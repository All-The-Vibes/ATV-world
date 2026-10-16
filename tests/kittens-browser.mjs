import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = 5188;
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.KITTEN_SCREENSHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
let browser;

try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
        try {
            ready = (await fetch(ORIGIN)).ok;
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('[ATV]')) errors.push(message.text());
    });
    await page.addInitScript(() => {
        let seed = 179;
        Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    await page.clock.install();
    await page.goto(ORIGIN);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.kittens?.cats.length === 8);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 200));
    await page.keyboard.press('f');
    await page.clock.runFor(100);

    const initial = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const k = scene.kittens;
        const view = scene.cameras.main.worldView;
        return {
            cats: k.cats.length, toys: k.toys.length,
            varieties: new Set(k.toys.map((toy) => toy.kind)).size,
            width: k.bounds.width, height: k.bounds.height,
            rendered: k.cats.every((cat) => cat.sprite.visible && cat.sprite.texture.getSourceImage().width > 0),
            includes: scene.worldBounds.contains(k.meadow.left, k.meadow.top)
                && scene.worldBounds.contains(k.meadow.right, k.meadow.bottom),
            fitted: view.contains(k.bounds.left, k.bounds.top) && view.contains(k.bounds.right, k.bounds.bottom),
            people: k.visitors.length,
        };
    });
    assert.equal(initial.cats, 8);
    assert.ok(initial.toys >= 18, 'lots of toys, not a token prop');
    assert.equal(initial.varieties, 6);
    assert.ok(initial.width >= 300 && initial.height >= 170, 'generously sized corral');
    assert.ok(initial.rendered && initial.includes && initial.fitted, 'real art and fit camera include the playground');
    assert.equal(initial.people, 6, 'existing townspeople can get distracted');
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'kittens-world.png') });
    const fitZoom = await page.evaluate(() => window.atv.game.scene.getScene('Preview').cameras.main.zoom);
    await page.getByTitle('Zoom in (+)', { exact: true }).click();
    await page.clock.runFor(100);
    assert.ok(await page.evaluate(() => window.atv.game.scene.getScene('Preview').cameras.main.zoom) > fitZoom);
    await page.getByTitle('Show the whole world (F)', { exact: true }).click();
    await page.clock.runFor(100);

    // Step the actual scene, not a fake behavioral model. Fixed deltas make long-lived antics cheap.
    const natural = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.game.loop.sleep();
        const k = scene.kittens;
        const seen = new Set();
        const conversations = new Set();
        let escaped = false, bored = false, carried = false, returned = false, bounded = true;
        const cargo = new Set();
        for (let frame = 0; frame < 90 * 60; frame++) {
            scene.update(frame * 1000 / 60, 1000 / 60);
            for (const cat of k.cats) {
                seen.add(cat.mood);
                escaped ||= !k.bounds.contains(cat.x, cat.y);
                bored ||= cat.bubble.visible && cat.bubble.texture.key.includes('BORED');
                if (cat.mood === 'carried') { carried = true; cargo.add(cat); }
                if (cargo.has(cat) && cat.mood !== 'carried' && k.bounds.contains(cat.x, cat.y)) returned = true;
                bounded &&= scene.worldBounds.contains(cat.x, cat.y) && Number.isFinite(cat.sprite.y);
            }
            for (const visitor of k.visitors) {
                if (visitor.stage === 'talk') {
                    conversations.add(visitor.bubble.texture.key);
                    if (visitor.cat?.bubble.visible) conversations.add(visitor.cat.bubble.texture.key);
                }
            }
        }
        return {
            seen: [...seen], escaped, bored, carried, returned, bounded,
            caught: k.catches, missed: k.misses, conversations: [...conversations],
            status: k.status.text,
        };
    });
    assert.ok(natural.seen.includes('play') && natural.seen.includes('escape') && natural.seen.includes('wander'));
    assert.ok(natural.bored && natural.escaped, 'bored kittens naturally leave the corral');
    assert.ok(natural.caught > 0 && natural.missed > 0, 'PM sometimes catches and sometimes misses');
    assert.ok(natural.carried && natural.returned, 'successful catches carry kittens home instead of teleporting');
    assert.ok(natural.bounded, 'kittens remain finite and inside the world');
    assert.ok(natural.conversations.some((line) => line.includes('GET BACK TO WORK')), 'people try to return to work');
    assert.ok(natural.conversations.some((line) => line.includes('ERR... MEOW, MEOW')), 'people relapse into meowing');
    assert.ok(natural.conversations.some((line) => line.includes('MEOW MEOW!')), 'kittens answer people');
    assert.match(natural.status, /8 KITTENS.*CAUGHT.*MISSED/);

    // A real dropped token lands through the existing tween pipeline.
    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.kittens.managerRest = 30;
        scene.dragon.sprite.setVisible(false);
        scene.tokens.drop(-215, 430, 480);
        scene.game.loop.wake();
    });
    await page.clock.runFor(2000);
    const coin = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.game.loop.sleep();
        const k = scene.kittens;
        const token = scene.tokens.tokens.find((token) => token.landed && k.meadow.contains(token.sprite.x, token.sprite.y));
        if (!token) throw new Error('No real landed token near the corral');
        const cat = k.cats[0];
        Object.assign(cat, { x: token.sprite.x - 20, y: token.sprite.y, mood: 'wander', cooldown: 0, timer: 6 });
        k.visitors.forEach((visitor) => { if (visitor.stage === 'idle') visitor.timer = 20; });
        const count = scene.tokens.count;
        let playing = false, jumping = false;
        for (let i = 0; i < 80; i++) {
            k.update(1 / 60);
            playing ||= cat.mood === 'coin';
            jumping ||= cat.y - cat.sprite.y > 10;
        }
        const preserved = scene.tokens.count === count && token.sprite.active;
        scene.player.sprite.setPosition(token.sprite.x, token.sprite.y).setVisible(true);
        scene.tokens.update(0, [{ sprite: scene.player.sprite, player: true }]);
        return { playing, jumping, preserved, collectible: scene.tokens.count === count - 1 };
    });
    assert.ok(coin.playing && coin.jumping, 'kittens visibly pounce on real dropped coins');
    assert.ok(coin.preserved && coin.collectible, 'coin play does not spend or hide the player collectible');

    const dragon = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const k = scene.kittens;
        const cat = k.cats[0];
        Object.assign(cat, { x: -245, y: 478, mood: 'wander', cooldown: 0, timer: 8 });
        Object.assign(scene.dragon, { x: -210, y: 478 });
        scene.dragon.sprite.setPosition(-210, 450).setVisible(true);
        k.managerRest = 30;
        const before = Math.hypot(cat.x + 210, cat.y - 478);
        let chasing = false, jumping = false;
        for (let i = 0; i < 90; i++) {
            k.update(1 / 60);
            chasing ||= cat.mood === 'dragon';
            jumping ||= cat.y - cat.sprite.y > 15;
        }
        const closer = Math.hypot(cat.x + 210, cat.y - 478) < before;
        const safe = !scene.burnables().some((target) => target.sprite === cat.sprite);
        cat.cooldown = 0;
        cat.mood = 'wander';
        scene.dragon.sprite.setVisible(false);
        k.update(1 / 60);
        const ignoresHidden = cat.mood !== 'dragon';
        Object.assign(scene.dragon, { x: 900, y: 900 });
        scene.dragon.sprite.setVisible(true);
        k.update(1 / 60);
        return { chasing, jumping, closer, safe, ignoresHidden, ignoresDistant: cat.mood !== 'dragon' };
    });
    assert.ok(dragon.chasing && dragon.closer && dragon.jumping, 'nearby visible dragon triggers a chase and jump');
    assert.ok(dragon.safe && dragon.ignoresHidden && dragon.ignoresDistant, 'kittens are not burned and cannot see distant/hidden dragons');

    // Let the actual renderer draw the simulated scene, then frame the playground.
    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.player.sprite.setPosition(0, 158);
        scene.view.show({ x: -430, y: 210, width: 440, height: 335 });
        scene.game.loop.wake();
    });
    await page.clock.runFor(100);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'kittens-playground.png') });
    assert.deepEqual(errors, [], 'no scene or browser errors');
    console.log('Kitten browser test passed: 8 kittens, 24 toys, escapes, PM catch/miss/carry, coin play, dragon pounces, and meowing conversations.');
} finally {
    await browser?.close();
    server.kill();
}
