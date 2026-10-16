import type Phaser from 'phaser';
import { PixelCanvas, ensurePixels, hash, miniText, miniTextWidth, type Color } from '../kit';

/** Wonderland's curious objects: clocks, the looking-glass, cake, chess pieces, signposts, and things that fall up. */

/** Where the face sits on each clock, from its bottom middle. */
export const GRANDFATHER = { w: 24, h: 58, faceY: 12, pendulumY: 28 };
export const POST_CLOCK = { w: 18, h: 34, faceY: 9 };
/** The looking-glass's glass, from its top left. */
export const MIRROR = { w: 40, h: 60, glass: { x: 9, y: 12, w: 22, h: 38 } };
export const CHESS = { square: 20, size: 8 };

function clockFace(pc: PixelCanvas, cx: number, cy: number, r: number, rim: Color) {
    pc.ellipse(cx, cy, r, r, rim).ellipse(cx, cy, r - 1.6, r - 1.6, 'cream');
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pc.set(Math.round(cx + Math.cos(a) * (r - 2.6)), Math.round(cy + Math.sin(a) * (r - 2.6)), i % 3 ? 'mist' : 'ink');
    }
}

/** A tall grandfather clock with a glass window for its pendulum. */
function grandfather() {
    const { w, h, faceY } = GRANDFATHER;
    const pc = new PixelCanvas(w, h);
    pc.ellipse(12, faceY, 11, 11, 'wood').rect(2, faceY, 20, h - faceY - 4, 'wood').rect(2, faceY, 3, h - faceY - 4, 'clay').rect(19, faceY, 3, h - faceY - 4, 'earth');
    clockFace(pc, 12, faceY, 8, 'gold');
    pc.rect(7, 26, 10, 22, 'gold').rect(8, 27, 8, 20, 'night');
    pc.rect(0, h - 4, w, 4, 'earth').rect(0, h - 4, w, 1, 'wood');
    pc.set(12, 1, 'gold').set(11, 2, 'gold').set(13, 2, 'gold');
    return pc.outline('ink');
}

function pendulum() {
    const pc = new PixelCanvas(7, 18);
    return pc.line(3, 0, 3, 12, 'gold').ellipse(3, 14.5, 3, 3, 'gold').ellipse(3, 14.5, 1.5, 1.5, 'yellow').outline('ink');
}

/** A clock on a post, with two little bells on top. */
function postClock(rim: Color) {
    const { w, h, faceY } = POST_CLOCK;
    const pc = new PixelCanvas(w, h);
    pc.rect(8, faceY + 6, 2, h - faceY - 6, 'earth').rect(5, h - 2, 8, 2, 'earth');
    pc.ellipse(3, 2, 2.5, 2.2, 'gold').ellipse(15, 2, 2.5, 2.2, 'gold');
    clockFace(pc, 9, faceY, 7.5, rim);
    return pc.outline('ink');
}

const hand = (len: number, c: Color) => () => new PixelCanvas(2, len).rect(0, 0, 2, len, c);

/** A tall, gilded looking-glass on little feet. */
function mirror() {
    const { w, h, glass } = MIRROR;
    const pc = new PixelCanvas(w, h);
    const arch = (x: number, y: number, x0: number, y0: number, aw: number, ah: number) => {
        const r = aw / 2;
        if (x < x0 || x >= x0 + aw || y < y0 || y >= y0 + ah) return false;
        if (y - y0 >= r) return true;
        return (x + 0.5 - (x0 + r)) ** 2 + (y + 0.5 - (y0 + r)) ** 2 <= r * r;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (arch(x, y, 3, 2, w - 6, h - 8)) pc.set(x, y, hash(x, y, 6) > 0.85 ? 'yellow' : (x + y) % 5 === 0 ? 'orange' : 'gold');
        if (arch(x, y, glass.x, glass.y - 4, glass.w, glass.h + 4)) pc.set(x, y, 'ice');
    }
    for (let i = 0; i < 40; i++) pc.set(glass.x + 3 + i * 0.4, glass.y + 2 + i, 'white').set(glass.x + 6 + i * 0.4, glass.y + i, 'white');
    pc.set(w / 2, 0, 'gold').set(w / 2 - 1, 1, 'gold').set(w / 2 + 1, 1, 'gold').set(w / 2, 1, 'red');
    pc.rect(6, h - 6, 4, 6, 'gold').rect(w - 10, h - 6, 4, 6, 'gold');
    return pc.outline('ink');
}

/** The "eat me" cake on a little glass table, with currants on top. */
function cake() {
    const pc = new PixelCanvas(30, 30);
    pc.rect(2, 16, 26, 2, 'ice').rect(2, 16, 26, 1, 'white').rect(4, 18, 2, 12, 'cyan').rect(24, 18, 2, 12, 'cyan');
    pc.rect(7, 8, 16, 8, 'peach').rect(7, 8, 16, 3, 'white').set(9, 11, 'white').set(14, 11, 'white').set(19, 11, 'white');
    [[9, 9], [12, 8], [15, 9], [18, 8], [21, 9]].forEach(([x, y]) => pc.set(x, y, 'wine'));
    pc.rect(7, 13, 16, 1, 'pink').rect(14, 4, 2, 4, 'red').set(15, 3, 'red');
    return pc.outline('ink');
}

