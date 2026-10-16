import { PixelCanvas, stripFrames, type ColorName } from '../kit';
import type { RoamerProp } from './types';

export const LANTERN_W = 7;
export const LANTERN_H = 9;

/** A hand lantern that flickers between two frames. `glow` is the colour of the light. */
export function lanternProp(glow: ColorName): RoamerProp {
    return {
        key: `roamer-lantern-${glow}`,
        frames: 2,
        w: LANTERN_W,
        h: LANTERN_H,
        frameRate: 5,
        offset: [9, -16],
        make: () => {
            const pc = new PixelCanvas(LANTERN_W * 2, LANTERN_H);
            for (let f = 0; f < 2; f++) {
                const l = new PixelCanvas(LANTERN_W, LANTERN_H);
                l.rect(2, 0, 3, 1, 'slate').rect(1, 1, 5, 1, 'steel');
                l.rect(1, 2, 5, 5, f ? 'yellow' : glow).rect(2, 3, 3, 3, f ? 'white' : 'yellow');
                l.rect(1, 7, 5, 1, 'steel');
                l.outline('ink');
                pc.blit(l, f * LANTERN_W, 0);
            }
            return { canvas: pc, frames: stripFrames(2, LANTERN_W, LANTERN_H) };
        },
    };
}
