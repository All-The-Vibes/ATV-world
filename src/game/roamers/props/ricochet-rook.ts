import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 7;
const H = 12;

/** A short cape that flutters between two frames, hanging behind his back. */
export const capeProp: RoamerProp = {
    key: 'roamer-rook-cape',
    frames: 2,
    w: W,
    h: H,
    frameRate: 4,
    offset: [-5, -10],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const c = new PixelCanvas(W, H);
            const sway = f ? 1 : 0;
            c.rect(0, 0, 3, 2, 'red');
            for (let y = 2; y < H - 1; y++) {
                const x = Math.min(4, Math.floor((y - 2) / 3) * sway + (y > 6 ? 1 : 0));
                c.rect(x, y, 3 + (y > 5 ? 1 : 0), 1, y % 3 === 0 ? 'violet' : 'red');
            }
            c.rect(f ? 2 : 1, H - 1, 4, 1, 'violet');
            c.outline('ink');
            pc.blit(c, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};
