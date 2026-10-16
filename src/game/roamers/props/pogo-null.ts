import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 11;
const H = 8;

/** A small floating holo-display that flickers between two frames. */
export const holoProp: RoamerProp = {
    key: 'roamer-holo-display',
    frames: 2,
    w: W,
    h: H,
    frameRate: 4,
    offset: [0, -36],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const d = new PixelCanvas(W, H);
            d.rect(0, 0, W, 6, 'violet').rect(1, 1, W - 2, 4, f ? 'plum' : 'navy');
            d.rect(2, 2, 3, 1, 'lime').rect(2, 3, f ? 6 : 4, 1, 'cyan');
            d.rect(4, 6, 3, 1, 'steel');
            d.outline('ink');
            pc.blit(d, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};

const UW = 13;
const UH = 9;

/** A tiny gold umbrella, drawn only while shielding. */
export const umbrellaCanvas = (): PixelCanvas => {
    const u = new PixelCanvas(UW, UH);
    u.ellipse(6, 4, 6, 4, 'gold');
    u.rect(0, 5, UW, 4, null);
    u.rect(6, 5, 1, 4, 'steel').set(5, 8, 'steel');
    for (const x of [3, 6, 9]) u.set(x, 1, 'yellow');
    u.outline('ink');
    return u;
};
export const UMBRELLA = { w: UW, h: UH };
