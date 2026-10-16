import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5189/';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5189', '--strictPort', '--host', '127.0.0.1'], { stdio: 'inherit' });
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
    await page.waitForFunction(() => window.atv?.game.scene.getScene('Preview')?.witch?.witch?.active);

    const witch = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        return {
            x: scene.witch.witch.x,
            y: scene.witch.witch.y,
            portalDistance: Math.hypot(scene.witch.witch.x - scene.surfacePortal.x, scene.witch.witch.y - scene.surfacePortal.y),
        };
    });
    assert.deepEqual({ x: witch.x, y: witch.y }, { x: 295, y: 120 });
    assert.ok(witch.portalDistance < 70, 'the witch sits beside the portal');

    const first = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const player = scene.player.sprite;
        player.setPosition(295, 140);
        scene.witch.update();
        const overlay = [...scene.witch.costumed.values()].find(state => state.visiting);
        return { texture: overlay.overlay.texture.key, visible: overlay.overlay.visible };
    });
    assert.ok(first.texture.startsWith('halloween-costume-'));
    assert.ok(first.visible, 'the player receives a visible costume');

    const second = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const player = scene.player.sprite;
        player.setPosition(240, 208);
        scene.witch.update();
        const state = scene.witch.costumed.get(player);
        const left = { visiting: state.visiting, visible: state.overlay.visible };
        player.setPosition(295, 140);
        scene.witch.update();
        return { left, texture: state.overlay.texture.key, visiting: state.visiting };
    });
    assert.deepEqual(second.left, { visiting: false, visible: false });
    assert.ok(second.visiting, 'returning applies another costume');
    assert.notEqual(second.texture, first.texture, 'a return visit gets a different random costume');

    const walker = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const person = scene.walkers[0].sprite;
        person.setPosition(294, 121);
        scene.witch.update();
        const state = scene.witch.costumed.get(person);
        return { visiting: state.visiting, visible: state.overlay.visible };
    });
    assert.deepEqual(walker, { visiting: true, visible: true });

    const roamer = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.roamers.spawn('mothbell');
        const person = scene.roamers.burnables()[0].sprite;
        person.setPosition(298, 124);
        scene.witch.update();
        const state = scene.witch.costumed.get(person);
        return { visiting: state.visiting, visible: state.overlay.visible };
    });
    assert.deepEqual(roamer, { visiting: true, visible: true }, 'new-style roaming characters receive costumes');

    const upsideDown = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.setHellTheme(true);
        scene.witch.update();
        const hidden = !scene.witch.witch.visible && [...scene.witch.costumed.values()].every(state => !state.overlay.visible);
        scene.setHellTheme(false);
        return { hidden, restored: scene.witch.witch.visible };
    });
    assert.deepEqual(upsideDown, { hidden: true, restored: true }, 'the surface witch stays out of the Upside Down');

    if (process.env.WITCH_SCREENSHOT) {
        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.player.sprite.setPosition(261, 140);
            scene.walkers[0].sprite.setPosition(332, 132);
            scene.witch.update();
            scene.view.show({ x: 130, y: 22, width: 170, height: 130 });
        });
        await sleep(300);
        await page.screenshot({ path: process.env.WITCH_SCREENSHOT });
    }
    assert.deepEqual(errors, [], 'no browser or game-frame errors');
    console.log('Halloween witch: placement, player visits, rerolls, walkers, roamers, and Upside Down boundaries passed.');
} finally {
    await browser?.close();
    server.kill();
}
