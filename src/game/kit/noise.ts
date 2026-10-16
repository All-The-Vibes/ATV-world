/** Deterministic noise, hashing, and ordered dithering helpers. */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 4x4 Bayer threshold in (0, 1). Use `t > bayer(x, y)` to pick the second color of a dithered mix. */
export const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

/** Integer hash → [0, 1). Stable across runs and machines. */
export function hash(x: number, y: number, seed = 0): number {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1]. */
export function valueNoise(x: number, y: number, scale: number, seed = 0): number {
    const fx = x / scale;
    const fy = y / scale;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash(x0, y0, seed);
    const b = hash(x0 + 1, y0, seed);
    const c = hash(x0, y0 + 1, seed);
    const d = hash(x0 + 1, y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal value noise in [0, 1]. */
export function fbm(x: number, y: number, scale: number, seed = 0, octaves = 3): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x, y, scale, seed + i * 101) * amp;
        norm += amp;
        amp *= 0.5;
        scale *= 0.5;
    }
    return sum / norm;
}

/** FNV-1a string hash → uint32. */
export function hashString(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** Small seeded PRNG (mulberry32) → () => [0, 1). */
export function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const pick = <T>(items: readonly T[], r: number): T => items[Math.min(items.length - 1, Math.floor(r * items.length))];
