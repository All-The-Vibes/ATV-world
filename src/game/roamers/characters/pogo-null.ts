import Phaser from 'phaser';
import { ensurePixels, toHexNumber } from '../../kit';
import { holoProp, umbrellaCanvas, UMBRELLA } from '../props/pogo-null';
import type { RoamerHandle, RoamerSpec } from '../types';

interface Pogo {
    mirror: number;
    shield?: Phaser.GameObjects.Image;
    shieldT: number;
}

const state = (r: RoamerHandle): Pogo => (r.data.p ??= { mirror: 0, shieldT: 0 }) as Pogo;

const spec: RoamerSpec = {
    id: 'pogo-null',
    name: 'Pogo Null',
    look: { skin: 'steel', hair: 'gold', hairStyle: 'bald', hat: 'steel', shirt: 'steel', pants: 'slate', shoes: 'lime' },
    prop: holoProp,
    glow: 'violet',
    ward: 'ring',
    every: [26, 36],
    stay: [32, 46],
    speed: 30,
    greet: ['Welcome, challenger!', 'Practice round, anyone?', 'Boing! Hello!'],
    foil: ['Round over, gremlin!', 'Out of bounds!', 'Disqualified, politely!'],
    token: ['Bonus points!', 'Score one for me!', 'Ding! Collected!'],
    hooks: {
        update(r, dt) {
            const v = state(r);
            const s = r.sprite;
            if (s.anims.isPlaying) {
                const b = Math.abs(Math.sin(r.age * 9));
                s.setScale(1 - b * 0.04, 1 + b * 0.08);
            } else if (!v.shieldT) {
                s.setScale(1);
            }
            if (v.mirror > 0) {
                v.mirror -= dt;
                const p = r.world.player();
                if (p) s.setFlipX(p.flipX);
            }
            if (v.shieldT > 0) {
                v.shieldT -= dt;
                v.shield?.setPosition(Math.round(s.x), Math.round(s.y - 34)).setDepth(s.depth + 3);
                if (v.shieldT <= 0) {
                    v.shield?.destroy();
                    v.shield = undefined;
                }
            }
        },
        onGreet(r) {
            state(r).mirror = 2;
            r.say('NICE AIM');
        },
        onFoil(r) {
            const { scene } = r.world;
            const ring = scene.add.ellipse(r.sprite.x, r.sprite.y - 12, 16, 22).setStrokeStyle(2, toHexNumber('violet')).setFillStyle(toHexNumber('violet'), 0.2);
            ring.setDepth(r.sprite.depth + 2);
            scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        },
        onBurn(r) {
            const v = state(r);
            r.say('TOASTED (CHEERFULLY)');
            const tex = ensurePixels(r.world.scene, 'roamer-umbrella', umbrellaCanvas);
            v.shield?.destroy();
            v.shield = r.world.scene.add.image(r.sprite.x, r.sprite.y - 34, tex).setOrigin(0.5, 1);
            v.shield.setSize(UMBRELLA.w, UMBRELLA.h);
            v.shieldT = 2;
            r.sprite.setScale(1);
        },
        onLeave(r) {
            const { scene } = r.world;
            const s = r.sprite;
            state(r).shield?.destroy();
            const tints = [0xff3355, 0x33ff88, 0x3388ff];
            tints.forEach((tint, i) => {
                const ghost = scene.add.sprite(s.x + (i - 1) * 3, s.y + (i - 1), s.texture.key, s.frame.name)
                    .setOrigin(0.5, 1).setFlipX(s.flipX).setTint(tint).setAlpha(0.7).setDepth(s.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
                scene.tweens.add({ targets: ghost, x: ghost.x + (i - 1) * 10, alpha: 0, duration: 600, onComplete: () => ghost.destroy() });
            });
            scene.tweens.killTweensOf(s);
        },
    },
};

export default spec;
