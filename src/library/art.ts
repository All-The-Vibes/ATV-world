/**
 * Small pixel-art textures for the library's HTML views, painted with the world's pixel kit and cached as data URLs.
 * Shown with `image-rendering: pixelated` so they match the game.
 */
import { PixelCanvas } from '../game/kit/pixels';
import { fbm, hash } from '../game/kit/noise';
import { PALETTE, type ColorName } from '../game/kit/palette';
import type { Emblem } from './books';

export type Art = { url: string; w: number; h: number };
const cache = new Map<string, Art>();

function art(key: string, draw: () => PixelCanvas): Art {
    let out = cache.get(key);
    if (!out) {
        const pc = draw();
        pc.flush();
        out = { url: pc.canvas.toDataURL(), w: pc.width, h: pc.height };
        cache.set(key, out);
    }
    return out;
}

/** Book cloth: a faint basket weave laid over the binding color. */
export const weave = () => art('weave', () => {
    const pc = new PixelCanvas(4, 4);
    const dark = '#14101e2e';
    const light = '#ffffff17';
    ['d.l.', '.l.d', 'l.d.', '.d.l'].forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch !== '.') pc.set(x, y, ch === 'd' ? dark : light);
    }));
    return pc;
});

/** Paper: sparse specks over the page color. */
export const grain = () => art('grain', () => {
    const pc = new PixelCanvas(32, 32);
    for (let i = 0; i < 46; i++) {
        pc.set(Math.floor(hash(i, 1, 41) * 32), Math.floor(hash(i, 2, 41) * 32), hash(i, 3, 41) > 0.4 ? '#6b3e2e1c' : '#ffffff40');
    }
    return pc;
});

/** Seamless wood grain for bookcases, drawers, and the reading desk. */
export const wood = (tone: 'oak' | 'walnut' = 'walnut') => art(`wood-${tone}`, () => {
    const W = 64, H = 32;
    const [shadow, base, light]: ColorName[] = tone === 'oak' ? ['earth', 'wood', 'clay'] : ['bark', 'earth', 'wood'];
    const pc = new PixelCanvas(W, H).rect(0, 0, W, H, base);
    for (let i = 0; i < 9; i++) {
        const y0 = Math.floor(hash(i, 1, 7) * H);
        const amp = 1 + Math.floor(hash(i, 2, 7) * 2);
        const k = 1 + Math.floor(hash(i, 3, 7) * 2);
        const phase = hash(i, 4, 7) * Math.PI * 2;
        for (let x = 0; x < W; x++) {
            const y = (y0 + Math.round(Math.sin((x / W) * Math.PI * 2 * k + phase) * amp) + H) % H;
            if (hash(x, i, 9) > 0.14) pc.set(x, y, shadow);
            if (hash(x, i, 10) > 0.8) pc.set(x, (y + 1) % H, shadow);
        }
    }
    for (let n = 0; n < 36; n++) pc.set(Math.floor(hash(n, 5, 3) * W), Math.floor(hash(n, 6, 3) * H), light);
    return pc;
});

/** Marbled endpaper: domain-warped bands of color with gold and cream veins. */
export const marble = () => art('marble', () => {
    const W = 110, H = 155;
    const pc = new PixelCanvas(W, H);
    const fields: ColorName[] = ['navy', 'blue', 'navy', 'wine', 'navy', 'plum'];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const wx = x + (fbm(x, y, 26, 31) - 0.5) * 46;
            const wy = y + (fbm(x + 97, y + 13, 26, 32) - 0.5) * 46;
            const v = fbm(wx, wy, 18, 33) * 5 + wx * 0.035 + Math.sin(wy * 0.08) * 0.9;
            const band = Math.floor(v * 2.2);
            const frac = v * 2.2 - band;
            const vein = frac < 0.09 ? (band % 2 ? 'gold' : 'cream') : frac > 0.94 ? 'sky' : null;
            pc.set(x, y, vein ?? fields[((band % fields.length) + fields.length) % fields.length]);
        }
    }
    return pc;
});

/** Printer's ornament used under chapter titles and at section breaks. */
export const fleuron = (color: ColorName) => art(`fleuron-${color}`, () => new PixelCanvas(25, 5).ascii(0, 0, [
    '............#............',
    '.....#.....###.....#.....',
    '#########.#####.#########',
    '.....#.....###.....#.....',
    '............#............',
], { '#': color }));

