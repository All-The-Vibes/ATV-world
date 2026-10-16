import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5191/';
const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', '--port', '5191', '--strictPort', '--host', '127.0.0.1',
], { stdio: 'pipe' });
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
let browser;
try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
        if (server.exitCode !== null) throw new Error(`Vite exited: ${output}`);
        try {
            ready = (await fetch(origin)).ok;
        } catch (error) {
            if (!['ECONNREFUSED', 'ECONNRESET'].includes(error.cause?.code)) throw error;
        }
        if (ready) break;
        await sleep(200);
    }
    assert.ok(ready, `Vite did not become ready: ${output}`);
    browser = await chromium.launch({ channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let state = 'green';
    let message = 'MAIN IS HEALTHY';
    await page.route('**/api/health', route => route.fulfill({
        status: state === 'unknown' ? 503 : 200,
        contentType: 'application/json',
        body: JSON.stringify({ state, message }),
    }));
    for (const [color, text] of [
        ['green', 'MAIN IS HEALTHY'], ['yellow', 'CHECKS FAILING'],
        ['red', 'MAIN IS BROKEN'], ['unknown', 'CI UNAVAILABLE'],
    ]) {
        state = color;
        message = text;
        await page.goto(origin);
        await page.waitForFunction(({ color, text }) => {
            const scene = window.atv?.game?.scene.getScene('Preview');
            const children = scene?.children?.list ?? [];
            return children.some(child => child.texture?.key === `ci-light-${color}`) &&
                children.some(child => child.texture?.key === `ci-label-${text}`);
        }, { color, text });
    }
    const opened = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const sprite = scene.children.list.find(child => child.texture?.key === 'ci-light-unknown');
        const calls = [];
        window.open = (...args) => { calls.push(args); return null; };
        sprite.emit('pointerdown');
        const bounds = sprite.getBounds();
        return { calls, width: bounds.width, height: bounds.height, x: sprite.x, y: sprite.y };
    });
    assert.equal(opened.width, 76);
    assert.equal(opened.height, 140);
    assert.equal(opened.x, 60);
    assert.equal(opened.y, 170);
    assert.equal(opened.calls[0][0], 'https://github.com/All-The-Vibes/ATV-world/actions');
    assert.equal(opened.calls[0][2], 'noopener,noreferrer');
    assert.deepEqual(errors, [], 'No runtime errors');
    console.log('Traffic light: all colors, unavailable state, giant plaza art, and Actions link passed.');
} finally {
    await browser?.close();
    server.kill();
}
