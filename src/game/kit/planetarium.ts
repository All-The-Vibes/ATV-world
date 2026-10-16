import { miniText, miniTextWidth } from './font';
import { bayer, hash } from './noise';
import type { Color } from './palette';
import { PixelCanvas } from './pixels';

/** Silver dome, dark → light. */
const SILVER: readonly Color[] = ['slate', 'steel', 'mist', 'cloud', 'white'];
/** Weathered copper for the little telescope domes. */
const COPPER: readonly Color[] = ['pine', 'forest', 'leaf', 'cyan'];
/** White stucco walls. */
const STUCCO: readonly Color[] = ['clay', 'sand', 'cream', 'white'];

export const PLANETARIUM_W = 144;
export const PLANETARIUM_H = 124;
const CX = 72;

function tone(pc: PixelCanvas, x: number, y: number, ramp: readonly Color[], v: number) {
    const top = ramp.length - 1;
    const c = Math.max(0, Math.min(top, v));
    const i = Math.min(top - 1, Math.floor(c));
    const f = Math.max(0, Math.min(1, (c - i - 0.5) * 3 + 0.5));
    pc.mix(x, y, ramp[i], ramp[i + 1], f);
}

/** Light on a sphere from the upper left; nx, ny run -1 → 1. */
const sphereLit = (nx: number, ny: number) => {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return Math.max(0, -0.5 * nx - 0.45 * ny + 0.74 * nz);
};

/** The top half of a shaded dome sitting on (cx, base), with standing seams. */
function dome(pc: PixelCanvas, cx: number, base: number, rx: number, ry: number, ramp: readonly Color[], ribs: number, seed: number) {
    for (let y = base - ry; y < base; y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const nx = (x + 0.5 - cx) / rx;
            const ny = (y + 0.5 - base) / ry;
            if (nx * nx + ny * ny > 1) continue;
            const top = ramp.length - 1;
            let v = 0.4 + top * 0.95 * sphereLit(nx, ny) + (hash(x, y, seed) - 0.5) * 0.25;
            // Seams: lines of longitude, bunching up toward the rim.
            const lon = Math.asin(Math.max(-1, Math.min(1, nx / Math.sqrt(Math.max(0.05, 1 - ny * ny)))));
            const k = ((lon / Math.PI + 0.5) * ribs) % 1;
            if (k < 0.12) v -= 0.9;
            else if (k < 0.24 && nx < 0) v += 0.4;
            pc.set(x, y, 'ink');
            tone(pc, x, y, ramp, v);
        }
    }
}

/** A night sky with a few stars, seen through an opening (door, slit). */
function starry(pc: PixelCanvas, x: number, y: number, seed: number) {
    const r = hash(x, y, seed);
    pc.set(x, y, r < 0.06 ? 'white' : r < 0.1 ? 'cyan' : r < 0.14 ? 'yellow' : bayer(x, y) < 0.3 ? 'plum' : 'night');
}

/** A little copper telescope dome with its shutter open and the telescope peeking out. */
function observatory(pc: PixelCanvas, cx: number, base: number, seed: number, flip: boolean) {
    dome(pc, cx, base, 13, 12, COPPER, 5, seed);
    const s = flip ? -1 : 1;
    // Open shutter slit, then the tube angled up and out of it.
    for (let y = base - 12; y < base - 1; y++) {
        for (let i = -1; i <= 1; i++) {
            const x = cx + i + s * Math.round((base - y) * 0.15);
            if (pc.filled(x, y)) starry(pc, x, y, seed + 9);
        }
    }
    const tube: [number, number][] = [];
    for (let t = 0; t < 9; t++) tube.push([cx + s * (1 + t), base - 6 - Math.round(t * 0.9)]);
    for (const [x, y] of tube) pc.rect(x, y, 1, 3, 'steel').set(x, y, 'cloud').set(x, y + 2, 'slate');
    const [ex, ey] = tube[tube.length - 1];
    pc.rect(ex, ey - 1, 1, 5, 'mist').set(ex, ey - 1, 'white').set(ex + s, ey + 1, 'cyan');
    for (let x = cx - 14; x <= cx + 14; x++) pc.set(x, base, x < cx ? 'cream' : 'sand').set(x, base + 1, 'clay');
}

/** Art-deco wall: banded stucco with a pilaster every few pixels. */
function wall(pc: PixelCanvas, x0: number, x1: number, y0: number, y1: number, seed: number) {
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const u = (x - x0) / Math.max(1, x1 - x0);
            let v = 2.4 - u * 0.9 + (hash(x >> 2, y >> 2, seed) - 0.5) * 0.2;
            const k = (x - x0) % 7;
            if (k === 0) v += 0.6;
            else if (k === 1) v -= 0.5;
            if ((y - y0) % 9 === 8) v -= 0.6;
            tone(pc, x, y, STUCCO, v);
        }
    }
}

/** A tall window on the wings: glowing violet from the star show inside. */
function window_(pc: PixelCanvas, x0: number, y0: number, h: number) {
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + 3; x++) {
            const glow = (y - y0) / h;
            pc.set(x, y, y === y0 ? 'clay' : glow < 0.4 ? 'cyan' : glow < 0.7 || bayer(x, y) < 0.5 ? 'violet' : 'plum');
        }
    }
    pc.rect(x0 - 1, y0 + h, 5, 1, 'white');
}

