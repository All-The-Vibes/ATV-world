import type { Color } from './palette';
import { PixelCanvas } from './pixels';
import { stripFrames, type FrameRect } from './textures';

/** One frame of the dragon sheet. The art faces right; flip it to fly left. */
export const DRAGON_W = 48;
export const DRAGON_H = 36;
/** Where the fire comes out, in frame pixels. */
export const DRAGON_MOUTH = { x: 47, y: 13 };
/** Wings up, level, down, level. */
export const DRAGON_FRAMES = 4;

type Pt = readonly [number, number];

function triangle(pc: PixelCanvas, a: Pt, b: Pt, c: Pt, color: Color) {
    const minX = Math.floor(Math.min(a[0], b[0], c[0])), maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
    const minY = Math.floor(Math.min(a[1], b[1], c[1])), maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
    const edge = (p: Pt, q: Pt, x: number, y: number) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5, py = y + 0.5;
            const e0 = edge(a, b, px, py), e1 = edge(b, c, px, py), e2 = edge(c, a, px, py);
            if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) pc.set(x, y, color);
        }
    }
}

/** Wing joints for each flap pose: elbow, tip, and two points along the trailing edge. */
const WINGS: Record<'up' | 'mid' | 'down', { elbow: Pt; tip: Pt; m1: Pt; m2: Pt }> = {
    up: { elbow: [24, 5], tip: [15, 0], m1: [11, 6], m2: [9, 12] },
    mid: { elbow: [19, 9], tip: [4, 8], m1: [6, 13], m2: [9, 17] },
    down: { elbow: [22, 27], tip: [14, 33], m1: [10, 29], m2: [9, 24] },
};

function wing(pc: PixelCanvas, pose: keyof typeof WINGS, dx: number, dy: number, membrane: Color, bone: Color) {
    const at = (p: Pt): Pt => [p[0] + dx, p[1] + dy];
    const { elbow, tip, m1, m2 } = WINGS[pose];
    const S = at([22, 17]), R = at([13, 18]), E = at(elbow), T = at(tip), M1 = at(m1), M2 = at(m2);
    triangle(pc, S, E, T, membrane);
    triangle(pc, S, T, M1, membrane);
    triangle(pc, S, M1, M2, membrane);
    triangle(pc, S, M2, R, membrane);
    pc.line(S[0], S[1], E[0], E[1], bone).line(E[0], E[1], T[0], T[1], bone);
    pc.line(E[0], E[1], M1[0], M1[1], bone).line(E[0], E[1], M2[0], M2[1], bone);
}

function drawDragon(pose: keyof typeof WINGS): PixelCanvas {
    const pc = new PixelCanvas(DRAGON_W - 2, DRAGON_H - 2);

    wing(pc, pose, 3, -1, 'wine', 'bark');

    // Tail, curling up into a spade.
    for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = (1 - t) ** 2 * 10 + 2 * (1 - t) * t * 1 + t * t * 2;
        const y = (1 - t) ** 2 * 21 + 2 * (1 - t) * t * 25 + t * t * 14;
        pc.ellipse(x, y, 2.6 - t * 1.4, 2.6 - t * 1.4, t < 0.5 ? 'red' : 'wine');
    }
    triangle(pc, [0, 14], [4, 12], [2, 9], 'red');

    pc.rect(14, 23, 3, 4, 'wine').rect(14, 27, 4, 1, 'cream');
    pc.rect(25, 23, 3, 4, 'wine').rect(25, 27, 4, 1, 'cream');

    pc.ellipse(20, 20, 11, 5.5, (x, y, _nx, ny) => {
        if (ny > 0.35) return (x + y) % 3 === 0 ? 'orange' : 'gold';
        if (ny < -0.55) return (x % 2 === 0 ? 'orange' : 'red');
        return 'red';
    });
    for (let x = 12; x <= 28; x += 3) pc.set(x, 14, 'gold');

    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const x = 29 + t * 8, y = 18 - t * 6;
        pc.ellipse(x, y, 3.2 - t * 0.7, 3.2 - t * 0.7, 'red');
        pc.set(x + 1, y + 2, 'gold');
    }
    pc.line(34, 8, 31, 3, 'cream').line(36, 8, 34, 4, 'sand');
    pc.ellipse(38, 11, 4.5, 3.5, 'red');
    pc.rect(40, 10, 6, 3, 'red').rect(40, 13, 4, 1, 'gold');
    pc.set(45, 10, 'wine').line(41, 12, 45, 12, 'wine');
    pc.set(38, 9, 'yellow').set(39, 9, 'ink').set(37, 8, 'wine').set(38, 8, 'wine');

    wing(pc, pose, 0, 0, 'orange', 'wine');
    return pc;
}

/** A red dragon flapping its wings: 4 frames named 0..3. */
export function dragonSheet(): { canvas: PixelCanvas; frames: FrameRect[] } {
    const pc = new PixelCanvas(DRAGON_W * DRAGON_FRAMES, DRAGON_H);
    (['up', 'mid', 'down', 'mid'] as const).forEach((pose, i) => {
        const frame = new PixelCanvas(DRAGON_W, DRAGON_H).blit(drawDragon(pose), 1, 1).outline('ink');
        pc.blit(frame, i * DRAGON_W, 0);
    });
    return { canvas: pc, frames: stripFrames(DRAGON_FRAMES, DRAGON_W, DRAGON_H) };
}

/** A fireball that burns from white-hot down to smoke: 4 frames of 11x11. */
export function flameArt(): { canvas: PixelCanvas; frames: FrameRect[] } {
    const S = 11;
    const stages: [number, Color, Color, Color][] = [
        [3.5, 'gold', 'yellow', 'white'],
        [5, 'orange', 'gold', 'yellow'],
        [5, 'red', 'orange', 'gold'],
        [4, 'slate', 'steel', 'mist'],
    ];
    const pc = new PixelCanvas(S * stages.length, S);
    stages.forEach(([r, outer, mid, core], i) => {
        pc.ellipse(i * S + 5.5, 5.5, r, r, (x, y, nx, ny) => {
            const d = Math.hypot(nx, ny);
            if (d > 0.8 && (x * 7 + y * 3) % 4 === 0) return null;
            return d < 0.4 ? core : d < 0.7 ? mid : outer;
        });
    });
    return { canvas: pc, frames: stripFrames(stages.length, S, S) };
}

/** A grey puff of smoke, 7x7. */
export function smokeArt(): PixelCanvas {
    return new PixelCanvas(7, 7).ellipse(3.5, 3.5, 3.5, 3.5, (_x, _y, nx, ny) => (nx + ny < -0.4 ? 'cloud' : 'mist'));
}

/** Hair on fire: 2 flickering frames of 9x10. */
export function hairFlameArt(): { canvas: PixelCanvas; frames: FrameRect[] } {
    const W = 9, H = 10;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        for (let y = 0; y < H; y++) {
            const half = Math.round(Math.sin((y / H) * Math.PI * 0.85) * 4);
            const lean = f === 0 ? Math.round((H - y) / 5) : -Math.round((H - y) / 6);
            for (let x = -half; x <= half; x++) {
                const edge = Math.abs(x) / Math.max(1, half);
                const c: Color = edge > 0.66 || y < 3 ? 'red' : edge > 0.3 || y < 5 ? 'orange' : 'yellow';
                pc.set(f * W + 4 + x + lean, y, c);
            }
        }
    }
    return { canvas: pc, frames: stripFrames(2, W, H) };
}
