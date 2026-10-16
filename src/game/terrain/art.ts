import { hash, rng, PixelCanvas, type Color } from '../kit';
import { GREENS } from './ground';
import { POND } from './layout';

/** Frames of every swaying plant: tips lean 0, 1, 0, -1 px (scaled by height). */
export const SWAY_FRAMES = 4;
const SWAY = [0, 1, 0, -1];

interface Blade {
    x: number;
    h: number;
    lean: number;
    colors: readonly Color[];
}

/** Draw blades (bottom-up, leaning) into frame `f` of a strip. */
function blades(pc: PixelCanvas, ox: number, H: number, list: readonly Blade[], f: number) {
    for (const b of list) {
        for (let j = 0; j < b.h; j++) {
            const t = j / b.h;
            const dx = Math.round(b.lean * t * t + SWAY[f] * t * t * 1.6);
            const c = b.colors[Math.min(b.colors.length - 1, Math.floor(t * b.colors.length))];
            pc.set(ox + b.x + dx, H - 1 - j, c);
        }
    }
}

/** A clump of tall meadow grass, 4 sway frames. Seeds vary its size, density and whether it flowers. */
export function tallGrassArt(seed: number): { canvas: PixelCanvas; w: number; h: number } {
    const w = 12 + (seed % 3) * 4, h = 9 + ((seed * 7) % 4) * 3;
    const r = rng(seed * 7919 + 13);
    const list: Blade[] = [];
    const n = 4 + Math.floor(w / 3) + Math.floor(r() * 4);
    const cx = (w - 1) / 2;
    for (let i = 0; i < n; i++) {
        const x = 2 + Math.round(r() * (w - 5));
        const hh = Math.round(h * (0.4 + r() * 0.6));
        const lean = (x - cx) * 0.45 + (r() - 0.5) * 2;
        const lightish = r() < 0.5;
        list.push({ x, h: hh, lean, colors: lightish ? [GREENS[2], GREENS[4], GREENS[5], GREENS[6]] : [GREENS[2], GREENS[3], GREENS[4], GREENS[5]] });
    }
    list.sort((a, b) => b.h - a.h);
    const flowers: Color[] | null = seed % 4 === 1 ? ['white', 'yellow'] : seed % 4 === 3 ? ['pink', 'violet'] : null;
    const pc = new PixelCanvas(w * SWAY_FRAMES, h + 1);
    for (let f = 0; f < SWAY_FRAMES; f++) {
        blades(pc, f * w, h + 1, list, f);
        // Seed heads (or little flowers) on the tallest stalks.
        list.slice(0, flowers ? 3 : 2).forEach((b, i) => {
            const t = 1;
            const dx = Math.round(b.lean * t + SWAY[f] * 1.6);
            const top = h + 1 - b.h;
            const x = f * w + b.x + dx;
            if (flowers) pc.set(x, top - 1, flowers[i % 2]).set(x + 1, top - 1, flowers[i % 2]).set(x, top - 2, flowers[(i + 1) % 2]);
            else pc.set(x, top, i ? 'sand' : 'cream').set(x, top - 1, 'sand');
        });
        pc.outline(GREENS[0], false, { x: f * w, y: 0, w, h: h + 1 });
    }
    return { canvas: pc, w, h: h + 1 };
}

/** Reeds and cattails for the pond edge, 4 sway frames of 16x24. */
export function reedsArt(seed: number): { canvas: PixelCanvas; w: number; h: number } {
    const w = 16, h = 24;
    const r = rng(seed * 104729 + 7);
    const list: Blade[] = [];
    for (let i = 0; i < 6; i++) {
        const x = 3 + Math.round(r() * 9);
        list.push({ x, h: 11 + Math.round(r() * 9), lean: (x - 7.5) * 0.6 + (r() - 0.5) * 2, colors: [GREENS[1], GREENS[3], GREENS[4], GREENS[6]] });
    }
    const tails = [
        { x: 6, h: 21, lean: -1 },
        { x: 10, h: 18, lean: 1.5 },
    ];
    const pc = new PixelCanvas(w * SWAY_FRAMES, h);
    for (let f = 0; f < SWAY_FRAMES; f++) {
        const ox = f * w;
        blades(pc, ox, h, tails.map((t) => ({ ...t, colors: [GREENS[1], GREENS[2]] })), f);
        for (const t of tails) {
            const dx = Math.round(t.lean + SWAY[f] * 1.6);
            const top = h - t.h;
            pc.rect(ox + t.x + dx, top + 1, 2, 5, 'earth').set(ox + t.x + dx, top + 1, 'wood').set(ox + t.x + dx, top + 2, 'wood');
            pc.set(ox + t.x + dx, top, GREENS[4]);
        }
        blades(pc, ox, h, list, f);
        pc.outline(GREENS[0], false, { x: ox, y: 0, w, h });
    }
    return { canvas: pc, w, h };
}

