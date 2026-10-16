import { PixelCanvas, fbm, miniText, stripFrames } from '../kit';

/** The pool deck, and the water inside it, in pixels from the deck's top-left corner. */
export const DECK = { w: 250, h: 100 };
export const WATER = { x: 100, y: 16, w: 136, h: 60 };
/** The steps out of the pool, on its near edge. */
export const STEPS_X = 218;
export const POOL_FRAMES = 3;

/** Deck tiles, coping, and three frames of shimmering water. */
export function poolArt() {
    const { w, h } = DECK;
    const deck = new PixelCanvas(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const grout = x % 10 === 0 || y % 10 === 0;
            deck.set(x, y, grout || fbm(x, y, 8, 5) > 0.66 ? 'sand' : 'cream');
        }
    }
    deck.rect(0, 0, w, 1, 'clay').rect(0, h - 1, w, 1, 'clay').rect(0, 0, 1, h, 'clay').rect(w - 1, 0, 1, h, 'clay');
    deck.rect(WATER.x - 2, WATER.y - 2, WATER.w + 4, WATER.h + 4, 'white')
        .rect(WATER.x - 2, WATER.y + WATER.h + 1, WATER.w + 4, 1, 'cloud');
    miniText(deck, WATER.x + 4, 6, 'DEEP END', 'navy');
    miniText(deck, WATER.x + WATER.w - 34, 6, 'NO BOMBS', 'red');
    miniText(deck, 120, 88, 'NO RUNNING', 'clay');
    // Beach towels on the corner of the deck.
    for (const [tx, a] of [[6, 'pink'], [24, 'cyan']] as const) {
        for (let y = 80; y < 96; y++) deck.rect(tx, y, 14, 1, Math.floor((y - 80) / 3) % 2 ? 'white' : a);
    }

    const canvas = new PixelCanvas(w * POOL_FRAMES, h);
    for (let f = 0; f < POOL_FRAMES; f++) {
        const ox = f * w;
        canvas.blit(deck, ox, 0);
        for (let y = 0; y < WATER.h; y++) {
            for (let x = 0; x < WATER.w; x++) {
                const px = ox + WATER.x + x;
                const py = WATER.y + y;
                if (y < 3) {
                    canvas.set(px, py, y < 2 ? 'navy' : 'blue');
                    continue;
                }
                // Deeper (darker) toward the diving end on the left.
                const shallow = x / WATER.w;
                canvas.mix(px, py, 'blue', 'sky', 0.25 + shallow * 0.6 + (fbm(x, y, 12, 9) - 0.5) * 0.3);
                const lane = (y === 22 || y === 42) && x > 8 && x < WATER.w - 8;
                const tee = (x === 8 || x === WATER.w - 8) && (Math.abs(y - 22) < 3 || Math.abs(y - 42) < 3);
                if (lane || tee) canvas.set(px, py, 'navy');
                const wave = Math.sin(x * 0.35 + f * 2.1 + Math.sin(y * 0.5) * 2) + Math.sin(y * 0.7 - f * 2.1 + x * 0.12);
                if (wave > 1.85) canvas.set(px, py, 'ice');
                else if (wave > 1.5) canvas.set(px, py, 'cyan');
            }
        }
        // Chrome steps hooked over the near edge.
        for (const rx of [STEPS_X - 5, STEPS_X + 5]) {
            canvas.line(ox + rx, WATER.y + WATER.h - 10, ox + rx, WATER.y + WATER.h + 4, 'mist')
                .set(ox + rx, WATER.y + WATER.h + 5, 'steel');
        }
        for (const ry of [WATER.y + WATER.h - 7, WATER.y + WATER.h - 3]) canvas.line(ox + STEPS_X - 4, ry, ox + STEPS_X + 4, ry, 'cloud');
    }
    return { canvas, frames: stripFrames(POOL_FRAMES, w, h) };
}

/** The high-dive tower: two posts, a ladder, and the platform up top (the board is its own sprite). */
export const TOWER = { w: 24, h: 82 };
export function towerArt() {
    const pc = new PixelCanvas(TOWER.w, TOWER.h);
    for (const x of [5, 15]) pc.rect(x, 2, 2, TOWER.h - 2, 'steel').rect(x, 2, 1, TOWER.h - 2, 'mist');
    for (let y = 18; y < TOWER.h - 2; y += 6) pc.line(7, y, 14, y, 'cloud');
    pc.rect(2, 10, 20, 3, 'clay').rect(2, 10, 20, 1, 'sand')
        .line(2, 3, 2, 10, 'white').line(2, 3, 15, 3, 'white')
        .line(16, 13, 22, 11, 'steel').line(16, 14, 22, 12, 'steel')
        .rect(3, TOWER.h - 2, 6, 2, 'slate').rect(13, TOWER.h - 2, 6, 2, 'slate');
    return pc.outline('ink');
}

/** The springboard: a white plank with a blue stripe, pivoting at its left end. */
export const BOARD = { w: 44, h: 5 };
export function boardArt() {
    const pc = new PixelCanvas(BOARD.w, BOARD.h);
    pc.rect(0, 1, BOARD.w - 1, 2, 'white').rect(0, 3, BOARD.w - 1, 1, 'sky').set(BOARD.w - 1, 2, 'white');
    return pc.outline('ink');
}

