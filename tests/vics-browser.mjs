import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({
    server: { host: '127.0.0.1', port: 0, strictPort: true, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
});
let browser;
try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/health', route => route.fulfill({ json: { state: 'unknown', message: 'AWAITING CI' } }));
    await page.goto(`${origin}/?time=day`);
    await page.waitForFunction(() => window.atv?.game?.scene.getScene('Preview')?.roamers);
    const initial = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        scene.scene.pause();
        const roamers = scene.roamers;
        roamers.destroy();
        for (const id of roamers.timers.keys()) roamers.timers.set(id, Infinity);
        const lights = scene.atmosphere.lights.length;
        const listeners = scene.events.listenerCount('postupdate');
        roamers.spawn('vics');
        const r = roamers.active.get('vics');
        r.sprite.setPosition(100, 100);
        r.tx = 300;
        r.ty = 100;
        r.life = 1000;
        r.greetCd = Infinity;
        r.handle.world.dragon = () => undefined;
        r.handle.world.gremlins = () => undefined;
        r.handle.world.player = () => undefined;
        roamers.update(0.1);
        scene.atmosphere.setTime(0.33);
        scene.atmosphere.render();
        scene.events.emit('postupdate');
        const creator = r.sprite.getData('creatorNametag');
        return {
            lights, listeners, x: r.sprite.x, texture: r.sprite.texture.key,
            name: r.tag.text, creator: creator.text,
            labelAboveCreator: r.tag.y < creator.y - creator.displayHeight,
            directory: scene.directory.locate('visitor-vics'),
            catalog: roamers.catalog().find(c => c.id === 'vics')?.name,
            dayAlpha: scene.children.getByName('vics-neon').alpha,
            shield: scene.children.getByName('vics-shield').visible,
        };
    });
    assert.equal(initial.texture, 'roamer-vics');
    assert.equal(initial.name, '@vics');
    assert.equal(initial.creator, '@vicslive');
    assert.ok(initial.labelAboveCreator, 'community name and creator attribution do not overlap');
    assert.equal(initial.catalog, '@vics');
    assert.ok(initial.directory, 'the automatically discovered visitor can be found in character search');
    assert.equal(initial.dayAlpha, 0, 'neon emission is off in daylight');
    assert.equal(initial.shield, false, 'no shield when the dragon is away');

    const motion = await page.evaluate(async () => {
        const scene = window.atv.game.scene.getScene('Preview');
        const r = scene.roamers.active.get('vics');
        for (let i = 0; i < 10; i++) scene.roamers.update(0.1);
        r.sprite.setFlipX(true).setFrame('side-2');
        scene.events.emit('postupdate');
        const neon = scene.children.getByName('vics-neon');
        const pixels = r.sprite.texture.getSourceImage().getContext('2d').getImageData(0, 0, 32, 44).data;
        let fuzzy = 0, eyes = 0, board = 0;
        for (let y = 0; y < 44; y++) {
            for (let x = 0; x < 32; x++) {
                const i = (y * 32 + x) * 4;
                if (!pixels[i + 3]) continue;
                if (y < 21 && pixels[i] > 100 && pixels[i + 2] > pixels[i + 1] * 1.3) fuzzy++;
                if (y < 14 && pixels[i] > 230 && pixels[i + 1] > 230 && pixels[i + 2] > 230) eyes++;
                if (y >= 35 && pixels[i] > 150 && pixels[i + 2] > 100) board++;
            }
        }
        const { toggleGithubLabels } = await import('/src/game/commands.ts');
        toggleGithubLabels();
        scene.roamers.update(0);
        const labelsOff = { name: r.tag.visible, creator: r.sprite.getData('creatorNametag').visible };
        toggleGithubLabels();
        scene.roamers.update(0);
        return {
            x: r.sprite.x, neonX: neon.x, neonY: neon.y, spriteY: r.sprite.y,
            frame: neon.frame.name, flip: neon.flipX, fuzzy, eyes, board, labelsOff,
        };
    });
    assert.ok(motion.x > initial.x + 40, 'the hoverboard actually travels through town');
    assert.equal(motion.neonX, motion.x);
    assert.equal(motion.neonY, motion.spriteY);
    assert.equal(motion.frame, 'side-2');
    assert.equal(motion.flip, true);
    assert.ok(motion.fuzzy > 100 && motion.eyes > 35, 'a fuzzy purple head and oversized white puppet eyes are drawn');
    assert.ok(motion.board > 60, 'a wide pink hoverboard is drawn below the planted feet');
    assert.deepEqual(motion.labelsOff, { name: true, creator: false }, '@vics remains recognizable when attribution labels are hidden');

    const lighting = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const r = scene.roamers.active.get('vics');
        const neon = scene.children.getByName('vics-neon');
        scene.atmosphere.setNightMode(true);
        scene.atmosphere.render();
        scene.events.emit('postupdate');
        const night = neon.alpha;
        const light = scene.atmosphere.lights.find(l => l.target === r.sprite);
        light.sync();
        scene.atmosphere.setNightMode(false);
        scene.atmosphere.render();
        scene.events.emit('postupdate');
        const day = neon.alpha;
        scene.atmosphere.setTime(0.84);
        scene.atmosphere.render();
        scene.events.emit('postupdate');
        scene.view.show({ x: r.sprite.x - 65, y: r.sprite.y - 85, width: 130, height: 110 });
        scene.events.emit('postupdate');
        const zoomedNameSize = r.tag.scaleX * scene.cameras.main.zoom;
        return { night, day, cycleNight: neon.alpha, zoomedNameSize, lightFollows: light.x === r.sprite.x && light.y === r.sprite.y - 19 };
    });
    assert.ok(lighting.night > 0.5, 'Night View lights the suit');
    assert.equal(lighting.day, 0, 'switching Night View off restores the daylight suit');
    assert.ok(lighting.cycleNight > 0.5, 'the natural day/night clock lights the suit too');
    assert.equal(lighting.lightFollows, true, 'neon glow also illuminates nearby ground');
    assert.equal(lighting.zoomedNameSize, 1, 'the community name stays screen-sized on the first zoom frame');

    const shield = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const r = scene.roamers.active.get('vics');
        const shield = scene.children.getByName('vics-shield');
        r.sprite.setPosition(200, 200);
        r.handle.world.dragon = () => ({ x: r.sprite.x + 130, y: r.sprite.y });
        scene.events.emit('postupdate');
        const near = shield.visible;
        r.handle.world.dragon = () => ({ x: r.sprite.x + 131, y: r.sprite.y });
        scene.events.emit('postupdate');
        const far = shield.visible;
        const target = scene.roamers.burnables().find(t => t.sprite === r.sprite);
        scene.dragon.burn(target);
        scene.roamers.update(0.1);
        scene.events.emit('postupdate');
        const burn = scene.dragon.burns.get(r.sprite);
        scene.dragon.tickBurn(burn, 1.5);
        const toasted = {
            shield: shield.visible, reply: burn.bubble.texture.key, alpha: burn.bubble.alpha,
            aboveName: burn.bubble.y < r.tag.y - r.tag.displayHeight,
            neon: scene.children.getByName('vics-neon').alpha,
        };
        scene.dragon.endBurn(burn);
        scene.time.now += 4500;
        scene.events.emit('postupdate');
        return { near, far, toasted, expired: shield.visible };
    });
    assert.equal(shield.near, true, 'the shield surrounds @vics at the proximity threshold');
    assert.equal(shield.far, false, 'the shield retracts outside its range');
    assert.equal(shield.toasted.shield, true, 'a blast flashes the shield even while movement is frozen');
    assert.match(shield.toasted.reply, /Thanks for the warm welcome!/);
    assert.equal(shield.toasted.alpha, 1, 'the actual dragon reply is visible, not a competing hidden bubble');
    assert.ok(shield.toasted.aboveName, 'dragon speech clears both name labels');
    assert.ok(shield.toasted.neon > 0.5, 'night glow survives the dragon reaction');
    assert.equal(shield.expired, false, 'the shield flash expires after the dragon leaves');

    if (process.env.VICS_SCREENSHOT) {
        await page.evaluate(() => {
            const scene = window.atv.game.scene.getScene('Preview');
            const r = scene.roamers.active.get('vics');
            r.handle.world.dragon = () => ({ x: r.sprite.x + 50, y: r.sprite.y });
            r.sprite.clearTint();
            scene.view.show({ x: r.sprite.x - 65, y: r.sprite.y - 85, width: 130, height: 110 });
            scene.roamers.update(0);
            scene.atmosphere.render();
            scene.events.emit('postupdate');
        });
        await page.screenshot({ path: process.env.VICS_SCREENSHOT });
    }

    const cleanup = await page.evaluate(() => {
        const scene = window.atv.game.scene.getScene('Preview');
        const r = scene.roamers.active.get('vics');
        scene.roamers.remove(r);
        const remaining = ['vics-shield', 'vics-neon', 'roamer-name-vics', '@vics']
            .filter(name => scene.children.getByName(name));
        const lights = scene.atmosphere.lights.length;
        const listeners = scene.events.listenerCount('postupdate');
        scene.roamers.spawn('beacon-belle');
        const regular = scene.roamers.spriteOf('beacon-belle');
        const normalTarget = scene.roamers.burnables().find(t => t.sprite === regular);
        scene.dragon.burn(normalTarget);
        const normalReply = scene.dragon.burns.get(regular).bubble.texture.key;
        scene.roamers.spawn('vics');
        scene.roamers.spawn('vics');
        const instances = scene.children.list.filter(o => o.name === 'vics-neon').length;
        scene.scene.stop();
        return { remaining, lights, listeners, normalTexture: regular.texture.key, normalReply, instances };
    });
    assert.deepEqual(cleanup.remaining, [], 'departure removes the board rider, both labels, shield and neon');
    assert.equal(cleanup.lights, initial.lights, 'departure releases its atmosphere light');
    assert.equal(cleanup.listeners, initial.listeners, 'departure releases its frame listeners');
    assert.match(cleanup.normalTexture, /^char\|/, 'existing visitors retain their original sheets');
    assert.doesNotMatch(cleanup.normalReply, /Thanks for the warm welcome!/, 'other characters retain shared dragon quips');
    assert.equal(cleanup.instances, 1, 'repeat spawning never duplicates the visitor');
    assert.deepEqual(errors, []);
    console.log('PASS: @vics hoverboard art/movement, attribution, directory, day/night neon, dragon shield/reply, existing visitors and lifecycle cleanup.');
} finally {
    await browser?.close();
    await server.close();
}
