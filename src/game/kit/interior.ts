import { MINI_GLYPHS, miniText, miniTextWidth } from './font';
import { bayer, hash, valueNoise } from './noise';
import { DARKER, LIGHTER, U32, type ColorName } from './palette';
import { PixelCanvas, type Legend } from './pixels';

/**
 * The Tower Library reading room, painted in the same ATV-32 pixel style as the world outside:
 * a panelled back wall of tall bookcases (featured books carry their real titles on the spine),
 * arched windows throwing sunbeams across a plank floor, a reading table on a Persian rug,
 * a circulation desk, a wingback reading nook, a globe, and the card catalog.
 *
 * The room is one static texture; furniture comes back as separate pieces so the scene can
 * depth-sort them against the player and block walking with their floor footprints.
 */

const W = 352;
const H = 280;
const FLOOR_TOP = 108;
const FRONT_WALL = 262;
const DOOR_L = 160;
const DOOR_R = 191;
const CASE_XS = [20, 132, 244] as const;
const CASE_Y = 8;
const CASE_W = 88;
const CASE_H = 100;
const WINDOW_XS = [113, 225] as const;
const WINDOW_Y = 22;
const WINDOW_W = 13;
const WINDOW_H = 62;
const SHAFT_LEN = 86;

export interface Bookcase {
    /** Short label for the brass plaque on the crown (mini font, uppercase). */
    plaque: string;
    /** Featured books, shelved at eye level with their titles painted on the spine. */
    books: readonly { cloth: ColorName; ink: ColorName; spine: readonly string[] }[];
}

export interface RoomPiece {
    name: string;
    canvas: PixelCanvas;
    x: number;
    y: number;
    /** Floor footprint in room pixels: blocks walking, and its bottom edge sets the draw depth. */
    foot: { x: number; y: number; w: number; h: number };
}

/** A lamp whose light the scene can pool and breathe. */
export interface RoomLamp {
    x: number;
    y: number;
    depth: number;
    size: 'wide' | 'round';
}

export const READING_ROOM = {
    width: W,
    height: H,
    walk: { left: 20, right: 331, top: 116, bottom: 258 },
    door: { x: 176, y: FRONT_WALL },
    start: { x: 176, y: 238 },
    cases: CASE_XS.map((x) => ({ x, y: CASE_Y, w: CASE_W, h: CASE_H })),
    catalog: { left: 262, right: 337, top: 128, bottom: 190 },
} as const;

/** A point inside window `i`'s sunbeam on the floor: u runs across the beam, v along it (both 0..1). */
export function shaftPoint(i: number, u: number, v: number) {
    const wx = WINDOW_XS[i % WINDOW_XS.length];
    const k = v * (SHAFT_LEN - 1);
    const l = wx + 0.42 * k;
    const r = wx + WINDOW_W + 0.62 * k;
    return { x: l + (r - l) * u, y: FLOOR_TOP + k };
}

const NAME_OF = new Map<number, ColorName>(Object.entries(U32).map(([name, v]) => [v, name as ColorName]));

/** Move an already-painted palette pixel one step along the hand-tuned ramps. */
function step(pc: PixelCanvas, x: number, y: number, ramp: Record<ColorName, ColorName>) {
    const name = NAME_OF.get(pc.raw(Math.floor(x), Math.floor(y)));
    if (name) pc.set(x, y, ramp[name]);
}
const brighten = (pc: PixelCanvas, x: number, y: number) => step(pc, x, y, LIGHTER);
const darken = (pc: PixelCanvas, x: number, y: number) => step(pc, x, y, DARKER);

/** Plain cloth for the books around the featured ones. */
const FILLER: readonly ColorName[] = ['wine', 'red', 'navy', 'blue', 'forest', 'plum', 'earth', 'pine', 'violet', 'slate', 'orange', 'gold', 'cream', 'sky'];
const LIGHT_CLOTH = new Set<ColorName>(['gold', 'orange', 'cream', 'sky', 'sand', 'yellow']);
const bandFor = (cloth: ColorName): ColorName => (LIGHT_CLOTH.has(cloth) ? 'bark' : 'gold');

// ─── room shell ─────────────────────────────────────────────────────────────────────────────────

function walls(pc: PixelCanvas) {
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const dx = x < 14 ? 14 - x : x > 337 ? x - 337 : 0;
            const dy = y >= FRONT_WALL ? y - FRONT_WALL + 1 : 0;
            if (!dx && !dy) continue;
            if (!dx && x >= DOOR_L && x <= DOOR_R) continue;
            const d = Math.max(dx, dy) - 1;
            let c: ColorName;
            if (x === 0 || x === W - 1 || y === H - 1) c = 'ink';
            else if (d === 0) c = 'wood';
            else if (d === 1) c = 'earth';
            else {
                const grain = dx >= dy ? hash(x, Math.floor(y / 7), 5) : hash(Math.floor(x / 9), y, 6);
                c = grain < 0.16 ? 'earth' : 'bark';
            }
            pc.set(x, y, c);
        }
    }
    for (let y = FRONT_WALL; y < H - 1; y++) {
        pc.set(DOOR_L - 2, y, 'earth').set(DOOR_L - 1, y, 'clay').set(DOOR_R + 1, y, 'clay').set(DOOR_R + 2, y, 'earth');
    }
}

