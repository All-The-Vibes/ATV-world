import Phaser from 'phaser';
import { toHexNumber, type Color } from '../../kit';
import { bellCart } from '../props/bramble-bellweather';
import type { RoamerHandle, RoamerSpec } from '../types';

interface State {
    ring: number;
    rings: number;
    check: number;
    follow: number;
    followTick: number;
    things: Set<Phaser.GameObjects.GameObject>;
}

const st = (r: RoamerHandle): State =>
    (r.data.bell ??= { ring: Phaser.Math.FloatBetween(6, 10), rings: 0, check: 1, follow: 0, followTick: 0, things: new Set() }) as State;

/** Fade-and-drop pixel dots in a ring that expands from the bell. */
function waves(r: RoamerHandle, x: number, y: number) {
    const s = st(r);
    const scene = r.world.scene;
    for (let k = 0; k < 3; k++) {
        const dots: Phaser.GameObjects.Rectangle[] = [];
        for (let i = 0; i < 14; i++) {
            const d = scene.add.rectangle(x, y, 2, 2, toHexNumber(k === 1 ? 'white' : 'cyan')).setDepth(1e6 + 1).setAlpha(0);
            dots.push(d);
            s.things.add(d);
        }
        scene.tweens.addCounter({
            from: 0, to: 1, duration: 900, delay: k * 220,
            onUpdate: (t) => {
                const v = t.getValue() ?? 0;
                dots.forEach((d, i) => {
                    if (!d.active) return;
                    const a = (i / dots.length) * Math.PI * 2;
                    d.setPosition(Math.round(x + Math.cos(a) * (4 + v * 26)), Math.round(y + Math.sin(a) * (3 + v * 16))).setAlpha(v > 0 ? 1 - v : 0);
                });
            },
            onComplete: () => dots.forEach((d) => { s.things.delete(d); d.destroy(); }),
        });
    }
}

function ring(r: RoamerHandle) {
    const s = st(r);
    s.rings++;
    const { x, y } = r.sprite;
    r.pause(1.5);
    r.say('Ding-dong!');
    waves(r, x - (r.sprite.flipX ? -15 : 15), y - 14);
    const glow: Color = 'cyan';
    for (const w of r.world.walkers()) {
        if (Phaser.Math.Distance.Between(x, y, w.x, w.y) < 90) r.sparkle(glow, w.x, w.y - 14);
    }
    const p = r.world.player();
    if (p && Phaser.Math.Distance.Between(x, y, p.x, p.y) < 100) {
        r.sparkle('yellow', p.x, p.y - 14);
        r.say('Bell buddy!');
        s.follow = 6;
    }
    if (s.rings % 3 === 0) r.world.scene.time.delayedCall(1600, () => r.sprite.active && nap(r));
}

function nap(r: RoamerHandle) {
    r.pause(4);
    r.say('Zzz...');
}

const spec: RoamerSpec = {
    id: 'bramble-bellweather',
    name: 'Bramble Bellweather',
    look: { skin: 'sand', hair: 'violet', hairStyle: 'short', hat: 'violet', shirt: 'cream', pants: 'bark', shoes: 'earth' },
    prop: bellCart,
    glow: 'cyan',
    ward: 'ring',
    every: [24, 34],
    stay: [40, 55],
    speed: 20,
    greet: ['Ding! Good day!', 'Follow the bell!', 'Slow and steady, friend.'],
    foil: ['Honk! Hoof it!', 'Bell says shoo!', 'Back to the hills!'],
    token: ['Ding! A token!', 'Bell-worthy find!'],
    hooks: {
        update(r, dt) {
            const s = st(r);
            s.ring -= dt;
            if (s.ring <= 0) {
                s.ring = Phaser.Math.FloatBetween(6, 10);
                ring(r);
            }
            if (s.follow > 0) {
                s.follow -= dt;
                s.followTick -= dt;
                const p = r.world.player();
                if (p && s.followTick <= 0) {
                    s.followTick = 1;
                    r.goTo(p.x - 18, p.y);
                }
            }
            s.check -= dt;
            if (s.check <= 0) {
                s.check = 1;
                const gr = r.world.gremlins();
                const g = gr?.nearest(r.sprite.x, r.sprite.y, 110, true);
                if (gr && g && gr.foil(g)) {
                    r.say('Honk! Hoof it!');
                    r.ward();
                }
            }
        },
        onBurn(r) {
            r.say('Pfft! Cough!');
            const scene = r.world.scene;
            for (let i = 0; i < 10; i++) {
                const d = scene.add
                    .rectangle(r.sprite.x + Phaser.Math.Between(-5, 5), r.sprite.y - Phaser.Math.Between(6, 18), 2, 2, toHexNumber(i % 2 ? 'slate' : 'mist'))
                    .setDepth(1e6 + 1);
                st(r).things.add(d);
                scene.tweens.add({
                    targets: d, x: d.x + Phaser.Math.Between(-16, 16), y: d.y - Phaser.Math.Between(6, 16), alpha: 0, duration: 700,
                    onComplete: () => { st(r).things.delete(d); d.destroy(); },
                });
            }
        },
        onLeave(r) {
            const s = st(r);
            for (const o of s.things) {
                r.world.scene.tweens.killTweensOf(o);
                o.destroy();
            }
            s.things.clear();
        },
    },
};

export default spec;
