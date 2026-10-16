import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:5194/';
const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', '--port', '5194', '--strictPort', '--host', '127.0.0.1',
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        let seed = 179;
        Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    });
    await page.clock.install();
    await page.goto(origin);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.incidents);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 2000));
    const state = () => page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const incident = scene.incidents;
        return {
            phase: incident.phase, kind: incident.kind, completed: incident.completed, progress: incident.progress,
            status: incident.board.texture.key, station: incident.station.texture.key,
            flames: incident.flames.filter(flame => flame.visible).length,
            aliens: incident.aliens.filter(alien => alien.visible).length,
            agents: incident.agents.map(agent => ({ x: agent.sprite.x, y: agent.sprite.y })),
            home: incident.agents.every(agent => agent.sprite.x === agent.home.x && agent.sprite.y === agent.home.y),
            atWork: incident.agents.every(agent => agent.sprite.x === agent.work.x && agent.sprite.y === agent.work.y),
        };
    });
    const tick = seconds => page.evaluate(seconds => {
        const incident = window.atv.game.scene.getScene('Preview').incidents;
        for (let i = 0; i < Math.round(seconds * 10); i++) incident.update(0.1);
    }, seconds);
    const press = () => page.keyboard.press('c');
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').incidents.autoEnabled), true,
        'Self-healing is enabled on arrival');
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').incidents.toggleAuto());
    await press();
    assert.equal((await state()).phase, 'idle', 'C does nothing far from the button');
    await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.player.sprite.setPosition(-205, 115);
    });
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', repeat: true })));
    assert.equal((await state()).phase, 'idle', 'Holding C does not trigger an incident');
    await page.evaluate(() => {
        const input = document.createElement('input');
        input.id = 'incident-typing-test';
        document.body.append(input);
        input.focus();
    });
    await press();
    assert.equal((await state()).phase, 'idle', 'Typing does not trigger an incident');
    await page.locator('#incident-typing-test').evaluate(input => input.remove());
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').insideHQ = true; });
    await press();
    assert.equal((await state()).phase, 'idle', 'No remote keyboard incident from inside HQ');
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').insideHQ = false; });
    await page.keyboard.press('Control+c');
    assert.equal((await state()).phase, 'idle', 'Keyboard shortcuts do not start incidents');
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').scene.sleep());
    await page.clock.runFor(100);
    await press();
    assert.equal((await state()).phase, 'idle', 'Sleeping world ignores the button hotkey');
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').scene.wake());
    await page.clock.runFor(100);

    const seen = new Set();
    let previous = -1;
    const textureCount = await page.evaluate(() => window.atv.game.textures.getTextureKeys().length);
    for (let round = 0; round < 16 && seen.size < 4; round++) {
        await press();
        const initial = await state();
        assert.equal(initial.phase, 'detecting');
        assert.notEqual(initial.kind, previous, 'Consecutive incidents differ');
        seen.add(initial.kind);
        previous = initial.kind;
        assert.equal(initial.flames, initial.kind === 0 ? 3 : 0);
        assert.equal(initial.aliens, initial.kind === 2 ? 3 : 0);
        assert.equal(initial.station, initial.kind === 1 ? 'incident-station-off' : 'incident-station-on');
        await press();
        assert.equal((await state()).kind, initial.kind, 'Busy button cannot stack incidents');
        await tick(1);
        assert.equal((await state()).phase, 'detecting', 'Detection has a visible delay');
        await tick(1);
        assert.equal((await state()).phase, 'responding', 'Agents visibly travel to the incident');
        assert.notDeepEqual((await state()).agents, initial.agents);
        await tick(2);
        assert.equal((await state()).phase, 'resolving');
        assert.ok((await state()).atWork, 'Repairs require every responder to arrive');
        await tick(2);
        assert.ok((await state()).progress > 0 && (await state()).progress < 1, 'Repair progress is gradual');
        await tick(3);
        const resolved = await state();
        assert.equal(resolved.phase, 'resolved');
        assert.equal(resolved.completed, round + 1);
        assert.equal(resolved.progress, 1);
        assert.equal(resolved.flames + resolved.aliens, 0, 'Hazards disappear after repair');
        assert.equal(resolved.station, 'incident-station-on', 'Power is restored');
        await tick(6);
        assert.equal((await state()).phase, 'idle');
        assert.ok((await state()).home, 'Responders return to their actual posts');
    }
    assert.equal(seen.size, 4, 'All four random incident types exercised');
    assert.equal(await page.evaluate(() => window.atv.game.textures.getTextureKeys().length), textureCount,
        'Repeated incidents reuse textures');

    const toggle = () => page.evaluate(() => window.atv.game.scene.getScene('Preview').incidents.toggleAuto());
    await tick(35);
    assert.equal((await state()).phase, 'idle', 'Disabled automation never starts a drill');
    await toggle();
    await tick(29);
    assert.equal((await state()).phase, 'idle', 'Automatic detection waits 30 standby seconds');
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').insideHQ = true; });
    await tick(5);
    assert.equal((await state()).phase, 'idle', 'Automatic countdown pauses inside HQ');
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').insideHQ = false; });
    await page.evaluate(() => {
        const input = document.createElement('input');
        input.id = 'auto-typing-test';
        document.body.append(input);
        input.focus();
    });
    await tick(5);
    await toggle();
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').incidents.autoEnabled), true,
        'Typing also guards the automation toggle');
    assert.equal((await state()).phase, 'idle', 'Automatic countdown pauses while typing');
    await page.locator('#auto-typing-test').evaluate(input => input.remove());
    await tick(1.1);
    assert.equal((await state()).phase, 'detecting', 'Standby fault is detected without player input');
    await toggle();
    await tick(4);
    assert.equal((await state()).phase, 'resolving', 'Disabling automation does not interrupt repairs');
    const toolCommands = () => page.evaluate(() =>
        [...window.atv.game.scene.getScene('Preview').incidents.tools.commandBuffer]);
    const toolsBefore = await toolCommands();
    assert.ok(toolsBefore.length > 0, 'Repair wrenches are drawn');
    await tick(0.1);
    assert.notDeepEqual(await toolCommands(), toolsBefore, 'Repair tools visibly animate');
    await tick(10);
    assert.equal((await state()).phase, 'idle');
    assert.ok((await state()).home, 'Automatic repairs return the crew to their posts');
    assert.equal((await toolCommands()).length, 0, 'Tools clear when repairs finish');
    await toggle();
    await tick(29);
    assert.equal((await state()).phase, 'idle', 'Re-enabling starts a fresh countdown');
    await tick(1.1);
    assert.equal((await state()).phase, 'detecting', 'Self-healing repeats without player input');
    await page.evaluate(() => {
        const incident = window.atv.game.scene.getScene('Preview').incidents;
        for (let i = 0; i < 200 && incident.phase !== 'idle'; i++) incident.update(0.1);
    });
    assert.equal((await state()).phase, 'idle');
    await tick(29);
    assert.equal((await state()).phase, 'idle', 'Returning home resets the automatic countdown');
    await toggle();
    assert.equal(await page.evaluate(() =>
        window.atv.game.scene.getScene('Preview').incidents.autoButton.texture.key), 'incident-auto-off');
    assert.equal(await page.evaluate(() => window.atv.game.textures.getTextureKeys().length), textureCount,
        'Automatic repairs reuse their textures too');

    // A real pointer click and game frames exercise the scene wiring, not just the controller.
    await page.keyboard.press('f');
    await page.clock.runFor(300);
    const point = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const camera = scene.cameras.main;
        return {
            x: camera.x + (scene.incidents.button.x - camera.worldView.x) * camera.zoom,
            y: camera.y + (scene.incidents.button.y - 20 - camera.worldView.y) * camera.zoom,
        };
    });
    await page.mouse.click(point.x, point.y);
    assert.equal((await state()).phase, 'detecting', 'The visible red button is clickable');
    await page.clock.runFor(14_000);
    assert.equal((await state()).phase, 'idle', 'The live scene update completes a full incident');
    assert.ok((await state()).home);
    const autoPoint = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const camera = scene.cameras.main;
        return {
            x: camera.x + (scene.incidents.autoButton.x - camera.worldView.x) * camera.zoom,
            y: camera.y + (scene.incidents.autoButton.y - camera.worldView.y) * camera.zoom,
        };
    });
    await page.mouse.click(autoPoint.x, autoPoint.y);
    assert.equal(await page.evaluate(() =>
        window.atv.game.scene.getScene('Preview').incidents.autoButton.texture.key), 'incident-auto-on',
        'The visible automation sign is clickable');
    await page.clock.runFor(44_000);
    assert.equal((await state()).phase, 'idle', 'The live scene completes an automatic repair cycle');
    assert.ok((await state()).home);
    if (process.env.INCIDENT_SCREENSHOT) {
        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.view.show({ x: -390, y: -65, width: 295, height: 290 });
        });
        await press();
        await page.clock.runFor(4000);
        await page.screenshot({ path: process.env.INCIDENT_SCREENSHOT });
    }
    assert.deepEqual(errors, [], 'No game runtime errors');
    console.log('Repair crew: all four hazards, automatic/manual cycles, pause/resume, animated tools, input guards, texture reuse, and live scene wiring passed.');
} finally {
    await browser?.close();
    server.kill();
}