function backWall(pc: PixelCanvas) {
    const crown: ColorName[] = ['bark', 'clay', 'wood', 'earth', 'bark'];
    for (let x = 14; x <= 337; x++) {
        crown.forEach((c, y) => pc.set(x, y, c));
        for (let y = 5; y <= 87; y++) {
            const stripe = x % 8 === 0;
            const diamond = Math.abs((x % 8) - 4) + Math.abs((y % 10) - 5) === 2;
            pc.set(x, y, stripe || diamond ? 'forest' : 'pine');
        }
        pc.set(x, 88, 'clay').set(x, 89, 'wood').set(x, 90, 'earth').set(x, 91, 'bark');
        for (let y = 92; y <= 103; y++) {
            const px = (x - 14) % 16;
            let c: ColorName = 'earth';
            if (px <= 1 || y === 92 || y === 103) c = 'wood';
            else if (y === 93 || px === 2) c = 'bark';
            else if (y === 102 || px === 15) c = 'clay';
            pc.set(x, y, c);
        }
        pc.set(x, 104, 'clay').set(x, 105, 'wood').set(x, 106, 'earth').set(x, 107, 'bark');
    }
}

/** A tall arched window with a cream frame, looking out over treetops. */
function paneWindow(pc: PixelCanvas, x0: number, seed: number) {
    const r = WINDOW_W / 2;
    const cx = x0 + r;
    const cy = WINDOW_Y + r;
    const bottom = WINDOW_Y + WINDOW_H - 1;
    for (let y = WINDOW_Y - 2; y <= bottom; y++) {
        for (let x = x0 - 2; x <= x0 + WINDOW_W + 1; x++) {
            const out = y + 0.5 < cy
                ? Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r
                : Math.max(x0 - (x + 0.5), x + 0.5 - (x0 + WINDOW_W));
            if (out > 0) {
                const ring = Math.ceil(out);
                if (ring === 1) pc.set(x, y, 'cream');
                else if (ring === 2) pc.set(x, y, 'wood');
                continue;
            }
            if (x === x0 + 6 || (y >= WINDOW_Y + 7 && (y - WINDOW_Y - 7) % 12 === 0)) {
                pc.set(x, y, 'cream');
                continue;
            }
            const treeline = WINDOW_Y + 50 + Math.floor(valueNoise(x, 0, 3, seed) * 6);
            let c: ColorName;
            if (y >= treeline) {
                const t = y - treeline;
                c = t === 0 ? (bayer(x, y) < 0.5 ? 'grass' : 'leaf') : t < 3 ? 'leaf' : t < 7 ? 'forest' : 'pine';
            } else {
                const t = ((y - WINDOW_Y) / WINDOW_H) * 2.2;
                c = t < 1 ? (t > bayer(x, y) ? 'cyan' : 'sky') : Math.min(1, t - 1) > bayer(x, y) ? 'ice' : 'cyan';
            }
            pc.set(x, y, (x + y) % 13 === 0 ? LIGHTER[c] : c);
        }
    }
    for (let x = x0 - 3; x <= x0 + WINDOW_W + 2; x++) pc.set(x, 84, 'clay').set(x, 85, 'wood').set(x, 86, 'earth');
}

// ─── bookcases ──────────────────────────────────────────────────────────────────────────────────

function spine(pc: PixelCanvas, x: number, bottom: number, w: number, h: number, cloth: ColorName, bands: ColorName) {
    const top = bottom - h + 1;
    for (let i = 0; i < w; i++) {
        const c = i === 0 ? LIGHTER[cloth] : i === w - 1 ? DARKER[cloth] : cloth;
        for (let y = top; y <= bottom; y++) pc.set(x + i, y, c);
        if (h >= 8) {
            const b = i === w - 1 ? DARKER[bands] : bands;
            pc.set(x + i, top + 2, b).set(x + i, bottom - 2, b);
        }
    }
}

