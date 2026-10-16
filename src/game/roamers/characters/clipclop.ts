import Phaser from 'phaser';
import { chatBubbles, clipProp, viewfinder } from '../props/clipclop';
import type { RoamerHandle, RoamerSpec } from '../types';

function liveRec(r: RoamerHandle) {
    const s = r.sprite;
    r.say('LIVE!');
    r.sparkle('red', s.x + 8, s.y - 16);
    chatBubbles(r.world.scene, s.x, s.y - 28);
}

const spec: RoamerSpec = {
    id: 'clipclop',
    name: 'Clipclop',
    look: { skin: 'peach', hair: 'bark', hairStyle: 'cap', hat: 'violet', shirt: 'cyan', pants: 'slate', shoes: 'gold' },
    prop: clipProp,
    glow: 'cyan',
    ward: 'rays',
    every: [20, 28],
    stay: [30, 42],
    speed: 34,
    greet: ['Smile for the feed!', 'Say cheese. Or clip.', 'Rolling! Be natural!'],
    foil: ['Got it on camera!', 'Gremlin: caught in 4K!', 'Chat, look at this!'],
    token: ['Framing this one.', 'Gold shot! Hold still.', 'Perfect angle!'],
    hooks: {
        update(r, dt) {
            const p = r.world.player();
            const d = r.data;
            d.cool = Math.max(0, ((d.cool as number) ?? 0) - dt);
            if (!p) return (d.still = 0);
            const near = Phaser.Math.Distance.Between(p.x, p.y, r.sprite.x, r.sprite.y) < 44;
            const last = d.last as { x: number; y: number } | undefined;
            const moved = !last || Math.abs(last.x - p.x) + Math.abs(last.y - p.y) > 0.5;
            d.last = { x: p.x, y: p.y };
            d.still = near && !moved ? ((d.still as number) ?? 0) + dt : 0;
            if ((d.still as number) > 1.4 && (d.cool as number) <= 0) {
                d.cool = 14;
                d.still = 0;
                r.say('...');
                r.pause(2);
                r.world.scene.time.delayedCall(900, () => {
                    const pl = r.world.player();
                    if (!r.sprite.active || !pl) return;
                    r.sprite.setFlipX(pl.flipX);
                    r.world.scene.tweens.add({ targets: r.sprite, scaleY: 0.8, yoyo: true, duration: 120, repeat: 1 });
                    r.sparkle('gold', pl.x, pl.y - 18);
                    r.say('Nice flip!');
                });
            }
        },
        onFoil: liveRec,
        onToken(r) {
            const s = r.sprite;
            viewfinder(r.world.scene, s.x + (s.flipX ? -14 : 14), s.y - 4);
            chatBubbles(r.world.scene, s.x, s.y - 28, [0x7fd6f0, 0x7d4bb5], 2);
        },
        onBurn(r) {
            const s = r.sprite;
            r.say('CLIP IT!');
            r.world.scene.tweens.add({
                targets: s, scaleX: 1.25, scaleY: 0.7, yoyo: true, duration: 140, repeat: 2,
                onComplete: () => s.active && s.setScale(1),
            });
            chatBubbles(r.world.scene, s.x, s.y - 28);
        },
    },
};

export default spec;
