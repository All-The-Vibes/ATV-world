// Real Phaser regression coverage; Vite binds an OS-assigned port and only this server is closed.
import assert from 'node:assert/strict';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const shots = process.env.NAMETAG_SCREENSHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const server = await createServer({
    server: { host: '127.0.0.1', port: 0, strictPort: true, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
const expectedTags = [...Array(6).fill('@Bakar404'), '@DeaderestPool', '@aifateen', ...Array(15).fill('@markbriggs-ms'), '@vvundela1111'].sort();
let browser;
try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    // The unrelated traffic-light widget must not make this regression test depend on live GitHub CI.
    await page.route('**/api/health', route => route.fulfill({ json: { state: 'unknown', message: 'AWAITING CI' } }));
    await page.clock.install();
    await page.goto(`${origin}/?call=Ana,Ben`);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.player?.sprite);
    await page.evaluate(() => document.fonts.ready);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 200));
    const tags = () => page.evaluate(() => window.atv.game.scene.getScene('Preview').children.list
        .filter(o => o.name === 'creator-nametag').map(o => o.text).sort());
    assert.deepEqual(await tags(), expectedTags,
        'only verified character creators are labeled, never Teams display names');
    assert.equal(await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.walker(6, 'Abdallah');
        const unknown = scene.walkers.pop();
        const unlabeled = unknown.nametag === undefined;
        [unknown.sprite, unknown.shadow, unknown.label].forEach(o => o?.destroy());
        return unlabeled;
    }), true, 'a matching character name does not infer creator ownership');

    assert.deepEqual(await page.evaluate(async () => {
        const { randomLook, lookKey, PLAYER_LOOK } = await import('/src/game/kit/characters.ts');
        const { callerLook } = await import('/src/game/hq/art.ts');
        const unknown = randomLook('same');
        const named = randomLook('same', { githubUsername: 'MiXeD-Case' });
        return {
            unknown: unknown.githubUsername ?? null,
            preserved: named.githubUsername,
            sameTexture: lookKey(unknown) === lookKey(named),
            player: PLAYER_LOOK.githubUsername,
            hq: callerLook('Bakar404').githubUsername ?? null,
        };
    }), { unknown: null, preserved: 'MiXeD-Case', sameTexture: true, player: 'vvundela1111', hq: null },
    'metadata is explicit, case-preserving, and independent of texture keys or participant IDs');

    assert.deepEqual(await page.evaluate(async () => {
        const { addCreatorNametag } = await import('/src/game/kit/nametag.ts');
        const scene = window.atv.game.scene.getScene('Preview');
        const before = ['postupdate', 'sleep', 'wake'].map(event => scene.events.listenerCount(event));
        const sprite = scene.add.sprite(80, 100, 'preview-player', 'side-0').setOrigin(0.5, 1);
        const unknown = addCreatorNametag(sprite, {});
        const label = addCreatorNametag(sprite, { githubUsername: 'MiXeD-Case' });
        sprite.setPosition(110, 150).setFlipX(true).setDepth(150).setAlpha(0.4);
        scene.events.emit('postupdate');
        const follows = label.x === 110 && label.y === 126 && label.depth > sprite.depth;
        const readable = label.text === '@MiXeD-Case' && !label.flipX && label.scaleX > 0 && label.alpha === sprite.alpha;
        sprite.setVisible(false);
        scene.events.emit('postupdate');
        const hidden = !label.visible;
        sprite.setVisible(true).setActive(false);
        scene.events.emit('postupdate');
        const inactive = !label.visible;
        sprite.setActive(true);
        scene.events.emit('postupdate');
        const restored = label.visible;
        label.destroy();
        const detached = ['postupdate', 'sleep', 'wake'].every((event, i) => scene.events.listenerCount(event) === before[i])
            && sprite.listenerCount('destroy') === 0;
        const replacement = addCreatorNametag(sprite, { githubUsername: 'OtherCreator' });
        sprite.destroy();
        const destroyed = !replacement.scene
            && ['postupdate', 'sleep', 'wake'].every((event, i) => scene.events.listenerCount(event) === before[i]);
        return { unknown: unknown === undefined, follows, readable, hidden, inactive, restored, detached, destroyed };
    }), { unknown: true, follows: true, readable: true, hidden: true, inactive: true, restored: true, detached: true, destroyed: true },
    'real Phaser sprites drive position, alpha, visibility, active state, and leak-free cleanup');
    assert.equal(await page.evaluate(async () => {
        const { addCreatorNametag } = await import('/src/game/kit/nametag.ts');
        const scene = window.atv.game.scene.getScene('Preview');
        const load = document.fonts.load;
        document.fonts.load = () => Promise.reject(new Error('test: font unavailable'));
        const sprite = scene.add.sprite(0, 0, 'preview-player', 'down-0');
        try {
            const label = addCreatorNametag(sprite, { githubUsername: 'Fallback' });
            await Promise.resolve();
            return label.text === '@Fallback' && label.visible;
        } finally {
            document.fonts.load = load;
            sprite.destroy();
        }
    }), true, 'font failure retains a readable fallback without an unhandled rejection');

    // Stop random attacks; speech is exercised deliberately below.
    await page.evaluate(() => { window.atv.game.scene.getScene('Preview').dragon.timer = 1e9; });
    for (const [size, width, height] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
        await page.setViewportSize({ width, height });
        await page.keyboard.press('f');
        await page.clock.runFor(200);
        if (shots) await page.screenshot({ path: join(shots, `nametags-${size}.png`) });
        const start = await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.kittens.visitors.forEach(v => { v.stage = 'idle'; v.timer = 1e9; v.bubble.setVisible(false); });
            scene.walkers.forEach(w => { w.rest = 0; });
            return { player: scene.player.sprite.x, walker: scene.walkers[0].sprite.x };
        });
        await page.keyboard.down('ArrowLeft');
        await page.clock.runFor(350);
        await page.keyboard.up('ArrowLeft');
        await page.clock.runFor(50);
        const moved = await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            const { sprite, marker, nametag } = scene.player;
            const walker = scene.walkers[0];
            return {
                player: sprite.x, walker: walker.sprite.x,
                attached: Math.abs(nametag.x - sprite.x) < 1e-6 && Math.abs(walker.nametag.x - walker.sprite.x) < 1e-6,
                facing: sprite.flipX && !nametag.flipX && nametag.scaleX > 0,
                markerClear: nametag.getBottomCenter().y < marker.getTopCenter().y,
                readable: parseInt(nametag.style.fontSize) * nametag.scaleY * scene.cameras.main.zoom >= 12 - 1e-6,
            };
        });
        assert.ok(moved.player < start.player && moved.walker !== start.walker, `${size}: player and NPC move`);
        assert.ok(moved.attached && moved.facing && moved.markerClear && moved.readable,
            `${size}: readable, unmirrored labels clear the player marker: ${JSON.stringify(moved)}`);
        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.dragon.burn(scene.burnables().find(t => t.sprite === scene.player.sprite));
            scene.dragon.burn(scene.burnables().find(t => t.sprite === scene.walkers[1].sprite));
        });
        await page.clock.runFor(1400);
        assert.equal(await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            return [...scene.dragon.burns.values()].every(b => b.bubble.alpha > 0
                && b.bubble.getBottomCenter().y < b.nametag.getTopCenter().y);
        }), true, `${size}: speech bubbles clear the nametags`);
        if (shots) await page.screenshot({ path: join(shots, `nametags-${size}-speech.png`) });
        await page.keyboard.press('+');
        await page.clock.runFor(150);
        assert.equal(await page.evaluate(() => [...window.atv.game.scene.getScene('Preview').dragon.burns.values()]
            .every(b => b.bubble.getBottomCenter().y < b.nametag.getTopCenter().y)), true, 'speech stays clear after zooming');
        assert.equal(await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.cameras.main.setZoom(0.25);
            scene.dragon.update(0);
            scene.events.emit('postupdate');
            return [...scene.dragon.burns.values()].every(b => b.bubble.getBottomCenter().y < b.nametag.getTopCenter().y);
        }), true, 'speech clears the enlarged label on the first zoom-out frame');
        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.kittens.pmSays('HERDING CATS');
            const visitor = scene.kittens.visitors[0];
            visitor.stage = 'return';
            visitor.timer = 10;
            visitor.homeY = visitor.person.sprite.y + 100;
            visitor.person.hold(10);
            visitor.bubble.setVisible(true);
        });
        await page.clock.runFor(100);
        assert.equal(await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            const manager = scene.kittens;
            const visitor = manager.visitors[0];
            const named = scene.walkers.find(w => w.label);
            return manager.managerBubble.getBottomCenter().y < manager.managerNametag.getTopCenter().y
                && manager.managerNametag.getBottomCenter().y < manager.label.getTopCenter().y
                && visitor.bubble.getBottomCenter().y < visitor.person.nametag.getTopCenter().y
                && named.nametag.getBottomCenter().y < named.label.getTopCenter().y
                && scene.disco.dancers.every(d => d.nametag.text === '@markbriggs-ms'
                    && Math.abs(d.nametag.x - d.sprite.x) < 1e-6 && !d.nametag.flipX);
        }), true, `${size}: new dancers, named walker, project manager and kitten conversations retain attribution and spacing`);

        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.player.sprite.setPosition(scene.sortingHat.stool.x, scene.sortingHat.stool.y);
        });
        await page.clock.runFor(1000);
        assert.equal(await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            return scene.sortingHat.bubble?.getBottomCenter().y < scene.player.nametag.getTopCenter().y;
        }), true, `${size}: sorting-hat speech clears the player nametag`);
        for (let zoom = 0; zoom < 4; zoom++) await page.keyboard.press('+');
        await page.clock.runFor(200);
        if (shots) await page.screenshot({ path: join(shots, `nametags-${size}-zoomed.png`) });

        await page.evaluate(() => window.atv.game.scene.getScene('Preview').enterHQ());
        await page.clock.runFor(100);
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').player.nametag.visible), false,
            `${size}: going inside HQ hides the player label`);
        await page.keyboard.press('ArrowDown');
        await page.clock.runFor(100);
        assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Preview').player.nametag.visible), true,
            `${size}: stepping out restores it`);

        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            scene.player.sprite.setPosition(scene.entrance.x, scene.libraryFoot.centerY);
        });
        await page.clock.runFor(400);
        assert.equal(await page.evaluate(() => {
            const game = window.atv.game;
            const outside = game.scene.getScene('Preview');
            const inside = game.scene.getScene('Library');
            const label = inside.children.list.find(o => o.name === 'creator-nametag');
            return outside.sys.isSleeping() && !outside.player.nametag.visible
                && label?.text === '@vvundela1111' && Math.abs(label.x - inside.player.x) < 1e-6;
        }), true, `${size}: library entry transfers the same creator without a visible outdoor duplicate`);
        await page.keyboard.down('ArrowLeft');
        await page.clock.runFor(200);
        await page.keyboard.up('ArrowLeft');
        await page.clock.runFor(50);
        assert.equal(await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Library');
            const label = scene.children.list.find(o => o.name === 'creator-nametag');
            return Math.abs(label.x - scene.player.x) < 1e-6 && Math.abs(label.y - (scene.player.y - 24)) < 1e-6 && !label.flipX;
        }), true, `${size}: library movement keeps the label attached`);
        if (shots) await page.screenshot({ path: join(shots, `nametags-${size}-library.png`) });
        await page.evaluate(() => window.atv.game.scene.getScene('Library').bridge.leave());
        await page.clock.runFor(200);
        assert.deepEqual(await page.evaluate(() => {
            const game = window.atv.game;
            return {
                insideLabels: game.scene.getScene('Library').children.list.filter(o => o.name === 'creator-nametag').length,
                visible: game.scene.getScene('Preview').player.nametag.visible,
            };
        }), { insideLabels: 0, visible: true }, `${size}: scene shutdown removes its label and wake restores the outdoor one`);
        await page.evaluate(() => { window.atv.game.scene.getScene('Preview').player.sprite.setPosition(0, 158); });
    }

    await page.evaluate(() => window.atv.game.scene.getScene('Preview').blastOff(true));
    await page.clock.runFor(300);
    assert.equal(await page.evaluate(() => window.atv.game.scene.getScene('Mars').children.list
        .find(o => o.name === 'creator-nametag')?.visible), false, 'Mars hides the player label while landing');
    await page.clock.runFor(2200);
    assert.equal(await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Mars');
        const label = scene.children.list.find(o => o.name === 'creator-nametag');
        return label?.text === '@vvundela1111' && label.visible && label.x === scene.player.x;
    }), true, 'Mars restores the same creator when the player disembarks');
    await page.evaluate(() => window.atv.game.scene.getScene('Mars').flyHome());
    await page.clock.runFor(7000);
    assert.equal(await page.evaluate(() => {
        const game = window.atv.game;
        return !game.scene.getScene('Mars').children.list.some(o => o.name === 'creator-nametag')
            && game.scene.getScene('Preview').player.nametag.visible;
    }), true, 'returning from Mars cleans up its label and restores the world label');

    // HQ ownership is unresolved: changing a Teams identity, name, or "me" flag never claims authorship.
    await page.evaluate(async () => {
        const { call } = await import('/src/call/roster.ts');
        call.join({ id: 'unverified', name: 'Bakar404', me: true, source: 'teams', githubUsername: 'PretendCreator' });
    });
    await page.clock.runFor(5000);
    assert.deepEqual(await tags(), expectedTags, 'HQ arrivals and roster fields do not invent attribution');
    assert.equal(await page.evaluate(async () => {
        const { addCreatorNametag } = await import('/src/game/kit/nametag.ts');
        const scene = window.atv.game.scene.getScene('Preview');
        const desk = scene.hq.desks.find(d => d.coder?.flipX);
        const label = addCreatorNametag(desk.coder, { githubUsername: 'TestCreator' }, { headOffsetX: -6 });
        desk.nametag = label;
        window.testHqLabel = label;
        scene.hq.say(desk, 'HI!');
        window.testHqBubble = scene.children.list.findLast(o => o.texture?.key === 'hq-bubble-HI!');
        return label.x === desk.coder.x + 20 && !label.flipX;
    }), true, 'seated HQ labels center over the head, not the monitor, even when flipped');
    await page.clock.runFor(250);
    const hqSpeech = await page.evaluate(() => ({
        bottom: window.testHqBubble.getBottomCenter().y,
        top: window.testHqLabel.getTopCenter().y,
        alpha: window.testHqBubble.alpha,
    }));
    assert.ok(hqSpeech.alpha > 0 && hqSpeech.bottom < hqSpeech.top,
        `HQ speech clears an explicitly attributed coder: ${JSON.stringify(hqSpeech)}`);
    await page.evaluate(async () => {
        const { call } = await import('/src/call/roster.ts');
        const scene = window.atv.game.scene.getScene('Preview');
        call.leave(scene.hq.desks.find(d => d.nametag === window.testHqLabel).caller.id);
    });
    await page.clock.runFor(200);
    assert.equal(await page.evaluate(() => window.testHqLabel.alpha < 1), true, 'HQ departure fades the label with the coder');
    await page.clock.runFor(400);
    assert.equal(await page.evaluate(() => !window.testHqLabel.scene), true, 'HQ departure destroys the label');
    assert.deepEqual(errors, [], 'no browser or game-loop errors');
    console.log('Creator nametag browser checks passed: attribution, movement, turning, zoom, visibility, speech, HQ, scene transitions, cleanup, desktop and mobile.');
} finally {
    await browser?.close();
    await server.close();
}
