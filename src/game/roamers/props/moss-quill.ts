import { PixelCanvas, ensurePixels, stripFrames } from '../../kit';
import type { RoamerProp } from '../types';

const W = 11;
const H = 10;

/** A tin watering can: upright, then tilted with blue droplets. */
export const wateringCan: RoamerProp = {
    key: 'roamer-moss-can',
    frames: 2,
    w: W,
    h: H,
    frameRate: 1.5,
    offset: [8, -10],
    make: () => {
        const pc = new PixelCanvas(W * 2, H);
        const up = new PixelCanvas(W, H);
        up.rect(2, 4, 5, 5, 'steel').rect(3, 4, 3, 1, 'mist').rect(2, 2, 5, 1, 'steel').rect(2, 3, 1, 1, 'steel').rect(6, 3, 1, 1, 'steel');
        up.rect(7, 5, 1, 1, 'steel').rect(8, 4, 1, 1, 'steel').rect(9, 3, 1, 1, 'steel').rect(9, 2, 1, 1, 'mist');
        up.rect(0, 4, 1, 3, 'slate').rect(1, 3, 1, 1, 'slate').rect(1, 7, 1, 1, 'slate');
        up.outline('ink');
        const tilt = new PixelCanvas(W, H);
        tilt.rect(1, 2, 5, 5, 'steel').rect(2, 2, 3, 1, 'mist').rect(0, 1, 1, 1, 'slate').rect(0, 6, 1, 1, 'slate').rect(0, 2, 1, 4, 'slate');
        tilt.rect(6, 4, 1, 1, 'steel').rect(7, 5, 1, 1, 'steel').rect(8, 6, 1, 1, 'steel').rect(8, 7, 1, 1, 'mist');
        tilt.rect(9, 8, 1, 1, 'sky').rect(10, 9, 1, 1, 'blue').rect(8, 9, 1, 1, 'cyan');
        tilt.outline('ink');
        pc.blit(up, 0, 0).blit(tilt, W, 0);
        return { canvas: pc, frames: stripFrames(2, W, H) };
    },
};

/** A tiny 5x6 sprout (leaf green) or a gold coin flower. */
export function sproutTexture(scene: Phaser.Scene, coin: boolean): string {
    const key = coin ? 'roamer-moss-coinflower' : 'roamer-moss-sprout';
    return ensurePixels(scene, key, () => {
        const pc = new PixelCanvas(5, 6);
        pc.rect(2, 3, 1, 3, 'forest');
        if (coin) {
            pc.rect(1, 0, 3, 3, 'gold').rect(2, 1, 1, 1, 'yellow').rect(0, 4, 2, 1, 'leaf').rect(3, 4, 2, 1, 'leaf');
        } else {
            pc.rect(0, 2, 2, 1, 'leaf').rect(0, 1, 1, 1, 'leaf').rect(3, 2, 2, 1, 'lime').rect(4, 1, 1, 1, 'lime').rect(1, 3, 1, 1, 'leaf');
        }
        return pc.outline('ink');
    });
}
