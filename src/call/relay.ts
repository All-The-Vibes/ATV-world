/**
 * The website mirror: one Teams meeting fills ATV HQ for everyone on the site (see api/hq/index.js).
 *
 * On ATV World's Teams setup page, the organizer types the website mirror key once; the API trades it for a
 * publish token that only works for that meeting, and the tab keeps the token in its URL fragment (#hq=…),
 * which never reaches a server. In the meeting, one client posts who's here every few seconds. Everywhere
 * else, the site asks /api/hq every few seconds and seats whoever's there. Visitors only ever read.
 */
import { demoRunning } from './demo';
import { call } from './roster';

const API = './api/hq';
const POLL_MS = 5_000;
const PUBLISH_MS = 5_000;
/** If the mirror hasn't confirmed the meeting is live for this long, assume it's over (the API forgets on restarts). */
const FORGET_MS = 60_000;

interface Mirror {
    configured: boolean;
    known: boolean;
    live: boolean;
    people: { id: string; name: string }[];
    updated: number | null;
}

/**
 * The website only ever shows first names and an initial: "Ada Lovelace" and "Lovelace, Ada" both become
 * "Ada L.". Anything that looks like an email, a link, an ID, or a phone number becomes "Guest". The API
 * applies the same rule.
 */
export function publicName(name: string): string {
    let text = name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/@|https?:|www\.|\d{3,}|^[0-9a-f-]{16,}$/i.test(text)) return 'Guest';
    const comma = text.indexOf(',');
    if (comma > 0) text = `${text.slice(comma + 1)} ${text.slice(0, comma)}`.trim();
    const words = text.split(' ').filter(Boolean);
    if (!words.length) return '';
    const first = words[0].slice(0, 24);
    return words.length > 1 ? `${first} ${words[words.length - 1][0].toUpperCase()}.` : first;
}

/** The publish token this tab was set up with (kept in the URL fragment, so it never reaches a server). */
export const mirrorToken = () => new URLSearchParams(location.hash.slice(1)).get('hq')?.trim() ?? '';

/** Trade the website mirror key for a publish token that only works for `meeting`. */
export async function mintToken(key: string, meeting: string): Promise<string> {
    const res = await fetch(`${API}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hq-key': key },
        body: JSON.stringify({ meeting }),
    });
    if (res.status === 403) throw new Error("That isn't the website mirror key.");
    if (!res.ok) throw new Error(res.status === 404 ? "This site doesn't have the website mirror." : `The website mirror said ${res.status}.`);
    return ((await res.json()) as { token: string }).token;
}

/** Seat whoever's on the mirrored meeting, and keep up as they come and go. Stops by itself where there's no mirror. */
export function followMirror(): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let newest = -1;
    let misses = 0;
    let confirmed = 0;
    const stop = () => {
        stopped = true;
        clearTimeout(timer);
    };
    const seat = (people: Mirror['people']) => {
        const here = new Map(people.map((p) => [p.id, p.name]));
        // Status first: HQ seats a call's first wave straight away instead of walking them all in.
        if (here.size && call.status.kind === 'idle') call.setStatus({ kind: 'live', text: 'Live from the ATV meeting on Teams.' });
        for (const c of call.list()) if (c.source === 'relay' && !here.has(c.id)) call.leave(c.id);
        for (const [id, name] of here) call.join({ id, name, source: 'relay' });
        if (!here.size && call.status.kind === 'live') call.setStatus({ kind: 'idle' });
    };
    const tick = async () => {
        if (stopped) return;
        if (document.visibilityState === 'visible' && !demoRunning()) {
            try {
                const res = await fetch(`${API}?t=${Date.now()}`, { cache: 'no-store' });
                // No API on this host (or the mirror's off): HQ just fills from Teams, the demo, or the URL.
                if (res.status === 404 || (res.ok && !res.headers.get('content-type')?.includes('json'))) return stop();
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const mirror = (await res.json()) as Mirror;
                if (!mirror.configured) return stop();
                misses = 0;
                // An instance that hasn't heard from the meeting yet knows nothing: keep what we have, for now.
                if (mirror.known && (mirror.updated ?? 0) >= newest) {
                    newest = mirror.updated ?? 0;
                    if (mirror.live) confirmed = Date.now();
                    seat(mirror.live ? mirror.people : []);
                }
            } catch {
                misses++;
            }
            if (Date.now() - confirmed > FORGET_MS && call.list().some((c) => c.source === 'relay')) seat([]);
        }
        timer = setTimeout(tick, POLL_MS * 2 ** Math.min(misses, 3));
    };
    void tick();
    return stop;
}

/**
 * Inside the mirrored meeting: post who's here every few seconds, and right after anyone comes or goes.
 * Only the client `leader()` picks posts, since one per meeting is plenty. `report` hears about problems
 * (null once it's working).
 */
export function publishMirror(token: string, meeting: string, leader: () => boolean, report: (problem: string | null) => void): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sending = false;
    let last = '';
    let lastAt = 0;
    const post = async (again = false) => {
        if (stopped || sending || !leader()) return;
        const people = call.list().filter((c) => c.source === 'teams').map((c) => ({ id: c.id, name: publicName(c.name) }));
        const body = JSON.stringify({ meeting, people });
        if (!again && body === last && Date.now() - lastAt < PUBLISH_MS) return;
        sending = true;
        try {
            const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hq-token': token }, body });
            last = body;
            lastAt = Date.now();
            report(
                res.ok ? null
                : res.status === 403 ? 'The website mirror link has expired or was revoked. Add ATV World to the meeting again to renew it.'
                : res.status === 409 ? 'The website is showing a different meeting right now.'
                : res.status === 404 ? "This site doesn't have the website mirror."
                : `The website mirror is having trouble (HTTP ${res.status}).`,
            );
        } catch {
            report("Couldn't reach the website mirror. Trying again.");
        } finally {
            sending = false;
        }
    };
    const unsubscribe = call.subscribe(() => void post());
    const loop = () => {
        void post(true);
        timer = setTimeout(loop, PUBLISH_MS);
    };
    loop();
    return () => {
        stopped = true;
        clearTimeout(timer);
        unsubscribe();
    };
}