/** A little purple toadstool with yellow spots: a ring of them makes the topsy-turvy fairy ring. */
function topsyMushroom() {
    const pc = new PixelCanvas(14, 14);
    pc.rect(5, 7, 4, 7, 'cream').ellipse(7, 7, 6.5, 5, (_x, y) => (y > 7 ? null : 'violet')).set(4, 4, 'yellow').set(9, 3, 'yellow').set(7, 5, 'yellow');
    return pc.outline('ink');
}

/** A plank of a signpost, pointing right, lettered. */
function arrow(text: string, board: Color) {
    const w = miniTextWidth(text) + 12;
    const pc = new PixelCanvas(w, 9);
    pc.rect(0, 0, w - 5, 9, board);
    for (let i = 0; i < 5; i++) pc.line(w - 5 + i, i, w - 5 + i, 8 - i, board);
    miniText(pc, 3, 2, text, 'ink');
    return pc.outline('ink');
}

/** The giant chessboard of the Looking-Glass, in red and cream. */
function chessboard() {
    const { square: s, size: n } = CHESS;
    const pc = new PixelCanvas(s * n + 8, s * n + 8);
    pc.rect(0, 0, pc.width, pc.height, 'earth').rect(1, 1, pc.width - 2, pc.height - 2, 'wood');
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) pc.rect(4 + c * s, 4 + r * s, s, s, (r + c) % 2 ? 'red' : 'cream');
    return pc;
}

export type PieceKind = 'king' | 'queen' | 'knight' | 'rook' | 'bishop' | 'pawn';

/** A living chess piece, with eyes. */
function piece(kind: PieceKind, side: 'white' | 'red') {
    const [fill, shade]: Color[] = side === 'white' ? ['white', 'cloud'] : ['red', 'wine'];
    const pc = new PixelCanvas(16, 28);
    const body = (top: number, topHalf: number) => {
        for (let y = top; y < 24; y++) {
            const half = Math.round(topHalf + (y - top) * ((6 - topHalf) / (24 - top)));
            for (let x = 8 - half; x < 8 + half; x++) pc.set(x, y, x >= 8 + half - 2 ? shade : fill);
        }
    };
    pc.rect(1, 23, 14, 5, shade).rect(1, 23, 14, 1, fill);
    let eyeY = 10;
    if (kind === 'pawn') {
        body(15, 2);
        pc.ellipse(8, 10, 4, 4, fill).rect(5, 14, 6, 2, shade);
    } else if (kind === 'rook') {
        body(10, 4);
        pc.rect(3, 5, 10, 5, fill).rect(3, 3, 2, 2, fill).rect(7, 3, 2, 2, fill).rect(11, 3, 2, 2, fill).rect(11, 5, 2, 5, shade);
        eyeY = 7;
    } else if (kind === 'bishop') {
        body(14, 2);
        pc.ellipse(8, 8, 4, 6, fill).line(9, 4, 10, 7, shade).ellipse(8, 1.5, 1.5, 1.5, fill);
        eyeY = 9;
    } else if (kind === 'knight') {
        body(14, 3);
        pc.ellipse(8, 9, 4.5, 6, fill).ellipse(4, 10, 4, 2.5, fill).set(9, 2, fill).set(9, 3, fill).rect(11, 4, 2, 9, shade).set(2, 10, 'ink');
        eyeY = 7;
    } else if (kind === 'queen') {
        body(12, 3);
        pc.ellipse(8, 8, 5, 4, fill).rect(3, 3, 1, 3, fill).rect(6, 2, 1, 3, fill).rect(9, 2, 1, 3, fill).rect(12, 3, 1, 3, fill).set(8, 1, 'gold');
        eyeY = 8;
    } else {
        body(12, 3);
        pc.ellipse(8, 8, 5, 4, fill).rect(7, 0, 2, 5, 'gold').rect(5, 1, 6, 2, 'gold');
        eyeY = 8;
    }
    pc.set(6, eyeY, 'ink').set(9, eyeY, 'ink');
    if (side === 'red') pc.set(6, eyeY - 1, 'white');
    return pc.outline('ink');
}

