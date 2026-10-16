import { PixelCanvas, fbm, miniText, miniTextWidth } from '../kit';

/** The trampled field, in pixels from its top-left corner. */
export const FIELD = { w: 310, h: 80 };
/** Where the pullers' feet are, and the mud pit's centre. */
export const FEET_Y = 58;
export const ROPE_W = 270;
export const ROPE_H = 4;
/** How far from the centre the red "you win" lines sit. */
export const WIN_LINE = 60;

/** Dirt churned up by years of pulling, a centre line, a win line each side, and a mud pit in the middle. */
export function fieldArt() {
    const { w, h } = FIELD;
    const pc = new PixelCanvas(w, h);
    pc.ellipse(w / 2, FEET_Y - 2, w / 2 - 2, 22, (x, y, nx, ny) => {
        const edge = nx * nx + ny * ny;
        if (edge > 0.82) return fbm(x, y, 4, 3) > 0.5 ? 'clay' : 'wood';
        return fbm(x, y, 6, 3) > 0.6 ? 'clay' : 'sand';
    });
    for (let y = FEET_Y - 20; y < FEET_Y + 18; y += 4) {
        pc.rect(w / 2, y, 1, 2, 'white');
        for (const dx of [-WIN_LINE, WIN_LINE]) pc.rect(w / 2 + dx, y, 1, 2, 'red');
    }
    pc.ellipse(w / 2, FEET_Y + 1, 15, 5, 'bark').ellipse(w / 2, FEET_Y + 1, 13, 4, 'earth');
    for (const [dx, dy] of [[-6, 0], [-1, 2], [5, 0], [8, 2], [2, -1]]) pc.set(w / 2 + dx, FEET_Y + 1 + dy, 'wood');
    return pc;
}

/** A twisted rope. */
export function ropeArt() {
    const pc = new PixelCanvas(ROPE_W, ROPE_H);
    for (let x = 0; x < ROPE_W; x++) {
        for (let y = 0; y < ROPE_H - 1; y++) pc.set(x, y, (x + y) % 4 < 2 ? 'sand' : 'wood');
        pc.set(x, ROPE_H - 1, 'bark');
    }
    return pc;
}

/** The red flag tied to the middle of the rope. */
export const FLAG = { w: 12, h: 11 };
export function flagArt() {
    const pc = new PixelCanvas(FLAG.w, FLAG.h);
    pc.rect(5, 0, 2, 3, 'wood').rect(1, 3, 10, 7, 'red').rect(1, 5, 10, 2, 'white');
    pc.set(3, 9, null).set(7, 9, null);
    return pc.outline('ink');
}

/** The sign on its post, behind the field. */
export const SIGN = { w: 51, h: 34 };
export function signArt() {
    const pc = new PixelCanvas(SIGN.w, SIGN.h);
    pc.rect(23, 26, 5, 8, 'wood').rect(23, 26, 1, 8, 'clay');
    pc.rect(0, 0, SIGN.w, 27, 'wood').rect(1, 1, SIGN.w - 2, 25, 'cream');
    ['TUG OF WAR', 'ROUND 1 OF', 'FOREVER'].forEach((line, i) => {
        miniText(pc, Math.floor((SIGN.w - miniTextWidth(line)) / 2), 4 + i * 7, line, i === 0 ? 'red' : 'earth');
    });
    return pc.outline('ink');
}
