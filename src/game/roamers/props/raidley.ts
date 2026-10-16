import Phaser from 'phaser';
import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 8;
const H = 8;

/** A headset mic whose LEDs trade places between cyan and violet. */
export const headsetProp: RoamerProp = {
    key: 'roamer-raidley-headset',
    frames: 2,
    w: W,
    h: H,
    frameRate: 3,
    offset: [-1, -20],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const p = new PixelCanvas(W, H);
            p.rect(1, 0, 6, 1, 'gold').rect(0, 1, 1, 3, 'gold').rect(7, 1, 1, 3, 'gold');
            p.rect(0, 4, 2, 2, 'slate').rect(6, 4, 2, 2, 'slate');
            p.set(0, 4, f ? 'violet' : 'cyan').set(7, 4, f ? 'cyan' : 'violet');
            p.rect(5, 6, 1, 1, 'slate').rect(4, 7, 2, 1, 'steel');
            pc.blit(p, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};

const EMOTES = [0xf7b538, 0xe26fa6, 0xfbe46f];

/** A ring of tiny emote squares around a spot that spins out and fades. */
export function emoteRing(scene: Phaser.Scene, x: number, y: number, ms = 2000, radius = 20) {
    const g = scene.add.graphics({ x, y }).setDepth(9000);
    const n = 10;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.fillStyle(EMOTES[i % 3], 1).fillRect(Math.round(Math.cos(a) * radius) - 1, Math.round(Math.sin(a) * radius * 0.55) - 1, 3, 3);
    }
    scene.tweens.add({ targets: g, angle: 20, scale: { from: 0.6, to: 1 }, duration: ms, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: g, alpha: 0, delay: ms - 400, duration: 400, onComplete: () => g.destroy() });
}

/** A bobbing arrow plus a pulse ring marking a spot. */
export function beacon(scene: Phaser.Scene, x: number, y: number, ms = 4000) {
    const g = scene.add.graphics({ x, y }).setDepth(9000);
    g.fillStyle(0xe26fa6, 1).fillRect(-2, -22, 5, 2).fillRect(-1, -20, 3, 2).fillRect(0, -18, 1, 2);
    g.lineStyle(1, 0x7fd6f0, 1).strokeEllipse(0, 2, 18, 8);
    scene.tweens.add({ targets: g, y: y - 3, yoyo: true, repeat: -1, duration: 350, ease: 'Sine.easeInOut' });
    scene.time.delayedCall(ms, () => {
        scene.tweens.killTweensOf(g);
        scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
    });
}