/** Things tumbling the wrong way up: clocks, cups, cards, keys, books, a jar of marmalade. */
const flyers: Record<string, () => PixelCanvas> = {
    clock: () => {
        const pc = new PixelCanvas(12, 12);
        clockFace(pc, 6, 6, 5.5, 'gold');
        return pc.line(6, 6, 6, 3, 'ink').line(6, 6, 8, 6, 'ink').outline('ink');
    },
    cup: () => new PixelCanvas(11, 8).rect(1, 0, 7, 5, 'white').rect(1, 2, 7, 1, 'pink').set(8, 1, 'white').set(9, 2, 'white').set(8, 3, 'white').rect(0, 6, 10, 1, 'cloud').outline('ink'),
    card: () => {
        const pc = new PixelCanvas(9, 12).rect(0, 0, 9, 12, 'white');
        return pc.rect(3, 4, 3, 2, 'ink').set(4, 3, 'ink').rect(2, 5, 5, 2, 'ink').set(4, 7, 'ink').set(4, 8, 'ink').set(1, 1, 'red').outline('ink');
    },
    key: () => new PixelCanvas(13, 6).ellipse(2.5, 3, 2.5, 2.5, 'gold').set(2, 2, null).rect(5, 2, 7, 2, 'gold').rect(9, 4, 1, 2, 'gold').rect(11, 4, 1, 2, 'gold').outline('ink'),
    book: () => new PixelCanvas(12, 9).rect(0, 0, 12, 9, 'blue').rect(1, 1, 10, 7, 'cream').rect(6, 0, 1, 9, 'navy').outline('ink'),
    jar: () => new PixelCanvas(9, 11).rect(1, 2, 7, 9, 'orange').rect(2, 3, 2, 6, 'gold').rect(0, 0, 9, 2, 'white').rect(2, 5, 5, 3, 'cream').outline('ink'),
};
export const FLYERS = Object.keys(flyers).map((k) => `wl-fly-${k}`);

/** A sign on two posts, lettered (shared with the welcome sign's style). */
export function plaque(text: string, color: Color = 'yellow') {
    const w = miniTextWidth(text) + 8;
    const pc = new PixelCanvas(w, 18);
    pc.rect(3, 9, 2, 9, 'earth').rect(w - 5, 9, 2, 9, 'earth');
    pc.rect(0, 0, w, 11, 'night').rect(1, 1, w - 2, 9, 'plum');
    miniText(pc, 4, 3, text, color);
    return pc.outline('ink');
}

export const SIGN_ARROWS = ['THIS WAY', 'THAT WAY', 'UP', 'BACK', 'YONDER', 'NOWHERE'];
const ARROW_BOARDS: Color[] = ['cream', 'peach', 'lime', 'ice', 'yellow', 'pink'];

export function curioTextures(scene: Phaser.Scene) {
    ensurePixels(scene, 'wl-grandfather', grandfather);
    ensurePixels(scene, 'wl-pendulum', pendulum);
    ensurePixels(scene, 'wl-postclock-sky', () => postClock('sky'));
    ensurePixels(scene, 'wl-postclock-pink', () => postClock('pink'));
    ensurePixels(scene, 'wl-postclock-lime', () => postClock('lime'));
    ensurePixels(scene, 'wl-hand-long', hand(7, 'ink'));
    ensurePixels(scene, 'wl-hand-short', hand(5, 'wine'));
    ensurePixels(scene, 'wl-mirror', mirror);
    ensurePixels(scene, 'wl-cake', cake);
    ensurePixels(scene, 'wl-topsy', topsyMushroom);
    ensurePixels(scene, 'wl-chessboard', chessboard);
    ensurePixels(scene, 'wl-post', () => new PixelCanvas(4, 48).rect(0, 2, 4, 46, 'earth').rect(0, 2, 1, 46, 'wood').rect(0, 0, 4, 2, 'gold').outline('ink'));
    SIGN_ARROWS.forEach((t, i) => ensurePixels(scene, `wl-arrow-${i}`, () => arrow(t, ARROW_BOARDS[i])));
    for (const kind of ['king', 'queen', 'knight', 'rook', 'bishop', 'pawn'] as PieceKind[]) {
        for (const side of ['white', 'red'] as const) ensurePixels(scene, `wl-${side}-${kind}`, () => piece(kind, side));
    }
    for (const [k, draw] of Object.entries(flyers)) ensurePixels(scene, `wl-fly-${k}`, draw);
    ensurePixels(scene, 'wl-tag-drink', () => plaque('DRINK ME', 'cyan'));
    ensurePixels(scene, 'wl-tag-eat', () => plaque('EAT ME', 'pink'));
    ensurePixels(scene, 'wl-tag-topsy', () => plaque('TOPSY-TURVY', 'lime'));
    ensurePixels(scene, 'wl-tag-mirror', () => plaque('JABBERWOCKY', 'cyan'));
    ensurePixels(scene, 'wl-tag-croquet', () => plaque("THE QUEEN'S CROQUET", 'red'));
    ensurePixels(scene, 'wl-tag-chess', () => plaque('LOOKING-GLASS CHESS', 'cream'));
    ensurePixels(scene, 'wl-tag-tea', () => plaque('MAD TEA PARTY', 'yellow'));
    ensurePixels(scene, 'wl-tag-garden', () => plaque('GARDEN OF LIVE FLOWERS', 'pink'));
}