/** A row of anonymous books: spines of varied width and height, the odd gap, the odd flat stack. */
function fillRow(pc: PixelCanvas, x0: number, x1: number, bottom: number, hmin: number, hmax: number, seed: number) {
    let x = x0;
    while (x <= x1) {
        const room = x1 - x + 1;
        const r = hash(x, bottom, seed);
        if (r < 0.06 && room > 5) {
            x += 2 + Math.floor(hash(x, bottom, seed + 1) * 3);
            continue;
        }
        if (r < 0.14 && room >= 9) {
            const w = Math.min(room, 8 + Math.floor(hash(x, bottom, seed + 2) * 4));
            const n = 2 + Math.floor(hash(x, bottom, seed + 3) * 2);
            for (let k = 0; k < n; k++) {
                const cloth = FILLER[Math.floor(hash(x + k, bottom, seed + 4) * FILLER.length)];
                const inset = Math.floor(hash(x, k, seed + 5) * 2);
                const yb = bottom - k * 3;
                for (let xx = x + inset; xx < x + w - (1 - inset); xx++) {
                    pc.set(xx, yb - 2, LIGHTER[cloth]).set(xx, yb - 1, cloth).set(xx, yb, DARKER[cloth]);
                }
                pc.set(x + w - 3, yb - 1, bandFor(cloth));
            }
            x += w;
            continue;
        }
        const w = room < 3 ? room : Math.min(room, 3 + Math.floor(hash(x, bottom, seed + 6) * 4));
        const h = hmin + Math.floor(hash(x, bottom, seed + 7) * (hmax - hmin + 1));
        const cloth = FILLER[Math.floor(hash(x, bottom, seed + 8) * FILLER.length)];
        const bands = bandFor(cloth);
        spine(pc, x, bottom, w, h, cloth, bands);
        if (w >= 4 && h >= 14 && hash(x, bottom, seed + 9) < 0.5) {
            const tx = x + Math.floor(w / 2);
            for (let y = bottom - h + 6; y <= bottom - 5; y++) if ((y + x) % 4) pc.set(tx, y, bands);
        }
        x += w;
    }
}

/** A featured book standing upright with its real title running down the spine. Returns its width. */
function titledSpine(pc: PixelCanvas, x: number, bottom: number, book: Bookcase['books'][number]) {
    const lines = book.spine.length ? book.spine : [''];
    const longest = Math.max(...lines.map((l) => l.length));
    const w = lines.length > 1 ? 13 : 9;
    const h = longest * 4 + 9;
    const top = bottom - h + 1;
    spine(pc, x, bottom, w, h, book.cloth, book.ink);
    lines.forEach((line, li) => {
        const colX = x + Math.floor((w - (lines.length * 6 - 1)) / 2) + (lines.length - 1 - li) * 6;
        const y0 = top + 5 + (longest - line.length) * 2;
        for (let i = 0; i < line.length; i++) {
            const g = MINI_GLYPHS[line[i]] ?? MINI_GLYPHS[line[i].toUpperCase()];
            if (!g) continue;
            // Rotated a quarter turn clockwise, so the title reads top to bottom like a real spine.
            for (let k = 0; k < 15; k++) if (g[k] === '1') pc.set(colX + 4 - Math.floor(k / 3), y0 + i * 4 + (k % 3), book.ink);
        }
    });
    return w;
}

function featuredRow(pc: PixelCanvas, x0: number, x1: number, bottom: number, books: Bookcase['books'], seed: number) {
    let x = x0;
    let prev: ColorName | null = null;
    books.forEach((book, i) => {
        const bw = book.spine.length > 1 ? 13 : 9;
        if (x + 4 + bw > x1) return;
        const fw = 3 + Math.floor(hash(i, bottom, seed) * 2);
        const fh = 30 + Math.floor(hash(i, bottom, seed + 1) * 13);
        let k = Math.floor(hash(i, bottom, seed + 2) * FILLER.length);
        while (FILLER[k] === book.cloth || FILLER[k] === prev) k = (k + 3) % FILLER.length;
        spine(pc, x, bottom, fw, fh, FILLER[k], bandFor(FILLER[k]));
        x += fw;
        x += titledSpine(pc, x, bottom, book);
        prev = book.cloth;
    });
    fillRow(pc, x, x1, bottom, 30, 42, seed + 9);
}

function bookcase(pc: PixelCanvas, bx: number, by: number, shelf: Bookcase, seed: number) {
    for (let x = bx - 2; x <= bx + CASE_W + 1; x++) {
        pc.set(x, by, 'clay').set(x, by + 1, 'wood');
        for (let y = 2; y <= 7; y++) pc.set(x, by + y, 'earth');
        pc.set(x, by + 8, (x - bx + 3) % 3 === 2 ? 'bark' : 'wood').set(x, by + 9, 'bark');
    }
    if (shelf.plaque) {
        const pw = miniTextWidth(shelf.plaque) + 6;
        const px = bx + Math.floor((CASE_W - pw) / 2);
        for (let y = 0; y <= 8; y++) {
            for (let x = 0; x < pw; x++) {
                const c: ColorName = y === 0 || x === 0 ? 'yellow' : y === 8 || x === pw - 1 ? 'orange' : 'gold';
                pc.set(px + x, by + y, c);
            }
        }
        miniText(pc, px + 3, by + 2, shelf.plaque, 'bark');
    }
    const left: ColorName[] = ['bark', 'clay', 'wood', 'earth'];
    const right: ColorName[] = ['earth', 'clay', 'wood', 'bark'];
    for (let y = by + 10; y <= by + 95; y++) {
        left.forEach((c, i) => pc.set(bx + i, y, c));
        right.forEach((c, i) => pc.set(bx + 84 + i, y, c));
        for (let x = bx + 4; x <= bx + 83; x++) pc.set(x, y, 'bark');
    }
    for (let x = bx + 4; x <= bx + 83; x++) {
        for (const y of [10, 31, 84]) pc.set(x, by + y, 'ink');
        for (const y of [28, 81]) pc.set(x, by + y, 'clay').set(x, by + y + 1, 'wood').set(x, by + y + 2, 'earth');
    }
    fillRow(pc, bx + 4, bx + 83, by + 27, 9, 16, seed);
    featuredRow(pc, bx + 4, bx + 83, by + 80, shelf.books, seed + 1);
    fillRow(pc, bx + 4, bx + 83, by + 95, 7, 11, seed + 2);
    const base: ColorName[] = ['clay', 'wood', 'earth', 'bark'];
    for (let x = bx - 1; x <= bx + CASE_W; x++) base.forEach((c, i) => pc.set(x, by + 96 + i, c));
}

