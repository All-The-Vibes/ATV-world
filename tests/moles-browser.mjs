import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5189/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5189', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
let browser;

try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
        try {
            ready = (await fetch(origin)).ok;
        } catch { /* The child server is still starting. */ }
        if (ready) break;
        await sleep(200);
    }
    assert.ok(ready, 'local Vite server is responsive');
    try {
        browser = await chromium.launch({ channel: 'msedge' });
    } catch {
        browser = await chromium.launch();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('[ATV]')) errors.push(message.text());
    });
    await page.goto(origin);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.talkingMoles);
    if (process.env.MOLE_SCREENSHOT) {
        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.talkingMoles.clock = 3;
            scene.view.trackPlayer();
            scene.view.show({ x: -360, y: -15, width: 150, height: 140 });
        });
        await sleep(200);
        await page.screenshot({ path: process.env.MOLE_SCREENSHOT });
    }
    const result = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.game.loop.sleep();
        const moles = scene.talkingMoles;
        const whackAMolePreserved = scene.moles?.holes.length === 9;
        moles.clock = 0;
        moles.update(0);
        const initial = moles.burrows.every((b) => !b.bubble.visible);
        scene.update(0, 1000 / 60);
        const wired = moles.clock > 0;
        moles.clock = 0;
        moles.update(0);
        const states = moles.burrows.map(() => ({
            rising: false, speaking: false, sinking: false, hiddenAfterSpeech: false, cleared: false,
            talkFrames: 0, lastFrame: 0, lastTalking: false, lastVisible: false,
        }));
        const quips = new Set();
        let ordered = true, oneSpeaker = true, grounded = true, longestSpeech = 0;
        for (let frame = 0; frame < 90 * 60; frame++) {
            moles.update(1 / 60);
            oneSpeaker &&= moles.burrows.filter((b) => b.bubble.visible).length <= 1;
            moles.burrows.forEach((b, i) => {
                const state = states[i];
                const lift = Number(b.mole.frame.name);
                grounded &&= scene.worldBounds.contains(b.mole.x, b.mole.y)
                    && !scene.solids.some((r) => r.contains(b.mole.x, b.mole.y));
                state.rising ||= b.mole.visible && lift > 0 && lift < 24 && lift > state.lastFrame;
                state.sinking ||= state.speaking && b.mole.visible && lift < state.lastFrame;
                if (b.bubble.visible) {
                    ordered &&= b.mole.visible && lift === 24;
                    state.speaking = true;
                    state.talkFrames++;
                    quips.add(b.bubble.texture.key);
                } else if (state.lastTalking) {
                    ordered &&= state.talkFrames >= 329 && state.talkFrames <= 331;
                    longestSpeech = Math.max(longestSpeech, state.talkFrames / 60);
                    state.talkFrames = 0;
                }
                if (!b.mole.visible && state.lastVisible) {
                    ordered &&= state.speaking && state.sinking && !b.bubble.visible;
                    state.hiddenAfterSpeech = true;
                }
                state.cleared ||= state.hiddenAfterSpeech && !b.hole.visible && !b.rim.visible;
                state.lastFrame = lift;
                state.lastTalking = b.bubble.visible;
                state.lastVisible = b.mole.visible;
            });
        }
        const countBefore = scene.children.length;
        moles.destroy();
        const removed = countBefore - scene.children.length;
        return { initial, wired, states, ordered, oneSpeaker, grounded, longestSpeech, quips: [...quips], removed, whackAMolePreserved };
    });
    assert.ok(result.initial && result.wired, 'no early speech; Preview updates the moles');
    assert.ok(result.whackAMolePreserved, 'the existing nine-hole Whack-a-Mole game is preserved');
    assert.equal(result.states.length, 3);
    assert.ok(result.states.every((s) => s.rising && s.speaking && s.sinking && s.hiddenAfterSpeech && s.cleared),
        'every mole emerges, speaks, burrows, and disappears');
    assert.ok(result.ordered, 'speech is shown only above ground for 5.5 seconds, before disappearing');
    assert.ok(result.oneSpeaker, 'staggered moles do not overlap their speech bubbles');
    assert.ok(result.grounded, 'burrows stay in the world and off buildings and the pool');
    assert.equal(result.quips.length, 8, 'all eight AI jokes rotate naturally');
    assert.equal(result.removed, 12, 'cleanup removes all mole images and bubbles');
    assert.deepEqual(errors, [], 'no game errors');
    console.log('Moles: emergence, readable speech, burrowing, joke rotation, placement, integration and cleanup passed.');
} finally {
    await browser?.close();
    server.kill();
}
