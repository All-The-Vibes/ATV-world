import type { RoamerHandle, RoamerSpec } from '../types';
import { guardShield } from '../props/pip-parry';

const num = (r: RoamerHandle, k: string) => (r.data[k] as number | undefined) ?? 0;

/** Floating mini-text that rises and fades. */
function floatText(r: RoamerHandle, text: string, color = '#ffd84a', dy = 26) {
    const s = r.sprite;
    const t = r.world.scene.add
        .text(Math.round(s.x), Math.round(s.y - 30), text, { fontFamily: 'monospace', fontSize: '7px', color, stroke: '#2a1450', strokeThickness: 2 })
        .setOrigin(0.5)
        .setDepth(s.y + 50);
    r.world.scene.tweens.add({ targets: t, y: t.y - dy, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
}

function flashShield(r: RoamerHandle) {
    r.sparkle('violet');
    r.sparkle('gold', r.sprite.x + (r.sprite.flipX ? -8 : 8), r.sprite.y - 10);
}

function hop(r: RoamerHandle) {
    const s = r.sprite;
    const y = s.y;
    r.world.scene.tweens.add({ targets: s, y: y - 6, duration: 130, yoyo: true, onComplete: () => (s.y = y) });
}

function squash(r: RoamerHandle) {
    const s = r.sprite;
    r.world.scene.tweens.add({ targets: s, scaleY: 0.8, duration: 200, yoyo: true, onComplete: () => s.setScale(1) });
}

const spec: RoamerSpec = {
    id: 'pip-parry',
    name: 'Pip Parry',
    look: { skin: 'sand', hair: 'ink', hairStyle: 'cap', hat: 'gold', shirt: 'violet', pants: 'forest', shoes: 'gold' },
    prop: guardShield,
    glow: 'violet',
    ward: 'ring',
    every: [26, 38],
    stay: [30, 48],
    speed: 30,
    greet: ['Ready when you are!', 'Try me. I dare you.', 'Nothing gets past this guard!'],
    foil: ['Perfect block!', 'Not on my watch!', 'Denied. Politely.'],
    token: ['Deflected with style!', 'Nice try, coin!', 'Block, block, bonk!'],
    hooks: {
        update(r) {
            const p = r.world.player();
            if (!p || !r.data.greeted) return;
            if (Phaser_dist(r, p) > 60) {
                r.data.greeted = false;
                r.pause(1);
                squash(r);
                r.say('Good match!');
            }
        },
        onGreet(r) {
            r.data.greeted = true;
            r.say('READY?');
            for (let i = 0; i < 3; i++) {
                r.world.scene.time.delayedCall(450 + i * 220, () => {
                    if (r.sprite.active) flashShield(r);
                    if (i === 2 && r.sprite.active) floatText(r, 'PARRY!', '#c9a6ff');
                });
            }
        },
        onFoil(r) {
            r.ward();
            flashShield(r);
            hop(r);
            r.say('PERFECT BLOCK!');
            floatText(r, '1-2-3 COMBO');
        },
        onToken(r) {
            const s = r.sprite;
            r.sparkle('gold', s.x, s.y);
            r.sparkle('violet', s.x + 4, s.y - 4);
            const ring = r.world.scene.add.circle(Math.round(s.x), Math.round(s.y), 3, 0xffd84a, 0).setStrokeStyle(1, 0xc9a6ff).setDepth(s.y + 2);
            r.world.scene.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
            r.say('DEFLECT!');
            hop(r);
            r.data.deflects = num(r, 'deflects') + 1;
        },
        onBurn(r) {
            flashShield(r);
            r.say('STILL STANDING!');
        },
    },
};

function Phaser_dist(r: RoamerHandle, p: { x: number; y: number }) {
    return Math.hypot(r.sprite.x - p.x, r.sprite.y - p.y);
}

export default spec;