function railAndLadder(pc: PixelCanvas, x0: number) {
    for (let x = 18; x <= 333; x++) pc.set(x, 18, 'gold').set(x, 19, 'orange');
    for (let y = 18; y <= 105; y++) {
        pc.set(x0 - 1, y, 'bark').set(x0, y, 'wood').set(x0 + 1, y, 'clay');
        pc.set(x0 + 7, y, 'wood').set(x0 + 8, y, 'earth').set(x0 + 9, y, 'bark');
    }
    for (let y = 25; y <= 100; y += 7) {
        for (let x = x0 + 2; x <= x0 + 6; x++) pc.set(x, y, 'clay').set(x, y + 1, 'earth');
    }
    for (const hx of [x0, x0 + 7]) {
        pc.set(hx, 16, 'gold').set(hx + 1, 16, 'gold').set(hx, 17, 'orange').set(hx + 1, 17, 'orange');
        pc.set(hx, 106, 'steel').set(hx + 1, 106, 'steel').set(hx, 107, 'slate').set(hx + 1, 107, 'slate');
    }
}

// ─── floor ──────────────────────────────────────────────────────────────────────────────────────

function floor(pc: PixelCanvas) {
    for (let y = FLOOR_TOP; y < FRONT_WALL + 10; y++) {
        const k = y - FLOOR_TOP;
        const row = Math.floor(k / 6);
        const door = y >= FRONT_WALL;
        for (let x = door ? DOOR_L : 14; x <= (door ? DOOR_R : 337); x++) {
            const run = x - 14 + row * 19;
            let c: ColorName = 'earth';
            if (k % 6 === 5 || run % 48 === 0) c = 'bark';
            else {
                const v = hash(Math.floor(run / 48), row, 41);
                if (v < 0.3 && bayer(x, y) < 0.22) c = 'bark';
                else if (v > 0.72 && bayer(x, y) < 0.28) c = 'wood';
                if (k % 6 === 0 && v > 0.45 && bayer(x, y) < 0.5) c = 'wood';
                if (hash(Math.floor((x + row * 7) / 5), y, 43) < 0.07) c = 'bark';
            }
            pc.set(x, y, c);
        }
    }
    for (let x = 14; x <= 337; x++) {
        darken(pc, x, FLOOR_TOP);
        if (bayer(x, FLOOR_TOP + 1) < 0.5) darken(pc, x, FLOOR_TOP + 1);
    }
    for (let y = FLOOR_TOP + 1; y < FRONT_WALL; y++) {
        darken(pc, 14, y);
        darken(pc, 337, y);
    }
}

function doorway(pc: PixelCanvas) {
    for (let x = DOOR_L; x <= DOOR_R; x++) {
        pc.set(x, 272, 'sand').set(x, 273, 'sand').set(x, 274, 'clay');
        for (let y = 275; y < H; y++) pc.mix(x, y, 'grass', 'leaf', 0.25 + hash(x, y, 3) * 0.5);
    }
    for (let y = 249; y <= 259; y++) {
        for (let x = 163; x <= 188; x++) {
            const edge = x === 163 || x === 188 || y === 249 || y === 259;
            pc.set(x, y, edge ? 'earth' : bayer(x, y) < 0.3 ? 'sand' : 'clay');
        }
    }
}

