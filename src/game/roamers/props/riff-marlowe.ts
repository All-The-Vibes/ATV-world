import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 11;
const H = 9;

/** A little synth-guitar that jiggles between two strum frames. */
export const guitarProp: RoamerProp = {
    key: 'roamer-riff-guitar',
    frames: 2,
    w: W,
    h: H,
    frameRate: 6,
    offset: [8, -9],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        for (let f = 0; f < 2; f++) {
            const g = new PixelCanvas(W, H);
            g.rect(0, 3, 6, 5, 'violet').rect(1, 4, 4, 3, 'pink').rect(3, 5, 1, 1, 'ink');
            g.rect(6, 4 + f, 5, 1, 'wood');
            g.rect(9, 3 + f, 2, 1, 'gold');
            g.set(2, 3 + f, 'gold');
            g.outline('ink');
            pc.blit(g, f * W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};

export const NOTE_KEY = 'roamer-riff-note';
export const NOTE_W = 5;
export const NOTE_H = 7;

/** A tiny eighth note. */
export function noteArt(): PixelCanvas {
    const n = new PixelCanvas(NOTE_W, NOTE_H);
    n.ascii(0, 0, ['...##', '...#.', '...#.', '...#.', '.###.', '####.', '.##..'], { '#': 'gold', '.': null });
    return n;
}
