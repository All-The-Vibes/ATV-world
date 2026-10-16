import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 5;
const H = 9;

/** A handheld mic with a glint that flashes on the second frame. */
export const micProp: RoamerProp = {
    key: 'roamer-vey-mic',
    frames: 2,
    w: W,
    h: H,
    frameRate: 3,
    offset: [7, -15],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const m = new PixelCanvas(W, H);
            m.rect(1, 0, 3, 3, 'steel').rect(1, 1, 3, 1, 'mist');
            m.rect(2, 3, 1, 5, 'gold');
            m.outline('ink');
            if (f) m.set(1, 0, 'white').set(0, 1, 'white').set(2, 1, 'white').set(1, 2, 'white');
            pc.blit(m, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};
