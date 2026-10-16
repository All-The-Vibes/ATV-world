import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const PORT = 5191;
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.DAENERYS_SCREENSHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
let browser;

try {
    await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => reject(new Error('Vite did not start')), 30000);
        const fail = error => { clearTimeout(timeout); reject(error); };
        server.once('error', fail);
        server.once('exit', code => fail(new Error(`Vite exited (${code}): ${output}`)));
        const read = chunk => {
            output += chunk.toString();
            if (output.includes(ORIGIN)) { clearTimeout(timeout); resolve(); }
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
    await page.clock.install();
    await page.goto(ORIGIN);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.kittens).catch(error => {
        console.error('Browser errors:', errors);
        throw error;
    });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 200));

    const initial = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const matches = scene.walkers.filter(w => w.sprite.name === 'Daenerys');
        const w = matches[0];
        return {
            count: matches.length, walkers: scene.walkers.length,
            named: scene.walkers.some(w => w.sprite.name === 'Abdallah'),
            visible: w?.sprite.visible, x: w?.sprite.x, y: w?.sprite.y,
            inside: w && scene.worldBounds.contains(w.sprite.x, w.sprite.y),
            label: w && w.label.y <= w.sprite.y - w.sprite.height - 4,
            visitor: w && scene.kittens.visitors.some(v => v.person.sprite === w.sprite),
        };
    });
    assert.equal(initial.count, 1, 'Daenerys is in the world exactly once');
    assert.ok(initial.walkers >= 8, 'the original walkers remain alongside Daenerys');
    assert.ok(initial.named && initial.visible && initial.inside && initial.label && initial.visitor);

    const art = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const sprite = scene.walkers.find(w => w.sprite.name === 'Daenerys').sprite;
        const source = sprite.texture.getSourceImage();
        const ctx = source.getContext('2d');
        return ['side-0', 'side-1', 'side-2'].map(name => {
            const f = sprite.texture.get(name);
            const data = [...ctx.getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data];
            return { name: f.name, data };
        });
    });
    assert.deepEqual(art.map(f => f.name), ['side-0', 'side-1', 'side-2']);
    assert.equal(new Set(art.map(f => JSON.stringify(f.data))).size, 3, 'three distinct standing/walking poses');
    for (const frame of art) {
        const pixels = frame.data.reduce((out, value, i, data) => {
            if (i % 4 === 0) out.push(data.slice(i, i + 4));
            return out;
        }, []);
        assert.ok(pixels.some(([r, g, b, a]) => a && g > r * 1.3 && g > b * 1.3), 'green shoulder dragon');
        assert.ok(pixels.some(([r, g, b, a]) => a && r > 190 && g > 190 && b > 190), 'silver hair');
        assert.ok(pixels.some(([, , , a]) => a === 0), 'transparent background, no reference-sheet rectangle');
    }

    await page.clock.runFor(800);
    assert.notEqual(await page.evaluate(() => window.atv.game.scene.getScene('Preview').walkers.find(w => w.sprite.name === 'Daenerys').sprite.x), initial.x, 'walks without user input');
    for (const dir of [-1, 1]) {
        await page.evaluate(dir => {
            const scene = window.atv.game.scene.getScene('Preview');
            const w = scene.walkers.find(w => w.sprite.name === 'Daenerys');
            w.rest = 0;
            w.dir = dir;
            w.sprite.x = dir < 0 ? Math.max(scene.worldBounds.left, scene.campus?.bounds().right ?? -Infinity) + 24 : Math.min(scene.worldBounds.right, scene.town.bounds().left) - 24;
        }, dir);
        await page.clock.runFor(50);
        const bounced = await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            const w = scene.walkers.find(w => w.sprite.name === 'Daenerys');
            return { dir: w.dir, flip: w.sprite.flipX, inside: scene.worldBounds.contains(w.sprite.x, w.sprite.y), label: w.label.x === w.sprite.x };
        });
        assert.equal(bounced.dir, -dir, 'turns at each end of the street');
        assert.equal(bounced.flip, dir > 0, 'faces the direction of travel');
        assert.ok(bounced.inside && bounced.label);
    }
    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const w = scene.walkers.find(w => w.sprite.name === 'Daenerys');
        scene.burnables().find(target => target.sprite === w.sprite).hold(0.3);
    });
    await page.clock.runFor(100);
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').walkers.find(w => w.sprite.name === 'Daenerys').sprite.frame.name), 'side-0', 'rests in a valid standing pose');
    await page.clock.runFor(400);
    assert.ok(await page.evaluate(() => window.atv.game.scene.getScene('Preview').walkers.find(w => w.sprite.name === 'Daenerys').sprite.anims.isPlaying), 'resumes walking after a distraction');

    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const w = scene.walkers.find(w => w.sprite.name === 'Daenerys');
        w.sprite.setPosition(-180, 120);
        scene.view.show({ x: -280, y: 40, width: 230, height: 155 });
    });
    await page.clock.runFor(100);
    if (SHOTS) {
        await page.screenshot({ path: join(SHOTS, 'daenerys-world.png') });
        const sheet = await page.evaluate(() => window.atv.game.scene.getScene('Preview').walkers.find(w => w.sprite.name === 'Daenerys').sprite.texture.getSourceImage().toDataURL());
        writeFileSync(join(SHOTS, 'daenerys-sheet.png'), Buffer.from(sheet.split(',')[1], 'base64'));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.runFor(100);
    assert.ok(await page.locator('#game canvas').isVisible(), 'world remains visible on mobile');
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'daenerys-mobile.png') });
    assert.deepEqual(errors, [], 'no browser runtime errors');
    assert.equal(server.exitCode, null, 'the test server stayed alive throughout');
    console.log('Daenerys browser test passed: appearance, walking, turns, rest/resume, labels, mobile.');
} finally {
    await browser?.close();
    server.kill();
}
