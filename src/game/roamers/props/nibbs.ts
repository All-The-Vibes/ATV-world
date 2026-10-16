import { PixelCanvas, stripFrames } from '../../kit';

export const BOX_KEY = 'roamer-nibbs-box';
export const BOX_W = 14;
export const BOX_H = 13;

/** A cardboard box with a peeking red eye; frame 1 is slightly shifted for a shiver. */
export function boxArt(): { canvas: PixelCanvas; frames: ReturnType<typeof stripFrames> } {
    const pc = new PixelCanvas(BOX_W * 2, BOX_H);
    for (let f = 0; f < 2; f++) {
        const b = new PixelCanvas(BOX_W, BOX_H);
        b.rect(1, 3, 12, 9, 'wood').rect(1, 3, 12, 1, 'sand').rect(6, 3, 2, 9, 'sand');
        b.rect(f ? 0 : 1, 1, 5, 2, 'sand').rect(f ? 9 : 8, 1, 5, 2, 'sand');
        b.rect(2, 7, 4, 3, 'night').rect(3, 8, 2, 1, 'red');
        b.rect(9, 6, 3, 1, 'earth');
        b.outline('ink');
        pc.blit(b, f * BOX_W, 0);
    }
    return { canvas: pc, frames: stripFrames(2, BOX_W, BOX_H) };
}
