// Real Phaser + React integration. Only this OS-assigned dev server and these browser contexts close.
import assert from 'node:assert/strict';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
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
const snapshot = page => page.evaluate(() => {
    const s = window.atv.game.scene.getScene('Preview');
    const parts = [s.player.sprite, s.player.shadow, s.player.marker, ...s.walkers.flatMap(w => [w.sprite, w.shadow, ...(w.label ? [w.label] : [])]),
        ...s.hq.surfRiders().flatMap(r => [r.sprite, ...(r.carry ?? []), ...(r.hide ?? [])]),
        ...(s.campus?.surfRiders().flatMap(r => [r.sprite, ...(r.hide ?? [])]) ?? [])];
    return {
        parts: parts.map(o => ({
            x: o.x, y: o.y, depth: o.depth, visible: o.visible, alpha: o.alpha,
            texture: o.texture.key, frame: o.frame.name, flipX: o.flipX,
            paused: o.anims?.isPaused, playing: o.anims?.isPlaying,
        })),
        indoor: s.insideHQ, score: s.vibeScore, count: s.vibeCollected, round: s.vibeRound,
        tokens: localStorage.getItem('atv-tokens'),
        grass: s.textures.get('preview-grass').getSourceImage().toDataURL(),
    };
});
const effectCount = page => page.evaluate(() => window.atv.game.scene.getScene('Preview').children.list.filter(o => o.name.startsWith('surf-')).length);
const stepOcean = (page, ms) => page.evaluate(ms => {
    const ocean = window.atv.game.scene.getScene('Preview').ocean;
    for (; ms > 0; ms -= 100) ocean.update(Math.min(ms, 100));
}, ms);
const endWave = page => page.evaluate(() => {
    const ocean = window.atv.game.scene.getScene('Preview').ocean;
    for (let i = 0; i < 201 && ocean.active; i++) ocean.update(100);
});
const shot = async (page, name) => {
    if (!shots) return;
    await page.evaluate(() => {
        const game = window.atv.game;
        const scene = game.scene.getScene('Preview');
        scene.events.emit('postupdate', scene.time.now, 0);
        game.renderer.preRender();
        game.scene.render(game.renderer);
        game.renderer.postRender();
    });
    await page.screenshot({ path: join(shots, `${name}.png`) });
};

async function open(query = '', reducedMotion = 'no-preference') {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
    await page.clock.install();
    await page.goto(`${server.resolvedUrls.local[0]}${query}`);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.ocean);
    await page.evaluate(() => document.fonts.ready);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10_000));
    // Keep the baseline deterministic; attacks are explicitly tested during the ride.
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').dragon.timer = 1e6; });
    return { context, page };
}

