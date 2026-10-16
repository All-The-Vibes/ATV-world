import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const PORT = 5186;
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.WONDERLAND_SCREENSHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
const shot = async (page, name) => SHOTS && page.screenshot({ path: join(SHOTS, `${name}.png`) });

try {
    await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error('Vite did not start')), 30000);
        const fail = error => { clearTimeout(timeout); reject(error); };
        server.once('error', fail);
        server.once('exit', code => fail(new Error(`Vite exited (${code}): ${output}`)));
        const read = chunk => {
            output += chunk.toString();
            if (output.replace(/\x1b\[[0-9;]*m/g, '').includes(ORIGIN)) { clearTimeout(timeout); resolve(); }
        };
        server.stdout.on('data', read);
        server.stderr.on('data', read);
    });
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(ORIGIN);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.rabbitTree?.rabbit, null, { timeout: 30000 }).catch(error => {
        console.error('Browser errors:', errors);
        throw error;
    });

    const placed = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const tree = scene.rabbitTree;
        return {
            inside: scene.worldBounds.contains(tree.x, tree.y - 10),
            eastOfTown: tree.x - 60 > (scene.town?.bounds().right ?? -Infinity),
            onMap: scene.directory.locate !== undefined,
        };
    });
    assert.ok(placed.inside, 'the big tree is inside the world');
    assert.ok(placed.eastOfTown, 'the big tree stands off to the side, east of the town');

    // Send the rabbit now and watch him close in on the tree.
    const start = await page.evaluate(() => {
        const tree = window.atv.game.scene.getScene('Preview').rabbitTree;
        tree.away = 0;
        return new Promise(resolve => setTimeout(() => {
            const r = tree.rabbit;
            resolve({ visible: r.sprite.visible, d: Math.hypot(r.x - tree.x, r.y - tree.y) });
        }, 200));
    });
    assert.ok(start.visible, 'the White Rabbit appears');
    const closest = await page.evaluate(() => new Promise(resolve => {
        const tree = window.atv.game.scene.getScene('Preview').rabbitTree;
        let best = Infinity, ran = false;
        const id = setInterval(() => {
            const r = tree.rabbit;
            if (r.running) ran = true;
            if (r.sprite.visible) best = Math.min(best, Math.hypot(r.x - tree.x, r.y - tree.y));
        }, 50);
        setTimeout(() => { clearInterval(id); resolve({ best, ran }); }, 3500);
    }));
    assert.ok(closest.ran, 'the White Rabbit runs');
    assert.ok(closest.best < start.d - 100, `the White Rabbit runs toward the tree (${start.d.toFixed(0)} -> ${closest.best.toFixed(0)})`);

    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const t = scene.rabbitTree;
        scene.view.show({ x: t.x - 170, y: t.y - 190, width: 340, height: 230 });
    });
    await page.waitForTimeout(900);
    await shot(page, '1-tree');

    // Walk into the hollow and fall into Wonderland.
    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const f = scene.rabbitTree.foot();
        scene.player.sprite.setPosition(f.centerX, f.centerY);
    });
    await page.waitForFunction(() => window.atv.game.scene.isActive('Wonderland'), null, { timeout: 5000 });
    assert.ok(window => true);
    await page.waitForFunction(() => !window.atv.game.scene.getScene('Wonderland').busy, null, { timeout: 5000 });
    const there = await page.evaluate(() => {
        const game = window.atv.game;
        const w = game.scene.getScene('Wonderland');
        return { previewAsleep: game.scene.isSleeping('Preview'), rabbit: w.rabbit.sprite.visible, cards: w.cards.length };
    });
    assert.ok(there.previewAsleep, 'the town sleeps while you are in Wonderland');
    assert.ok(there.rabbit && there.cards > 0, 'Wonderland has the White Rabbit and the card soldiers');
    await page.waitForTimeout(1500);
    await shot(page, '2-wonderland');
    await page.evaluate(() => window.atv.game.scene.getScene('Wonderland').cameras.main.setZoom(1.5).stopFollow().centerOn(-40, 0));
    await page.waitForTimeout(2600);
    await shot(page, '3-wonderland-wide');

    // Walk into the little door to go home, and step back out of the tree.
    await page.evaluate(() => window.atv.game.scene.getScene('Wonderland').player.setPosition(0, -125));
    await page.waitForFunction(() => window.atv.game.scene.isActive('Preview') && !window.atv.game.scene.isActive('Wonderland'), null, { timeout: 5000 });
    await page.waitForFunction(() => !window.atv.game.scene.getScene('Preview').tumbling, null, { timeout: 5000 });
    const home = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const p = scene.player.sprite, e = scene.rabbitTree.exit;
        return { x: p.x - e.x, y: p.y - e.y, visible: p.visible, scale: p.scale, inTree: scene.rabbitTree.enters(p.x, p.y) };
    });
    assert.deepEqual([home.x, home.y, home.visible, home.scale, home.inTree], [0, 0, true, 1, false], 'the player comes back out in front of the tree');
    assert.deepEqual(errors, []);
    console.log('wonderland: ok');
} finally {
    await browser?.close();
    server.kill();
}
