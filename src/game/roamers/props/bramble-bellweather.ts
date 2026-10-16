import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 20;
const H = 12;

/** A small two-wheeled cart with a hanging bell that flashes cyan. */
export const bellCart: RoamerProp = {
    key: 'roamer-bramble-cart',
    frames: 2,
    w: W,
    h: H,
    frameRate: 3,
    offset: [-15, -6],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const c = new PixelCanvas(W, H);
            c.rect(3, 5, 13, 4, 'wood').rect(3, 5, 13, 1, 'sand').rect(3, 8, 13, 1, 'bark');
            c.rect(16, 6, 4, 1, 'bark');
            c.rect(9, 0, 1, 5, 'bark').rect(5, 0, 9, 1, 'bark');
            c.rect(8, 1, 3, 3, f ? 'cyan' : 'gold').rect(9, 2, 1, 1, f ? 'white' : 'yellow').rect(9, 4, 1, 1, 'ink');
            c.ellipse(5, 9, 2.4, 2.4, 'earth').ellipse(14, 9, 2.4, 2.4, 'earth').rect(5, 9, 1, 1, 'sand').rect(14, 9, 1, 1, 'sand');
            c.outline('ink');
            pc.blit(c, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};