/**
 * The planetarium: a big silver star-show dome on an art-deco drum, flanked by two wings that each wear
 * a little copper telescope dome, with a PLANETARIUM frieze, a starry doorway, and broad front steps.
 */
export function planetariumArt(seed = 11): { canvas: PixelCanvas; door: { x: number; y: number; w: number; h: number } } {
    const pc = new PixelCanvas(PLANETARIUM_W, PLANETARIUM_H);
    const door = { x: CX - 7, y: 92, w: 15, h: 20 };

    // Wings: parapet, walls, windows.
    for (const [x0, x1] of [[6, 46], [98, 138]] as const) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
            pc.set(x, 74, 'white').set(x, 75, 'cream').set(x, 76, x % 3 ? 'sand' : 'clay').set(x, 77, 'clay');
        }
        wall(pc, x0, x1, 78, 111, seed + x0);
        for (let x = x0 + 5; x <= x1 - 6; x += 8) window_(pc, x, 84, 20);
    }
    observatory(pc, 26, 73, seed + 1, true);
    observatory(pc, 118, 73, seed + 2, false);

    // The central drum.
    wall(pc, CX - 30, CX + 30, 62, 111, seed + 3);
    // Frieze with the name, and a band of gold stars under it.
    pc.rect(CX - 31, 64, 63, 9, 'cream').rect(CX - 31, 64, 63, 1, 'white').rect(CX - 31, 72, 63, 1, 'sand');
    const word = 'PLANETARIUM';
    miniText(pc, CX - Math.floor(miniTextWidth(word) / 2), 66, word, 'navy');
    for (let x = CX - 27; x <= CX + 27; x += 6) pc.set(x, 75, 'gold').set(x - 1, 75, 'orange').set(x + 1, 75, 'yellow').set(x, 74, 'yellow').set(x, 76, 'orange');
    // Two tall glowing windows either side of the door.
    for (const x of [CX - 22, CX - 15, CX + 13, CX + 20]) window_(pc, x, 79, 26);

    // Doorway: a stepped deco arch, with the starry show showing through.
    for (let y = door.y - 3; y < door.y + door.h; y++) {
        for (let x = door.x - 3; x < door.x + door.w + 3; x++) {
            const inner = x >= door.x && x < door.x + door.w && y >= door.y;
            const step = Math.min(x - (door.x - 3), door.x + door.w + 2 - x);
            if (!inner) {
                if (y >= door.y - 3 + Math.max(0, 2 - step)) pc.set(x, y, x < CX ? 'white' : 'cream');
                continue;
            }
            const arch = y < door.y + 4 && Math.abs(x - CX) > 3 + (y - door.y) * 1.5;
            if (arch) pc.set(x, y, 'cream');
            else starry(pc, x, y, seed + 4);
        }
    }
    pc.rect(CX - 1, door.y + 8, 3, 3, 'yellow').set(CX, door.y + 7, 'gold').set(CX, door.y + 11, 'gold')
        .set(CX - 2, door.y + 9, 'gold').set(CX + 2, door.y + 9, 'gold').set(CX, door.y + 9, 'white');

    // Cornice ring, then the great dome with a gold ring and a little spire.
    for (let x = CX - 34; x <= CX + 34; x++) {
        pc.set(x, 58, 'white').set(x, 59, 'cream').set(x, 60, x % 2 ? 'clay' : 'sand').set(x, 61, 'clay');
    }
    dome(pc, CX, 58, 34, 32, SILVER, 9, seed + 5);
    const ringY = 52;
    const ringHalf = 34 * Math.sqrt(1 - ((ringY + 0.5 - 58) / 32) ** 2);
    for (let x = Math.ceil(CX - ringHalf + 1); x <= Math.floor(CX + ringHalf - 1); x++) {
        const nx = (x - CX) / ringHalf;
        pc.set(x, ringY, nx < -0.3 ? 'yellow' : nx < 0.4 ? 'gold' : 'orange').set(x, ringY + 1, nx < 0 ? 'orange' : 'earth');
    }
    pc.ascii(CX - 2, 18, [
        '..y..',
        '.yyg.',
        '..g..',
        '..o..',
        '.ggo.',
        'gggoo',
    ], { '.': null, y: 'yellow', g: 'gold', o: 'orange' });
    pc.rect(CX, 14, 1, 4, 'gold').set(CX, 13, 'white');

    // Stylobate and three broad steps.
    for (let x = 4; x <= PLANETARIUM_W - 5; x++) pc.set(x, 112, 'white').set(x, 113, 'cream').set(x, 114, 'clay');
    [36, 40, 44].forEach((hw, i) => {
        const y = 115 + i * 3;
        for (let x = CX - hw; x <= CX + hw; x++) {
            const glow = Math.abs(x - CX) < 5 && i === 0 && bayer(x, y) < 0.5;
            pc.set(x, y, glow ? 'violet' : 'cream').set(x, y + 1, 'sand').set(x, y + 2, 'clay');
        }
    });

    pc.outline('ink');
    return { canvas: pc, door };
}
