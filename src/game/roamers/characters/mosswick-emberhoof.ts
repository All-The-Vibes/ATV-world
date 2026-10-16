import Phaser from 'phaser';
import type { RoamerHandle, RoamerSpec } from '../types';
import { amberLantern } from '../props/mosswick-emberhoof';

const AMBER = 0xf7b538;
const BLUE = 0x5ab0ff;

/** Remember and later destroy every extra object so a leaving roamer leaves nothing behind. */
function track<T extends Phaser.GameObjects.GameObject>(r: RoamerHandle, o: T): T {
    const list = (r.data.extras ??= new Set<Phaser.GameObjects.GameObject>()) as Set<Phaser.GameObjects.GameObject>;
    list.add(o);
    o.once('destroy', () => list.delete(o));
    return o;
}

function fadeAway(r: RoamerHandle, o: Phaser.GameObjects.Shape, delay: number, ms: number): void {
    r.world.scene.tweens.add({ targets: o, alpha: 0, delay, duration: ms, onComplete: () => o.destroy() });
}

/** A decoy token that glows on the ground for 3s, then fades. */
function decoy(r: RoamerHandle): void {
    const { scene } = r.world;
    const s = r.sprite;
    const dir = s.flipX ? -1 : 1;
    const tx = s.x + dir * 22;
    const ty = s.y + 4;
    const coin = track(r, scene.add.ellipse(s.x, s.y - 14, 6, 6, AMBER).setStrokeStyle(1, 0xffffff).setDepth(s.y + 2));
    scene.tweens.add({ targets: coin, x: tx, y: ty, duration: 350, ease: 'Bounce.easeOut' });
    scene.tweens.add({ targets: coin, scaleX: 0.3, duration: 260, yoyo: true, repeat: 5 });
    fadeAway(r, coin, 2400, 600);
    r.sparkle('gold', tx, ty);
}

/** An amber beam of pixels, from the roamer toward a point. */
function beam(r: RoamerHandle, tx: number, ty: number): void {
    const { scene } = r.world;
    const s = r.sprite;
    const g = track(r, scene.add.graphics().setDepth(s.y + 3));
    const ang = Math.atan2(ty - s.y, tx - s.x);
    g.fillStyle(AMBER, 0.35);
    g.slice(s.x, s.y - 14, 40, ang - 0.25, ang + 0.25, false).fillPath();
    for (let i = 0; i < 6; i++) {
        const d = 8 + i * 6;
        g.fillStyle(0xffffff, 0.8).fillRect(Math.round(s.x + Math.cos(ang) * d), Math.round(s.y - 14 + Math.sin(ang) * d), 1, 1);
    }
    scene.tweens.add({ targets: g, alpha: 0, duration: 1100, onComplete: () => g.destroy() });
}

/** Little blue flames licking up around the roamer. */
function blueFlames(r: RoamerHandle): void {
    const { scene } = r.world;
    const s = r.sprite;
    for (let i = 0; i < 6; i++) {
        const f = track(r, scene.add.rectangle(s.x - 10 + i * 4, s.y - 4, 2, 3, i % 2 ? BLUE : 0xcfeaff).setDepth(s.y + 2));
        scene.tweens.add({
            targets: f,
            y: s.y - 24 - i * 2,
            alpha: 0,
            delay: i * 60,
            duration: 700,
            onComplete: () => f.destroy(),
        });
    }
}

const spec: RoamerSpec = {
    id: 'mosswick-emberhoof',
    name: 'Mosswick Emberhoof',
    look: { skin: 'peach', hair: 'bark', hairStyle: 'spiky', shirt: 'blue', pants: 'earth', shoes: 'earth' },
    prop: amberLantern,
    glow: 'orange',
    ward: 'rays',
    every: [22, 32],
    stay: [35, 55],
    speed: 22,
    greet: ['Mind the lantern, friend.', 'The beasts are all asleep.', 'Warm light for a cold path.'],
    foil: ['Shoo now, little spark.', 'Follow the glow, not the gold!', 'Gently, gently.'],
    token: ['A gift for the herd!', 'Shiny. The beasts will love it.', 'Warm as an ember.'],
    hooks: {
        update(r, dt) {
            const d = r.data;
            const s = r.sprite;
            const moved = Math.hypot(s.x - ((d.lx as number) ?? s.x), s.y - ((d.ly as number) ?? s.y)) > 0.05;
            d.lx = s.x;
            d.ly = s.y;
            d.cool = Math.max(0, ((d.cool as number) ?? 0) - dt);

            // Dragon close: raise the lantern, blue flames, clap.
            const dr = r.world.dragon();
            if (dr && d.cool === 0 && Math.hypot(dr.x - s.x, dr.y - s.y) < 90) {
                d.cool = 12;
                r.pause(3);
                blueFlames(r);
                r.say('Pretty flames!');
                r.sparkle('sky', s.x, s.y - 18);
                r.world.scene.tweens.add({ targets: s, y: s.y - 3, duration: 120, yoyo: true, repeat: 3 });
            }

            // Idle: an amber cone sways over the ground and the revealed pixels twinkle.
            if (moved) {
                (d.sweep as Phaser.GameObjects.Graphics | undefined)?.clear();
                return;
            }
            const g = (d.sweep ??= track(r, r.world.scene.add.graphics())) as Phaser.GameObjects.Graphics;
            const t = ((d.t as number) ?? 0) + dt;
            d.t = t;
            const dir = s.flipX ? -1 : 1;
            const ang = (dir > 0 ? 0.7 : Math.PI - 0.7) + Math.sin(t * 2) * 0.4;
            g.clear().setDepth(s.y + 1);
            g.fillStyle(AMBER, 0.22).slice(s.x + dir * 9, s.y - 12, 34, ang - 0.3, ang + 0.3, false).fillPath();
            for (let i = 0; i < 5; i++) {
                if (Math.sin(t * 6 + i * 2.1) < 0.2) continue;
                const dist = 12 + i * 5;
                g.fillStyle(0xffffff, 0.9).fillRect(Math.round(s.x + dir * 9 + Math.cos(ang) * dist), Math.round(s.y - 12 + Math.sin(ang) * dist), 1, 1);
            }
        },
        onFoil(r) {
            decoy(r);
        },
        onToken(r) {
            const { scene } = r.world;
            const s = r.sprite;
            const near = r.world.walkers().filter((w) => Math.hypot(w.x - s.x, w.y - s.y) < 120);
            beam(r, s.x + (s.flipX ? -30 : 30), s.y + 6);
            near.forEach((w) => {
                w.setFlipX(s.x < w.x);
                const m = scene.add.rectangle(w.x, w.y - 26, 3, 3, AMBER).setDepth(w.y + 2);
                scene.tweens.add({ targets: m, y: m.y - 6, alpha: 0, duration: 800, onComplete: () => m.destroy() });
            });
            if (near.length) r.say('Look, over here!');
        },
        onGreet(r) {
            r.sparkle('orange');
        },
        onLeave(r) {
            const list = r.data.extras as Set<Phaser.GameObjects.GameObject> | undefined;
            list?.forEach((o) => o.destroy());
            list?.clear();
            r.data.sweep = undefined;
        },
    },
};

export default spec;
