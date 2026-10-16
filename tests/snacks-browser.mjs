import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5188/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5188', '--strictPort', '--host', '127.0.0.1'], { stdio: 'inherit' });
let browser;

try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
        if (server.exitCode !== null) throw new Error(`Vite exited with code ${server.exitCode}`);
        try {
            ready = (await fetch(origin)).ok;
        } catch (error) {
            if (error.cause?.code !== 'ECONNREFUSED') throw error;
        }
        if (ready) break;
        await sleep(200);
    }
    assert.ok(ready, 'Vite starts');
    browser = await chromium.launch({ channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(origin);
    await page.waitForFunction(() => {
        const scene = window.atv?.game.scene.getScene('Preview');
        return scene?.sys.isActive() && scene.children.list.some(child => child.texture?.key === 'preview-prop-popcornVolcano');
    });

    const art = await page.evaluate(async () => {
        const { PROPS, paintProp } = await import('/src/game/kit/props.ts');
        const p = paintProp(PROPS.popcornVolcano);
        const frames = Array.from({ length: p.frames }, (_, f) => {
            const pixels = [];
            for (let y = 0; y < p.frameH; y++) {
                for (let x = 0; x < p.frameW; x++) pixels.push(p.canvas.raw(f * p.frameW + x, y));
            }
            return pixels;
        });
        return {
            width: p.canvas.width, height: p.canvas.height, frameW: p.frameW, frames: p.frames, fps: p.fps,
            unique: new Set(frames.map(frame => frame.join(','))).size,
            emptyEdges: frames.every(frame => frame.every((pixel, i) =>
                (i % p.frameW === 0 || i % p.frameW === p.frameW - 1 || i < p.frameW || i >= frame.length - p.frameW) ? pixel === 0 : true)),
        };
    });
    assert.deepEqual(art, { width: 592, height: 74, frameW: 74, frames: 8, fps: 8, unique: 8, emptyEdges: true });

    const placed = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const prop = scene.children.list.find(child => child.texture?.key === 'preview-prop-popcornVolcano');
        const bounds = prop.getBounds();
        const library = scene.children.list.find(child => child.texture?.key === 'preview-library');
        const libraryBounds = library.getBounds();
        return {
            x: prop.x, y: prop.y, playing: prop.anims.isPlaying,
            frame: prop.frame.name,
            fits: scene.cameras.main.worldView.contains(bounds.left, bounds.top) && scene.cameras.main.worldView.contains(bounds.right, bounds.bottom),
            overlapsLibrary: bounds.left < libraryBounds.right && bounds.right > libraryBounds.left &&
                bounds.top < libraryBounds.bottom && bounds.bottom > libraryBounds.top,
            fountain: scene.children.list.some(child => child.texture?.key === 'preview-prop-fountain'),
            benches: scene.children.list.filter(child => child.texture?.key === 'preview-prop-bench').length,
            sign: scene.children.list.some(child => child.texture?.key === 'preview-prop-banner'),
        };
    });
    assert.equal(placed.x, -290);
    assert.equal(placed.y, 220);
    assert.ok(placed.playing, 'the volcano erupts');
    assert.ok(placed.fits, 'fit-world camera includes the whole volcano');
    assert.equal(placed.overlapsLibrary, false, 'the library is untouched');
    assert.ok(placed.fountain, 'the fountain remains');
    assert.equal(placed.benches, 2, 'both picnic and original benches remain');
    assert.ok(placed.sign, 'the snack sign is present');
    await page.waitForFunction(frame => {
        const scene = window.atv.game.scene.getScene('Preview');
        return scene.children.list.find(child => child.texture?.key === 'preview-prop-popcornVolcano').frame.name !== frame;
    }, placed.frame);

    await page.keyboard.down('ArrowLeft');
    await sleep(250);
    await page.keyboard.up('ArrowLeft');
    assert.ok(await page.evaluate(() => window.atv.game.scene.getScene('Preview').player.sprite.x < 0), 'the player can still walk');
    if (process.env.SNACK_SCREENSHOT) {
        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.view.show({ x: -350, y: 126, width: 165, height: 145 });
        });
        await sleep(300);
        await page.screenshot({ path: process.env.SNACK_SCREENSHOT });
    }
    assert.deepEqual(errors, [], 'no browser or game-frame errors');
    console.log('Mount Popcorn: art, animation, world fit, neighbors, and walking passed.');
} finally {
    await browser?.close();
    server.kill();
}
