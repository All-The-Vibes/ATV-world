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
            playing: duck.anims.isPlaying, text: bubble.getData('text'), kind: bubble.getData('kind'), visible: bubble.visible,
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
    // Frames can be slow in headless browsers, so wait for movement rather than assuming a rate.
    await page.waitForFunction(x => Math.abs(window.atv.game.scene.getScene('Preview')
        .children.getByName('Rubber Duck').x - x) > 15, first.x, { timeout: 30000 });
    for (let i = 0; i < 12; i++) { await sleep(150); frames.add((await state()).frame); }
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
    }, undefined, { timeout: 60000 });
    const lines = [{ text: "Hi I'm Rubber Duck", kind: 'review' }, { text: (await state()).text, kind: 'review' }];
    await page.evaluate(() => {
        window.atv.game.scene.getScene('Preview').view.show({ x: -250, y: -20, width: 500, height: 230 });
    });
    await sleep(100);
    const point = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const rd = scene.rubberDuck;
        while (rd.zap) rd.update(0.1);
        rd.lineTime = 0;
        rd.strikeClock = 0;
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
        .getByName('Rubber Duck-speech').getData('kind') === 'more');
    const clicked = await state();
    lines.push({ text: clicked.text, kind: 'more' });
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').scene.pause());
    for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
            window.atv.game.scene.getScene('Preview').children.getByName('Rubber Duck').emit('pointerdown');
        });
        const current = await state();
        assert.ok(current.visible, 'clicking reveals the next line immediately');
        lines.push({ text: current.text, kind: current.kind });
    }
    assert.equal(lines[0].text, "Hi I'm Rubber Duck");
    assert.equal(lines[1].text, 'May I review your code, please?');
    assert.match(lines[2].text, /days off I play tennis/);
    lines.forEach((line, i) => assert.equal(line.kind, i % 3 === 2 ? 'more' : 'review', `comment ${i + 1} is ${i % 3 === 2 ? 'a witty extra' : 'a review offer'}`));
    assert.equal(new Set(lines.map(line => line.text)).size, lines.length, 'the duck does not repeat itself within twelve comments');
    assert.ok(lines.filter(line => line.kind === 'review').every(line => !/days off|tennis/.test(line.text)));
    const patrol = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const rd = scene.rubberDuck;
        const duck = scene.children.getByName('Rubber Duck');
        while (rd.zap) rd.update(0.1);
        rd.strikeClock = -1e9;
        const directions = new Set();
        const positions = [];
        for (let i = 0; i < 300; i++) {
            rd.update(0.1);
            directions.add(duck.flipX);
            positions.push({ x: duck.x, y: duck.y });
        }
        return { directions: directions.size, positions, home: { ...rd.home } };
    });
    assert.equal(patrol.directions, 2, 'the duck faces both directions as it rounds its patch');
    assert.ok(patrol.positions.every(({ x, y }) => Math.abs(x - patrol.home.x) <= 71 && Math.abs(y - patrol.home.y) <= 17));

    const strike = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const rd = scene.rubberDuck;
        const duck = scene.children.getByName('Rubber Duck');
        const from = { x: duck.x, y: duck.y };
        rd.strikeClock = 7.97;
        rd.update(0.05);
        const struck = { zapping: !!rd.zap, bolts: rd.effects.length };
        const held = { x: duck.x, y: duck.y };
        rd.update(0.05);
        struck.frozen = !!rd.zap && duck.x === held.x && duck.y === held.y;
        let updates = 0;
        while (rd.zap && updates++ < 20) rd.update(0.05);
        const to = { x: duck.x, y: duck.y };
        const landed = { bolts: rd.effects.length, alpha: duck.alpha };
        for (let i = 0; i < 5; i++) rd.update(0.1);
        const b = scene.worldBounds;
        return {
            struck, landed, from, to, left: rd.effects.length, centre: { x: b.centerX, y: b.centerY },
            blocked: scene.solids.some(r => r.contains(to.x, to.y)) || !!scene.hq?.contains(to.x, to.y),
        };
    });
    assert.deepEqual(strike.struck, { zapping: true, bolts: 1, frozen: true }, 'lightning hits the duck, which holds still while it sizzles');
    assert.equal(strike.landed.bolts, 2, 'a second bolt marks where it lands');
    assert.equal(strike.landed.alpha, 1);
    assert.ok(Math.hypot(strike.to.x - strike.from.x, strike.to.y - strike.from.y) >= 90, 'the duck teleports somewhere new');
    assert.ok(Math.abs(strike.to.x - strike.centre.x) <= 200 && Math.abs(strike.to.y - strike.centre.y) <= 110, 'it lands in the middle of the map');
    assert.equal(strike.blocked, false, 'it never lands inside a building');
    assert.equal(strike.left, 0, 'the bolts fade away');

    const crowded = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const rd = scene.rubberDuck;
        const duck = scene.children.getByName('Rubber Duck');
        rd.strikeClock = -1e9;
        const spot = rd.quietSpot();
        const clutter = Array.from({ length: 16 }, (_, i) => scene.add.image(
            spot.x + ((i % 4) - 1.5) * 30, spot.y - Math.floor(i / 4) * 18, 'rubber-duck-review-0').setDepth(10));
        const busyBefore = rd.busyAt(spot.x, spot.y);
        const next = rd.quietSpot();
        const result = { busyBefore, busyNext: rd.busyAt(next.x, next.y), moved: next.x !== spot.x || next.y !== spot.y };
        clutter.forEach(image => image.destroy());
        duck.setAlpha(1);
        return result;
    });
    assert.ok(crowded.busyBefore >= 16, 'a crowd makes a spot busy');
    assert.ok(crowded.busyNext < crowded.busyBefore && crowded.moved, 'the duck picks a less busy spot than a crowded one');
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
