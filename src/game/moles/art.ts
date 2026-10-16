import type Phaser from 'phaser';
import { PixelCanvas, addPixels, ensurePixels, fbm, miniText, miniTextWidth, stripFrames, type Color } from '../kit';

export const COLS = 3;
export const ROWS = 3;
export const HOLE_DX = 30;
export const HOLE_DY = 20;
export const PATCH_W = COLS * HOLE_DX + 22;
export const PATCH_H = ROWS * HOLE_DY + 18;
export const MOLE_W = 14;
export const MOLE_H = 14;
export const SIGN_W = 66;
export const SIGN_H = 33;

/** Hole centers, relative to the patch's top-left corner. */
export const holeSpots = () =>
    Array.from({ length: COLS * ROWS }, (_, i) => ({ x: 11 + HOLE_DX / 2 + (i % COLS) * HOLE_DX, y: 16 + Math.floor(i / COLS) * HOLE_DY }));

/** A fenced dirt patch with nine mole holes. */
export function patchTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'moles-patch', () => {
        const pc = new PixelCanvas(PATCH_W, PATCH_H);
        for (let y = 3; y < PATCH_H - 2; y++) {
            for (let x = 1; x < PATCH_W - 1; x++) pc.mix(x, y, 'earth', 'clay', fbm(x, y, 9, 41) * 0.8 - 0.15);
        }
        for (const { x, y } of holeSpots()) {
            pc.ellipse(x, y, 9, 4, 'bark');
            pc.ellipse(x, y, 7, 3, 'ink');
            pc.line(x - 6, y + 4, x + 6, y + 4, 'clay');
        }
        // Fence: rails all round, posts every 10px.
        pc.rect(0, 2, PATCH_W, 1, 'wood').rect(0, PATCH_H - 3, PATCH_W, 1, 'wood');
        pc.rect(0, 2, 1, PATCH_H - 4, 'wood').rect(PATCH_W - 1, 2, 1, PATCH_H - 4, 'wood');
        for (let x = 0; x < PATCH_W - 1; x += 10) {
            pc.rect(x, 0, 2, 5, 'wood').set(x, 0, 'clay');
            pc.rect(x, PATCH_H - 5, 2, 5, 'wood').set(x, PATCH_H - 5, 'clay');
        }
        pc.rect(PATCH_W - 2, 0, 2, 5, 'wood').rect(PATCH_W - 2, PATCH_H - 5, 2, 5, 'wood');
        return pc;
    });
}

/** Four frames: mole, bonked mole, golden mole, bonked golden mole. */
export function moleTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'moles-mole', () => {
        const pc = new PixelCanvas(MOLE_W * 4, MOLE_H);
        const body = [
            '....bbbbbb....',
            '...bmmmmmmb...',
            '..bmmmmmmmmb..',
            '..bmmmmmmmmb..',
            '..bmmmppmmmb..',
            '.bmmmpnnpmmmb.',
            '.bmmmmppmmmmb.',
            '.bmmmmwwmmmmb.',
            'cbmmmmmmmmmmbc',
            'ccbmmllllmmbcc',
            '.cbmllllllmbc.',
            '..bmmllllmmb..',
            '..bmmmmmmmmb..',
            '..bmmmmmmmmb..',
        ];
        const paint = (frame: number, fur: Color, belly: Color, bonked: boolean) => {
            const ox = frame * MOLE_W;
            pc.ascii(ox, 0, body, { '.': null, b: 'ink', m: fur, l: belly, p: 'pink', n: 'wine', w: 'white', c: 'peach' });
            for (const ex of [4, 9]) {
                if (bonked) pc.set(ox + ex - 1, 2, 'ink').set(ox + ex + 1, 2, 'ink').set(ox + ex, 3, 'ink').set(ox + ex - 1, 4, 'ink').set(ox + ex + 1, 4, 'ink');
                else pc.set(ox + ex, 3, 'ink').set(ox + ex, 2, 'white');
            }
        };
        paint(0, 'slate', 'steel', false);
        paint(1, 'slate', 'steel', true);
        paint(2, 'gold', 'yellow', false);
        paint(3, 'gold', 'yellow', true);
        return { canvas: pc, frames: stripFrames(4, MOLE_W, MOLE_H) };
    });
}

/** A little word that pops up and floats away (BONK!, +5, GO!). */
export function popTexture(scene: Phaser.Scene, text: string, color: Color): string {
    return ensurePixels(scene, `moles-pop-${text}-${color}`, () => {
        const pc = new PixelCanvas(miniTextWidth(text) + 4, 9);
        miniText(pc, 2, 2, text, color);
        return pc.outline('ink', true);
    });
}

/** A star that flies off a bonked mole. */
export function starTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'moles-star', () =>
        new PixelCanvas(5, 5).ascii(0, 0, ['..y..', '.yYy.', 'yYYYy', '.yYy.', '..y..'], { '.': null, y: 'gold', Y: 'yellow' }));
}

/** The scoreboard on its post. Redrawn whenever the lines change. */
export function signTexture(scene: Phaser.Scene, lines: [string, string, string]): string {
    const pc = new PixelCanvas(SIGN_W, SIGN_H);
    pc.rect(SIGN_W / 2 - 2, 24, 4, SIGN_H - 24, 'bark');
    pc.rect(0, 0, SIGN_W, 25, 'bark').rect(1, 1, SIGN_W - 2, 23, 'wood');
    const colors: Color[] = ['yellow', 'cream', 'cream'];
    lines.forEach((line, i) => miniText(pc, Math.floor((SIGN_W - miniTextWidth(line)) / 2), 3 + i * 7, line, colors[i]));
    return addPixels(scene, 'moles-sign', pc, [], true);
}
