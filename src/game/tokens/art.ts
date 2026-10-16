import type Phaser from 'phaser';
import { PixelCanvas, ensurePixels, miniText, miniTextWidth, stripFrames } from '../kit';

export const CAR_W = 46;
export const CAR_H = 18;

/** A sleek white electric car with its wheels swapped for hover pods. Faces right; two frames of thruster flicker. */
export function carTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'tokens-car', () => {
        const pc = new PixelCanvas(CAR_W * 2, CAR_H);
        for (let f = 0; f < 2; f++) {
            const ox = f * CAR_W;
            const body = new PixelCanvas(CAR_W, CAR_H);
            // Fastback roof and glass: a long slope to the rear (left), a steep windshield at the front (right).
            for (let y = 2; y <= 6; y++) {
                const left = 18 - (y - 2) * 2.5;
                const right = 28 + (y - 2) * 1.5;
                for (let x = Math.round(left); x <= Math.round(right); x++) {
                    const glass = y > 2 && x > left + 1 && x < right - 1 && x !== 23;
                    body.set(x, y, glass ? (x > 23 && y === 3 ? 'steel' : 'night') : 'white');
                }
            }
            // Body: tapered nose and tail, a crease line, and a slightly darker underside.
            body.rect(4, 7, 36, 1, 'white').rect(3, 8, 39, 3, 'white').rect(4, 11, 37, 1, 'cloud');
            body.rect(5, 6, 4, 1, 'white').rect(34, 6, 4, 1, 'white');
            body.rect(5, 9, 35, 1, 'cloud');
            body.set(23, 8, 'mist').set(23, 10, 'mist');
            body.rect(3, 8, 2, 1, 'red').set(41, 8, 'cyan').set(40, 8, 'ice');
            // Hover pods where the wheels would be.
            for (const px of [11, 33]) body.ellipse(px, 12.5, 4, 1.6, 'slate').rect(px - 2, 12, 4, 1, 'steel');
            body.outline('ink');
            pc.blit(body, ox, 0);
            // Thrusters under each pod, flickering between frames.
            for (const px of [11, 33]) {
                const len = f ? 3 : 2;
                for (let j = 0; j < len; j++) {
                    pc.rect(ox + px - 2 + (j > 0 ? 1 : 0), 15 + j, j > 0 ? 2 : 4, 1, j === 0 ? 'ice' : 'cyan');
                }
            }
        }
        return { canvas: pc, frames: stripFrames(2, CAR_W, CAR_H) };
    });
}

export const BANNER_TEXT = 'FREE TOKENS!';
const CLOTH_W = miniTextWidth(BANNER_TEXT) + 8;
const CLOTH_H = 11;
const ROPE = 10;
export const BANNER_W = CLOTH_W + 2 + ROPE;
export const BANNER_H = CLOTH_H + 4;

/**
 * The cloth banner a car tows, rippling over two frames. `ropeRight` puts the tow rope on the right end
 * (for a car flying right), so the words never read backwards.
 */
export function bannerTexture(scene: Phaser.Scene, ropeRight: boolean): string {
    return ensurePixels(scene, `tokens-banner-${ropeRight ? 'r' : 'l'}`, () => {
        const cloth = new PixelCanvas(CLOTH_W + 2, CLOTH_H + 2);
        cloth.rect(1, 1, CLOTH_W, CLOTH_H, 'white').rect(1, 1, CLOTH_W, 1, 'red').rect(1, CLOTH_H, CLOTH_W, 1, 'red');
        for (let x = 1; x <= CLOTH_W; x += 2) cloth.set(x, CLOTH_H - 1, 'cloud');
        miniText(cloth, 5, 4, BANNER_TEXT, 'red');
        cloth.outline('ink');

        const pc = new PixelCanvas(BANNER_W * 2, BANNER_H);
        const clothX = ropeRight ? 0 : ROPE;
        const ropeY = Math.floor(BANNER_H / 2);
        for (let f = 0; f < 2; f++) {
            const ox = f * BANNER_W;
            for (let x = 0; x < cloth.width; x++) {
                // A gentle ripple that runs away from the rope.
                const along = ropeRight ? cloth.width - x : x;
                const dy = Math.round(Math.sin(along / 5 + f * Math.PI)) + 1;
                for (let y = 0; y < cloth.height; y++) {
                    const v = cloth.px[y * cloth.width + x];
                    if (v >>> 24) pc.px[(y + dy) * pc.width + ox + clothX + x] = v;
                }
            }
            const rx = ropeRight ? ox + cloth.width : ox;
            pc.rect(rx, ropeY, ROPE, 1, 'steel');
        }
        return { canvas: pc, frames: stripFrames(2, BANNER_W, BANNER_H) };
    });
}

export const TOKEN_SIZE = 11;

/** A gold token with a T on its face, spinning over four frames. */
export function tokenTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'tokens-token', () => {
        const pc = new PixelCanvas(TOKEN_SIZE * 4, TOKEN_SIZE);
        [4.5, 3, 1.2, 3].forEach((rx, f) => {
            const coin = new PixelCanvas(TOKEN_SIZE, TOKEN_SIZE);
            const c = TOKEN_SIZE / 2;
            coin.ellipse(c, c, rx, 4.5, (_x, _y, nx, ny) => (nx * nx + ny * ny > 0.55 ? 'gold' : nx - ny < -0.4 ? 'yellow' : 'gold'));
            if (rx > 2) coin.ellipse(c, c, rx * 0.6, 2.8, (_x, _y, nx) => (nx < 0 ? 'yellow' : 'gold'));
            if (f === 0) coin.rect(4, 3, 3, 1, 'clay').rect(5, 4, 1, 4, 'clay');
            if (f === 2) coin.rect(5, 2, 1, 7, 'clay');
            coin.outline('ink');
            pc.blit(coin, f * TOKEN_SIZE, 0);
        });
        return { canvas: pc, frames: stripFrames(4, TOKEN_SIZE, TOKEN_SIZE) };
    });
}

/** The little "+1 TOKEN" that pops up over whoever grabs one. */
export function popTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'tokens-pop', () => {
        const text = '+1 TOKEN';
        const pc = new PixelCanvas(miniTextWidth(text) + 2, 7);
        miniText(pc, 1, 1, text, 'yellow');
        return pc.outline('ink', true);
    });
}
