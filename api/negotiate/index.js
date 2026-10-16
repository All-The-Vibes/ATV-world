/**
 * /api/negotiate: hands a browser a short-lived WebSocket URL for the multiplayer hub (Azure Web PubSub).
 *
 * GET /api/negotiate?id=<random browser id>  ->  { url } (good for an hour), or { url: null } when multiplayer is off.
 *
 * There are no accounts: the browser's own random id is the identity. The token only lets that connection join and
 * talk in the one "world" group. Needs the WPS_ENDPOINT (host name) and WPS_ACCESS_KEY app settings; without them
 * multiplayer is off and the game plays solo. The token is signed by hand (HS256), so this needs no packages.
 */
const crypto = require('node:crypto');

const HUB = 'atv';
const GROUP = 'world';
const TTL_S = 15 * 60;
const LIMIT = 30;
const WINDOW_MS = 60_000;
const hits = new Map();

// A per-instance cap on tokens per caller, so one client can't mint endless connections.
function limited(ip) {
    const now = Date.now();
    if (hits.size > 5000) hits.clear();
    const entry = hits.get(ip);
    if (!entry || now - entry.at > WINDOW_MS) {
        hits.set(ip, { at: now, n: 1 });
        return false;
    }
    entry.n += 1;
    return entry.n > LIMIT;
}

const reply = (status, body) => ({
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
});

const b64 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

module.exports = async function (context, req) {
    const host = process.env.WPS_ENDPOINT;
    const key = process.env.WPS_ACCESS_KEY;
    if (!host || !key) {
        context.res = reply(200, { url: null });
        return;
    }
    const ip = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-azure-clientip'])) || 'unknown').split(',')[0].trim();
    if (limited(ip)) {
        context.res = reply(429, { error: 'slow down' });
        return;
    }
    const id = String((req.query && req.query.id) || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    if (id.length < 8) {
        context.res = reply(400, { error: 'id required' });
        return;
    }
    const now = Math.floor(Date.now() / 1000);
    const audience = `https://${host}/client/hubs/${HUB}`;
    const head = b64({ alg: 'HS256', typ: 'JWT' });
    const body = b64({
        aud: audience,
        iat: now,
        exp: now + TTL_S,
        sub: id,
        role: [`webpubsub.joinLeaveGroup.${GROUP}`, `webpubsub.sendToGroup.${GROUP}`],
    });
    const sig = crypto.createHmac('sha256', key).update(`${head}.${body}`).digest('base64url');
    context.res = reply(200, { url: `wss://${host}/client/hubs/${HUB}?access_token=${head}.${body}.${sig}` });
};
