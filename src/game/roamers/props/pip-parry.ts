import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 9;
const H = 10;

/** A round guard shield whose violet and gold rings swap on each frame. */
export const guardShield: RoamerProp = {
    key: 'roamer-guard-shield',
    frames: 2,
    w: W,
    h: H,
    frameRate: 6,
    offset: [8, -10],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const s = new PixelCanvas(W, H);
            s.ellipse(4, 4.5, 4, 4.5, f ? 'gold' : 'violet');
            s.ellipse(4, 4.5, 2.6, 3, f ? 'violet' : 'gold');
            s.rect(3, 3, 3, 3, f ? 'yellow' : 'white');
            s.outline('ink');
            pc.blit(s, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};
