import type Phaser from 'phaser';
import { PixelCanvas, ensurePixels, stripFrames } from '../kit';

export const NET_W = 28;
export const NET_H = 26;
/** Where the catcher's hand holds the pole, in each texture. */
export const NET_HAND = { x: 3, y: 23 };
export const BAG_W = 24;
export const BAG_H = 26;
export const BAG_HAND = { x: 20, y: 23 };

function pole(pc: PixelCanvas, x0: number, y0: number, x1: number, y1: number) {
    pc.line(x0, y0, x1, y1, 'wood').line(x0, y0 + 1, x1, y1 + 1, 'bark');
}

function hoop(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number) {
    pc.ellipse(cx, cy, rx, ry, 'steel');
    pc.ellipse(cx, cy, rx - 1.2, ry - 1.2, (x, y) => ((x + y) % 2 ? 'cloud' : null));
}

/** An empty bug net held up and ready, facing right. It swings from the hand at NET_HAND. */
export function netTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'catcher-net', () => {
        const pc = new PixelCanvas(NET_W, NET_H);
        pc.ellipse(19, 11, 5.5, 6.5, (x, y) => ((x + y) % 2 ? 'cloud' : 'mist'));
        hoop(pc, 21, 6, 6, 5);
        pole(pc, NET_HAND.x, NET_HAND.y, 16, 10);
        return pc.outline('ink');
    });
}

/** A net slung over the shoulder with a gremlin wriggling in the bag, facing right. Two frames of wriggle. */
export function bagTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'catcher-bag', () => {
        const pc = new PixelCanvas(BAG_W * 2, BAG_H);
        for (let f = 0; f < 2; f++) {
            const b = new PixelCanvas(BAG_W, BAG_H);
            b.ellipse(6, 13 + f, 5.5, 8, (x, y) => ((x + y) % 2 ? 'cloud' : 'mist'));
            const gx = 6 + (f ? 1 : -1);
            const gy = 15 - f;
            b.ellipse(gx, gy, 3.6, 4.2, 'grass').ellipse(gx, gy + 1, 2, 2, 'lime');
            b.set(gx - 2, gy - 1, 'red').set(gx + 1, gy - 1, 'red');
            b.rect(gx - 5, gy - 3, 2, 2, 'leaf').rect(gx + 4, gy - 3, 2, 2, 'leaf');
            hoop(b, 6, 4, 5, 3);
            pole(b, BAG_HAND.x, BAG_HAND.y, 9, 5);
            b.outline('ink');
            pc.blit(b, f * BAG_W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, BAG_W, BAG_H) };
    });
}
