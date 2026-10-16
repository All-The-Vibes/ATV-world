import type Phaser from 'phaser';
import { PixelCanvas, ensurePixels, miniText, miniTextWidth, stripFrames } from '../kit';

export const GREMLIN_W = 14;
export const GREMLIN_H = 16;

/** A small green gremlin with big ears and red eyes, two scampering frames. */
export function gremlinTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'gremlin', () => {
        const pc = new PixelCanvas(GREMLIN_W * 2, GREMLIN_H);
        for (let f = 0; f < 2; f++) {
            const g = new PixelCanvas(GREMLIN_W, GREMLIN_H);
            g.rect(0, 3, 3, 2, 'leaf').rect(11, 3, 3, 2, 'leaf').set(1, 4, 'pink').set(12, 4, 'pink');
            g.rect(3, 2, 8, 6, 'grass').rect(4, 1, 6, 1, 'grass');
            g.rect(4, 4, 2, 2, 'red').rect(8, 4, 2, 2, 'red').set(5, 4, 'yellow').set(9, 4, 'yellow');
            g.rect(5, 7, 4, 1, 'ink').set(5, 7, 'white').set(8, 7, 'white');
            g.rect(4, 8, 6, 4, 'leaf').rect(5, 9, 4, 2, 'lime');
            g.rect(2, 9 + f, 2, 1, 'leaf').rect(10, 9 + (1 - f), 2, 1, 'leaf');
            g.rect(4, 12, 2, 2 - f, 'forest').rect(8, 12, 2, 1 + f, 'forest');
            g.rect(3, 14 - f, 3, 1, 'ink').rect(8, 13 + f, 3, 1, 'ink');
            g.outline('ink');
            pc.blit(g, f * GREMLIN_W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, GREMLIN_W, GREMLIN_H) };
    });
}

/** The "-1 TOKEN" that pops up over whoever got robbed. */
export function lossTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'gremlin-loss', () => {
        const text = '-1 TOKEN';
        const pc = new PixelCanvas(miniTextWidth(text) + 2, 7);
        miniText(pc, 1, 1, text, 'red');
        return pc.outline('ink', true);
    });
}
