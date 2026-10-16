/**
 * /api/hq: mirrors one Teams meeting into ATV HQ for everyone on the website.
 *
 * GET  /api/hq        Who's on the meeting HQ follows: { configured, known, live, people: [{ id, name }], updated }.
 *                     `known` is false when this instance hasn't heard from the meeting yet: visitors keep what
 *                     they have (for a while) and ask again.
 * POST /api/hq/token  { meeting } with an x-hq-key header matching the HQ_PUBLISH_KEY app setting. Returns a
 *                     publish token for that one meeting, good for two weeks. ATV World's Teams setup page asks
 *                     for it, so the secret itself never lands in a URL.
 * POST /api/hq        { meeting, people } with an x-hq-token header: ATV World in that meeting saying who's here.
 *
 * Tokens are signed with HQ_PUBLISH_KEY (rotate it to revoke them all), so any instance can check them without
 * shared state. HQ_MEETING_ID (optional) pins the one meeting allowed; otherwise a meeting keeps HQ until it has
 * been quiet for two minutes. Nothing is stored: the meeting re-posts every few seconds, and HQ empties when it
 * ends. Without HQ_PUBLISH_KEY, the mirror is off.
 */
const crypto = require('node:crypto');

/** No word from the meeting for this long: it's over. */
const STALE_MS = 45_000;
/** Another meeting can take HQ once the current one has been quiet this long. */
const HOLD_MS = 120_000;
const TOKEN_MS = 14 * 24 * 60 * 60 * 1000;
/** Calls run 40-50 people. */
const MAX_PEOPLE = 80;

/** @type {{ meeting: string, people: { id: string, name: string }[], updated: number } | null} */
let state = null;

const reply = (status, body) => ({
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
});

const digest = (text) => crypto.createHash('sha256').update(String(text)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));
const sign = (key, meeting, expires) => crypto.createHmac('sha256', key).update(`${meeting}\n${expires}`).digest('base64url');

function tokenFor(key, meeting, now) {
    const expires = now + TOKEN_MS;
    return { token: `${expires}.${sign(key, meeting, expires)}`, expires };
}

function tokenOk(key, meeting, token, now) {
    const [exp, sig] = String(token).split('.');
    const expires = Number(exp);
    return Number.isFinite(expires) && expires > now && !!sig && same(sig, sign(key, meeting, expires));
}

/**
 * The website only ever shows first names and an initial: "Ada Lovelace" and "Lovelace, Ada" both become
 * "Ada L.". Anything that looks like an email, a link, an ID, or a phone number becomes "Guest".
 */
function publicName(name) {
    let text = String(name).replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/@|https?:|www\.|\d{3,}|^[0-9a-f-]{16,}$/i.test(text)) return 'Guest';
    const comma = text.indexOf(',');
    if (comma > 0) text = `${text.slice(comma + 1)} ${text.slice(0, comma)}`.trim();
    const words = text.split(' ').filter(Boolean);
    if (!words.length) return '';
    const first = words[0].slice(0, 24);
    return words.length > 1 ? `${first} ${words[words.length - 1][0].toUpperCase()}.` : first;
}

const header = (req, name) => {
    const headers = req.headers || {};
    const hit = Object.keys(headers).find((k) => k.toLowerCase() === name);
    return hit ? String(headers[hit]) : '';
};

module.exports = async function (context, req) {
    const key = process.env.HQ_PUBLISH_KEY || '';
    const now = Date.now();
    const action = (req.params && req.params.action) || '';

    if ((req.method || 'GET').toUpperCase() === 'GET') {
        const live = !!state && now - state.updated < STALE_MS;
        context.res = reply(200, {
            configured: !!key,
            known: !!state,
            live,
            people: live ? state.people : [],
            updated: state ? state.updated : null,
        });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const meeting = String(body.meeting || '').slice(0, 512);
    if (!key) {
        context.res = reply(403, { error: 'The website mirror is off.' });
        return;
    }
    if (!meeting) {
        context.res = reply(400, { error: 'Missing meeting.' });
        return;
    }

    if (action === 'token') {
        if (!same(header(req, 'x-hq-key'), key)) {
            context.res = reply(403, { error: "That isn't the website mirror key." });
            return;
        }
        context.res = reply(200, tokenFor(key, meeting, now));
        return;
    }
    if (action) {
        context.res = reply(404, { error: 'No such thing.' });
        return;
    }

    if (!tokenOk(key, meeting, header(req, 'x-hq-token'), now)) {
        context.res = reply(403, { error: 'Missing, expired, or wrong publish token.' });
        return;
    }
    const pinned = process.env.HQ_MEETING_ID;
    const taken = pinned ? meeting !== pinned : !!state && state.meeting !== meeting && now - state.updated < HOLD_MS;
    if (taken) {
        context.res = reply(409, { error: 'ATV HQ is following a different meeting.' });
        return;
    }
    const seen = new Set();
    const people = (Array.isArray(body.people) ? body.people : [])
        .slice(0, MAX_PEOPLE)
        .map((p) => ({ id: String((p && p.id) || '').slice(0, 64), name: publicName((p && p.name) || '') }))
        .filter((p) => p.id && p.name && !seen.has(p.id) && seen.add(p.id));
    state = { meeting, people, updated: now };
    context.res = reply(200, { ok: true, people: people.length });
};

module.exports.publicName = publicName;