const EMBLEMS: Record<Emblem, string[]> = {
    quill: ['.........##', '.......####', '......####.', '.....####..', '....####...', '...####....', '...###.....', '..#.#......', '..##.......', '.#.........', '#..........'],
    candle: ['.....#.....', '....###....', '....###....', '.....#.....', '...#####...', '...#.###...', '...#.###...', '...#.###...', '...#####...', '.#########.', '..#######..'],
    ribbon: ['...........', '##.......##', '####...####', '#####.#####', '####.#.####', '##..###..##', '....###....', '...##.##...', '..##...##..', '.##.....##.', '...........'],
    holly: ['....#.#....', '.....#.....', '.#.......#.', '###.....###', '.###...###.', '####...####', '.####.####.', '..###.###..', '...##.##...', '....#.#....', '...........'],
    teacup: ['...#..#....', '....#..#...', '...#..#....', '...........', '.#######...', '.########..', '.#######.#.', '.########..', '..#####....', '#########..', '.#######...'],
    compass: ['.....#.....', '....###....', '....###....', '...#####...', '.#########.', '#####.#####', '.#########.', '...#####...', '....###....', '....###....', '.....#.....'],
    emerald: ['...........', '...#####...', '..#.#.#.#..', '.#..#.#..#.', '###########', '.#..#.#..#.', '..#.#.#.#..', '...#.#.#...', '....#.#....', '.....#.....', '...........'],
    star: ['.....#.....', '.....#.....', '....###....', '###########', '.#########.', '..#######..', '...#####...', '..###.###..', '..##...##..', '.##.....##.', '.#.......#.'],
    magnifier: ['..#####....', '.#.....#...', '#..##...#..', '#.#.....#..', '#.......#..', '#.......#..', '.#.....#...', '..#####.##.', '........###', '.........##', '...........'],
    lightning: ['......####.', '.....####..', '....####...', '...####....', '..#######..', '....####...', '...####....', '..####.....', '.###.......', '.##........', '#..........'],
    bat: ['...........', '...........', '....#.#....', '#...###...#', '##..###..##', '###.###.###', '###########', '##.#####.##', '#...###...#', '.....#.....', '...........'],
    hourglass: ['.#########.', '..#.....#..', '..#######..', '...#####...', '....###....', '.....#.....', '....#.#....', '...#...#...', '..#..#..#..', '..#.###.#..', '.#########.'],
};

/** Gilt stamp for a spine or cover, in the book's lettering color. */
export const emblem = (name: Emblem, color: ColorName) => art(`emblem-${name}-${color}`, () => new PixelCanvas(11, 11).ascii(0, 0, EMBLEMS[name], { '#': color }));

export type PropName = 'globe' | 'plant' | 'candle' | 'bookend' | 'hourglass';

/** Things that share the shelves with the books. */
export const prop = (name: PropName) => art(`prop-${name}`, () => {
    switch (name) {
        case 'globe': {
            const pc = new PixelCanvas(18, 24);
            pc.ellipse(9, 9, 7, 7, (x, y, nx, ny) => {
                const land = fbm(x * 2 + 5, y * 2, 7, 21) > 0.56;
                const lit = -nx * 0.6 - ny * 0.8 > 0.35;
                const dark = nx * 0.7 + ny * 0.7 > 0.5;
                return land ? (dark ? 'forest' : lit ? 'grass' : 'leaf') : (dark ? 'navy' : lit ? 'sky' : 'blue');
            });
            for (let a = -Math.PI * 0.62; a <= Math.PI * 0.62; a += 0.04) pc.set(Math.round(9 + Math.cos(a) * 8.4), Math.round(9 + Math.sin(a) * 8.4), 'gold');
            pc.rect(8, 17, 2, 3, 'gold').rect(5, 20, 8, 1, 'wood').rect(4, 21, 10, 2, 'earth');
            return pc.outline('ink');
        }
        case 'plant': {
            const pc = new PixelCanvas(18, 26);
            const leaves: [number, number, number, number][] = [[9, 2, 0, 1], [4, 5, -1, 1], [14, 5, 1, 1], [2, 10, -1, 0], [16, 10, 1, 0], [6, 9, -1, 1], [12, 9, 1, 1]];
            for (const [tx, ty] of leaves) pc.line(9, 16, tx, ty, 'forest');
            for (const [tx, ty, dx] of leaves) {
                pc.ellipse(tx, ty + 1, 2, 1.6, 'leaf');
                pc.set(tx + dx, ty, 'grass');
            }
            pc.rect(4, 16, 10, 2, 'red').rect(5, 18, 8, 6, 'clay').rect(5, 18, 2, 6, 'sand').rect(11, 18, 2, 6, 'wood');
            return pc.outline('ink');
        }
        case 'candle': {
            const pc = new PixelCanvas(12, 26);
            pc.ascii(0, 0, ['.....3.....', '....373....', '....373....', '.....f.....'], { 3: 'orange', 7: 'yellow', f: 'ink' });
            pc.rect(4, 4, 4, 11, 'cream').rect(4, 4, 1, 11, 'white').rect(7, 4, 1, 11, 'sand').set(5, 6, 'white');
            pc.rect(2, 15, 8, 2, 'gold').rect(5, 17, 2, 5, 'clay').rect(3, 22, 6, 1, 'gold').rect(2, 23, 8, 2, 'clay');
            return pc.outline('ink');
        }
        case 'bookend': {
            const pc = new PixelCanvas(12, 22);
            pc.rect(1, 2, 8, 20, 'earth').rect(1, 2, 2, 20, 'wood').rect(9, 18, 2, 4, 'earth');
            pc.rect(3, 6, 4, 6, 'gold').rect(4, 7, 2, 4, 'clay').rect(1, 0, 8, 2, 'wood');
            return pc.outline('ink');
        }
        case 'hourglass': {
            const pc = new PixelCanvas(14, 22);
            pc.rect(1, 0, 12, 2, 'wood').rect(1, 20, 12, 2, 'wood').rect(2, 2, 1, 18, 'earth').rect(11, 2, 1, 18, 'earth');
            for (let y = 0; y < 8; y++) {
                const half = Math.max(1, Math.round(4 - y * 0.5));
                pc.rect(7 - half, 2 + y, half * 2, 1, y < 2 ? 'ice' : 'sand');
                pc.rect(7 - half, 19 - y, half * 2, 1, y < 4 ? 'sand' : 'ice');
            }
            pc.set(7, 10, 'sand').set(7, 11, 'sand');
            return pc.outline('ink');
        }
    }
});

/** Palette hex for a color name, for inline styles. */
export const css = (name: ColorName) => PALETTE[name];