/** A splash: a plop, a column, a crown, falling drops, a fading ring. */
export const SPLASH = { w: 32, h: 30, frames: 5 };
export function splashArt() {
    const { w, h, frames } = SPLASH;
    const canvas = new PixelCanvas(w * frames, h);
    const cx = w / 2;
    const base = h - 4;
    for (let f = 0; f < frames; f++) {
        const ox = f * w;
        const ring = (rx: number, c: 'white' | 'ice' | 'cyan') => {
            for (let a = 0; a < Math.PI * 2; a += 0.08) canvas.set(ox + cx + Math.cos(a) * rx, base + Math.sin(a) * rx * 0.3, c);
        };
        if (f === 0) {
            ring(5, 'white');
            canvas.ellipse(ox + cx, base - 4, 3, 4, 'ice').ellipse(ox + cx, base - 4, 1.5, 3, 'white');
        } else if (f === 1) {
            ring(8, 'white');
            canvas.rect(ox + cx - 3, base - 18, 6, 18, 'ice').rect(ox + cx - 1, base - 20, 3, 18, 'white');
            [[-7, -10], [6, -12], [-4, -22], [5, -21]].forEach(([dx, dy]) => canvas.rect(ox + cx + dx, base + dy, 2, 2, 'white'));
        } else if (f === 2) {
            ring(11, 'ice');
            for (const [dx, dy] of [[-12, -16], [-6, -23], [0, -26], [6, -23], [12, -16]]) {
                canvas.line(ox + cx, base - 2, ox + cx + dx, base + dy, 'ice').rect(ox + cx + dx - 1, base + dy - 1, 2, 2, 'white');
            }
        } else if (f === 3) {
            ring(13, 'ice');
            [[-13, -8], [-8, -14], [-2, -17], [4, -15], [9, -11], [13, -6], [-5, -6], [6, -5]]
                .forEach(([dx, dy]) => canvas.rect(ox + cx + dx, base + dy, 1, 2, 'white'));
        } else {
            ring(14, 'cyan');
            [[-12, -2], [11, -3], [0, -6]].forEach(([dx, dy]) => canvas.set(ox + cx + dx, base + dy, 'ice'));
        }
    }
    return { canvas, frames: stripFrames(frames, w, h) };
}

/** A thin ring spreading out on the water. */
export function rippleArt() {
    const pc = new PixelCanvas(32, 10);
    for (let a = 0; a < Math.PI * 2; a += 0.05) pc.set(16 + Math.cos(a) * 15, 5 + Math.sin(a) * 4, 'ice');
    return pc;
}

/** The little ring around a swimmer's shoulders. */
export function wakeArt() {
    const pc = new PixelCanvas(16, 5);
    for (let a = 0; a < Math.PI * 2; a += 0.1) pc.set(8 + Math.cos(a) * 7, 2 + Math.sin(a) * 2, a > 0.3 && a < Math.PI - 0.3 ? 'white' : 'ice');
    return pc;
}

/** Wednesday Addams standing sprite with twin braided pigtails, pale skin, white pointed collar, and black dress. */
export function wednesdayArt() {
    const pc = new PixelCanvas(16, 22);
    const p = (x: number, y: number, c: 'ink' | 'night' | 'slate' | 'steel' | 'cloud' | 'white' | 'red' | 'wine') => pc.set(x, y + 1, c);
    const row = (y: number, x0: number, x1: number, c: 'ink' | 'night' | 'slate' | 'steel' | 'cloud' | 'white' | 'red' | 'wine') => {
        for (let x = x0; x <= x1; x++) p(x, y, c);
    };
    // Pale face
    row(2, 5, 10, 'cloud');
    row(3, 4, 11, 'cloud');
    for (let y = 4; y <= 9; y++) row(y, 4, 11, 'cloud');
    row(10, 5, 10, 'cloud');
    // Deadpan dark eyes & subtle dark lip
    p(5, 7, 'ink'); p(6, 7, 'ink'); p(5, 8, 'ink');
    p(9, 7, 'ink'); p(10, 7, 'ink'); p(10, 8, 'ink');
    row(9, 7, 8, 'wine');
    // Parted black hair + twin long braids hanging down both sides
    row(1, 5, 10, 'ink');
    row(2, 4, 11, 'ink');
    row(3, 3, 12, 'ink');
    row(4, 3, 6, 'ink'); row(4, 9, 12, 'ink');
    p(7, 2, 'slate'); // center part highlight
    for (let y = 5; y <= 15; y++) {
        const bx = y % 2 === 0 ? 3 : 2;
        const rx = y % 2 === 0 ? 12 : 13;
        p(bx, y, 'ink'); p(bx + 1, y, y % 2 ? 'night' : 'ink');
        p(rx, y, 'ink'); p(rx - 1, y, y % 2 ? 'night' : 'ink');
    }
    p(3, 16, 'white'); p(12, 16, 'white'); // braid ties
    // Iconic sharp white Peter Pan collar over black dress
    for (let y = 11; y <= 17; y++) row(y, 4, 11, 'ink');
    p(6, 11, 'white'); p(5, 12, 'white'); p(6, 12, 'white');
    p(9, 11, 'white'); p(9, 12, 'white'); p(10, 12, 'white');
    p(7, 13, 'slate'); p(7, 15, 'slate'); // dress buttons
    // Pale hands at sides
    p(3, 14, 'cloud'); p(12, 14, 'cloud');
    // Legs & black Mary Jane shoes
    row(18, 5, 6, 'cloud'); row(18, 9, 10, 'cloud');
    row(19, 4, 6, 'ink'); row(19, 9, 11, 'ink');
    return pc.outline('ink');
}

