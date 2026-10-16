import Phaser from 'phaser';
import { toHexNumber } from '../../kit';
import { blasterProp } from '../props/vexa-quill';
import type { RoamerHandle, RoamerSpec } from '../types';

const CYAN = toHexNumber('cyan');

interface Vexa {
    reticle?: Phaser.GameObjects.Graphics;
    lock: number;
    extras: Phaser.GameObjects.GameObject[];
}

const state = (r: RoamerHandle): Vexa => (r.data.v ??= { lock: 0, extras: [] }) as Vexa;

function drawReticle(g: Phaser.GameObjects.Graphics, x: number, y: number, t: number) {
    const o = 14 - Math.min(t, 0.3) * 10;
    g.clear().fillStyle(CYAN, 1);
    for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
            const cx = x + sx * o;
            const cy = y + sy * o;
            g.fillRect(cx - (sx > 0 ? 3 : 0), cy - (sy > 0 ? 1 : 0), 4, 2);
            g.fillRect(cx - (sx > 0 ? 1 : 0), cy - (sy > 0 ? 3 : 0), 2, 4);
        }
    }
}

const spec: RoamerSpec = {
    id: 'vexa-quill',
    name: 'Vexa Quill',
    look: { skin: 'tan', hair: 'ink', hairStyle: 'short', hat: 'cyan', shirt: 'violet', pants: 'navy', shoes: 'ink' },
    prop: blasterProp,
    glow: 'cyan',
    ward: 'ring',
    every: [24, 34],
    stay: [34, 48],
    speed: 34,
    greet: ['Squad scout, reporting!', 'Objective: say hi. Done!', 'Foam-safe zone ahead!'],
    foil: ['Foam dart away!', 'Tag! You are it!', 'Hostile? Nope. Sticky!'],
    token: ['Objective located!', 'Loot secured!', 'Courier delivery!'],
    hooks: {
        update(r, dt) {
            const v = state(r);
            if (v.lock <= 0) return;
            const p = r.world.player();
            v.lock -= dt;
            if (!p || v.lock <= 0) {
                v.reticle?.destroy();
                v.reticle = undefined;
                return;
            }
            v.reticle ??= r.world.scene.add.graphics().setDepth(1e7);
            drawReticle(v.reticle, Math.round(p.x), Math.round(p.y - 16), 1.5 - v.lock);
        },
        onGreet(r) {
            const p = r.world.player();
            if (!p) return;
            r.sprite.setFlipX(p.x < r.sprite.x);
            state(r).lock = 1.5;
        },
        onFoil(r) {
            const { scene } = r.world;
            const s = r.sprite;
            const g = r.world.gremlins()?.nearest(s.x, s.y, 160);
            const tx = g ? g.x : s.x + (s.flipX ? -50 : 50);
            const ty = g ? g.y - 8 : s.y - 14;
            r.say('PEW!');
            const dart = scene.add.rectangle(s.x, s.y - 14, 4, 2, CYAN).setDepth(1e7);
            dart.setStrokeStyle(1, 0xffffff);
            dart.setRotation(Math.atan2(ty - (s.y - 14), tx - s.x));
            state(r).extras.push(dart);
            scene.tweens.add({
                targets: dart, x: tx, y: ty, duration: 260,
                onComplete: () => {
                    dart.destroy();
                    r.sparkle('white', tx, ty);
                },
            });
        },
        onToken(r) {
            r.say('OBJECTIVE CLEAR!');
            r.sparkle('cyan');
            r.sparkle('white', r.sprite.x, r.sprite.y - 24);
        },
        onBurn(r) {
            r.say('DANGER');
            const s = r.sprite;
            const { scene } = r.world;
            const visor = scene.add.rectangle(s.x, s.y - 26, 8, 2, 0xff3355).setDepth(s.depth + 2);
            state(r).extras.push(visor);
            scene.tweens.add({ targets: visor, alpha: 0, duration: 140, yoyo: true, repeat: 3, onComplete: () => visor.destroy() });
            scene.tweens.add({ targets: s, scaleY: 0.72, scaleX: 1.12, duration: 160, yoyo: true, hold: 500, onComplete: () => s.setScale(1) });
        },
        onLeave(r) {
            const v = state(r);
            r.world.scene.tweens.killTweensOf(r.sprite);
            v.reticle?.destroy();
            for (const o of v.extras) o.destroy();
        },
    },
};

export default spec;
