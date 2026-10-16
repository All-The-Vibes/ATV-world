import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 7;
const H = 10;

/** A tiny amber lantern on a hook that swings between two frames. */
export const amberLantern: RoamerProp = {
    key: 'roamer-mosswick-lantern',
    frames: 2,
    w: W,
    h: H,
    frameRate: 3,
    offset: [9, -15],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const l = new PixelCanvas(W, H);
            const dx = f; // the whole lantern leans a pixel on the second frame
            l.rect(3, 0, 1, 1, 'steel');
            l.rect(2 + dx, 1, 3, 1, 'slate');
            l.rect(1 + dx, 2, 5, 5, 'orange').rect(2 + dx, 3, 3, 3, 'yellow').rect(3 + dx, 4, 1, 1, 'white');
            l.rect(1 + dx, 7, 5, 1, 'earth');
            l.outline('ink');
            pc.blit(l, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};
