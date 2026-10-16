import type { BuildingInfo } from './buildings';
import { miniText, miniTextWidth } from './font';
import { bayer, hash } from './noise';
import type { Color } from './palette';
import { PixelCanvas } from './pixels';

/** Warm sandstone, dark → light. */
const STONE: readonly Color[] = ['earth', 'wood', 'clay', 'sand', 'cream', 'white'];
/** Weathered copper: dark teal-green up to a mint highlight. */
const PATINA: readonly Color[] = ['pine', 'forest', 'leaf', 'cyan'];
const LEAVES: readonly Color[] = ['pine', 'forest', 'leaf', 'grass', 'lime'];
/** Book spines glimpsed through the windows. */
const SPINES: readonly Color[] = ['wine', 'red', 'navy', 'blue', 'forest', 'plum', 'gold', 'cream', 'earth', 'orange', 'pine', 'violet', 'sky'];

const W = 128;
const H = 160;
/** The façade is symmetric about this column: x mirrors to 128 - x. */
const CX = 64;

/** Pick a shade from a ramp with a narrow ordered-dither band between neighbouring steps. */
function tone(pc: PixelCanvas, x: number, y: number, ramp: readonly Color[], v: number) {
    const top = ramp.length - 1;
    const c = Math.max(0, Math.min(top, v));
    const i = Math.min(top - 1, Math.floor(c));
    const f = Math.max(0, Math.min(1, (c - i - 0.5) * 3 + 0.5));
    pc.mix(x, y, ramp[i], ramp[i + 1], f);
}

/** Light on a vertical cylinder from the front-left; u runs -1 → 1 across its width. */
const lit = (u: number) => Math.max(0, -0.55 * u + 0.83 * Math.sqrt(Math.max(0, 1 - u * u)));

/** An arched window (odd width) looking into a lamplit room lined with books. */
function shelfWindow(pc: PixelCanvas, x0: number, y0: number, w: number, h: number, seed: number, keystone = true) {
    const r = w / 2;
    const cx = x0 + r;
    const cy = y0 + r;
    const mid = x0 + (w - 1) / 2;
    const transom = y0 + Math.floor(r);
    const dist = (x: number, y: number) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy);

    for (let y = y0 - 1; y < y0 + h; y++) {
        for (let x = x0 - 1; x <= x0 + w; x++) {
            const arch = y + 0.5 < cy;
            const inside = arch ? dist(x, y) <= r : x >= x0 && x < x0 + w;
            if (!inside) {
                if (arch ? dist(x, y) <= r + 1 : true) pc.set(x, y, x < mid ? 'white' : 'cream');
                continue;
            }
            if (x === mid || y === transom) {
                pc.set(x, y, 'cream');
            } else if (arch) {
                const d = dist(x, y) / r;
                pc.set(x, y, d < 0.55 ? 'yellow' : d < 0.8 || bayer(x, y) < 0.5 ? 'gold' : 'orange');
            } else {
                const k = y - transom - 1;
                const band = Math.floor(k / 6);
                const row = k % 6;
                if (row === 5) {
                    pc.set(x, y, 'wood');
                    continue;
                }
                const gap = hash(x, band, seed) < 0.1;
                const tall = 3 + Math.floor(hash(x, band, seed + 1) * 3);
                if (gap || row < 5 - tall) {
                    pc.set(x, y, 'bark');
                    continue;
                }
                const gilt = row === 6 - tall && hash(x, band, seed + 3) < 0.45;
                pc.set(x, y, gilt ? 'gold' : SPINES[Math.floor(hash(x, band, seed + 2) * SPINES.length)]);
            }
        }
    }
    if (keystone) pc.rect(mid - 1, y0 - 2, 3, 1, 'white').set(mid + 1, y0 - 2, 'cream');
    pc.rect(x0 - 2, y0 + h, w + 4, 1, 'cream').rect(x0 - 2, y0 + h, 2, 1, 'white');
    pc.rect(x0 - 1, y0 + h + 1, w + 2, 1, 'clay');
}

