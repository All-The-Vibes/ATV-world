import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

export const CAPE_W = 10;
export const CAPE_H = 13;

/** A bat-wing cape that flutters between two frames. */
export const capeProp: RoamerProp = {
    key: 'roamer-vesper-cape',
    frames: 2,
    w: CAPE_W,
    h: CAPE_H,
    frameRate: 4,
    offset: [-5, -11],
    make: () => {
        const pc = new PixelCanvas(CAPE_W * 2, CAPE_H);
        for (let f = 0; f < 2; f++) {
            const c = new PixelCanvas(CAPE_W, CAPE_H);
            c.rect(6, 0, 3, 8, 'violet').rect(3, 2 + f, 4, 8, 'violet').rect(0, 4 + f, 4, 6, 'violet');
            // scalloped bat-wing hem
            for (const [x, y] of [[0, 10 + f], [2, 11 + f], [4, 12], [6, 11], [8, 10]] as const) c.rect(x, y, 2, 2 - (f && x === 0 ? 1 : 0), 'violet');
            c.rect(6, 1, 2, 6, 'wine').rect(3, 4 + f, 2, 5, 'wine').rect(1, 6 + f, 1, 3, 'wine');
            pc.blit(c.outline('ink'), f * CAPE_W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, CAPE_W, CAPE_H) };
    },
};

export const BAT_W = 7;
export const BAT_H = 4;

/** Two 7x4 bat frames: wings up and wings down. */
export function batFrame(up: boolean): PixelCanvas {
    const b = new PixelCanvas(BAT_W, BAT_H);
    if (up) b.rect(0, 0, 2, 2, 'plum').rect(5, 0, 2, 2, 'plum').rect(1, 1, 2, 2, 'plum').rect(4, 1, 2, 2, 'plum');
    else b.rect(0, 2, 2, 2, 'plum').rect(5, 2, 2, 2, 'plum').rect(1, 1, 2, 2, 'plum').rect(4, 1, 2, 2, 'plum');
    b.rect(3, 0, 1, 3, 'ink').set(3, 1, 'violet');
    b.set(2, 0, 'ink').set(4, 0, 'ink');
    return b;
}
