import Phaser from 'phaser';
import { addPixels } from '../../kit';
import { coinCanvas, reedProp } from '../props/morrow-muckwhistle';
import type { RoamerHandle, RoamerSpec } from '../types';

const MAX_PUDDLES = 8;

interface State {
    puddles: Phaser.GameObjects.Ellipse[];
    coin?: Phaser.GameObjects.Image;
    last?: [number, number];
    t: number;
}

const state = (r: RoamerHandle): State => (r.data.s ??= { puddles: [], t: 0 }) as State;

function puddle(r: RoamerHandle, x: number, y: number, rx: number, life: number) {
    const s = state(r);
    const p = r.world.scene.add.ellipse(x, y, rx * 2, rx, 0x3f8f86, 0.75).setDepth(y - 1);
    s.puddles.push(p);
    if (s.puddles.length > MAX_PUDDLES) s.puddles.shift()?.destroy();
    r.world.scene.tweens.add({
        targets: p, alpha: 0, delay: life * 0.6, duration: life * 0.4,
        onComplete: () => {
            p.destroy();
            const i = s.puddles.indexOf(p);
            if (i >= 0) s.puddles.splice(i, 1);
        },
    });
    return p;
}

function duck(r: RoamerHandle) {
    const sp = r.sprite;
    r.world.scene.tweens.add({ targets: sp, scaleY: 0.5, scaleX: 1.2, duration: 160, yoyo: true, hold: 700, ease: 'Quad.easeOut', onComplete: () => sp.setScale(1) });
}

const spec: RoamerSpec = {
    id: 'morrow-muckwhistle',
    name: 'Morrow Muckwhistle',
    look: { skin: 'grass', hair: 'forest', hairStyle: 'bald', shirt: 'forest', pants: 'bark', shoes: 'bark' },
    prop: reedProp,
    glow: 'cyan',
    ward: 'moths',
    every: [26, 40],
    stay: [30, 50],
    speed: 20,
    greet: ['Oh! Hello... *blub*', 'I found this. Is it yours?', 'Mind the puddles, please.'],
    foil: ['Sploosh! Go away!', 'Not my lost things!', 'Shoo, shoo, shoo!'],
    token: ['Shiny! Lost, maybe?', 'A coin! Finders... keepers?'],
    hooks: {
        update(r, dt) {
            const s = state(r);
            s.t += dt;
            const sp = r.sprite;
            if (s.coin) s.coin.setPosition(Math.round(sp.x), Math.round(sp.y - 30));
            if (s.t < 0.6) return;
            s.t = 0;
            const moved = s.last ? Math.hypot(sp.x - s.last[0], sp.y - s.last[1]) > 2 : false;
            s.last = [sp.x, sp.y];
            if (moved) puddle(r, sp.x, sp.y - 1, 3, 3000);
        },
        onToken(r) {
            const s = state(r);
            const { scene } = r.world;
            if (!scene.textures.exists('morrow-coin')) addPixels(scene, 'morrow-coin', coinCanvas());
            s.coin?.destroy();
            const coin = (s.coin = scene.add.image(r.sprite.x, r.sprite.y - 30, 'morrow-coin').setDepth(1e6));
            r.pause(2.4);
            scene.time.delayedCall(2000, () => {
                if (s.coin !== coin || !coin.active) return;
                if (!r.sprite.active) return;
                const pl = r.world.player();
                const dir = pl && pl.x < r.sprite.x ? -1 : 1;
                s.coin = undefined;
                r.say('For you?');
                if (pl) r.sparkle('gold', pl.x, pl.y - 14);
                scene.tweens.add({
                    targets: coin, x: r.sprite.x + dir * 12, y: r.sprite.y - 22, alpha: 0.2, duration: 700,
                    onComplete: () => coin.destroy(),
                });
            });
        },
        onFoil(r) {
            puddle(r, r.sprite.x, r.sprite.y - 1, 6, 2500);
            r.sparkle('cyan');
            r.say('Sploosh!');
            r.pause(1);
            duck(r);
        },
        onBurn(r) {
            puddle(r, r.sprite.x, r.sprite.y - 1, 7, 3500);
            duck(r);
            r.say('Mud face!');
            r.sparkle('cyan');
        },
        onLeave(r) {
            const s = state(r);
            s.coin?.destroy();
            for (const p of s.puddles) p.destroy();
            s.puddles.length = 0;
        },
    },
};

export default spec;