/** The pond's shimmer: frames of sparse light dashes over the water, the size of the pond's box. */
export function pondShimmerArt(isWater: (wx: number, wy: number) => boolean, frames = 6) {
    const w = Math.ceil(POND.rx * 2.4), h = Math.ceil(POND.ry * 2.6);
    const x0 = Math.round(POND.x - w / 2), y0 = Math.round(POND.y - h / 2);
    const pc = new PixelCanvas(w * frames, h);
    const r = rng(4242);
    const slots: { x: number; y: number; len: number; phase: number; deep: boolean }[] = [];
    for (let tries = 0; slots.length < 46 && tries < 4000; tries++) {
        const x = Math.floor(r() * w), y = Math.floor(r() * h);
        const len = 2 + Math.floor(r() * 4);
        let ok = true;
        for (let i = -1; i <= len + 1 && ok; i++) ok = isWater(x0 + x + i, y0 + y) && isWater(x0 + x + i, y0 + y - 4) && isWater(x0 + x + i, y0 + y + 2);
        if (!ok) continue;
        const rp = Math.hypot((x0 + x - POND.x) / POND.rx, (y0 + y - POND.y) / POND.ry);
        slots.push({ x, y, len, phase: r() * Math.PI * 2, deep: rp < 0.55 });
    }
    for (let f = 0; f < frames; f++) {
        for (const s of slots) {
            const a = s.phase + (f / frames) * Math.PI * 2;
            const b = Math.sin(a);
            if (b < 0.2) continue;
            const shift = Math.round(Math.cos(a) * 1.5);
            const len = b > 0.75 ? s.len : Math.max(1, s.len - 2);
            for (let i = 0; i < len; i++) {
                const c: Color = s.deep ? 'sky' : b > 0.8 && i === 1 ? 'ice' : 'cyan';
                pc.set(f * w + s.x + shift + i + (len < s.len ? 1 : 0), s.y, c);
            }
        }
    }
    return { canvas: pc, w, h, x0, y0, frames };
}

/** An expanding ripple ring, 5 frames of 18x9. */
export function rippleArt() {
    const w = 18, h = 9, frames = 5;
    const pc = new PixelCanvas(w * frames, h);
    for (let f = 0; f < frames; f++) {
        const rx = 2 + f * 1.7, ry = 1 + f * 0.8;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const nx = (x + 0.5 - w / 2) / rx, ny = (y + 0.5 - h / 2) / ry;
                const d = Math.hypot(nx, ny);
                if (Math.abs(d - 1) * Math.min(rx, ry * 2) < 0.6) {
                    if (f >= 3 && hash(x, y, f) < (f - 2) * 0.3) continue;
                    pc.set(f * w + x, y, ny < 0 ? (f < 2 ? 'ice' : 'cyan') : 'sky');
                }
            }
        }
    }
    return { canvas: pc, w, h, frames };
}

/** A butterfly-sized sparkle: the sun catching the water. 3 frames of 5x5. */
export function glintArt() {
    const pc = new PixelCanvas(15, 5);
    pc.set(2, 2, 'white');
    pc.set(7, 2, 'white').set(6, 2, 'ice').set(8, 2, 'ice').set(7, 1, 'ice').set(7, 3, 'ice');
    pc.set(12, 2, 'white').set(10, 2, 'cyan').set(11, 2, 'ice').set(13, 2, 'ice').set(14, 2, 'cyan').set(12, 0, 'cyan').set(12, 1, 'ice').set(12, 3, 'ice').set(12, 4, 'cyan');
    return pc;
}
