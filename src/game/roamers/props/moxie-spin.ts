import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 8;
const H = 6;

/** A coral scarf tail that flutters between two frames, trailing behind her. */
export const trailingScarf: RoamerProp = {
    key: 'roamer-trailing-scarf',
    frames: 2,
    w: W,
    h: H,
    frameRate: 7,
    offset: [-8, -14],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const s = new PixelCanvas(W, H);
            s.rect(4, 2 + f, 4, 1, 'orange').rect(2, 2 + f, 2, 2, 'pink');
            s.rect(0, 3 - f, 3, 1, 'orange').rect(0, 4 - f, 2, 1, 'pink');
            s.outline('ink');
            pc.blit(s, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};
