import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 11;
const H = 7;

/** A chunky toy foam blaster; the second frame has a muzzle flash. */
export const blasterProp: RoamerProp = {
    key: 'roamer-foam-blaster',
    frames: 2,
    w: W,
    h: H,
    frameRate: 1,
    offset: [9, -12],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const b = new PixelCanvas(W, H);
            b.rect(0, 2, 7, 3, 'violet').rect(1, 2, 5, 1, 'cyan').rect(2, 5, 2, 2, 'slate');
            b.rect(7, 3, 2, 1, 'white').set(0, 3, 'gold');
            b.outline('ink');
            if (f) b.rect(9, 2, 2, 3, 'yellow').set(10, 3, 'white');
            pc.blit(b, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};
