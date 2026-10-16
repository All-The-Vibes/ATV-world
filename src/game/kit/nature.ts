import { lighter, toRamp, type Color, type RampLike } from './palette';
import { miniText, miniTextWidth } from './font';
import { PixelCanvas } from './pixels';
import { bayer, hash, rng } from './noise';

export type TreeShape = 'round' | 'cone' | 'palm';

/** Everything about a tree is open: pass any colors/size, or use/extend TREE_PRESETS. */
export interface TreeStyle {
    shape?: TreeShape;
    /** Leaf colors from darkest to lightest (2+ entries, any colors). */
    leaves?: readonly Color[];
    trunk?: RampLike;
    /** Scale of the whole tree (1 = ~32x40px). */
    size?: number;
    /** Sprinkle of accent pixels: blossoms, fruit, fairy lights… */
    accent?: Color;
    /** Hanging fruits in the canopy (single color or palette of colors). */
    fruits?: Color | readonly Color[];
    /** Optional wooden plaque label on the trunk (e.g. 'ATV'). */
    label?: string;
    snow?: boolean;
}

/** Built-in looks. Add your own: `TREE_PRESETS.neon = { leaves: ['#1a0033', '#7a00ff', '#ff00e6'] }`. */
export const TREE_PRESETS: Record<string, TreeStyle> = {
    oak: { shape: 'round', leaves: ['pine', 'forest', 'leaf', 'grass', 'lime'] },
    pine: { shape: 'cone', leaves: ['pine', 'forest', 'leaf', 'grass'] },
    cherry: { shape: 'round', leaves: ['plum', 'violet', 'pink', 'peach', 'cream'], accent: 'white' },
    autumn: { shape: 'round', leaves: ['wine', 'red', 'orange', 'gold', 'yellow'] },
    fruit: { shape: 'round', leaves: ['pine', 'forest', 'leaf', 'grass', 'lime'], accent: 'red', fruits: 'red' },
    atv: {
        shape: 'round',
        leaves: ['pine', 'forest', 'leaf', 'grass', 'lime'],
        size: 1.2,
        fruits: ['red', 'gold', 'orange', 'pink', 'cyan'],
        label: 'ATV',
    },
    palm: { shape: 'palm', leaves: ['pine', 'forest', 'leaf', 'grass', 'lime'] },
    snowpine: { shape: 'cone', leaves: ['pine', 'forest', 'leaf', 'grass'], snow: true },
    birch: { shape: 'round', leaves: ['forest', 'leaf', 'grass', 'lime', 'yellow'], trunk: ['steel', 'cloud', 'white'], size: 0.85 },
};

export interface TreeArt {
    canvas: PixelCanvas;
    /** Width of the trunk at its base (for collision). */
    trunkW: number;
}

const quantize = (tone: number, x: number, y: number, n: number, spread = 0.55) =>
    Math.max(0, Math.min(n - 1, Math.floor(tone * n + (bayer(x, y) - 0.5) * spread)));

function trunk(pc: PixelCanvas, cx: number, top: number, base: number, w: number, ramp: readonly [Color, Color, Color]) {
    const x0 = Math.round(cx - w / 2);
    for (let y = top; y <= base; y++) {
        for (let i = 0; i < w; i++) pc.set(x0 + i, y, i === 0 ? ramp[2] : i >= w - 2 ? ramp[0] : ramp[1]);
        if ((y * 7) % 5 === 0) pc.set(x0 + 1 + (y % Math.max(1, w - 2)), y, ramp[0]);
    }
    pc.set(x0 - 1, base, ramp[1]);
    pc.set(x0 + w, base, ramp[0]);
    return x0;
}

