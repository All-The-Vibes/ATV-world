import Phaser from 'phaser';
import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 7;
const H = 10;

/** A phone on a little stick with a blinking red REC dot. */
export const clipProp: RoamerProp = {
    key: 'roamer-clipclop-phone',
    frames: 2,
    w: W,
    h: H,
    frameRate: 2.5,
    offset: [8, -14],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const p = new PixelCanvas(W, H);
            p.rect(3, 5, 1, 5, 'wood');
            p.rect(1, 0, 5, 5, 'slate').rect(2, 1, 3, 3, 'ice');
            p.set(1, 1, f ? 'night' : 'red');
            p.outline('ink');
            pc.blit(p, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};

const BUBBLE = [0x7d4bb5, 0x7fd6f0, 0x7d4bb5];

/** Tiny 5x4 chat-bubble glyphs that pop upward and dissolve. */
export function chatBubbles(scene: Phaser.Scene, x: number, y: number, colors: number[] = BUBBLE, n = 3) {
    for (let i = 0; i < n; i++) {
        const g = scene.add.graphics({ x: x + (i - 1) * 9, y }).setDepth(9000).setAlpha(0);
        g.fillStyle(colors[i % colors.length], 1);
        g.fillRect(0, 0, 5, 3).fillRect(1, 3, 1, 1);
        g.fillStyle(0xf4f4ef, 1).fillRect(1, 1, 1, 1).fillRect(3, 1, 1, 1);
        scene.tweens.add({
            targets: g,
            y: y - 22 - i * 4,
            alpha: { from: 1, to: 0 },
            delay: i * 160,
            duration: 1100,
            onStart: () => g.setAlpha(1),
            onComplete: () => g.destroy(),
        });
    }
}

/** Four viewfinder corner brackets around a spot, for a couple of seconds. */
export function viewfinder(scene: Phaser.Scene, x: number, y: number, ms = 2000) {
    const g = scene.add.graphics({ x, y }).setDepth(9000);
    g.lineStyle(1, 0xf4f4ef, 1).fillStyle(0xc4314b, 1);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = sx * 10;
        const cy = sy * 10;
        g.fillRect(Math.min(cx, cx - sx * 4), cy - (sy > 0 ? 1 : 0), 5, 1);
        g.fillRect(cx - (sx > 0 ? 1 : 0), Math.min(cy, cy - sy * 4), 1, 5);
    }
    scene.tweens.add({
        targets: g, alpha: { from: 1, to: 0.3 }, scale: { from: 1.4, to: 1 },
        duration: 250, onComplete: () => {
            scene.tweens.add({ targets: g, alpha: 0, delay: ms - 250, duration: 200, onComplete: () => g.destroy() });
        },
    });
}
