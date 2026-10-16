import Phaser from 'phaser';
import { beacon, emoteRing, headsetProp } from '../props/raidley';
import type { RoamerHandle, RoamerSpec } from '../types';

/** Walkers nearby briefly turn to face the host; their flip is restored afterwards. */
function gather(r: RoamerHandle) {
    const s = r.sprite;
    const scene = r.world.scene;
    for (const w of r.world.walkers()) {
        if (Phaser.Math.Distance.Between(w.x, w.y, s.x, s.y) > 120) continue;
        const flip = w.flipX;
        const tint = w.tintTopLeft;
        const tinted = w.isTinted;
        w.setFlipX(w.x > s.x);
        w.setTint(0xfff2c0);
        scene.time.delayedCall(1200, () => {
            if (!w.active) return;
            w.setFlipX(flip);
            if (tinted) w.setTint(tint);
            else w.clearTint();
        });
    }
    emoteRing(scene, s.x, s.y - 8, 1800, 26);
}

const spec: RoamerSpec = {
    id: 'raidley',
    name: 'Raidley',
    look: { skin: 'sand', hair: 'pink', hairStyle: 'cap', hat: 'gold', shirt: 'forest', pants: 'navy', shoes: 'ink' },
    prop: headsetProp,
    glow: 'pink',
    ward: 'ring',
    every: [26, 36],
    stay: [28, 40],
    speed: 28,
    greet: ['Everybody, come look!', 'Welcome to the stream!', 'You are in my raid!'],
    foil: ['Big moment, everybody!', 'Gather round, gremlin gone!', 'Hype! Hype! Hype!'],
    token: ['Squad, gold on the ground!', 'Look look look!', 'Biggest token of the day!'],
    hooks: {
        onGreet(r) {
            const p = r.world.player();
            if (!p) return;
            emoteRing(r.world.scene, p.x, p.y - 8, 2000, 24);
            r.sparkle('pink', p.x, p.y - 18);
        },
        onFoil: gather,
        onToken(r) {
            const s = r.sprite;
            beacon(r.world.scene, s.x + (s.flipX ? -14 : 14), s.y, 4000);
            gather(r);
        },
        onBurn(r) {
            r.say('F in chat');
            gather(r);
            r.sparkle('gold');
        },
    },
};

export default spec;