function hedge(pc: PixelCanvas, x0: number, x1: number, y0: number, y1: number, seed: number) {
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const edge = Math.min(x - x0, x1 - x);
            if ((y === y0 && edge < 2) || (y === y1 && edge < 1)) continue;
            const t = (y - y0) / (y1 - y0);
            const clump = hash(x >> 1, (y + (x >> 2)) >> 1, seed);
            tone(pc, x, y, LEAVES, 3.1 - t * 2.6 + (clump - 0.5) * 1.1 - (x - x0) / (x1 - x0) * 0.5);
        }
    }
    for (let x = x0 + 2; x <= x1 - 2; x++) if (hash(x, y0, seed) < 0.3) pc.set(x, y0 + 1, 'lime');
}

/** A stone lion lying on a plinth, facing the street (NYPL-style), centred on column c. */
function lion(pc: PixelCanvas, c: number) {
    pc.ascii(c - 4, 137, [
        '..MMMMm..',
        '.MMMMMMm.',
        'MMWFFFFmm',
        'MMFeFeFmm',
        'MMFFFFFmm',
        '.MFFeFFm.',
        '.MMFFFmm.',
        '..BBBBb..',
        '.BBBBBbb.',
        'PPPBBbppp',
    ], { '.': null, M: 'clay', m: 'wood', W: 'white', F: 'cream', e: 'earth', B: 'sand', b: 'clay', P: 'cream', p: 'sand' });
    pc.rect(c - 7, 147, 15, 1, 'cream').rect(c - 7, 147, 4, 1, 'white');
    for (let y = 148; y <= 156; y++) {
        pc.rect(c - 6, y, 13, 1, 'sand').set(c - 6, y, 'cream').set(c + 6, y, 'clay').set(c + 5, y, 'clay');
    }
    pc.rect(c - 4, 150, 9, 1, 'clay').rect(c - 4, 154, 9, 1, 'cream');
    pc.rect(c - 7, 157, 15, 1, 'clay').rect(c - 7, 158, 15, 1, 'wood');
}

/** A brass wall lantern with a warm pool of light on the stone behind it. */
function lantern(pc: PixelCanvas, c: number, y: number) {
    for (let j = -4; j <= 4; j++) {
        for (let i = -4; i <= 4; i++) {
            const d = Math.hypot(i, j) / 4.5;
            if (d < 1 && (1 - d) * 1.2 > bayer(c + i, y + 2 + j)) pc.set(c + i, y + 2 + j, d < 0.5 ? 'sand' : 'clay');
        }
    }
    pc.ascii(c - 1, y - 1, [
        '.n.',
        'nnn',
        'gyg',
        'gyg',
        'gyg',
        'nnn',
        '.n.',
    ], { '.': null, n: 'night', g: 'gold', y: 'yellow' });
}

/**
 * The town library: a round reading tower under a verdigris cone, flanked by two book-lined
 * wings, with a columned portico, a carved LIBRARY frieze, grand steps, and a pair of stone lions.
 */
