import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

/** A reed antenna that sways between two frames. */
export const reedProp: RoamerProp = {
    key: 'roamer-morrow-reed',
    frames: 2,
    w: 5,
    h: 10,
    frameRate: 3,
    offset: [0, -23],
    make: () => {
        const pc = new PixelCanvas(10, 10);
        for (let f = 0; f < 2; f++) {
            const r = new PixelCanvas(5, 10);
            const lean = f ? 1 : -1;
            r.rect(2, 4, 1, 6, 'pine');
            r.rect(2 + lean, 2, 1, 2, 'leaf').rect(2 + lean * 2, 0, 1, 2, 'bark');
            pc.blit(r, f * 5, 0);
        }
        return { canvas: pc, frames: stripFrames(2, 5, 10) };
    },
};

/** A 5x5 gold disc for show-and-tell. */
export function coinCanvas(): PixelCanvas {
    const c = new PixelCanvas(5, 5);
    c.rect(1, 0, 3, 5, 'gold').rect(0, 1, 5, 3, 'gold').rect(2, 1, 1, 3, 'yellow').set(1, 1, 'yellow');
    return c.outline('ink');
}
