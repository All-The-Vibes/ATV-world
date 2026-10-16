import { PixelCanvas, miniText, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 7;
const H = 9;

/** A gold clipboard: lowered, then raised with a new scribble. */
export const clipboardProp: RoamerProp = {
    key: 'roamer-clipboard-gold',
    frames: 2,
    w: W,
    h: H,
    frameRate: 2,
    offset: [8, -13],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const c = new PixelCanvas(W, H);
            c.rect(1, 1, 5, 7, 'gold').rect(2, 2, 3, 5, 'cream').rect(2, 0, 3, 2, 'steel');
            c.rect(2, f ? 3 : 4, 3, 1, 'violet').rect(2, f ? 5 : 6, 2, 1, 'slate');
            c.outline('ink');
            pc.blit(c, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};

export const BANNER_KEY = 'roamer-breaking-news';

/** The 20x8 news mini-banner texture. */
export function bannerCanvas(): PixelCanvas {
    const pc = new PixelCanvas(20, 8);
    pc.rect(0, 0, 20, 8, 'violet').rect(0, 0, 20, 1, 'gold').rect(0, 7, 20, 1, 'gold');
    miniText(pc, 1, 1, 'NEWS', 'white');
    pc.rect(17, 2, 2, 4, 'gold');
    return pc.outline('ink');
}
