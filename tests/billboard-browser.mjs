import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5187/';
const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', '--port', '5187', '--strictPort', '--host', '127.0.0.1',
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
            if (error.cause?.code !== 'ECONNREFUSED') throw error;
        }
        if (ready) break;
        await sleep(200);
    }
    assert.ok(ready, `Vite did not become ready: ${output}`);
    try {
        browser = await chromium.launch({ channel: 'msedge' });
    } catch {
        browser = await chromium.launch();
    }
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('[ATV]')) errors.push(message.text());
    });
    await page.goto(origin);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.billboard);

    const result = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const b = scene.billboard;
        if (!b) return null;

        const initialAd = b.currentAd;
        const initialIndex = b.adIndex;

        // Verify collision footprint is in solids
        const solidMatch = scene.solids.some(s => s.x === b.bounds().x && s.y === b.bounds().y);

        // Click / rotate to next ad
        b.rotateAd(true);
        const quipVisible = b.quipBubble.visible;
        const quipKey = b.quipBubble.texture.key;

        return {
            initialIndex,
            initialAd,
            quipVisible,
            quipKey,
            solidMatch,
        };
    });

    assert.ok(result, 'billboard exists in scene');
    assert.equal(result.initialIndex, 0, 'starts on first ad');
    assert.equal(result.initialAd.id, 'vibe-insurance', 'first ad is Vibe Insurance');
    assert.ok(result.quipVisible, 'speech bubble quip appears on manual click');
    assert.ok(result.solidMatch, 'footing bounds are registered in solids');

    // Wait for the transition tween (80ms)
    await sleep(250);

    const rotated = await page.evaluate(() => {
        const b = window.atv.game.scene.getScene('Preview').billboard;
        return {
            index: b.adIndex,
            ad: b.currentAd,
        };
    });

    assert.equal(rotated.index, 1, 'manual rotation advances ad to index 1');
    assert.equal(rotated.ad.id, 'prompt-o-matic', 'second ad is Prompt-O-Matic');

    // Wait for auto rotation by setting adTimer
    await page.evaluate(() => {
        const b = window.atv.game.scene.getScene('Preview').billboard;
        b.adTimer = 5.6;
        b.update(0.1);
    });
    await sleep(250);

    const autoRotated = await page.evaluate(() => {
        const b = window.atv.game.scene.getScene('Preview').billboard;
        return { index: b.adIndex, ad: b.currentAd };
    });
    assert.equal(autoRotated.index, 2, 'auto timer rotates to next ad');
    assert.deepEqual(errors, [], 'no runtime game errors');

    console.log('Digital AI Billboard: ad rotation, click interaction, quip bubbles, and solids test passed.');
} finally {
    await browser?.close();
    server.kill();
}
