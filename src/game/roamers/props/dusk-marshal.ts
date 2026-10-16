import { PixelCanvas, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 10;
const H = 20;

/** A red energy blade with a flickering white-hot core. */
export const pulseBlade: RoamerProp = {
    key: 'roamer-pulse-blade',
    frames: 2,
    w: W,
    h: H,
    frameRate: 5,
    offset: [8, -14],
    make: () => {
        const sheet = new PixelCanvas(W * 2, H);
        for (let frame = 0; frame < 2; frame++) {
            const blade = new PixelCanvas(W, H);
            blade.line(2, 15, 8, 1, 'wine')
                .line(3, 15, 8, 2, 'red')
                .line(4, 14, 8, 3, frame ? 'white' : 'orange')
                .rect(0, 14, 5, 2, 'steel')
                .rect(1, 15, 3, 1, 'mist')
                .rect(2, 16, 2, 3, 'ink')
                .outline('ink');
            sheet.blit(blade, frame * W, 0);
        }
        return { canvas: sheet, frames: stripFrames(2, W, H) };
    },
};