/** A Persian-style rug: wine and gold borders around a red lattice field. */
function rug(pc: PixelCanvas) {
    const x0 = 112, x1 = 239, y0 = 138, y1 = 213;
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const d = Math.min(x - x0, x1 - x, y - y0, y1 - y);
            let c: ColorName;
            if (d === 0 || d === 3 || d === 7) c = 'wine';
            else if (d === 1) c = 'gold';
            else if (d === 2) c = 'orange';
            else if (d <= 6) c = d === 5 && (x + y) % 4 === 0 ? 'gold' : 'navy';
            else {
                const a = (((x - 120 + y - 146) % 10) + 10) % 10;
                const b = (((x - 120 - (y - 146)) % 10) + 10) % 10;
                c = a === 0 || b === 0 ? 'wine' : a === 5 && b === 5 ? 'gold' : 'red';
            }
            pc.set(x, y, c);
        }
    }
    for (let y = y0; y <= y1; y += 2) pc.set(x0 - 2, y, 'sand').set(x0 - 1, y, 'cream').set(x1 + 1, y, 'cream').set(x1 + 2, y, 'sand');
}

/** Sunbeams from both windows, with the mullion and transoms printed in shadow across them. */
function sunlight(pc: PixelCanvas) {
    for (const wx of WINDOW_XS) {
        for (let k = 0; k < SHAFT_LEN; k++) {
            const y = FLOOR_TOP + k;
            const l = wx + 0.42 * k;
            const r = wx + WINDOW_W + 0.62 * k;
            const fade = 0.7 * (1 - k / SHAFT_LEN);
            const wy = WINDOW_H - 1 - (k * WINDOW_H) / SHAFT_LEN;
            if ((((wy - 7) % 12) + 12) % 12 < 1) continue;
            for (let x = Math.floor(l); x <= Math.ceil(r); x++) {
                const edge = Math.min(x + 0.5 - l, r - (x + 0.5));
                if (edge <= 0) continue;
                if (Math.abs(((x + 0.5 - l) / (r - l)) * WINDOW_W - 6.5) < 0.5) continue;
                if (fade * Math.min(1, edge / 3) > bayer(x, y)) brighten(pc, x, y);
            }
        }
    }
}

function shadowRect(pc: PixelCanvas, x0: number, y0: number, x1: number, y1: number) {
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const edge = Math.min(x - x0, x1 - x, y - y0, y1 - y);
            if (edge >= 1 || bayer(x, y) < 0.5) darken(pc, x, y);
        }
    }
}

function shadowOval(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
            if (d < 0.55 || (d < 1 && bayer(x, y) < 0.5)) darken(pc, x, y);
        }
    }
}

// ─── furniture ──────────────────────────────────────────────────────────────────────────────────

const BANKER = [
    '..LLLLLLL..',
    '.LGGGGGGGF.',
    'GFFFFFFFFFP',
    'PPPPPPPPPPP',
    '.YYYYYYYYY.',
    '.....S...S.',
    '.....S...S.',
    '...SSSSS...',
    '..OOOOOOO..',
];
const BANKER_LEGEND: Legend = { '.': null, L: 'lime', G: 'leaf', F: 'forest', P: 'pine', Y: 'yellow', S: 'gold', O: 'orange' };

/** A green-shaded banker's lamp whose base sits on row `baseY`, with a warm pool on the surface below. */
function bankersLamp(pc: PixelCanvas, cx: number, baseY: number, pool = true) {
    if (pool) {
        for (let y = baseY - 4; y <= baseY + 6; y++) {
            for (let x = cx - 14; x <= cx + 14; x++) {
                const d = Math.hypot((x - cx) / 14, (y - baseY - 1) / 6);
                if (d < 1 && pc.filled(x, y) && (1 - d) * 1.4 > bayer(x, y)) brighten(pc, x, y);
            }
        }
    }
    pc.ascii(cx - 5, baseY - 8, BANKER, BANKER_LEGEND);
}

function woodTop(pc: PixelCanvas, x0: number, x1: number, y0: number, y1: number, seed: number) {
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const g = hash(Math.floor((x + y * 13) / 9), y, seed);
            pc.set(x, y, y === y0 ? 'clay' : g < 0.12 ? 'clay' : g > 0.9 ? 'earth' : 'wood');
        }
    }
}

function flatBook(pc: PixelCanvas, x0: number, x1: number, bottom: number, cloth: ColorName) {
    for (let x = x0; x <= x1; x++) pc.set(x, bottom - 2, LIGHTER[cloth]).set(x, bottom - 1, cloth).set(x, bottom, DARKER[cloth]);
    pc.set(x1, bottom - 1, 'cream').set(x1, bottom - 2, 'white');
    pc.set(x0 + 2, bottom - 1, bandFor(cloth)).set(x0 + 3, bottom - 1, bandFor(cloth));
}

/** A chesterfield chair back: earth frame, buttoned forest-green leather, brass studs. */
function chairBack(pc: PixelCanvas, c: number, top: number, bottom: number) {
    for (let y = top; y <= bottom; y++) {
        for (let x = c - 8; x <= c + 7; x++) {
            const u = x - (c - 8);
            const v = y - top;
            if (v === 0 && (u === 0 || u === 15)) continue;
            if (u <= 1 || u >= 14 || v <= 1) {
                pc.set(x, y, u === 0 || v === 0 ? 'wood' : 'earth');
                continue;
            }
            const p = (u + v) % 6;
            const q = (((u - v) % 6) + 6) % 6;
            pc.set(x, y, p === 0 && q === 0 ? 'ink' : p === 0 || q === 0 ? 'pine' : p === 1 ? 'leaf' : 'forest');
        }
    }
    for (let x = c - 6; x <= c + 5; x += 3) pc.set(x, top + 1, 'gold');
}

