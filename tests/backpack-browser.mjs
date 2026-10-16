// Exercise real drops, walking, inventory, and modal input with an isolated browser and dev server.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = 5191;
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.BACKPACK_SCREENSHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

// Never attach to (or stop) somebody else's dev server.
const probe = createServer();
await new Promise((resolve, reject) => probe.once('error', reject).listen(PORT, '127.0.0.1', resolve));
await new Promise(resolve => probe.close(resolve));
const server = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createServer } from 'vite';
    import { realpathSync } from 'node:fs';
    const server = await createServer({ server: {
        host: '127.0.0.1', port: ${PORT}, strictPort: true,
        fs: { allow: [process.cwd(), realpathSync('node_modules')] },
    } });
    await server.listen();
`], { stdio: 'ignore' });
let browser;
try {
    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) {
        if (server.exitCode !== null) throw new Error(`Vite exited: ${server.exitCode}`);
        try { ready = (await fetch(ORIGIN)).ok; } catch { /* starting */ }
        if (!ready) await sleep(200);
    }
    assert.ok(ready, 'isolated Vite server starts');
    try { browser = await chromium.launch({ channel: 'msedge' }); }
    catch { browser = await chromium.launch(); }
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
        if (localStorage.getItem('atv-tokens') === null) localStorage.setItem('atv-tokens', '37');
    });
    await page.clock.install();
    await page.goto(ORIGIN);
    await page.waitForFunction(() => new Set(window.atv?.game.scene.getScene('Preview').tokens?.tokens.map(t => t.kind)).size === 4);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 200));
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').gremlins.next = Infinity; });
    await page.clock.runFor(1600);
    const shot = async name => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }); };
    const bag = page.getByRole('dialog', { name: 'Backpack', exact: true });
    const trigger = page.getByRole('button', { name: /BACKPACK/ });
    const position = () => page.evaluate(() => {
        const p = window.atv.game.scene.getScene('Preview').player.sprite;
        return { x: p.x, y: p.y };
    });
    const hold = async (key, ms) => {
        await page.keyboard.down(key);
        await page.clock.runFor(ms);
        await page.keyboard.up(key);
        await page.clock.runFor(50);
    };
    const packed = () => page.evaluate(() => JSON.parse(localStorage.getItem('atv-backpack') ?? '{}'));
    assert.equal(await page.locator('.backpack-balance').getAttribute('aria-label'), '37 tokens');
    const counters = () => page.evaluate(() => window.atv.game.scene.getScene('Preview').children.list
        .filter(child => child.name === 'token-count').map(child => ({ text: child.text, visible: child.visible, x: child.x, y: child.y })));
    const people = await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        return 1 + s.walkers.length + s.bikeGang.sprites().length + s.lockAndKey.sprites().length;
    });
    assert.equal((await counters()).length, people, 'every token collector has an overhead counter');
    assert.equal((await counters()).filter(c => c.text === '0 T').length, people - 1);
    assert.equal((await counters()).filter(c => c.text === '37 T').length, 1);
    await shot('world-loot');
    await trigger.click();
    await bag.waitFor({ state: 'visible' });
    assert.equal(await page.locator('.backpack-grid li[data-found="false"]').count(), 4);
    assert.match(await bag.innerText(), /0 \/ 4 discovered/);
    assert.equal(await page.getByRole('button', { name: 'Close backpack', exact: true }).evaluate(el => el === document.activeElement), true);
    await shot('backpack-empty');
    const before = await position();
    const zoom = await page.evaluate(() => window.atv.game.scene.getScene('Preview').cameras.main.zoom);
    await hold('ArrowRight', 500);
    await page.keyboard.press('+');
    await page.clock.runFor(100);
    assert.deepEqual(await position(), before, 'arrow keys do not walk while the backpack is open');
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').cameras.main.zoom), zoom, 'modal keys do not zoom the world');
    await page.keyboard.press('Escape');
    await bag.waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'closing restores focus');

    // NPCs still pick up tokens, but cannot take a player's special collectibles.
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.tokens.nextCar = 1000;
        const item = s.tokens.tokens.find(t => t.kind === 'mac-mini');
        s.walkers[0].sprite.setPosition(item.sprite.x, item.sprite.y);
        s.tokens.update(0, [{ sprite: s.walkers[0].sprite, player: false }]);
    });
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').tokens.tokens.some(t => t.kind === 'mac-mini')), true);

    for (const id of ['mac-mini', 'dgx-spark', 'codex-pro', 'cloud-scout']) {
        await page.evaluate(id => {
            const s = window.atv.game.scene.getScene('Preview');
            const item = s.tokens.tokens.find(t => t.kind === id);
            if (!item?.landed) throw new Error(`${id} did not land: ${JSON.stringify({
                loot: s.tokens.tokens.map(t => ({ kind: t.kind, landed: t.landed, age: t.age })),
                packed: localStorage.getItem('atv-backpack'),
            })}`);
            s.player.sprite.setPosition(item.sprite.x - 17, item.sprite.y);
        }, id);
        await hold('ArrowRight', 180);
        assert.equal((await packed())[id], 1, `walking over ${id} packs it once`);
        await page.clock.runFor(200);
        assert.equal((await packed())[id], 1, `${id} is removed after pickup`);
    }
    assert.equal(await page.locator('.backpack-balance').getAttribute('aria-label'), '37 tokens', 'items are not counted as tokens');
    // A normal token uses the original counter and storage key.
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        if (!s.tokens.drop(0, -100, -50)) throw new Error('No open ground for token test');
    });
    await page.clock.runFor(1300);
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        const token = s.tokens.tokens.find(t => t.kind === 'token');
        s.player.sprite.setPosition(token.sprite.x, token.sprite.y);
    });
    await page.clock.runFor(100);
    assert.equal(await page.locator('.backpack-balance').getAttribute('aria-label'), '38 tokens');
    assert.ok((await counters()).some(c => c.text === '38 T'), 'player overhead count matches the backpack');
    const oldCounter = (await counters()).find(c => c.text === '38 T');
    await hold('ArrowDown', 100);
    assert.ok((await counters()).find(c => c.text === '38 T').y > oldCounter.y, 'counter follows the walking player');
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        if (!s.tokens.drop(-200, -100, -50)) throw new Error('No open ground for NPC token test');
    });
    await page.clock.runFor(1300);
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        const token = s.tokens.tokens.find(t => t.kind === 'token');
        s.walkers[0].sprite.setPosition(token.sprite.x, token.sprite.y);
        s.tokens.update(0, [{ sprite: s.walkers[0].sprite, player: false }]);
    });
    await page.clock.runFor(100);
    assert.equal((await counters()).filter(c => c.text === '1 T').length, 1, 'only the NPC that collects a token gets its count');
    assert.equal(await page.locator('.backpack-balance').getAttribute('aria-label'), '38 tokens', 'NPC tokens do not increase the player balance');
    await shot('overhead-token-counts');
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.gremlins.spawn();
        const g = s.gremlins.list.at(-1);
        g.target = { sprite: s.walkers[0].sprite, player: false };
        s.gremlins.steal(g, s.worldBounds);
    });
    await page.clock.runFor(50);
    assert.equal((await counters()).filter(c => c.text === '1 T').length, 0, 'gremlin theft subtracts from the NPC overhead balance');
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').walkers[0].sprite.getData('tokenCount')), 0);
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.gremlins.spawn();
        const g = s.gremlins.list.at(-1);
        g.target = { sprite: s.walkers[0].sprite, player: false };
        s.gremlins.steal(g, s.worldBounds);
        if (g.loot) throw new Error('An empty NPC purse produced a stolen token');
        s.gremlins.destroy();
    });
    await page.keyboard.press('b');
    await bag.waitFor({ state: 'visible' });
    assert.equal(await page.locator('.backpack-grid li[data-found="true"]').count(), 4);
    assert.equal(await page.locator('.backpack-wallet strong').innerText(), '38');
    await shot('backpack-full');

    // Small phone and short landscape layouts scroll, without horizontal overflow.
    for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
        await page.setViewportSize({ width, height });
        await page.clock.runFor(100);
        const size = await bag.evaluate(el => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scroll: el.scrollWidth, client: el.clientWidth };
        });
        if (SHOTS && width === 320) await shot('backpack-small');
        assert.ok(size.left >= 0 && size.right <= width && size.top >= 0 && size.bottom <= height && size.scroll <= size.client, `backpack fits ${width}x${height}: ${JSON.stringify(size)}`);
        if (width === 390) await shot('backpack-mobile');
    }
    await page.keyboard.press('b');
    await bag.waitFor({ state: 'detached' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.runFor(100);
    const overlaps = await page.evaluate(() => {
        const a = document.querySelector('.backpack-toggle').getBoundingClientRect();
        const b = document.querySelector('.vibe-meter').getBoundingClientRect();
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    });
    assert.equal(overlaps, false, 'mobile backpack does not cover Vibe Run');
    await shot('world-mobile');
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').player.sprite.setPosition(0, 30));
    await page.reload();
    await page.waitForFunction(() => new Set(window.atv?.game.scene.getScene('Preview').tokens?.tokens.map(t => t.kind)).size === 4);
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').gremlins.next = Infinity; });
    await trigger.click();
    await bag.waitFor({ state: 'visible' });
    assert.equal(await page.locator('.backpack-grid li[data-found="true"]').count(), 4, 'collection survives reload');
    assert.equal(await page.locator('.backpack-wallet strong').innerText(), '38', 'token balance survives reload');
    await page.keyboard.press('Escape');
    await page.clock.runFor(1500);
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').enterHQ());
    await page.clock.runFor(100);
    assert.equal((await counters()).find(c => c.text === '38 T').visible, false, 'player counter hides inside HQ');
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').leaveHQ());
    await page.clock.runFor(100);
    assert.equal((await counters()).find(c => c.text === '38 T').visible, true, 'player counter returns outside HQ');
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.scene.launch('Library');
        s.scene.sleep();
    });
    await page.clock.runFor(100);
    assert.ok((await counters()).every(c => !c.visible), 'sleeping world hides its overhead counters');
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Library').children.list.find(c => c.name === 'token-count').text), '38 T', 'library player shows the same saved count');
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Library');
        s.bridge.leave();
    });
    await page.clock.runFor(100);

    // Repeated flyovers really drop specials as well as tokens, within the shared ground cap.
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.tokens.nextCar = 1000;
        s.player.sprite.setVisible(false);
        s.walkers.forEach(w => w.sprite.setVisible(false));
        s.bikeGang.sprites().forEach(sprite => sprite.setVisible(false));
        s.lockAndKey.sprites().forEach(sprite => sprite.setVisible(false));
    });
    await page.clock.runFor(46000);
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').tokens.count), 0, 'flight test starts with empty ground');
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        for (let i = 0; i < 6; i++) s.tokens.flyOver();
        // Keep the flight test in the plaza even as new districts expand the world's bounds.
        for (const car of s.tokens.cars) {
            car.dir = 1;
            car.ground = 100;
            car.car.x = -150;
            car.drops = [-80, 0, 80];
        }
    });
    await page.clock.runFor(20000);
    const drops = await page.evaluate(() => window.atv.game.scene.getScene('Preview').tokens.tokens.map(t => t.kind));
    assert.ok(drops.length <= 14, 'concurrent cars respect the ground cap');
    assert.ok(drops.includes('token'), 'cars still deliver tokens');
    assert.ok(drops.some(id => id !== 'token'), 'cars deliver special items');
    await page.clock.runFor(60000);
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').tokens.count), 0, 'unclaimed loot expires');
    assert.deepEqual(errors, [], 'no browser or game-loop errors');
    console.log('Backpack browser checks passed: pickup, tokens, persistence, input, NPCs, drops, expiry, desktop and mobile.');
} finally {
    await browser?.close();
    server.kill();
}