export function libraryArt(seed = 7): { canvas: PixelCanvas; info: BuildingInfo } {
    const pc = new PixelCanvas(W, H);
    const info: BuildingInfo = { W, H, wallTop: 45, door: { x: 58, y: 120, w: 13, h: 20 } };

    // Drum: sandstone ashlar shaded as a cylinder.
    for (let y = 45; y <= 108; y++) {
        const course = Math.floor((y - 45) / 6);
        let prev = Number.NaN;
        for (let x = CX - 24; x <= CX + 24; x++) {
            const u = (x - CX) / 24.5;
            const block = Math.floor((Math.asin(u) / Math.PI + 0.5) * 7 + (course % 2) * 0.5);
            let v = 1.6 + 2 * lit(u) + (hash(block, course, seed) - 0.5) * 0.35;
            if ((y - 45) % 6 === 5 || (!Number.isNaN(prev) && block !== prev)) v -= 1;
            if (y < 47) v -= 0.8;
            prev = block;
            tone(pc, x, y, STONE, v);
        }
    }

    // Rose window.
    pc.ellipse(CX + 0.5, 52.5, 5.7, 5.7, (_x, _y, nx, ny) => (nx + ny < -0.4 ? 'white' : 'cream'));
    pc.ellipse(CX + 0.5, 52.5, 4.6, 4.6, (_x, _y, nx, ny) => (nx + ny < -0.6 ? 'yellow' : nx + ny > 0.6 ? 'orange' : 'gold'));
    pc.ellipse(CX + 0.5, 52.5, 3.5, 3.5, (_x, _y, nx, ny) => {
        if (Math.hypot(nx, ny) < 0.4) return 'yellow';
        return (nx < 0) === (ny < 0) ? 'red' : 'blue';
    });
    pc.rect(CX, 49, 1, 7, 'gold').rect(CX - 3, 52, 7, 1, 'gold').set(CX, 52, 'yellow');

    // Tall reading-room window and the two banners beside it.
    shelfWindow(pc, CX - 6, 61, 13, 30, seed, false);
    for (const [x0, shade] of [[CX - 20, false], [CX + 14, true]] as const) {
        pc.rect(x0 - 1, 58, 9, 1, 'gold').set(x0 - 1, 58, 'yellow').set(x0 + 7, 58, 'orange');
        for (let y = 59; y <= 79; y++) {
            for (let i = 0; i < 7; i++) {
                if (y >= 78 && (i === 3 || (y === 79 && i > 1 && i < 5))) continue;
                const c: Color = shade ? (i === 0 ? 'red' : i === 6 ? 'bark' : 'wine') : i === 6 ? 'wine' : 'red';
                pc.set(x0 + i, y, y === 76 ? (shade ? 'orange' : 'gold') : c);
            }
        }
        pc.ascii(x0 + 1, 63, ['cc.cc', 'ccgcc', 'gg.gg'], { '.': null, c: shade ? 'sand' : 'cream', g: shade ? 'orange' : 'gold' });
    }

    // Cornice ring under the roof.
    for (let x = CX - 27; x <= CX + 27; x++) {
        const v = 1.6 + 2 * lit((x - CX) / 27.5);
        tone(pc, x, 41, STONE, v + 1.3);
        tone(pc, x, 42, STONE, v + 0.6);
        tone(pc, x, 43, STONE, x % 2 ? v - 0.6 : v + 0.2);
        tone(pc, x, 44, STONE, v - 1.3);
    }

    // Copper cone with standing seams, a dormer, and a gilded finial.
    for (let y = 9; y <= 40; y++) {
        const t = (y - 9) / 31;
        const hw = 0.5 + 30 * t ** 1.2;
        let prev = Number.NaN;
        for (let x = CX - 31; x <= CX + 31; x++) {
            if (Math.abs(x - CX) > hw) continue;
            const u = Math.max(-1, Math.min(1, (x - CX) / (hw + 0.5)));
            const seam = Math.floor((u + 1) * 4.5);
            let v = 0.3 + 2.5 * lit(u) ** 1.5;
            if (seam !== prev && !Number.isNaN(prev)) v += u < -0.1 ? 0.7 : -0.8;
            if ((y - 9) % 8 === 7) v -= 0.6;
            if (y === 39) v += 0.4;
            prev = seam;
            if (y === 40) pc.set(x, y, 'pine');
            else tone(pc, x, y, PATINA, v);
        }
    }
    pc.ascii(CX - 3, 24, [
        '..mmf..',
        '.mllff.',
        'mllllff',
        'pwwwwcp',
        '.wyygc.',
        '.wyygc.',
        '.wggoc.',
        '.ccccc.',
    ], { '.': null, m: 'cyan', l: 'leaf', f: 'forest', p: 'pine', w: 'white', c: 'cream', y: 'yellow', g: 'gold', o: 'orange' });
    pc.ascii(CX - 1, 1, [
        '.y......',
        '.grrrr..',
        '.grrrrrr',
        '.gwwww..',
        '.g......',
        'ygg.....',
        'ggo.....',
        'goo.....',
        '.o......',
    ], { '.': null, y: 'yellow', g: 'gold', o: 'orange', r: 'red', w: 'wine' });

    // Wings: lead roof, balustrade, cornice, ashlar, quoins, and a tall book-lined window each.
    for (const side of [-1, 1] as const) {
        const near = CX + side * 20;
        const far = CX + side * 62;
        const x0 = Math.min(near, far);
        const x1 = Math.max(near, far);
        for (let x = x0; x <= x1; x++) {
            pc.set(x, 82, 'steel').rect(x, 83, 1, 3, 'slate');
            pc.set(x, 86, 'white').set(x, 87, 'cream');
            const post = x - x0 < 3 || x1 - x < 3;
            const k = (x - x0) % 4;
            for (let y = 88; y <= 90; y++) pc.set(x, y, post || k === 1 ? 'cream' : k === 2 ? 'sand' : 'slate');
            pc.set(x, 91, 'cream');
            pc.set(x, 92, 'white').set(x, 93, 'cream').set(x, 94, x % 2 ? 'clay' : 'sand').set(x, 95, 'clay');
            for (let y = 96; y <= 135; y++) {
                const wy = y - 96;
                const course = Math.floor(wy / 5);
                const joint = (x + (course % 2) * 4) % 9 === 0;
                let c: Color = wy % 5 === 4 || joint ? 'clay' : hash(Math.floor((x + (course % 2) * 4) / 9), course, seed) < 0.25 && wy % 5 === 0 ? 'cream' : 'sand';
                if (y === 96 && bayer(x, y) < 0.6) c = 'clay';
                const fromOuter = side < 0 ? x - x0 : x1 - x;
                const quoin = fromOuter < (course % 2 ? 3 : 5);
                if (quoin) c = wy % 5 === 4 ? 'sand' : fromOuter === 0 || wy % 5 === 0 ? 'white' : 'cream';
                pc.set(x, y, c);
            }
            pc.set(x, 136, 'sand').rect(x, 137, 1, 2, (x - x0) % 7 === 3 ? 'wood' : 'clay').set(x, 139, 'wood');
        }
        shelfWindow(pc, CX + side * 46 - 5, 101, 11, 31, seed + (side < 0 ? 11 : 23));
    }

    // Portico: shaded back wall, door with a lit fanlight, lanterns, then the columns.
    for (let y = 120; y <= 139; y++) {
        for (let x = CX - 28; x <= CX + 28; x++) {
            const deep = y < 122 || (y === 122 && bayer(x, y) < 0.5);
            pc.set(x, y, deep ? 'earth' : (y - 120) % 5 === 4 ? 'wood' : 'clay');
        }
    }
    for (const c of [39, 48, 80, 89]) pc.rect(c + 3, 122, 2, 16, 'wood');
    lantern(pc, CX - 10, 123);
    lantern(pc, CX + 10, 123);
    for (let y = 119; y <= 139; y++) {
        for (let x = CX - 7; x <= CX + 7; x++) {
            const d = Math.hypot(x + 0.5 - (CX + 0.5), y + 0.5 - 127);
            const arch = y < 127;
            const inside = Math.abs(x - CX) <= 6 && (!arch || d <= 6.5);
            const frame = arch ? d <= 7.5 : true;
            if (!inside) {
                if (frame) pc.set(x, y, x < CX ? 'white' : 'cream');
                continue;
            }
            if (arch) {
                const spoke = x === CX || Math.abs(Math.abs(x - CX) - (127 - y)) < 0.6;
                pc.set(x, y, spoke ? 'earth' : d < 3.5 ? 'yellow' : 'gold');
            } else if (y === 127) {
                pc.set(x, y, 'earth');
            } else if (x === CX) {
                pc.set(x, y, y < 130 ? 'yellow' : bayer(x, y) < 0.5 ? 'yellow' : 'gold');
            } else {
                const i = x < CX ? x - (CX - 6) : x - (CX + 1);
                const panel = (y >= 129 && y <= 132) || (y >= 134 && y <= 138);
                const edgeTop = y === 129 || y === 134;
                const edgeBot = y === 132 || y === 138;
                let c: Color = 'earth';
                if (panel && i >= 1 && i <= 4) c = edgeTop || i === 1 ? 'bark' : edgeBot || i === 4 ? 'wood' : 'earth';
                pc.set(x, y, c);
            }
        }
    }
    pc.set(CX - 1, 134, 'gold').set(CX + 1, 134, 'gold');
    for (const c of [39, 48, 80, 89]) {
        pc.rect(c - 3, 120, 7, 1, 'white').rect(c + 2, 120, 2, 1, 'cream');
        pc.rect(c - 3, 121, 7, 1, 'cream').set(c - 3, 121, 'sand').set(c + 3, 121, 'sand');
        const shaft: Color[] = ['cream', 'white', 'cream', 'sand', 'clay'];
        for (let y = 122; y <= 137; y++) shaft.forEach((col, i) => pc.set(c - 2 + i, y, col));
        pc.rect(c - 3, 138, 7, 1, 'cream').set(c - 3, 138, 'white').rect(c - 3, 139, 7, 1, 'sand');
    }

    // Entablature: architrave, LIBRARY frieze, dentil cornice.
    pc.rect(CX - 30, 117, 61, 1, 'white').rect(CX - 30, 118, 61, 1, 'cream').rect(CX - 30, 119, 61, 1, 'sand');
    pc.rect(CX - 30, 109, 61, 8, 'cream').rect(CX - 30, 109, 61, 1, 'white').rect(CX - 30, 116, 61, 1, 'sand');
    const word = 'LIBRARY';
    miniText(pc, CX - Math.floor(miniTextWidth(word) / 2), 111, word, 'earth');
    for (const x of [CX - 24, CX + 23]) pc.rect(x, 112, 2, 2, 'gold').set(x, 112, 'yellow').set(x + 1, 113, 'orange');
    for (let x = CX - 32; x <= CX + 32; x++) {
        pc.set(x, 106, 'white').set(x, 107, 'cream').set(x, 108, x % 2 ? 'clay' : 'sand');
    }

    // Pediment with an open-book medallion.
    for (let y = 94; y <= 105; y++) {
        const hw = ((y - 93) * 32) / 12;
        for (let x = CX - 32; x <= CX + 32; x++) {
            const off = Math.abs(x - CX);
            if (off > hw) continue;
            if (hw - off < 2.2) pc.set(x, y, x < CX ? 'white' : hw - off < 1.1 ? 'cream' : 'sand');
            else pc.set(x, y, y >= 104 && bayer(x, y) < 0.5 ? 'clay' : 'sand');
        }
    }
    pc.ascii(CX - 4, 98, [
        '.ww...ww.',
        'wwwwgwwww',
        'wccwgwccw',
        'wwwwgwwww',
        'ggggggggg',
        '.ooooooo.',
    ], { '.': null, w: 'white', c: 'cream', g: 'gold', o: 'orange' });

    // Stylobate with a spill of light from the open door, then three broad steps.
    for (let x = CX - 32; x <= CX + 32; x++) {
        const glow = Math.abs(x - CX) <= 4;
        pc.set(x, 140, glow ? 'yellow' : 'cream').set(x, 141, glow && bayer(x, 141) < 0.5 ? 'yellow' : 'cream').set(x, 142, 'sand').set(x, 143, 'clay');
    }
    [33, 37, 41].forEach((hw, i) => {
        const y = 144 + i * 5;
        for (let x = CX - hw; x <= CX + hw; x++) {
            const end = CX + hw - x < 2;
            pc.set(x, y, end ? 'cream' : 'white').set(x, y + 1, 'cream');
            pc.set(x, y + 2, end ? 'clay' : 'sand').set(x, y + 3, end ? 'clay' : 'sand').set(x, y + 4, 'clay');
        }
    });

    // Box hedges along the wings, and the lions in front of them.
    hedge(pc, 3, 30, 135, 144, seed);
    hedge(pc, W - 30, W - 3, 135, 144, seed + 5);
    lion(pc, 13);
    lion(pc, W - 13);

    pc.outline('ink');
    return { canvas: pc, info };
}
