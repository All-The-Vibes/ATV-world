// Two players in two real pages: world chat reaches everyone, nearby (proximity) chat only reaches people close by.
// Web PubSub is faked: each page's socket hands messages to this script, which relays them to the other pages.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = 5247;
const ORIGIN = `http://127.0.0.1:${PORT}/`;

const probe = createServer();
await new Promise((resolve, reject) => probe.once('error', reject).listen(PORT, '127.0.0.1', resolve));
await new Promise(resolve => probe.close(resolve));
const server = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createServer } from 'vite';
    import { realpathSync } from 'node:fs';
    const server = await createServer({ server: {
        host: '127.0.0.1', port: ${PORT}, strictPort: true,
        fs: { allow: [process.cwd(), realpathSync('node_modules')] },
    } });
    await server.listen();
`], { stdio: 'ignore' });

const fakeHub = (name) => {
    localStorage.setItem('atv-world-name', name);
    class FakeSocket {
        static OPEN = 1;
        readyState = 0;
        constructor() {
            window.__deliver = (data) => this.onmessage?.({ data: JSON.stringify({ type: 'message', data }) });
            setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 20);
        }
        send(raw) {
            const m = JSON.parse(raw);
            if (m.type === 'sendToGroup') window.__relay(m.data);
        }
        close() {
            this.readyState = 3;
            this.onclose?.();
        }
    }
    window.WebSocket = FakeSocket;
};

let browser;
try {
    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) {
        if (server.exitCode !== null) throw new Error(`Vite exited: ${server.exitCode}`);
        try { ready = (await fetch(ORIGIN)).ok; } catch { /* starting */ }
        if (!ready) await sleep(200);
    }
    assert.ok(ready, 'isolated Vite server starts');
    try { browser = await chromium.launch({ channel: 'msedge' }); }
    catch { browser = await chromium.launch(); }
    const pages = [];
    // Separate contexts, so neither page counts as a hidden background tab.
    const open = async (name) => {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await context.route('**/api/negotiate**', (route) => route.fulfill({ contentType: 'application/json', body: '{"url":"wss://fake/hub"}' }));
        const page = await context.newPage();
        pages.push(page);
        await page.exposeFunction('__relay', (data) => {
            for (const other of pages) if (other !== page) other.evaluate((d) => window.__deliver?.(d), data).catch(() => {});
        });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript(fakeHub, name);
        await page.goto(ORIGIN);
        await page.waitForFunction(() => window.atv?.game.scene.getScene('Preview')?.player, null, { timeout: 30_000 });
        return { page, errors };
    };
    const a = await open('Ana');
    const b = await open('Ben');
    await a.page.waitForFunction(() => window.atv.game.scene.getScene('Preview').multiplayer.count() === 1, null, { timeout: 15_000 });
    await b.page.waitForFunction(() => window.atv.game.scene.getScene('Preview').multiplayer.count() === 1, null, { timeout: 15_000 });

    const place = (page, dx) => page.evaluate((dx) => {
        const s = window.atv.game.scene.getScene('Preview').player.sprite;
        const home = window.__home ??= { x: s.x, y: s.y };
        s.setPosition(home.x + dx, home.y);
    }, dx);
    await place(a.page, 0);
    await place(b.page, 40);
    await sleep(400);

    const say = async (page, text, nearby = false) => {
        await sleep(800);
        await page.keyboard.press('Enter');
        const input = page.locator('.chat-form input');
        await input.waitFor();
        const channel = page.locator('.chat-channel');
        if ((await channel.textContent()) !== (nearby ? 'NEARBY' : 'WORLD')) await page.keyboard.press('Tab');
        assert.equal(await channel.textContent(), nearby ? 'NEARBY' : 'WORLD');
        await input.fill(text);
        await page.keyboard.press('Enter');
        await input.waitFor({ state: 'detached' });
    };
    const heard = (page, text) => page.locator('.chat-line', { hasText: text }).count();

    // Typing in the chat box doesn't walk the player around.
    const before = await a.page.evaluate(() => window.atv.game.scene.getScene('Preview').player.sprite.x);
    await a.page.keyboard.press('Enter');
    await a.page.keyboard.down('ArrowRight');
    await sleep(300);
    await a.page.keyboard.up('ArrowRight');
    await a.page.keyboard.press('Escape');
    assert.equal(await a.page.evaluate(() => window.atv.game.scene.getScene('Preview').player.sprite.x), before, 'arrow keys stay in the chat box');

    await say(a.page, 'hello world');
    await b.page.locator('.chat-line', { hasText: 'hello world' }).waitFor({ timeout: 5000 });
    assert.equal(await heard(a.page, 'hello world'), 1, 'Ana sees her own line');
    assert.equal(await b.page.evaluate(() => window.atv.game.scene.getScene('Preview').multiplayer.bubbles.length), 1, 'a bubble pops over Ana for Ben');

    if (process.env.CHAT_SHOTS) {
        await b.page.screenshot({ path: `${process.env.CHAT_SHOTS}/closed.png` });
        await b.page.keyboard.press('Enter');
        await b.page.locator('.chat-form input').fill('typing a reply');
        await b.page.screenshot({ path: `${process.env.CHAT_SHOTS}/open.png` });
        await b.page.keyboard.press('Escape');
    }

    await say(a.page, 'psst up close', true);
    await b.page.locator('.chat-line[data-channel="nearby"]', { hasText: 'psst up close' }).waitFor({ timeout: 5000 });

    await place(b.page, 900);
    await sleep(500);
    await say(a.page, 'too far to hear', true);
    await say(a.page, 'everyone hears this');
    await b.page.locator('.chat-line', { hasText: 'everyone hears this' }).waitFor({ timeout: 5000 });
    assert.equal(await heard(b.page, 'too far to hear'), 0, 'nearby chat stays nearby');
    assert.equal(await heard(a.page, 'too far to hear'), 1, 'the speaker still sees their nearby line');

    assert.deepEqual([...a.errors, ...b.errors], [], 'no page errors');
    console.log('chat: world and nearby chat work');
} finally {
    await browser?.close();
    server.kill();
}
