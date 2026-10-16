/**
 * ATV-32: the default 32-color palette of ATV World.
 *
 * The built-in procedural art uses these colors so it looks consistent out of the box. It is a
 * default, not a rule: every kit function accepts any `Color` (palette names, any CSS color
 * string, or 0xRRGGBB numbers), and you can ignore the kit entirely and bring your own art.
 */
export const PALETTE = {
    // neutrals
    ink: '#14101e',
    night: '#2a2445',
    slate: '#3d3d5c',
    steel: '#5d6b85',
    mist: '#94a3b8',
    cloud: '#cdd6e0',
    white: '#f4f4ef',
    // greens
    pine: '#1e3d36',
    forest: '#2c6a4a',
    leaf: '#3e9a4f',
    grass: '#6cbf4b',
    lime: '#b4e05a',
    // earth
    bark: '#3b2427',
    earth: '#6b3e2e',
    wood: '#9c6a3e',
    clay: '#c9925a',
    sand: '#e8c48a',
    cream: '#f6e6b8',
    // warm
    wine: '#6e1f3a',
    red: '#c4314b',
    orange: '#ec7a3a',
    gold: '#f7b538',
    yellow: '#fbe46f',
    // water
    navy: '#1c2f5e',
    blue: '#2f5fb3',
    sky: '#4b9be0',
    cyan: '#7fd6f0',
    ice: '#c8f1fb',
    // purples
    plum: '#4a2a6b',
    violet: '#7d4bb5',
    pink: '#e26fa6',
    peach: '#f5a98c',
} as const;

export type ColorName = keyof typeof PALETTE;

export const COLOR_NAMES = Object.keys(PALETTE) as ColorName[];

/** One character per palette color (in PALETTE order) for ASCII sprites. `.` and space are transparent. */
export const PALETTE_CHARS = '0123456789abcdefghijklmnopqrstuv';

const hexToRgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
];

/** 0xRRGGBB numbers, handy for Phaser tints, fills, and camera colors. */
export const HEX = Object.fromEntries(
    COLOR_NAMES.map((n) => [n, parseInt(PALETTE[n].slice(1), 16)]),
) as Record<ColorName, number>;

/** Packed little-endian ABGR values for writing straight into ImageData via a Uint32Array. */
export const U32 = Object.fromEntries(
    COLOR_NAMES.map((n) => {
        const [r, g, b] = hexToRgb(PALETTE[n]);
        return [n, ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0];
    }),
) as Record<ColorName, number>;

/** Three-step ramps (shadow, base, highlight) used for roofs, walls, and props. */
export const RAMPS = {
    red: ['wine', 'red', 'orange'],
    orange: ['earth', 'orange', 'gold'],
    gold: ['clay', 'gold', 'yellow'],
    green: ['pine', 'forest', 'leaf'],
    lime: ['leaf', 'grass', 'lime'],
    teal: ['navy', 'forest', 'cyan'],
    blue: ['navy', 'blue', 'sky'],
    sky: ['blue', 'sky', 'cyan'],
    purple: ['plum', 'violet', 'pink'],
    pink: ['violet', 'pink', 'peach'],
    brown: ['bark', 'earth', 'wood'],
    wood: ['earth', 'wood', 'clay'],
    cream: ['clay', 'sand', 'cream'],
    white: ['mist', 'cloud', 'white'],
    stone: ['slate', 'steel', 'mist'],
    dark: ['ink', 'night', 'slate'],
} as const satisfies Record<string, readonly [ColorName, ColorName, ColorName]>;

export type RampName = keyof typeof RAMPS;

export const isColorName = (v: unknown): v is ColorName => typeof v === 'string' && Object.hasOwn(PALETTE, v);

/** One step darker along the palette's hue-shifted ramps. */
export const DARKER: Record<ColorName, ColorName> = {
    ink: 'ink', night: 'ink', slate: 'night', steel: 'slate', mist: 'steel', cloud: 'mist', white: 'cloud',
    pine: 'ink', forest: 'pine', leaf: 'forest', grass: 'leaf', lime: 'grass',
    bark: 'ink', earth: 'bark', wood: 'earth', clay: 'wood', sand: 'clay', cream: 'sand',
    wine: 'bark', red: 'wine', orange: 'red', gold: 'orange', yellow: 'gold',
    navy: 'ink', blue: 'navy', sky: 'blue', cyan: 'sky', ice: 'cyan',
    plum: 'night', violet: 'plum', pink: 'violet', peach: 'pink',
};

/** One step lighter along the palette's hue-shifted ramps. */
export const LIGHTER: Record<ColorName, ColorName> = {
    ink: 'night', night: 'slate', slate: 'steel', steel: 'mist', mist: 'cloud', cloud: 'white', white: 'white',
    pine: 'forest', forest: 'leaf', leaf: 'grass', grass: 'lime', lime: 'yellow',
    bark: 'earth', earth: 'wood', wood: 'clay', clay: 'sand', sand: 'cream', cream: 'white',
    wine: 'red', red: 'orange', orange: 'gold', gold: 'yellow', yellow: 'cream',
    navy: 'blue', blue: 'sky', sky: 'cyan', cyan: 'ice', ice: 'white',
    plum: 'violet', violet: 'pink', pink: 'peach', peach: 'cream',
};

