import { wrenchProp } from '../props/dex-dabble';
import type { RoamerHandle, RoamerSpec } from '../types';

function sparks(r: RoamerHandle, color: number, count = 5) {
    const scene = r.world.scene;
    for (let i = 0; i < count; i++) {
        const dot = scene.add.rectangle(r.sprite.x + (i % 2 ? 6 : -6), r.sprite.y - 24, 2, 2, color).setDepth(r.sprite.depth + 2);
        scene.tweens.add({
            targets: dot,
            x: dot.x + (i % 2 ? 1 : -1) * (4 + i * 2),
            y: dot.y - 6 - (i % 3) * 4,
            duration: 150 + i * 60,
            ease: 'Stepped',
            easeParams: [4],
            alpha: 0,
            onComplete: () => dot.destroy(),
        });
    }
}

function later(r: RoamerHandle, ms: number, fn: () => void) {
    r.world.scene.time.delayedCall(ms, () => {
        if (r.sprite.active) fn();
    });
}

const spec: RoamerSpec = {
    id: 'dex-dabble',
    name: 'Dex Dabble',
    look: { skin: 'tan', hair: 'earth', hairStyle: 'cap', hat: 'lime', shirt: 'orange', pants: 'blue', shoes: 'slate' },
    prop: wrenchProp,
    glow: 'orange',
    ward: 'rays',
    every: [24, 34],
    stay: [30, 45],
    speed: 28,
    greet: ['Anything broken? I can help!', 'Fixed it! ...Probably.', 'Got a spare bolt?'],
    foil: ['Let me fix that!', 'Hold still, gremlin!', 'One tiny adjustment...'],
    token: ['Bzzt! Almost fixed it!', 'I can improve this token!'],
    hooks: {
        onFoil(r) {
            r.say('Let me fix that!');
            sparks(r, 0xec7a3a, 8);
            r.sparkle('orange');
        },
        onToken(r) {
            sparks(r, 0xf2c14e, 6);
            later(r, 700, () => r.say('bzzt... bzzt... oops.'));
        },
        onGreet(r) {
            r.say('Hold this!');
            const p = r.world.player();
            if (!p) return;
            for (let i = 0; i < 4; i++) later(r, i * 200, () => r.sparkle('orange', p.x + (i - 1.5) * 4, p.y - 6 - i * 3));
        },
        onBurn(r) {
            r.say('Hot wrench!');
            sparks(r, 0x3d3d5c, 7);
            r.sparkle('orange');
        },
        update(r, dt) {
            const t = ((r.data.fail as number | undefined) ?? 12 + Math.random() * 8) - dt;
            r.data.fail = t;
            if (t > 0) return;
            r.data.fail = 18 + Math.random() * 6;
            const s = r.sprite;
            const scene = r.world.scene;
            r.pause(1.5);
            r.say('It was fine before.');
            scene.tweens.add({
                targets: s,
                angle: { from: -12, to: 0 },
                scaleY: { from: 0.85, to: 1 },
                duration: 500,
                ease: 'Bounce.easeOut',
                onComplete: () => s.setAngle(0).setScale(1),
            });
            const dot = scene.add.rectangle(s.x, s.y - 20, 2, 2, 0xb4e05a).setDepth(s.depth + 2);
            scene.tweens.add({
                targets: dot,
                y: dot.y + 70,
                x: dot.x + 8,
                alpha: 0,
                duration: 1100,
                ease: 'Quad.easeIn',
                onComplete: () => dot.destroy(),
            });
        },
    },
};

export default spec;
