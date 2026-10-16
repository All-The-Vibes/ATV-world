import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5189/';
const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', '--port', '5189', '--strictPort', '--host', '127.0.0.1',
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
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.factory);

    const scene = (fn, arg) => page.evaluate(`(${fn})(window.atv.game.scene.getScene('Preview'), ${JSON.stringify(arg)})`);
    const agents = () => scene((s) => s.factory.agents.filter((a) => !a.leaving).map((a) => a.info.name));
    assert.equal((await agents()).length, 0, 'No agents until someone builds one');
    assert.equal(await page.locator('.factory').count(), 0, 'The role picker starts closed');

    // Walk into the factory from just below its door: the picker opens and the player is stepped back out front.
    await scene((s) => {
        const { door, foot } = s.factory;
        s.player.sprite.setPosition(door.x, foot.bottom + 30);
    });
    await page.keyboard.down('ArrowUp');
    await page.waitForSelector('.factory');
    await page.keyboard.up('ArrowUp');
    const outside = await scene((s) => ({ in: s.factory.foot.contains(s.player.sprite.x, s.player.sprite.y) }));
    assert.equal(outside.in, false, 'The player is not left inside the building');

    for (const title of ['Developer', 'SRE', 'Security Agent', 'Tester']) {
        assert.equal(await page.locator('.factory-role-title', { hasText: new RegExp(`^${title}$`) }).count(), 1, `${title} is offered`);
    }

    // Pick roles by clicking and by number key.
    await page.locator('.factory-role', { hasText: 'Developer' }).click();
    await page.keyboard.press('4');
    await page.locator('.factory-role', { hasText: 'SRE' }).click();
    await page.locator('.factory-role', { hasText: 'Security Agent' }).click();
    assert.deepEqual(await agents(), ['DEV-1', 'QA-1', 'SRE-1', 'SEC-1']);
    assert.equal(await page.locator('.factory-count').innerText(), '4/12 AGENTS');
    await sleep(3000);
    const moved = await scene((s) => s.factory.agents.map((a) => ({ name: a.info.name, x: a.sprite.x, y: a.sprite.y, visible: a.sprite.alpha })));
    assert.ok(moved.every((a) => a.visible === 1), 'Agents are fully visible once built');

    // They stay out of buildings and inside the world while wandering.
    await sleep(6000);
    const wander = await scene((s) => s.factory.agents.map((a) => ({
        name: a.info.name, x: a.sprite.x, y: a.sprite.y,
        solid: s.solids.some((r) => r.contains(a.sprite.x, a.sprite.y)),
        hq: s.hq.contains(a.sprite.x, a.sprite.y),
    })));
    assert.ok(wander.every((a) => !a.solid && !a.hq), `Agents stay out of buildings: ${JSON.stringify(wander)}`);
    assert.ok(wander.some((a, i) => a.x !== moved[i].x || a.y !== moved[i].y), 'Agents wander');

    // Dismiss one, then fill the town: the oldest goes home first.
    await page.locator('.factory-chip', { hasText: 'DEV-1' }).click();
    await sleep(500);
    assert.deepEqual(await agents(), ['QA-1', 'SRE-1', 'SEC-1']);
    for (let i = 0; i < 12; i++) await page.keyboard.press('1');
    const full = await agents();
    assert.equal(full.length, 12, 'The town holds twelve agents');
    assert.ok(!full.includes('QA-1'), 'The oldest agent went home to make room');
    await page.locator('.factory-clear').click();
    await sleep(500);
    assert.equal((await agents()).length, 0, 'Send all home clears the town');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.factory'));
    // Clicking the building opens it again.
    await scene((s) => {
        const b = s.factory.building;
        const cam = s.cameras.main;
        const p = cam.worldView;
        const rect = document.querySelector('canvas').getBoundingClientRect();
        window.__factoryClick = { x: rect.left + (b.x - p.x) * cam.zoom, y: rect.top + (b.y - 30 - p.y) * cam.zoom };
    });
    const click = await page.evaluate(() => window.__factoryClick);
    await page.mouse.click(click.x, click.y);
    await page.waitForSelector('.factory');

    assert.deepEqual(errors, [], `No game errors: ${errors.join('\n')}`);
    console.log('Agent Factory browser test passed.');
} finally {
    await browser?.close();
    server.kill();
}