function readingTable(): { piece: RoomPiece; lamps: RoomLamp[] } {
    const pc = new PixelCanvas(88, 62);
    chairBack(pc, 26, 6, 21);
    chairBack(pc, 62, 6, 21);
    woodTop(pc, 3, 84, 22, 45, 7);
    for (let x = 3; x <= 84; x++) pc.set(x, 46, 'clay');
    for (let x = 5; x <= 82; x++) {
        pc.set(x, 47, 'wood').set(x, 48, 'earth').set(x, 49, 'earth').set(x, 50, 'earth').set(x, 51, 'bark');
    }
    for (const lx of [6, 78]) {
        for (let y = 52; y <= 60; y++) {
            const bulge = y === 55 || y === 56 ? 1 : 0;
            for (let x = lx - bulge; x <= lx + 3 + bulge; x++) {
                pc.set(x, y, x === lx - bulge ? 'clay' : x === lx + 3 + bulge ? 'earth' : 'wood');
            }
        }
    }
    bankersLamp(pc, 22, 33);
    bankersLamp(pc, 66, 33);
    // An open book with a red ribbon.
    for (let y = 30; y <= 37; y++) for (let x = 36; x <= 52; x++) pc.set(x, y, x === 44 ? 'sand' : x < 44 ? 'white' : 'cream');
    for (const y of [32, 34, 36]) {
        for (let x = 37; x <= 51; x++) if (Math.abs(x - 44) > 1 && hash(x, y, 9) > 0.2) pc.set(x, y, 'clay');
    }
    for (let x = 35; x <= 53; x++) pc.set(x, 38, 'wine');
    for (let y = 30; y <= 38; y++) pc.set(35, y, 'wine').set(53, y, 'wine');
    for (let y = 38; y <= 41; y++) pc.set(47, y, 'red');
    flatBook(pc, 70, 82, 44, 'navy');
    flatBook(pc, 71, 81, 41, 'wine');
    flatBook(pc, 70, 80, 38, 'forest');
    // Inkwell and quill.
    pc.rect(10, 39, 4, 3, 'night').set(10, 39, 'steel').set(11, 38, 'steel').set(12, 38, 'night');
    pc.line(12, 37, 16, 30, 'white').line(13, 37, 17, 31, 'cloud');
    pc.outline('ink');
    return {
        piece: { name: 'table', canvas: pc, x: 132, y: 128, foot: { x: 136, y: 146, w: 81, h: 43 } },
        lamps: [
            { x: 154, y: 158, depth: 189.5, size: 'wide' },
            { x: 198, y: 158, depth: 189.5, size: 'wide' },
        ],
    };
}

function circulationDesk(): { piece: RoomPiece; lamps: RoomLamp[] } {
    const pc = new PixelCanvas(80, 58);
    woodTop(pc, 4, 75, 18, 32, 17);
    for (let x = 4; x <= 75; x++) {
        pc.set(x, 33, 'clay').set(x, 34, 'earth');
        for (let y = 35; y <= 52; y++) pc.set(x, y, hash(x, Math.floor(y / 5), 21) < 0.1 ? 'clay' : 'wood');
    }
    for (const [x0, x1] of [[5, 11], [67, 74]]) {
        for (let y = 37; y <= 51; y++) {
            for (let x = x0; x <= x1; x++) {
                pc.set(x, y, y === 37 || x === x0 ? 'bark' : y === 51 || x === x1 ? 'clay' : 'earth');
            }
        }
    }
    const label = 'QUIET PLEASE';
    const lw = miniTextWidth(label) + 6;
    const lx = 13 + Math.floor((53 - lw) / 2);
    for (let y = 40; y <= 48; y++) {
        for (let x = lx; x < lx + lw; x++) {
            pc.set(x, y, y === 40 || x === lx ? 'yellow' : y === 48 || x === lx + lw - 1 ? 'orange' : 'gold');
        }
    }
    miniText(pc, lx + 3, 42, label, 'bark');
    for (let x = 3; x <= 76; x++) pc.set(x, 53, 'earth').set(x, 54, 'bark');
    bankersLamp(pc, 12, 24);
    // Service bell.
    pc.ascii(31, 24, ['..Y..', '.YGG.', 'YGGGO', 'OOOOO', 'sssss'], { '.': null, Y: 'yellow', G: 'gold', O: 'orange', s: 'slate' });
    flatBook(pc, 46, 60, 29, 'blue');
    flatBook(pc, 47, 59, 26, 'red');
    flatBook(pc, 46, 58, 23, 'pine');
    flatBook(pc, 48, 57, 20, 'plum');
    pc.outline('ink');
    return {
        piece: { name: 'desk', canvas: pc, x: 22, y: 170, foot: { x: 26, y: 196, w: 72, h: 31 } },
        lamps: [{ x: 34, y: 191, depth: 227.5, size: 'wide' }],
    };
}

