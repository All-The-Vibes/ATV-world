import Phaser from 'phaser';
import { toHexNumber } from '../../kit';
import { sproutTexture, wateringCan } from '../props/moss-quill';
import type { RoamerHandle, RoamerSpec } from '../types';

const MAX_SPROUTS = 3;

interface State {
    water: number;
    mark?: { x: number; y: number };
    things: Set<Phaser.GameObjects.GameObject>;
    sprouts: Phaser.GameObjects.Image[];
}

const st = (r: RoamerHandle): State =>
    (r.data.moss ??= { water: Phaser.Math.FloatBetween(12, 16), things: new Set(), sprouts: [] }) as State;

/** Grow a sprout that pops up, then fades away and cleans itself up. */
function grow(r: RoamerHandle, x: number, y: number, coin: boolean, life: number, keep = false) {
    const s = st(r);
    const scene = r.world.scene;
    const img = scene.add.image(Math.round(x), Math.round(y), sproutTexture(scene, coin)).setOrigin(0.5, 1).setDepth(y).setScale(1, 0.1);
    s.things.add(img);
    if (keep) s.sprouts.push(img);
    scene.tweens.add({ targets: img, scaleY: 1, duration: 500, ease: 'Back.Out' });
    scene.tweens.add({
        targets: img, alpha: 0, delay: life * 1000, duration: 800,
        onComplete: () => {
            s.things.delete(img);
            s.sprouts = s.sprouts.filter((o) => o !== img);
            img.destroy();
        },
    });
}

function waterHere(r: RoamerHandle) {
    const s = st(r);
    const { x, y } = r.sprite;
    const dir = r.sprite.flipX ? -1 : 1;
    r.pause(3);
    const scene = r.world.scene;
    const spot = { x: x + dir * 14, y };
    for (let i = 0; i < 3; i++) {
        const p = scene.add.rectangle(spot.x, spot.y - 2, 2, 2, toHexNumber('leaf')).setDepth(1e6 + 1);
        s.things.add(p);
        const a = (i * Math.PI * 2) / 3;
        scene.tweens.addCounter({
            from: 0, to: 1, duration: 1300, delay: i * 150,
            onUpdate: (t) => {
                if (!p.active) return;
                const v = t.getValue() ?? 0;
                p.setPosition(spot.x + Math.cos(a + v * 7) * 4, spot.y - 2 - v * 16);
            },
            onComplete: () => { s.things.delete(p); p.destroy(); },
        });
    }
    scene.time.delayedCall(1400, () => {
        if (!r.sprite.active) return;
        if (s.sprouts.length >= MAX_SPROUTS) s.sprouts[0].destroy(), s.sprouts.shift();
        grow(r, spot.x, spot.y, false, 20, true);
        r.sparkle('leaf', spot.x, spot.y - 4);
    });
}

function vines(r: RoamerHandle) {
    const s = st(r);
    const scene = r.world.scene;
    const { x, y } = r.sprite;
    const g = scene.add.graphics().setDepth(y + 2);
    s.things.add(g);
    const cols = [toHexNumber('leaf'), toHexNumber('forest')];
    for (let i = 0; i < 14; i++) {
        g.fillStyle(cols[i % 2], 1).fillRect(Math.round(x + Math.sin(i * 1.3) * 5), Math.round(y - 2 - i), 2, 2);
    }
    scene.time.delayedCall(1000, () => { s.things.delete(g); g.destroy(); });
}

const spec: RoamerSpec = {
    id: 'moss-quill',
    name: 'Moss Quill',
    look: { skin: 'peach', hair: 'wood', hairStyle: 'bun', hat: 'cream', shirt: 'leaf', pants: 'earth', shoes: 'bark' },
    prop: wateringCan,
    glow: 'leaf',
    ward: 'moths',
    every: [20, 28],
    stay: [35, 50],
    speed: 24,
    greet: ['Hi there! Grow something!', 'Seeds make friends.', 'Mind the sprouts!'],
    foil: ['Shoo, pests!', 'Not my petunias!', 'Out of the garden!'],
    token: ['I will plant it!', 'Gold grows gold!', 'Water, sun, token!'],
    hooks: {
        update(r, dt) {
            const s = st(r);
            s.water -= dt;
            if (s.water <= 0) {
                s.water = Phaser.Math.FloatBetween(14, 17);
                waterHere(r);
            }
            if (s.mark && r.age > 3) {
                const m = s.mark;
                s.mark = undefined;
                r.goTo(m.x, m.y);
                r.world.scene.time.delayedCall(3500, () => r.sprite.active && waterHere(r));
            }
        },
        onToken(r) {
            r.say('Plant!');
            grow(r, r.sprite.x + 8, r.sprite.y, true, 8);
        },
        onFoil(r) {
            r.say('Eep, weeds!');
            vines(r);
        },
        onBurn(r) {
            const s = st(r);
            s.mark = { x: r.sprite.x, y: r.sprite.y };
            r.say('Eeek!');
            const b = r.world.bounds();
            for (let i = 0; i < 12; i++) {
                const x = Phaser.Math.Between(r.sprite.x - 80, r.sprite.x + 80);
                const y = Phaser.Math.Between(r.sprite.y - 60, r.sprite.y + 60);
                if (b.contains(x, y) && r.world.open(x, y)) return r.goTo(x, y);
            }
        },
        onGreet(r) {
            r.say('Hello! A gift!');
            r.sparkle('leaf');
            const p = r.world.player();
            if (p) grow(r, p.x + 14, p.y, false, 10);
        },
        onLeave(r) {
            const s = st(r);
            for (const o of s.things) {
                r.world.scene.tweens.killTweensOf(o);
                o.destroy();
            }
            s.things.clear();
            s.sprouts = [];
        },
    },
};

export default spec;
