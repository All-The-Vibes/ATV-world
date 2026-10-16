import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = process.env.ATV_TEST_URL ?? 'http://127.0.0.1:5188/';
let server;
let browser;
try {
    if (!process.env.ATV_TEST_URL) {
        server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5188', '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe' });
        let output = '';
        server.stdout.on('data', chunk => { output += chunk; });
        server.stderr.on('data', chunk => { output += chunk; });
        let ready = false;
        for (let i = 0; i < 100; i++) {
            await sleep(200);
            assert.equal(server.exitCode, null, 'the test must not reuse another server');
            if (output.includes(origin)) { ready = true; break; }
        }
        assert.ok(ready, `our Vite server must report that it is listening: ${output}`);
    }
    try { browser = await chromium.launch({ channel: 'msedge' }); }
    catch { browser = await chromium.launch(); }
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(origin);
    await page.waitForFunction(() => window.atv?.game.scene.getScene('Preview')?.children.getByName('Steph'), undefined, { timeout: 20000 });
    const state = () => page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const steph = scene.children.getByName('Steph');
        const label = scene.children.getByName('Steph-label');
        return { x: steph.x, y: steph.y, frame: steph.frame.name, flip: steph.flipX,
            playing: steph.anims.isPlaying, frames: steph.anims.currentAnim.frames.length,
            label: label.texture.key, labelX: label.x, labelY: label.y,
            count: scene.children.list.filter(child => child.name === 'Steph').length };
    });
    const first = await state();
    assert.equal(first.count, 1);
    assert.equal(first.label, 'steph-label');
    assert.equal(first.frames, 4);
    assert.equal(first.playing, true);
    const seen = new Set([first.frame]);
    for (let i = 0; i < 8; i++) { await sleep(100); seen.add((await state()).frame); }
    const walking = await state();
    assert.ok(walking.x > first.x + 8, 'Steph walks without keyboard input');
    assert.ok(seen.size > 1, 'her walk animation changes poses');
    assert.equal(walking.labelX, walking.x, 'her name follows her');
    assert.ok(walking.labelY < walking.y - 30);

    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.burnables().find(target => target.sprite.name === 'Steph').hold(0.5);
    });
    await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').children.getByName('Steph').frame.name === 'side-0');
    const resting = await state();
    await sleep(100);
    assert.equal((await state()).x, resting.x, 'the dragon reaction pauses her in a valid standing pose');
    await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').children.getByName('Steph').anims.isPlaying);

    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.children.getByName('Steph').x = Math.min(scene.worldBounds.right, scene.town?.bounds().left ?? Infinity) - 25;
    });
    await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').children.getByName('Steph').flipX);
    const turned = await state();
    await sleep(250);
    assert.ok((await state()).x < turned.x, 'she turns and walks back at the edge');
    const playerX = await page.evaluate(() => window.atv.game.scene.getScene('Preview').player.sprite.x);
    await page.keyboard.down('ArrowRight');
    await sleep(250);
    await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate(x => window.atv.game.scene.getScene('Preview').player.sprite.x > x, playerX), 'the existing player still moves');

    const interaction = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const steph = scene.children.getByName('Steph');
        const target = scene.burnables().find(target => target.sprite === steph);
        scene.dragon.burn(target);
        const burn = scene.dragon.burns.get(steph);
        const hairOffset = steph.y - burn.hair.y;
        scene.dragon.endBurn(burn);
        const visitor = scene.kittens.visitors.find(visitor => visitor.person.sprite === steph);
        visitor.stage = 'return';
        visitor.homeY = steph.y + 40;
        visitor.timer = 2;
        scene.kittens.update(0);
        return { hairOffset, labelOffset: steph.y - visitor.person.label.y,
            bubbleOffset: steph.y - visitor.bubble.y };
    });
    assert.equal(interaction.hairOffset, 41, 'dragon hair fire stays on her head');
    assert.equal(interaction.labelOffset, 48, 'kitten visits keep her name above her head');
    assert.equal(interaction.bubbleOffset, 51, 'kitten speech clears her taller body');

    mkdirSync('smoke-artifacts', { recursive: true });
    await page.reload();
    await page.waitForFunction(() => window.atv?.game.scene.getScene('Preview')?.children.getByName('Steph'));
    await page.keyboard.press('f');
    await sleep(300);
    await page.screenshot({ path: 'smoke-artifacts/steph-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('f');
    await sleep(300);
    await page.screenshot({ path: 'smoke-artifacts/steph-mobile.png' });
    assert.equal((await state()).count, 1, 'reload creates exactly one Steph');
    assert.deepEqual(errors, [], 'no browser errors');
    console.log('PASS: Steph loads, animates, walks, turns, rests for the dragon, keeps her label, and preserves player controls; desktop/mobile captured.');
} finally {
    await browser?.close();
    server?.kill();
}
