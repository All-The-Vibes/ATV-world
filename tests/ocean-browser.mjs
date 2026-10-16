// Real Phaser integration, using the repository's existing Playwright + Vite dependencies.
import assert from 'node:assert/strict';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const shots = process.env.OCEAN_SCREENSHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const server = await createServer({ server: {
    host: '127.0.0.1', port: 0, strictPort: true,
    fs: { allow: [process.cwd(), realpathSync('node_modules')] },
} });
let browser;
const errors = [];
const step = (page, ms) => page.evaluate(ms => {
    const o = window.atv.game.scene.getScene('Preview').ocean;
    for (; ms > 0; ms -= 100) o.update(Math.min(100, ms));
}, ms);
const end = page => page.evaluate(() => {
    const o = window.atv.game.scene.getScene('Preview').ocean;
    for (let i = 0; i < 201 && o.active; i++) o.update(100);
});
const effects = page => page.evaluate(() => window.atv.game.scene.getScene('Preview').children.list.filter(p => p.name.startsWith('surf-')).length);
const shot = async (page, name) => {
    if (!shots) return;
    await page.evaluate(() => {
        const g = window.atv.game, s = g.scene.getScene('Preview');
        s.events.emit('postupdate', s.time.now, 0);
        g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender();
    });
    await page.screenshot({ path: join(shots, `${name}.png`) });
};
const snapshot = page => page.evaluate(() => {
    const s = window.atv.game.scene.getScene('Preview');
    return {
        parts: window.surfParts.map(p => ({
            x: p.x, y: p.y, depth: p.depth, visible: p.visible, alpha: p.alpha,
            texture: p.texture.key, frame: p.frame.name, flipX: p.flipX,
            paused: p.anims?.isPaused, playing: p.anims?.isPlaying,
        })),
        indoor: s.insideHQ, score: s.vibeScore, collected: s.vibeCollected,
        tokens: localStorage.getItem('atv-tokens'), backpack: localStorage.getItem('atv-backpack'),
        tags: s.children.list.filter(p => p.name === 'creator-nametag').map(p => p.text).sort(),
        grass: s.textures.get('preview-grass').getSourceImage().toDataURL(),
    };
});
async function open(query = '', reducedMotion = 'no-preference', width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
    await page.clock.install();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 60_000));
    await page.goto(`${server.resolvedUrls.local[0]}${query}`);
    let ready = false;
    for (let i = 0; i < 400 && !ready; i++) {
        await page.clock.runFor(50);
        ready = await page.evaluate(() => !!window.atv?.game?.scene.getScene('Preview')?.ocean);
        if (!ready) await sleep(25);
    }
    assert.ok(ready, 'world initialized');
    await page.evaluate(() => document.fonts.ready);
    await page.clock.runFor(100);
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').dragon.timer = 1e6; });
    return { context, page };
}
async function remember(page) {
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        window.surfParts = s.children.list.filter(p => p.texture && p.depth > -1e8 && p.depth < 2e6
            && p.type !== 'Text');
        window.surfHomes = new Map(window.surfParts.map(p => [p, { x: p.x, y: p.y, visible: p.visible }]));
    });
    return snapshot(page);
}
try {
    await server.listen();
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
    for (const [mode, query] of [['normal', '?call=Ana,Ben,Cy'], ['hq', '?hq&call=Ana,Ben,Cy'], ['crowd', '?hq&call=crowd']]) {
        const { context, page } = await open(query);
        if (mode === 'crowd') {
            await page.evaluate(async () => {
                const { call } = await import('/src/call/roster.ts');
                call.list().forEach(p => call.join({ ...p, source: 'console' }));
                (await import('/src/call/demo.ts')).endDemo();
                for (let i = call.size; i < 48; i++) window.atv.call.join(`Surf Guest ${i}`);
            });
            assert.equal(await page.evaluate(() => window.atv.call.list().length), 48);
        }
        await page.keyboard.press('f');
        await page.clock.runFor(100);
        await shot(page, `${mode}-before`);
        const before = await remember(page);
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger()), true);
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger()), false);
        await page.evaluate(() => { window.surfLifted = new Set(); window.surfX = []; });
        for (let second = 1; second <= 20; second++) {
            await page.evaluate(() => {
                const s = window.atv.game.scene.getScene('Preview');
                for (let i = 0; i < 10; i++) {
                    s.ocean.update(100);
                    for (const [p, home] of window.surfHomes) {
                        if (p.x < home.x - 10 && p.y < home.y - 20) window.surfLifted.add(p);
                    }
                }
                const surfer = s.children.getByName('surf-surfer');
                if (surfer) window.surfX.push(surfer.x);
            });
            if ([7, 10, 13].includes(second)) await shot(page, `${mode}-wave-${second}`);
            if (second === 10) {
                const status = await page.evaluate(() => {
                    const s = window.atv.game.scene.getScene('Preview');
                    s.view.save();
                    return { timers: s.time.timeScale === 0 && s.tweens.timeScale === 0,
                        entry: !s.hq.facade.input.enabled, indoor: s.insideHQ,
                        stored: JSON.parse(sessionStorage.getItem('atv:view')).player,
                        tags: s.children.list.filter(p => p.name === 'creator-nametag').map(p => p.text).sort(),
                        home: window.surfHomes.get(s.player.sprite) };
                });
                assert.ok(status.timers && status.entry);
                assert.equal(status.indoor, before.indoor);
                assert.deepEqual(status.tags, before.tags, 'creator identities survive the wave unchanged');
                assert.equal(status.stored.x, status.home.x);
                assert.equal(status.stored.y, status.home.y);
                await page.evaluate(() => {
                    const s = window.atv.game.scene.getScene('Preview'), indoor = s.insideHQ;
                    s.enterHQ(); s.leaveHQ(); s.blastOff(); s.enterWonderland(); s.enterPlanetarium();
                    if (s.insideHQ !== indoor || s.rocketing || s.tumbling) throw Error('entry during wave');
                });
                if (mode === 'normal') {
                    await page.evaluate(() => {
                        const s = window.atv.game.scene.getScene('Preview'), p = s.children.getByName('surf-surfer');
                        s.view.show({ x: p.x - 380, y: p.y - 210, width: 950, height: 800 });
                    });
                    await shot(page, 'crest-detail');
                    await page.evaluate(() => window.atv.game.scene.getScene('Preview').view.fit());
                }
            }
        }
        const lifted = await page.evaluate(() => {
            const s = window.atv.game.scene.getScene('Preview'), all = [...window.surfHomes.keys()];
            const check = p => window.surfLifted.has(p);
            return {
                rightToLeft: window.surfX.every((x, i, a) => !i || x < a[i - 1]),
                houses: all.filter(p => /^(preview-building|town-house)/.test(p.texture.key)).map(check),
                billboard: all.filter(p => p.texture.key.startsWith('billboard-frame')).map(check),
                rocket: all.filter(p => p.texture.key === 'rocket').map(check),
                people: [...new Set([...s.ocean.opts.riders().map(r => r.sprite),
                    ...all.filter(p => p.type === 'Sprite' && p.active && window.surfHomes.get(p).visible)])].map(check),
                sceneryCount: window.surfLifted.size,
            };
        });
        assert.ok(lifted.rightToLeft, 'screen-space travel is strictly right to left');
        for (const kind of ['houses', 'billboard', 'rocket', 'people']) {
            assert.ok(lifted[kind].length && lifted[kind].every(Boolean), `all ${kind} visibly rise and move left: ${JSON.stringify(lifted)}`);
        }
        assert.equal(await effects(page), 0);
        assert.deepEqual(await snapshot(page), before, 'exact restoration of scenery, people, frames and game state');
        await shot(page, `${mode}-restored-grass`);
        await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger());
        await step(page, 9000);
        assert.equal(await effects(page), 6);
        await end(page);
        assert.deepEqual(await snapshot(page), before, 'second cycle is drift-free');
        assert.equal(await effects(page), 0);
        console.log(`${mode}: direction, ${lifted.sceneryCount} lifted objects, all avatars, two cycles and exact restoration PASS`);
        // Exercise real keyboard/camera controls and resumed play after deterministic checks.
        const x = await page.evaluate(() => window.atv.game.scene.getScene('Preview').player.sprite.x);
        await page.keyboard.down('ArrowRight'); await page.clock.runFor(250); await page.keyboard.up('ArrowRight');
        assert.notEqual(await page.evaluate(() => window.atv.game.scene.getScene('Preview').player.sprite.x), x, 'movement resumes');
        await context.close();
    }

    const { context, page } = await open('?hq&call=Ana,Ben');
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger());
    await step(page, 9000);
    const rebase = await page.evaluate(async () => {
        const s = window.atv.game.scene.getScene('Preview');
        const { HQ_SPOTS } = await import('/src/game/hq/art.ts');
        const old = s.hq.byId.get('name:ana').coder;
        window.atv.call.leave('Ana');
        for (let i = 0; i < 24; i++) window.atv.call.join(`Late Surfer ${i}`);
        s.ocean.update(100);
        return { departed: !old.active && !old.scene, signHome: s.hq.bounds().top + HQ_SPOTS.sign.y };
    });
    assert.ok(rebase.departed);
    await end(page);
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').hq.sign.y), rebase.signHome, 'HQ expansion is restored to its new correct roof');
    assert.equal(await page.evaluate(() => window.atv.call.list().includes('Ana')), false);
    // Expanded horizontal bounds are included in the next right-to-left sweep.
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.prop('bench', s.worldBounds.right + 900, 850);
        window.expandedBench = s.children.list.filter(p => p.texture?.key === 'preview-prop-bench').sort((a, b) => b.x - a.x)[0];
        s.view.fit();
    });
    await page.clock.runFor(50);
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger());
    assert.ok(await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview'), p = window.expandedBench, homeY = p.y;
        let lifted = false;
        for (let i = 0; i < 200 && !lifted; i++) {
            s.ocean.update(100);
            lifted ||= p.y < homeY - 20;
        }
        return lifted;
    }), 'scenery beyond the original horizontal bounds also rides');
    await shot(page, 'expanded-world');
    assert.ok(await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview'), p = s.children.getByName('surf-surfer'), x = p.x;
        s.view.show({ x: -800, y: -500, width: 900, height: 800 });
        s.ocean.update(0);
        return x === p.x;
    }), 'camera changes do not move or reverse the wave at the same elapsed time');
    const zoom = await page.evaluate(() => window.atv.game.scene.getScene('Preview').cameras.main.zoom);
    await page.keyboard.press('+'); await page.clock.runFor(100);
    assert.ok(await page.evaluate(z => window.atv.game.scene.getScene('Preview').cameras.main.zoom > z, zoom));
    assert.ok(await page.evaluate(async () => {
        const s = window.atv.game.scene.getScene('Preview'), { send } = await import('/src/game/commands.ts');
        send('toggleStranger');
        s.ocean.update(0);
        return s.inHell && !s.surfacePortal.visible && s.hellPortal.visible
            && s.terrain.things.every(p => !p.visible);
    }), 'overlay theme changes remain usable during the wave');
    await page.evaluate(async () => {
        const s = window.atv.game.scene.getScene('Preview'), { send } = await import('/src/game/commands.ts');
        send('toggleStranger'); s.ocean.update(0);
    });
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').scene.sleep(); });
    await page.clock.runFor(100);
    assert.equal(await effects(page), 0, 'sleep cleans up');
    await page.clock.fastForward(300000);
    await page.evaluate(() => { window.atv.game.scene.wake('Preview'); });
    await page.clock.runFor(100);
    assert.equal(await effects(page), 0, 'wake never replays missed events');
    assert.ok(await page.evaluate(() => {
        const o = window.atv.game.scene.getScene('Preview').ocean, before = o.clock.elapsed;
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        for (let i = 0; i < 2000; i++) o.update(100);
        delete document.hidden;
        return before === o.clock.elapsed;
    }));
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
            const s = window.atv.game.scene.getScene('Preview');
            s.ocean.trigger(); s.scene.restart();
        });
        await page.clock.runFor(100);
        assert.equal(await effects(page), 0);
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').events.listenerCount('surf:rebase')), 1);
    }
    await step(page, 119000);
    assert.equal(await effects(page), 0);
    await step(page, 1000);
    assert.equal(await effects(page), 6, 'natural 120s cadence');
    await end(page);
    await context.close();
    console.log('live HQ joins/leaves/resize, expanded world, zoom, sleep/wake/hidden time, three restarts, natural cadence PASS');

    const arrival = await open('?hq&call=Ana,Ben');
    await arrival.page.clock.runFor(2600);
    await arrival.page.evaluate(() => { window.atv.call.join('Last Minute Surfer'); });
    let overlapping = false;
    for (let i = 0; i < 100 && !overlapping; i++) {
        await arrival.page.clock.runFor(50);
        overlapping = await arrival.page.evaluate(() => {
            const hq = window.atv.game.scene.getScene('Preview').hq;
            return !!hq.byId.get('name:last minute surfer')?.coder && hq.onFoot.size > 0;
        });
    }
    assert.ok(overlapping, 'exercise the real walking-to-seated overlap');
    assert.equal(await arrival.page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.ocean.trigger();
        window.atv.call.leave('Last Minute Surfer');
        return s.hq.surfRiders().filter(r => r.sprite.texture.key.startsWith('hq-walker-')).length;
    }), 0, 'departure removes the fading walk-in copy during a wave');
    await end(arrival.page);
    await arrival.page.clock.runFor(500);
    assert.deepEqual(await arrival.page.evaluate(() => window.atv.call.list()), ['Ana', 'Ben']);
    await arrival.context.close();
    console.log('HQ departure during arrival-to-seat fade PASS');

    const reduced = await open('?hq&call=Ana,Ben', 'reduce', 390);
    const before = await remember(reduced.page);
    await reduced.page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger());
    await step(reduced.page, 10000);
    const during = await snapshot(reduced.page);
    assert.deepEqual(during.parts.map(p => [p.x, p.y]), before.parts.map(p => [p.x, p.y]), 'reduced motion: no displacement');
    assert.equal(await reduced.page.evaluate(() => window.atv.game.scene.getScene('Preview').children.getByName('surf-surfer').angle), 0);
    const stillX = await reduced.page.evaluate(() => window.atv.game.scene.getScene('Preview').children.getByName('surf-surfer').x);
    await step(reduced.page, 1000);
    assert.equal(await reduced.page.evaluate(() => window.atv.game.scene.getScene('Preview').children.getByName('surf-surfer').x), stillX, 'reduced motion has no screen-wide travel');
    await shot(reduced.page, 'mobile-reduced-motion');
    await end(reduced.page);
    assert.deepEqual(await snapshot(reduced.page), before);
    await reduced.context.close();
    assert.deepEqual(errors, [], 'no browser or swallowed frame exceptions');
    console.log('mobile reduced motion and browser errors PASS');
} finally {
    await browser?.close();
    await server.close();
}
