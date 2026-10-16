import type Phaser from 'phaser';
import { PixelCanvas, ensurePixels, stripFrames, type ColorName } from '../kit';

export const LANTERN_W = 7;
export const LANTERN_H = 9;

/** A hand lantern that flickers between two frames. `glow` is the colour of the light. */
export function lanternTexture(scene: Phaser.Scene, glow: ColorName): string {
    return ensurePixels(scene, `roamer-lantern-${glow}`, () => {
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
    });
}