try {
    await server.listen();
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
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
    assert.ok(overlapping, 'exercise the real 200ms walking-to-seated overlap');
    assert.equal(await arrival.page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.ocean.trigger();
        window.atv.call.leave('Last Minute Surfer');
        return s.hq.surfRiders().filter(r => r.sprite.texture.key.startsWith('hq-walker-')).length;
    }), 0, 'departure also removes the fading walk-in copy during a wave');
    await endWave(arrival.page);
    await arrival.page.clock.runFor(500);
    assert.deepEqual(await arrival.page.evaluate(() => window.atv.call.list()), ['Ana', 'Ben']);
    await arrival.context.close();
    console.log('HQ departure during arrival-to-seat fade PASS');
    for (const [mode, query] of [['normal', '?call=Ana,Ben,Cy'], ['hq', '?hq&call=Ana,Ben,Cy'], ['crowd', '?hq&call=crowd']]) {
        const { context, page } = await open(query);
        // Pin the crowd's existing identities before stopping churn, then fill its last six seats.
        if (mode === 'crowd') {
            await page.evaluate(async () => {
                const { call } = await import('/src/call/roster.ts');
                call.list().forEach(person => call.join({ ...person, source: 'console' }));
                (await import('/src/call/demo.ts')).endDemo();
                for (let i = call.size; i < 48; i++) window.atv.call.join(`Crowd Surfer ${i + 1}`);
            });
            assert.equal(await page.evaluate(() => window.atv.call.list().length), 48);
            assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').hq.surfRiders().length), 48);
        }
        await page.keyboard.press('f');
        await page.clock.runFor(100);
        await shot(page, `${mode}-before`);
        const before = await snapshot(page);
        const tagsBefore = await page.evaluate(() => window.atv.game.scene.getScene('Preview').children.list
            .filter(o => o.name === 'creator-nametag').map(o => o.text).sort());
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger()), true);
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger()), false, 'no overlapping dev trigger');
        await page.clock.runFor(6800);
        await shot(page, `${mode}-crest-surfer`);
        if (mode === 'normal' && shots) {
            await page.evaluate(() => {
                const s = window.atv.game.scene.getScene('Preview');
                const surfer = s.children.getByName('surf-surfer');
                s.view.show({ x: surfer.x - 260, y: surfer.y - 160, width: 520, height: 380 });
            });
            await shot(page, 'crest-detail');
            await page.evaluate(() => { window.atv.game.scene.getScene('Preview').view.fit(); });
            await shot(page, `${mode}-crest-surfer`);
        }
        const during = await page.evaluate(() => {
            const s = window.atv.game.scene.getScene('Preview');
            const riders = [s.player.sprite, ...s.walkers.map(w => w.sprite), ...s.hq.surfRiders().map(r => r.sprite),
                ...(s.campus?.surfRiders().map(r => r.sprite) ?? [])];
            return {
                everyoneUp: riders.every(r => r.visible && r.depth > 2e6),
                surfer: s.children.getByName('surf-surfer').visible,
                barrel: s.children.getByName('surf-barrel').visible,
                timersPaused: s.time.timeScale === 0 && s.tweens.timeScale === 0,
                entryDisabled: !s.hq.facade.input.enabled,
                townPaused: !s.town || s.town.surfing,
                tagTexts: s.children.list.filter(o => o.name === 'creator-nametag').map(o => o.text).sort(),
                stored: JSON.parse(sessionStorage.getItem('atv:view')).player,
                x: s.player.sprite.x, y: s.player.sprite.y,
            };
        });
        assert.ok(during.everyoneUp && during.surfer && during.barrel && during.timersPaused && during.entryDisabled && during.townPaused);
        assert.deepEqual(during.tagTexts, tagsBefore, 'existing creator labels survive unchanged');
        assert.equal(during.stored.x, before.parts[0].x, 'camera saves the home position, not the ride');
        const z = await page.evaluate(() => window.atv.game.scene.getScene('Preview').cameras.main.zoom);
        await page.keyboard.press('+');
        await page.clock.runFor(100);
        assert.ok(await page.evaluate(z => window.atv.game.scene.getScene('Preview').cameras.main.zoom > z, z), 'zoom remains usable');
        await page.keyboard.press('f');
        await page.evaluate(() => {
            const s = window.atv.game.scene.getScene('Preview');
            const indoor = s.insideHQ;
            s.enterHQ(); s.leaveHQ();
            if (s.insideHQ !== indoor) throw Error('HQ entry changed during surf');
            s.dragon.timer = 0; // A competing attack must not run.
        });
        await page.keyboard.down('ArrowRight');
        await page.clock.runFor(250);
        await page.keyboard.up('ArrowRight');
        await stepOcean(page, 9000);
        await shot(page, `${mode}-draining`);
        await endWave(page);
        assert.equal(await effectCount(page), 0);
        assert.deepEqual(await snapshot(page), before, `${mode}: exact restoration before normal movement resumes`);
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').hq.facade.input.enabled), true);
        await shot(page, `${mode}-restored-grass`);
        // A second complete event must reuse textures, restore identically, and leave no effects.
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger()), true);
        await stepOcean(page, 7000);
        assert.equal(await effectCount(page), 6);
        await endWave(page);
        assert.deepEqual(await snapshot(page), before, `${mode}: second cycle restoration`);
        assert.equal(await effectCount(page), 0);
        console.log(`${mode}: two cycles, surfer/crest, controls, indoor/score/token/identity restoration PASS`);
        await context.close();
    }

    const { context, page } = await open('?hq&call=Ana,Ben');
    await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger());
    await stepOcean(page, 6000);
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        const departed = s.hq.byId.get('name:ana').coder;
        window.atv.call.leave('Ana');
        window.atv.call.join('Late Surfer');
        if (departed.active || departed.scene) throw Error('departed avatar survived');
        // Expand the world while the ocean is active.
        s.prop('bench', 1400, 850);
    });
    await page.clock.runFor(200);
    assert.equal(await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        return s.hq.byId.get('name:late surfer').coder.depth > 2e6;
    }), true, 'late joiner is carried immediately');
    await shot(page, 'expanded-world');
    await endWave(page);
    assert.deepEqual(await page.evaluate(() => window.atv.call.list()), ['Ben', 'Late Surfer']);
    await page.clock.runFor(2000);
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').hq.byId.has('name:ana')), false, 'no delayed resurrection');

    // Cadence is driven through the actual scene-owned ocean, without waiting two real minutes.
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.ocean.trigger();
        s.scene.sleep();
    });
    await page.clock.runFor(100); // ScenePlugin operations take effect on the next game step.
    assert.equal(await effectCount(page), 0, 'sleep cancels and restores');
    await page.clock.fastForward(300_000);
    await page.evaluate(() => { window.atv.game.scene.wake('Preview'); });
    await page.clock.runFor(100);
    assert.equal(await effectCount(page), 0, 'wake does not replay missed waves');
    const hidden = await page.evaluate(() => {
        const o = window.atv.game.scene.getScene('Preview').ocean;
        const now = o.clock.elapsed;
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        for (let i = 0; i < 2000; i++) o.update(100);
        const unchanged = now === o.clock.elapsed;
        delete document.hidden;
        return unchanged;
    });
    assert.ok(hidden, 'hidden documents do not accrue active world time');
    await stepOcean(page, 120_000);
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.active), true, 'natural cadence starts after active time');
    await endWave(page);
    await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        s.leaveHQ();
        s.player.sprite.setPosition(-330, 164);
    });
    await page.clock.runFor(100);
    const progress = await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        return { score: s.vibeScore, collected: s.vibeCollected, found: s.vibes.map(v => v.found), indoor: s.insideHQ };
    });
    assert.ok(progress.score > 0, 'restart test has real earned progress to preserve');
    const counts = await page.evaluate(() => {
        const s = window.atv.game.scene.getScene('Preview');
        return ['sleep', 'shutdown', 'destroy'].map(e => s.events.listeners(e).filter(fn => fn === s.ocean.cancel || fn === s.ocean.destroy).length);
    });
    const walkerCount = await page.evaluate(() => window.atv.game.scene.getScene('Preview').walkers.length);
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
            const s = window.atv.game.scene.getScene('Preview');
            s.ocean.trigger();
            s.scene.restart();
        });
        await page.clock.runFor(100);
        assert.equal(await effectCount(page), 0);
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').walkers.length), walkerCount);
        assert.deepEqual(await page.evaluate(() => {
            const s = window.atv.game.scene.getScene('Preview');
            return { score: s.vibeScore, collected: s.vibeCollected, found: s.vibes.map(v => v.found), indoor: s.insideHQ };
        }), progress, 'restarts preserve score, collected identities, and indoor state');
        assert.deepEqual(await page.evaluate(() => {
            const s = window.atv.game.scene.getScene('Preview');
            return ['sleep', 'shutdown', 'destroy'].map(e => s.events.listeners(e).filter(fn => fn === s.ocean.cancel || fn === s.ocean.destroy).length);
        }), counts, 'restarts do not accumulate scene listeners');
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger()), true);
        assert.equal(await effectCount(page), 6, 'restart has one effect, not duplicate owners');
        await endWave(page);
    }
    console.log('joins/leaves, expanded bounds, hidden time, sleep/wake and three restarts PASS');
    await context.close();

    const reduced = await open('?hq&call=Ana,Ben', 'reduce');
    const before = await snapshot(reduced.page);
    await reduced.page.evaluate(() => window.atv.game.scene.getScene('Preview').ocean.trigger());
    await stepOcean(reduced.page, 7000);
    const after = await snapshot(reduced.page);
    assert.deepEqual(after.parts.map(p => [p.x, p.y]), before.parts.map(p => [p.x, p.y]), 'reduced motion has no avatar displacement');
    assert.equal(await reduced.page.evaluate(() => window.atv.game.scene.getScene('Preview').children.getByName('surf-surfer').angle), 0);
    await shot(reduced.page, 'reduced-motion');
    await endWave(reduced.page);
    assert.deepEqual(await snapshot(reduced.page), before);
    await reduced.context.close();
    assert.deepEqual(errors, [], 'no browser errors or swallowed game-frame exceptions');
    console.log('reduced motion and browser error checks PASS');
} finally {
    await browser?.close();
    await server.close();
}
