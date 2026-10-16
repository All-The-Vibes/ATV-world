const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const modulePath = require.resolve('../api/hq/index.js');
const originalKey = process.env.HQ_PUBLISH_KEY;
const originalMeeting = process.env.HQ_MEETING_ID;
const originalNow = Date.now;

let hq;

before(() => {
    process.env.HQ_PUBLISH_KEY = 'test-secret';
    delete process.env.HQ_MEETING_ID;
    Date.now = () => 1_700_000_000_000;
    delete require.cache[modulePath];
    hq = require(modulePath);
});

after(() => {
    Date.now = originalNow;
    if (originalKey === undefined) delete process.env.HQ_PUBLISH_KEY;
    else process.env.HQ_PUBLISH_KEY = originalKey;
    if (originalMeeting === undefined) delete process.env.HQ_MEETING_ID;
    else process.env.HQ_MEETING_ID = originalMeeting;
    delete require.cache[modulePath];
});

async function request({ method = 'GET', action = '', body, headers = {} } = {}) {
    const context = {};
    await hq(context, { method, body, headers, params: action ? { action } : {} });
    return { status: context.res.status, body: JSON.parse(context.res.body) };
}

async function tokenFor(meeting = 'meeting-1') {
    const response = await request({
        method: 'POST',
        action: 'token',
        headers: { 'x-hq-key': 'test-secret' },
        body: { meeting },
    });
    assert.equal(response.status, 200);
    return response.body.token;
}

test('the HQ API enforces its route and method contract', async () => {
    assert.equal((await request({ action: 'token' })).status, 404);
    assert.equal((await request({ method: 'PUT' })).status, 405);
    assert.equal((await request({ method: 'POST', action: 'unknown' })).status, 404);
});

test('meetings must be bounded non-empty strings', async () => {
    for (const meeting of [42, {}, '   ', 'x'.repeat(513)]) {
        const response = await request({
            method: 'POST',
            action: 'token',
            headers: { 'x-hq-key': 'test-secret' },
            body: { meeting },
        });
        assert.equal(response.status, 400);
    }
});

test('publish tokens reject extra fields and publishes require a roster', async () => {
    const token = await tokenFor();
    const invalid = await request({
        method: 'POST',
        headers: { 'x-hq-token': `${token}.junk` },
        body: { meeting: 'meeting-1', people: [] },
    });
    assert.equal(invalid.status, 403);

    const missing = await request({
        method: 'POST',
        headers: { 'x-hq-token': token },
        body: { meeting: 'meeting-1' },
    });
    assert.equal(missing.status, 400);

    const valid = await request({
        method: 'POST',
        headers: { 'x-hq-token': token },
        body: { meeting: 'meeting-1', people: [{ id: '1', name: 'Ada Lovelace' }] },
    });
    assert.deepEqual(valid, { status: 200, body: { ok: true, people: 1 } });
});