function cardCatalog(): RoomPiece {
    const pc = new PixelCanvas(52, 70);
    woodTop(pc, 2, 49, 10, 15, 31);
    for (let x = 2; x <= 49; x++) pc.set(x, 16, 'earth');
    for (let y = 17; y <= 62; y++) {
        for (let x = 2; x <= 49; x++) {
            pc.set(x, y, x === 2 ? 'clay' : x === 3 ? 'wood' : x === 49 ? 'bark' : x === 48 ? 'earth' : y < 28 ? 'wood' : 'bark');
        }
    }
    for (let y = 19; y <= 27; y++) {
        for (let x = 9; x <= 41; x++) pc.set(x, y, y === 19 || x === 9 ? 'yellow' : y === 27 || x === 41 ? 'orange' : 'gold');
    }
    miniText(pc, 12, 21, 'CATALOG', 'bark');
    const drawer = (dx: number, dy: number) => {
        for (let x = dx; x < dx + 10; x++) {
            pc.set(x, dy, 'clay').set(x, dy + 6, 'earth');
            for (let y = dy + 1; y <= dy + 5; y++) pc.set(x, y, 'wood');
        }
        pc.rect(dx + 3, dy + 2, 4, 2, 'cream').rect(dx + 2, dy + 2, 1, 2, 'gold').rect(dx + 7, dy + 2, 1, 2, 'gold');
        pc.rect(dx + 4, dy + 5, 2, 1, 'gold');
    };
    for (const dy of [30, 38, 46, 54]) for (const dx of [5, 16, 27, 38]) if (dx !== 27 || dy !== 38) drawer(dx, dy);
    // One drawer pulled out, showing its index cards and coloured tabs.
    for (let y = 38; y <= 42; y++) {
        for (let x = 27; x <= 36; x++) pc.set(x, y, x === 27 || x === 36 ? 'wood' : y === 38 ? 'bark' : y % 2 ? 'white' : 'cream');
    }
    (['red', 'sky', 'gold', 'lime'] as const).forEach((c, i) => pc.set(29 + i * 2, 38, c));
    drawer(27, 43);
    for (let x = 27; x <= 36; x++) {
        darken(pc, x, 50);
        if (bayer(x, 51) < 0.5) darken(pc, x, 51);
    }
    for (let x = 1; x <= 50; x++) pc.set(x, 63, 'earth').set(x, 64, 'bark');
    for (const lx of [3, 45]) {
        for (let y = 65; y <= 68; y++) pc.set(lx, y, 'clay').set(lx + 1, y, 'wood').set(lx + 2, y, 'wood').set(lx + 3, y, 'earth');
    }
    // A potted fern on top.
    pc.ascii(38, 0, [
        '....g...g...',
        '..g.Gg.Gg.g.',
        '.gG..GLG.Gg.',
        'gG..GLGGG..G',
        'G..GG.L.GG.g',
        '..G.GGGGG...',
        '...fGGGGf...',
        '...cOOOOr...',
        '...cOOOOr...',
        '....OOOr....',
        '....rrrr....',
    ], { '.': null, g: 'grass', G: 'leaf', L: 'lime', f: 'forest', c: 'gold', O: 'orange', r: 'red' });
    pc.outline('ink');
    return { name: 'catalog', canvas: pc, x: 274, y: 108, foot: { x: 276, y: 140, w: 49, h: 37 } };
}

function globe(seed: number): RoomPiece {
    const pc = new PixelCanvas(22, 36);
    const sea: ColorName[] = ['navy', 'blue', 'sky', 'cyan'];
    const land: ColorName[] = ['pine', 'forest', 'leaf', 'grass'];
    pc.ellipse(11, 11, 8, 8, (x, y, nx, ny) => {
        const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const light = Math.max(0, Math.min(0.999, -0.45 * nx - 0.5 * ny + 0.7 * z));
        if (Math.hypot(nx + 0.4, ny + 0.45) < 0.16) return 'white';
        const ramp = valueNoise(x * 1.2, y * 1.4, 4, seed) > 0.55 ? land : sea;
        const t = light * 3;
        const i = Math.min(2, Math.floor(t));
        return t - i > bayer(x, y) ? ramp[i + 1] : ramp[i];
    });
    for (let y = 0; y <= 22; y++) {
        for (let x = 11; x <= 21; x++) {
            const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 11);
            if (d >= 9 && d < 10.3) pc.set(x, y, d < 9.6 ? 'gold' : 'orange');
        }
    }
    pc.set(11, 1, 'gold').set(11, 0, 'orange').set(11, 21, 'gold').set(11, 22, 'orange');
    for (let y = 20; y <= 26; y++) pc.set(10, y, 'clay').set(11, y, 'wood').set(12, y, 'earth');
    pc.rect(9, 26, 5, 1, 'clay').rect(9, 27, 5, 1, 'earth');
    pc.line(10, 28, 4, 33, 'wood').line(11, 28, 5, 33, 'earth');
    pc.line(12, 28, 18, 33, 'wood').line(13, 28, 19, 33, 'earth');
    for (let y = 28; y <= 32; y++) pc.set(11, y, 'wood');
    pc.outline('ink');
    return { name: 'globe', canvas: pc, x: 289, y: 194, foot: { x: 291, y: 220, w: 19, h: 10 } };
}

