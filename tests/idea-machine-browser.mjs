import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5188/';
const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', '--port', '5188', '--strictPort', '--host', '127.0.0.1',
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('[ATV]')) errors.push(message.text());
    });
    await page.goto(origin);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.ideaBubble);
    const state = () => page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        return { index: scene.ideaIndex, visible: scene.ideaBubble.visible, texture: scene.ideaBubble.texture.key };
    });
    await page.keyboard.press('e');
    assert.equal((await state()).index, -1, 'Cannot roll from the starting spot');
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => window.atv.game.scene.getScene('Preview').ideaBubble.visible);
    await page.keyboard.up('ArrowLeft');
    assert.equal((await state()).texture, 'preview-idea-prompt', 'Walking up reveals the instruction');

    let previous = -1;
    for (let i = 0; i < 12; i++) {
        await page.keyboard.press(i % 2 ? 'E' : 'e');
        const current = await state();
        assert.ok([0, 1, 2].includes(current.index));
        assert.notEqual(current.index, previous, 'Consecutive challenges must differ');
        assert.equal(current.texture, `preview-idea-${current.index}`);
        previous = current.index;
    }
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', repeat: true })));
    assert.equal((await state()).index, previous, 'Holding E must not reroll');
    await page.evaluate(() => {
        const input = document.createElement('input');
        input.id = 'typing-test';
        document.body.append(input);
        input.focus();
    });
    await page.keyboard.press('e');
    assert.equal((await state()).index, previous, 'Typing must not reroll');
    await page.locator('#typing-test').evaluate(input => input.remove());

    const point = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const camera = scene.cameras.main;
        return {
            x: camera.x + (scene.ideaMachine.x - camera.worldView.x) * camera.zoom,
            y: camera.y + (scene.ideaMachine.y - 20 - camera.worldView.y) * camera.zoom,
        };
    });
    await page.mouse.click(point.x, point.y);
    assert.notEqual((await state()).index, previous, 'Clicking the nearby machine rerolls');

    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => !window.atv.game.scene.getScene('Preview').ideaBubble.visible);
    await page.keyboard.up('ArrowRight');
    previous = (await state()).index;
    await page.keyboard.press('e');
    assert.equal((await state()).index, previous, 'Walking away disables the machine');
    assert.deepEqual(errors, [], 'No game runtime errors');
    console.log('Idea Machine: proximity, keyboard, click, random choices, repeat and typing guards passed.');
} finally {
    await browser?.close();
    server.kill();
}
