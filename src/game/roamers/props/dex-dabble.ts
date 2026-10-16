import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 9;
const H = 9;

/** A wrench that throws an orange spark on its second frame. */
export const wrenchProp: RoamerProp = {
    key: 'roamer-wrench-spark',
    frames: 2,
    w: W,
    h: H,
    frameRate: 4,
    offset: [8, -12],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const c = new PixelCanvas(W, H);
            c.line(2, 7, 5, 4, 'steel').line(3, 7, 6, 4, 'steel');
            c.rect(5, 2, 3, 3, 'steel').rect(6, 2, 1, 1, 'slate');
            c.outline('ink');
            if (f) {
                c.set(1, 1, 'orange').set(2, 2, 'yellow').set(0, 3, 'orange').set(3, 0, 'yellow').set(1, 4, 'orange');
            }
            pc.blit(c, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};
