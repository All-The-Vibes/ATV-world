import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { stripVTControlCharacters } from 'node:util';
import { chromium } from 'playwright';

const origin = process.env.ATV_TEST_URL ?? 'http://127.0.0.1:5193/';
let server;
let browser;
try {
    if (!process.env.ATV_TEST_URL) {
        server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5193', '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe' });
        let output = '';
        server.stdout.on('data', chunk => { output += chunk; });
        server.stderr.on('data', chunk => { output += chunk; });
        let ready = false;
        for (let i = 0; i < 100; i++) {
            await sleep(200);
            assert.equal(server.exitCode, null, 'the test must not reuse another server');
            if (stripVTControlCharacters(output).includes(origin)) { ready = true; break; }
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
    await page.waitForFunction(() => window.atv?.game.scene.getScene('Preview')?.children.getByName('Rubber Duck'));
    const state = () => page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const duck = scene.children.getByName('Rubber Duck');
        const bubble = scene.children.getByName('Rubber Duck-speech');
        const shadow = scene.children.getByName('Rubber Duck-shadow');
        return {
            x: duck.x, y: duck.y, depth: duck.depth, flip: duck.flipX,
            width: duck.displayWidth, height: duck.displayHeight, frame: duck.frame.name,
            playing: duck.anims.isPlaying, text: bubble.getData('text'), visible: bubble.visible,
            bubbleX: bubble.x, bubbleY: bubble.y, shadowX: shadow.x, shadowY: shadow.y,
            count: scene.children.list.filter(child => child.name === 'Rubber Duck').length,
        };
    });
    const first = await state();
    assert.equal(first.count, 1);
    assert.equal(first.text, "Hi I'm Rubber Duck");
    assert.ok(first.visible && first.playing);
    assert.ok(first.width >= 64 && first.height >= 56, 'the duck is large, not a person-sized sprite');
    const art = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const duck = scene.children.getByName('Rubber Duck');
        const source = duck.texture.getSourceImage();
        const pixels = source.getContext('2d').getImageData(0, 0, duck.frame.width, duck.frame.height).data;
        let opaque = 0, yellow = 0, orange = 0, feet = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            if (!pixels[i + 3]) continue;
            opaque++;
            if (pixels[i] > 240 && pixels[i + 1] > 170 && pixels[i + 2] < 120) yellow++;
            if (pixels[i] === 236 && pixels[i + 1] === 122 && pixels[i + 2] === 58) {
                orange++;
                if (Math.floor(i / 4 / duck.frame.width) >= 57) feet++;
            }
        }
        return { opaque, yellow, orange, feet };
    });
    assert.ok(art.yellow / art.opaque > 0.65, 'most of the visible rubber duck is yellow');
    assert.ok(art.orange > 20, 'the duck has an orange bill');
    assert.ok(art.feet > 40, 'little orange legs and webbed feet extend below the body');
    const frames = new Set([first.frame]);
    for (let i = 0; i < 6; i++) { await sleep(150); frames.add((await state()).frame); }
    const walking = await state();
    assert.ok(Math.abs(walking.x - first.x) > 15, 'the duck wanders without input');
    assert.ok(frames.size > 1, 'the duck waddles through different poses');
    assert.equal(walking.depth, walking.y);
    assert.equal(walking.bubbleX, walking.x);
    assert.equal(walking.shadowX, walking.x);
    assert.equal(walking.shadowY, walking.y);
    assert.ok(walking.bubbleY < walking.y - walking.height);

    await page.waitForFunction(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        return scene.children.getByName('Rubber Duck-speech').getData('text') === 'May I review your code, please?';
    }, undefined, { timeout: 15000 });
    const lines = ["Hi I'm Rubber Duck", (await state()).text];
    await page.evaluate(() => {
        window.atv.game.scene.getScene('Preview').view.show({ x: -250, y: -20, width: 500, height: 230 });
    });
    await sleep(100);
    const point = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const duck = scene.children.getByName('Rubber Duck');
        const cam = scene.cameras.main;
        const canvas = scene.game.canvas;
        const bounds = canvas.getBoundingClientRect();
        return {
            x: bounds.left + (duck.x - cam.worldView.x) * cam.zoom * bounds.width / canvas.width,
            y: bounds.top + (duck.y - 30 - cam.worldView.y) * cam.zoom * bounds.height / canvas.height,
        };
    });
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').children
        .getByName('Rubber Duck-speech').getData('text') === 'Would you kindly walk me through your idea?');
    lines.push((await state()).text);
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').scene.pause());
    for (let i = 0; i < 4; i++) {
        await page.evaluate(() => {
            window.atv.game.scene.getScene('Preview').children.getByName('Rubber Duck').emit('pointerdown');
        });
        const current = await state();
        assert.ok(current.visible, 'clicking reveals the next line immediately');
        lines.push(current.text);
    }
    assert.deepEqual(lines, [
        "Hi I'm Rubber Duck",
        'May I review your code, please?',
        'Would you kindly walk me through your idea?',
        'May we check the edge cases together?',
        'If you like, I would be delighted to review your tests.',
        'Thank you for sharing. Take your time; I am happy to listen.',
        "Hi I'm Rubber Duck",
    ]);
    const patrol = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const duck = scene.children.getByName('Rubber Duck');
        const directions = new Set();
        const positions = [];
        for (let i = 0; i < 300; i++) {
            scene.rubberDuck.update(0.1);
            directions.add(duck.flipX);
            positions.push({ x: duck.x, y: duck.y });
        }
        return { directions: directions.size, positions };
    });
    assert.equal(patrol.directions, 2, 'the duck faces both directions as it rounds the plaza');
    assert.ok(patrol.positions.every(({ x, y }) => Math.abs(x) <= 180 && y >= 82 && y <= 130));
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').scene.resume());
    const playerX = await page.evaluate(() => window.atv.game.scene.getScene('Preview').player.sprite.x);
    await page.keyboard.down('ArrowRight');
    await sleep(250);
    await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate(x => window.atv.game.scene.getScene('Preview').player.sprite.x > x, playerX), 'player controls still work');

    await page.evaluate(() => window.atv.game.scene.stop('Preview'));
    await page.waitForFunction(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        return ['Rubber Duck', 'Rubber Duck-shadow', 'Rubber Duck-speech']
            .every(name => !scene.children.getByName(name));
    });
    await page.reload();
    await page.waitForFunction(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        return scene.children.getByName('Rubber Duck-speech')?.getData('text') === "Hi I'm Rubber Duck";
    });
    assert.equal((await state()).count, 1, 'reload creates exactly one duck');
    for (const name of ['Rubber Duck-shadow', 'Rubber Duck-speech']) {
        assert.equal(await page.evaluate(name => window.atv.game.scene.getScene('Preview').children.list.filter(child => child.name === name).length, name), 1);
    }
    assert.deepEqual(errors, [], 'no browser errors');
    console.log('PASS: Rubber Duck is large and yellow, waddles around the plaza, introduces itself, politely offers reviews, responds to real clicks, cleans up on shutdown, and reloads without duplicates.');
} finally {
    await browser?.close();
    server?.kill();
}