function roundTree(style: TreeStyle, seed: number): TreeArt {
    const s = style.size ?? 1;
    const R = 12 * s;
    const W = Math.ceil(R * 2.7 + 4);
    const H = Math.ceil(R * 3.35);
    const pc = new PixelCanvas(W, H);
    const r = rng(seed);
    const leaves = style.leaves ?? TREE_PRESETS.oak.leaves!;
    const cx = W / 2;
    const cy = 3.5 + R;
    const trunkW = Math.max(3, Math.round(6 * s));
    const ramp = toRamp(style.trunk ?? 'brown');
    trunk(pc, cx, Math.round(cy + R * 0.4), H - 2, trunkW, ramp);

    const j = () => (r() - 0.5) * 3 * s;
    const blobs = [
        { x: cx + j(), y: cy, r: R * (0.95 + r() * 0.1) },
        { x: cx - R * 0.55 + j(), y: cy + R * 0.35 + j(), r: R * (0.55 + r() * 0.12) },
        { x: cx + R * 0.55 + j(), y: cy + R * 0.35 + j(), r: R * (0.55 + r() * 0.12) },
        { x: cx - R * 0.3 + j(), y: cy - R * 0.45 + j(), r: R * (0.5 + r() * 0.12) },
        { x: cx + R * 0.35 + j(), y: cy - R * 0.4 + j(), r: R * (0.48 + r() * 0.12) },
        { x: cx + j(), y: cy + R * 0.55, r: R * (0.55 + r() * 0.1) },
    ];
    const top = cy - R;
    const span = R * 2.2;
    const lx = -0.6, ly = -0.8;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let best = -1, nx = 0, ny = 0;
            for (const b of blobs) {
                const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r;
                const h = 1 - (dx * dx + dy * dy);
                if (h > best) { best = h; nx = dx; ny = dy; }
            }
            if (best <= 0) continue;
            const lambert = -(nx * lx + ny * ly);
            const clump = (hash(x >> 1, y >> 1, seed) - 0.5) * 0.2;
            const tone = 0.5 + 0.38 * lambert + 0.12 * best - 0.3 * ((y - top) / span) + clump;
            pc.set(x, y, leaves[quantize(tone, x, y, leaves.length)]);
            if (style.accent && hash(x, y, seed + 7) < 0.04 && tone > 0.35) pc.set(x, y, style.accent);
        }
    }
    if (style.fruits) {
        const palette = (typeof style.fruits === 'string' || typeof style.fruits === 'number')
            ? [style.fruits]
            : style.fruits;
        if (palette.length) {
            const spots: [number, number][] = [
                [-0.62, 0.25], [-0.32, -0.22], [0.05, -0.35], [0.42, -0.15], [0.65, 0.28],
                [-0.45, 0.62], [-0.08, 0.22], [0.28, 0.55], [-0.18, 0.78], [0.52, 0.72],
            ];
            spots.forEach(([ox, oy], i) => {
                const fx = Math.round(cx + ox * R + (hash(i, seed, 19) - 0.5) * 2);
                const fy = Math.round(cy + oy * R + (hash(i, seed, 23) - 0.5) * 2);
                const c = palette[i % palette.length];
                const hi = lighter(c);
                // Stem hanging from canopy
                pc.set(fx, fy - 2, 'bark').set(fx + 1, fy - 2, 'lime');
                // Plump 2x2 hanging fruit with highlight
                pc.rect(fx - 1, fy - 1, 2, 2, c).set(fx - 1, fy - 1, hi);
            });
        }
    }
    if (style.label) {
        const tw = miniTextWidth(style.label);
        const sx = Math.round(cx - tw / 2) - 2;
        const sy = H - 10;
        pc.rect(sx, sy, tw + 4, 7, 'wood').rect(sx, sy, tw + 4, 1, 'clay');
        miniText(pc, sx + 2, sy + 1, style.label, 'gold');
    }
    pc.outline('ink');
    return { canvas: pc, trunkW };
}

function coneTree(style: TreeStyle, seed: number): TreeArt {
    const s = style.size ?? 1;
    const W = Math.ceil(30 * s + 4);
    const H = Math.ceil(42 * s);
    const pc = new PixelCanvas(W, H);
    const leaves = style.leaves ?? TREE_PRESETS.pine.leaves!;
    const cx = W / 2;
    const trunkW = Math.max(3, Math.round(4 * s));
    trunk(pc, cx, Math.round(H * 0.72), H - 2, trunkW, toRamp(style.trunk ?? 'brown'));
    const tiers = [
        { t: 1, b: Math.round(H * 0.36), hw: 6 * s },
        { t: Math.round(H * 0.2), b: Math.round(H * 0.58), hw: 9.5 * s },
        { t: Math.round(H * 0.4), b: Math.round(H * 0.8), hw: 12.5 * s },
    ];
    for (const tier of tiers) {
        const th = tier.b - tier.t;
        for (let y = tier.t; y <= tier.b; y++) {
            const k = (y - tier.t) / th;
            const jag = hash(y, tier.t, seed) < 0.3 ? 1 : 0;
            const hw = 1 + k * tier.hw + jag * k;
            for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
                const rel = (x + 0.5 - cx) / hw;
                if (Math.abs(rel) > 1) continue;
                const bottomEdge = y >= tier.b - 1 && hash(x, y, seed) < 0.5;
                let tone = 0.62 - 0.42 * rel - 0.28 * k + (hash(x >> 1, y, seed) - 0.5) * 0.15;
                if (bottomEdge) tone -= 0.3;
                pc.set(x, y, leaves[quantize(tone, x, y, leaves.length)]);
                if (style.snow && (y - tier.t < 2 + (hash(x, tier.t, seed) < 0.5 ? 1 : 0) || (k < 0.5 && rel < -0.4 && hash(x, y, seed) < 0.35))) {
                    pc.set(x, y, rel > 0.3 ? 'cloud' : 'white');
                }
                if (style.accent && hash(x, y, seed + 7) < 0.05) pc.set(x, y, style.accent);
            }
        }
    }
    pc.outline('ink');
    return { canvas: pc, trunkW };
}