function readingNook(): { piece: RoomPiece; lamps: RoomLamp[] } {
    const pc = new PixelCanvas(44, 54);
    // Floor lamp with a fringed linen shade.
    for (let y = 11; y <= 46; y++) pc.set(6, y, 'gold').set(7, y, 'orange');
    for (let y = 2; y <= 9; y++) {
        const spread = Math.floor((y - 2) / 3);
        for (let x = 3 - spread; x <= 9 + spread; x++) {
            pc.set(x, y, x <= 4 - spread ? 'white' : x >= 8 + spread ? 'sand' : 'cream');
        }
    }
    for (let x = 0; x <= 12; x++) pc.set(x, 10, x % 2 ? 'gold' : 'orange');
    pc.rect(3, 46, 8, 1, 'gold').rect(2, 47, 10, 1, 'orange').rect(2, 48, 10, 1, 'red');
    // Red wingback chair.
    for (let y = 22; y <= 36; y++) {
        for (let x = 20; x <= 37; x++) {
            if (y === 22 && (x === 20 || x === 37)) continue;
            const u = x - 20, v = y - 22;
            const p = (u + v) % 6;
            const q = (((u - v) % 6) + 6) % 6;
            pc.set(x, y, p === 0 && q === 0 ? 'bark' : p === 0 || q === 0 ? 'wine' : p === 1 ? 'orange' : 'red');
        }
    }
    for (let y = 26; y <= 40; y++) {
        for (const [x0, x1] of [[16, 19], [38, 41]]) {
            for (let x = x0; x <= x1; x++) pc.set(x, y, y === 26 ? 'red' : x === x0 ? 'red' : 'wine');
        }
    }
    for (let y = 34; y <= 41; y++) {
        pc.rect(15, y, 6, 1, y === 34 ? 'orange' : y < 37 ? 'red' : 'wine');
        pc.rect(37, y, 6, 1, y === 34 ? 'orange' : y < 37 ? 'red' : 'wine');
    }
    for (let y = 37; y <= 41; y++) pc.rect(21, y, 16, 1, y === 37 ? 'orange' : y < 40 ? 'red' : 'wine');
    flatBook(pc, 24, 31, 39, 'navy');
    for (let y = 42; y <= 46; y++) {
        for (let x = 15; x <= 42; x++) pc.set(x, y, y === 44 && x % 3 === 0 ? 'gold' : y === 46 ? 'bark' : 'wine');
    }
    for (const lx of [17, 39]) pc.rect(lx, 47, 2, 3, 'earth');
    pc.outline('ink');
    return {
        piece: { name: 'nook', canvas: pc, x: 36, y: 122, foot: { x: 38, y: 160, w: 41, h: 12 } },
        lamps: [{ x: 42, y: 128, depth: 172.5, size: 'round' }],
    };
}

// ─── assembly ───────────────────────────────────────────────────────────────────────────────────

/** Paint the reading room for up to three bookcases (left to right). */
export function readingRoomArt(cases: readonly Bookcase[], seed = 11) {
    const room = new PixelCanvas(W, H);
    walls(room);
    backWall(room);
    WINDOW_XS.forEach((x, i) => paneWindow(room, x, seed + i * 7));
    CASE_XS.forEach((x, i) => bookcase(room, x, CASE_Y, cases[i] ?? { plaque: '', books: [] }, seed + 100 + i * 31));
    railAndLadder(room, 93);
    floor(room);
    doorway(room);
    rug(room);
    sunlight(room);

    const table = readingTable();
    const desk = circulationDesk();
    const nook = readingNook();
    const pieces = [table.piece, desk.piece, nook.piece, cardCatalog(), globe(seed)];
    const lamps = [...table.lamps, ...desk.lamps, ...nook.lamps];

    shadowRect(room, 136, 178, 216, 191);
    shadowRect(room, 24, 225, 99, 228);
    shadowRect(room, 275, 164, 325, 170);
    shadowOval(room, 300, 227, 10, 3);
    shadowOval(room, 65, 171, 15, 3);
    shadowOval(room, 43, 170, 6, 2);
    return { room, pieces, lamps };
}