/**
 * Any color at all: an ATV-32 name ('gold'), any CSS color ('#ff8800', '#f80', 'rgb(…)', 'hsl(…)',
 * 'tomato'), or a 0xRRGGBB number. Palette names win over CSS names ('red' is ATV red).
 */
export type Color = ColorName | (string & {}) | number;

/** A ramp name, any single color (shades are derived), or an explicit [shadow, base, highlight]. */
export type RampLike = RampName | Color | readonly [Color, Color, Color];

type RGBA = readonly [number, number, number, number];

const rgbaCache = new Map<Color, RGBA>();
const u32Cache = new Map<Color, number>();
let probe: CanvasRenderingContext2D | null | undefined;

function parseHex(s: string): RGBA | null {
    const m = /^#([0-9a-f]{3,8})$/i.exec(s.trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join('');
    if (h.length === 6) {
        const n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }
    if (h.length === 8) {
        const n = parseInt(h, 16);
        return [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return null;
}

/** Let the browser parse anything else CSS understands (named colors, rgb(), hsl(), …). */
function parseCss(s: string): RGBA | null {
    if (probe === undefined) probe = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    if (!probe) return null;
    probe.fillStyle = '#000001';
    probe.fillStyle = s;
    const a = String(probe.fillStyle);
    probe.fillStyle = '#000002';
    probe.fillStyle = s;
    if (String(probe.fillStyle) !== a) return null; // invalid: the sentinel survived
    if (a.startsWith('#')) return parseHex(a);
    const parts = /rgba?\(([^)]+)\)/.exec(a)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (!parts || parts.length < 3) return null;
    return [parts[0], parts[1], parts[2], Math.round((parts[3] ?? 1) * 255)];
}

/** Resolve any Color to [r, g, b, a] in 0–255. Unparseable strings become hot magenta so they're easy to spot. */
export function toRGBA(c: Color): RGBA {
    let out = rgbaCache.get(c);
    if (out) return out;
    if (typeof c === 'number') out = [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
    else if (isColorName(c)) out = [...hexToRgb(PALETTE[c]), 255];
    else out = parseHex(c) ?? parseCss(c) ?? [255, 0, 255, 255];
    rgbaCache.set(c, out);
    return out;
}

/** Packed ABGR for ImageData writes. Fast path for palette names. */
export function toU32(c: Color): number {
    if (typeof c === 'string') {
        const v = (U32 as Record<string, unknown>)[c];
        if (typeof v === 'number') return v;
    }
    let v = u32Cache.get(c);
    if (v === undefined) {
        const [r, g, b, a] = toRGBA(c);
        v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
        u32Cache.set(c, v);
    }
    return v;
}

/** 0xRRGGBB, e.g. for Phaser tints, fills, and camera backgrounds. */
export function toHexNumber(c: Color): number {
    const [r, g, b] = toRGBA(c);
    return (r << 16) | (g << 8) | b;
}

/** CSS string, e.g. for Phaser text styles or DOM elements. */
export function toCss(c: Color): string {
    const [r, g, b, a] = toRGBA(c);
    if (a < 255) return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return `#${((f(0) << 16) | (f(8) << 8) | f(4)).toString(16).padStart(6, '0')}`;
}

/** Shift a color's lightness, nudging the hue toward `towardHue` (cool shadows, warm highlights). */
function shade(c: Color, dl: number, towardHue: number): string {
    const [r, g, b] = toRGBA(c);
    const [h, s, l] = rgbToHsl(r, g, b);
    const diff = ((towardHue - h + 540) % 360) - 180;
    const nh = (h + Math.max(-10, Math.min(10, diff)) + 360) % 360;
    return hslToHex(nh, Math.min(1, s * 1.05), Math.max(0, Math.min(1, l + dl)));
}

/** One step darker. Palette names follow the hand-tuned ramps; anything else is derived. */
export const darker = (c: Color): Color => (isColorName(c) ? DARKER[c] : shade(c, -0.14, 240));

/** One step lighter. Palette names follow the hand-tuned ramps; anything else is derived. */
export const lighter = (c: Color): Color => (isColorName(c) ? LIGHTER[c] : shade(c, 0.12, 60));

/** Turn a ramp name, a single color, or an explicit triple into [shadow, base, highlight]. */
export function toRamp(c: RampLike): readonly [Color, Color, Color] {
    if (Array.isArray(c)) return c as readonly [Color, Color, Color];
    if (typeof c === 'string' && Object.hasOwn(RAMPS, c)) return RAMPS[c as RampName];
    const base = c as Color;
    return [darker(base), base, lighter(base)];
}