function palmTree(style: TreeStyle, seed: number): TreeArt {
    const s = style.size ?? 1;
    const W = Math.ceil(52 * s);
    const H = Math.ceil(48 * s);
    const pc = new PixelCanvas(W, H);
    const r = rng(seed);
    const leaves = style.leaves ?? TREE_PRESETS.palm.leaves!;
    const ramp = toRamp(style.trunk ?? 'wood');
    const baseX = W / 2, topY = Math.ceil(14 * s);
    const lean = (r() < 0.5 ? -1 : 1) * (3 + r() * 3) * s;
    const trunkW = Math.max(3, Math.round(4 * s));
    let topX = baseX;
    for (let y = H - 2; y >= topY; y--) {
        const t = (H - 2 - y) / (H - 2 - topY);
        const x = baseX + lean * t * t;
        topX = x;
        const w = Math.max(2, Math.round(trunkW - t));
        for (let i = 0; i < w; i++) pc.set(Math.round(x - w / 2) + i, y, i === 0 ? ramp[2] : i === w - 1 ? ramp[0] : (y % 3 === 0 ? ramp[0] : ramp[1]));
    }
    const angles = [-165, -130, -95, -55, -18, 12, 168];
    for (const a0 of angles) {
        const a = ((a0 + (r() - 0.5) * 16) * Math.PI) / 180;
        const len = (11 + r() * 4) * s;
        for (let t = 0; t <= 1; t += 0.04) {
            const fx = topX + Math.cos(a) * len * t;
            const fy = topY + Math.sin(a) * len * t * 0.7 + 7 * s * t * t;
            const rad = (1.9 * (1 - t) + 0.7) * s;
            pc.ellipse(fx, fy, rad, rad * 0.8, (x, y, nx, ny) => {
                const tone = 0.62 - 0.35 * ny - 0.25 * t + nx * 0.05;
                return leaves[quantize(tone, x, y, leaves.length, 0.4)];
            });
        }
    }
    const nutC = style.accent ?? 'earth';
    pc.set(Math.round(topX) - 1, topY + 2, nutC).set(Math.round(topX), topY + 3, nutC).set(Math.round(topX) + 1, topY + 2, nutC);
    pc.outline('ink');
    return { canvas: pc, trunkW };
}

/** Paint a tree from a preset name or any TreeStyle. Variants differ by `seed`. */
export function treeArt(kind: string | TreeStyle, seed = 1): TreeArt {
    const style = typeof kind === 'string' ? (TREE_PRESETS[kind] ?? TREE_PRESETS.oak) : kind;
    if (style.shape === 'cone') return coneTree(style, seed);
    if (style.shape === 'palm') return palmTree(style, seed);
    return roundTree(style, seed);
}

/** A leafy bush (no outline; the prop pipeline adds it). `berries` adds dots of any color. */
export function bushArt(leaves: readonly Color[] = ['pine', 'forest', 'leaf', 'grass', 'lime'], berries?: Color, seed = 3): PixelCanvas {
    const pc = new PixelCanvas(18, 14);
    const blobs = [{ x: 9, y: 8, r: 6 }, { x: 5.5, y: 9, r: 4.2 }, { x: 12.5, y: 9, r: 4.2 }, { x: 8, y: 5.5, r: 4.5 }];
    for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 18; x++) {
            let best = -1, ny = 0, nx = 0;
            for (const b of blobs) {
                const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r;
                const h = 1 - dx * dx - dy * dy;
                if (h > best) { best = h; nx = dx; ny = dy; }
            }
            if (best <= 0 || y > 12) continue;
            const tone = 0.5 + 0.3 * -(nx * -0.6 + ny * -0.8) - 0.25 * (y / 13) + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.2;
            pc.set(x, y, leaves[quantize(tone, x, y, leaves.length)]);
            if (berries && hash(x, y, seed) < 0.06 && y < 11) pc.set(x, y, berries);
        }
    }
    return pc;
}

/** A boulder in any stone ramp (darkest → lightest), no outline. */
export function rockArt(stone: readonly Color[] = ['slate', 'steel', 'mist', 'cloud'], moss?: Color, seed = 5): PixelCanvas {
    const pc = new PixelCanvas(16, 12);
    pc.ellipse(8, 6.5, 7, 5, (x, y, nx, ny) => {
        const tone = 0.55 - 0.32 * nx - 0.42 * ny + (hash(x, y, seed) - 0.5) * 0.12;
        if (moss && ny < -0.35 && hash(x, y, seed + 1) < 0.6) return moss;
        return stone[quantize(tone, x, y, stone.length, 0.4)];
    });
    pc.line(6, 4, 8, 7, stone[0]).line(8, 7, 7, 9, stone[0]);
    return pc;
}
