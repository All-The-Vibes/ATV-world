import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
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
            if (error.cause?.code !== 'ECONNREFUSED') throw error;
        }
        if (ready) break;
        await sleep(200);
    }
    assert.ok(ready, `Vite did not become ready: ${output}`);
    browser = await chromium.launch({ channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('[ATV]')) errors.push(message.text());
        if (message.type() === 'warning' && /tarot|frame.*missing/i.test(message.text())) errors.push(message.text());
    });
    await page.goto(origin);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.tarot);
    await page.keyboard.press('f');
    await sleep(500);
    const fitted = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const bounds = scene.tarot.table.getBounds();
        const view = scene.cameras.main.worldView;
        return view.contains(bounds.left, bounds.top) && view.contains(bounds.right, bounds.bottom);
    });
    assert.ok(fitted, 'F / FIT includes the tarot table in the normal world view');
    for (let i = 0; i < 3; i++) await page.keyboard.press('+');
    await page.keyboard.down('ArrowLeft');
    try {
        await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').player.sprite.x <= -324,
            undefined, { timeout: 15000, polling: 'raf' });
    } finally {
        await page.keyboard.up('ArrowLeft');
    }
    await page.keyboard.down('ArrowDown');
    try {
        await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').player.sprite.y >= 945,
            undefined, { timeout: 20000, polling: 'raf' });
    } finally {
        await page.keyboard.up('ArrowDown');
    }
    await sleep(500);
    const reached = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const tarot = scene.tarot;
        const bounds = tarot.table.getBounds();
        const view = scene.cameras.main.worldView;
        return {
            inside: tarot.area.contains(scene.player.sprite.x, scene.player.sprite.y),
            visible: tarot.table.visible && view.contains(bounds.left, bounds.top) && view.contains(bounds.right, bounds.bottom),
        };
    });
    assert.ok(reached.inside, 'Normal arrow-key gameplay reaches the tarot footprint without teleporting');
    assert.ok(reached.visible, 'The follow camera shows the entire table after walking there');
    const geometry = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const tarot = scene.tarot;
        const rect = r => ({ x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom });
        return {
            area: rect(tarot.area),
            meadow: rect(scene.kittens.meadow),
            cards: tarot.cards.map(card => rect(card.getBounds())),
            world: rect(scene.worldBounds),
            reserved: scene.solids.includes(tarot.area),
        };
    });
    assert.equal(geometry.area.x + geometry.area.width / 2, -324);
    assert.equal(geometry.area.y + 125, 891);
    assert.ok(geometry.area.y > geometry.meadow.bottom, 'Entire tarot area is south of kitten meadow');
    assert.ok(geometry.world.bottom >= geometry.area.bottom + 64, 'Camera world includes tarot with padding');
    assert.ok(geometry.reserved, 'Token drops avoid the tarot footprint');
    geometry.cards.forEach(card => {
        assert.ok(card.width >= 60 && card.height >= 64, 'Cards are the visual centerpiece');
        assert.ok(card.y >= geometry.area.y && card.bottom <= geometry.area.bottom);
    });
    assert.ok(geometry.cards[0].x + geometry.cards[0].width < geometry.cards[1].x);
    const state = () => page.evaluate(() => {
        const t = window.atv.game.scene.getScene('Preview').tarot;
        return { state: t.state, revealed: t.revealed, texture: t.visitor.texture.key, visible: t.visitor.visible };
    });
    const clickTable = async () => {
        const point = await page.evaluate(() => {
            const s = window.atv.game.scene.getScene('Preview');
            const c = s.cameras.main, t = s.tarot.table;
            return { x: c.x + (t.x - c.worldView.x) * c.zoom, y: c.y + (t.y - 30 - c.worldView.y) * c.zoom };
        });
        await page.mouse.click(point.x, point.y);
    };
    await sleep(3200);
    assert.equal((await state()).state, 'waiting', 'No visitor arrives without a click');
    await clickTable();
    assert.equal((await state()).state, 'approaching', 'Real table click invites a normal visitor');
    await clickTable();
    assert.equal((await state()).state, 'approaching', 'Busy clicks do not restart the reading');
    await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').tarot.revealed === 1, undefined, { timeout: 12000 });
    await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').tarot.revealed === 2, undefined, { timeout: 5000 });
    await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').tarot.state === 'interpreting', undefined, { timeout: 5000 });
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').scene.pause());

    const initial = await page.evaluate(async () => {
        const scene = window.atv.game.scene.getScene('Preview'), t = scene.tarot;
        const { panelArt } = await import('/src/game/tarot/art.ts');
        const expected = panelArt(['YOUR THREE-CARD READING', ...t.spread.map(c => `${c.name}: ${c.reading}`)]);
        const actual = t.panel.texture.getSourceImage().getContext('2d').getImageData(0, 0, 286, 44).data;
        const samePanel = actual.every((value, i) => value === expected.image.data[i]);
        const snapshot = {
            unique: new Set(t.spread.map(c => c.name)).size,
            cards: t.cards.map(c => c.texture.key),
            expectedCards: t.spread.map(c => `tarot-card-${c.symbol}`),
            outcome: t.outcome,
            samePanel,
        };
        for (let i = 0; i < 80; i++) t.update(0.05);
        snapshot.held = t.state === 'interpreting' && t.outcome === undefined;
        return snapshot;
    });
    assert.equal(initial.unique, 3);
    assert.deepEqual(initial.cards, initial.expectedCards);
    assert.equal(initial.outcome, undefined, 'No outcome is decided before the combined readings are shown');
    assert.ok(initial.samePanel, 'All three named readings are painted together in the panel');
    assert.ok(initial.held, 'Combined readings are held for at least four seconds');
    if (process.env.TAROT_SCREENSHOT_DIR) {
        await page.screenshot({ path: join(process.env.TAROT_SCREENSHOT_DIR, 'tarot-reading.png') });
    }

    for (const outcome of ['angel', 'zombie']) {
        const result = await page.evaluate(async outcome => {
            const scene = window.atv.game.scene.getScene('Preview'), t = scene.tarot;
            const { DECK } = await import('/src/game/tarot/deck.ts');
            const advance = (seconds) => { for (let i = 0; i < Math.ceil(seconds / 0.05); i++) t.update(0.05); };
            // Finish the previous visitor before using a deterministic spread for this branch.
            for (let i = 0; i < 1000 && t.state !== 'waiting'; i++) t.update(0.05);
            const started = t.start();
            t.spread = outcome === 'angel' ? [DECK[0], DECK[1], DECK[2]] : [DECK[5], DECK[6], DECK[7]];
            for (let i = 0; i < 250 && t.state !== 'interpreting'; i++) t.update(0.05);
            const originalKey = t.visitor.texture.key;
            const busy = t.start();
            advance(5.1);
            const effectStarted = t.state === 'transforming' && t.glow.visible;
            advance(1.1);
            const transformed = t.visitor.texture.key;
            const sparks = t.sparks.filter(s => s.visible).length;
            advance(1.4);
            const departing = t.state;
            const x = t.feet.x;
            const initialAltitude = t.feet.y - t.visitor.y;
            const gait = [];
            for (let i = 0; i < 10; i++) {
                t.update(0.1);
                gait.push({ bob: t.feet.y - t.visitor.y, angle: t.visitor.angle });
            }
            const distance = t.feet.x - x;
            // Original shirt pixels remain in both transformed forms.
            const originalTexture = scene.textures.get(originalKey);
            const original = originalTexture.getSourceImage();
            const changed = t.visitor.texture.getSourceImage();
            const getPixel = (image, x, y) => Array.from(image.getContext('2d').getImageData(x, y, 1, 1).data);
            const bodyX = outcome === 'angel' ? 28 : 12;
            const bodyY = outcome === 'angel' ? 24 : 16;
            const shirtPreserved = JSON.stringify(getPixel(original, originalTexture.get('side-0').cutX + 7, 13))
                === JSON.stringify(getPixel(changed, bodyX + 7, bodyY + 13));
            const halo = getPixel(changed, 36, 12)[3] > 0;
            const wings = getPixel(changed, 3, 14)[3] > 0 && getPixel(changed, 69, 14)[3] > 0;
            const skinChanged = JSON.stringify(getPixel(original, originalTexture.get('side-0').cutX + 10, 7))
                !== JSON.stringify(getPixel(changed, 12 + 10, 16 + 7));
            const animation = t.visitor.anims.currentAnim.key;
            const shadowScale = t.shadow.scaleX;
            const shadowAlpha = t.shadow.alpha;
            const finalAltitude = t.feet.y - t.visitor.y;
            const wingFramesDiffer = JSON.stringify(getPixel(changed, 3, 14)) !== JSON.stringify(getPixel(changed, 72 + 3, 14));
            return { started, busy, originalKey, effectStarted, transformed, sparks, departing, distance, gait, shirtPreserved,
                halo, wings, skinChanged, animation, initialAltitude, finalAltitude, shadowScale, shadowAlpha, wingFramesDiffer };
        }, outcome);
        assert.ok(result.started);
        assert.equal(result.busy, false);
        assert.ok(result.effectStarted);
        assert.ok(result.transformed.startsWith(`tarot-${outcome}-`));
        assert.equal(result.sparks, 12);
        assert.equal(result.departing, 'departing');
        assert.ok(result.shirtPreserved, 'Transformation preserves the visitor clothing');
        if (outcome === 'angel') {
            assert.ok(result.halo && result.wings, 'Angel texture has a halo and wings extending on both sides');
            assert.ok(result.distance > 20, 'Angel flies forward');
            assert.ok(result.finalAltitude - result.initialAltitude >= 33, 'Angel ascends at least 33px in one second, rather than walking or bobbing');
            assert.ok(result.animation.endsWith('-fly'), 'Angel uses wing-flap flight animation, not a walk cycle');
            assert.ok(result.wingFramesDiffer, 'Large wings change pose between animation frames');
            assert.ok(result.shadowScale < 0.8 && result.shadowAlpha < 0.25, 'Ground shadow shrinks and fades as angel gains height');
        } else {
            assert.ok(result.skinChanged, 'Zombie has decayed green skin, not only a new animation');
            assert.ok(result.distance < 25, 'Zombie shambles slowly');
            assert.ok(new Set(result.gait.map(sample => sample.angle)).size > 5, 'Zombie sways unevenly');
        }
        if (process.env.TAROT_SCREENSHOT_DIR) {
            await sleep(100);
            await page.screenshot({ path: join(process.env.TAROT_SCREENSHOT_DIR, `tarot-${outcome}.png`) });
        }
        const exit = await page.evaluate(() => {
            const t = window.atv.game.scene.getScene('Preview').tarot;
            for (let i = 0; i < 300 && t.state !== 'waiting'; i++) t.update(0.05);
            const finished = t.state === 'waiting' && !t.visitor.visible && !t.shadow.visible;
            for (let i = 0; i < 80; i++) t.update(0.05);
            return { finished, waitsForClick: t.state === 'waiting' };
        });
        assert.ok(exit.finished, 'Visitor exits before returning to idle');
        assert.ok(exit.waitsForClick, 'Next visitor also requires an invitation');
    }
    assert.deepEqual(errors, [], 'No Phaser/runtime errors or missing tarot frames');
    console.log('Tarot browser: FIT visibility, normal keyboard navigation, placement, click invitation, timed reveals, combined reading hold, both transformations, identity, gaits, repeat lock, and clean exit passed.');
} finally {
    await browser?.close();
    server.kill();
}
