import { darker, lighter, type ColorName } from './palette';
import { PixelCanvas } from './pixels';
import { bayer, hash } from './noise';
import type { FrameRect } from './textures';

/** Disco floor tiles are 16x12 on screen (a 15x11 panel plus 1px of grout). */
export const DISCO_TILE_W = 16;
export const DISCO_TILE_H = 12;
/** The colors floor tiles, beams, and glitter-ball specks light up in. */
export const DISCO_COLORS = ['pink', 'cyan', 'gold', 'violet', 'lime', 'orange', 'sky'] as const satisfies readonly ColorName[];
export type DiscoColor = (typeof DISCO_COLORS)[number];

/** One 15x11 floor panel: glowing `color` brightest in the middle, or unlit glass when `color` is null. */
export function discoTileArt(color: DiscoColor | null): PixelCanvas {
    const pc = new PixelCanvas(DISCO_TILE_W - 1, DISCO_TILE_H - 1);
    const { width: w, height: h } = pc;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
            if (color) pc.mix(x, y, color, lighter(color), 1.1 - d);
            else pc.mix(x, y, 'night', 'plum', 0.45 - d * 0.4);
        }
    }
    const edge = color ? darker(color) : 'ink';
    pc.rect(0, h - 1, w, 1, edge).rect(w - 1, 0, 1, h, edge);
    pc.rect(0, 0, w - 1, 1, color ? 'white' : 'slate').rect(0, 0, 1, h - 1, color ? lighter(color) : 'slate');
    if (color) pc.set(2, 2, 'white').set(3, 2, 'white').set(2, 3, 'white');
    return pc;
}

/** The floor's grout and chrome front lip, for `cols` x `rows` tiles. Tiles sit at (1 + c*16, 1 + r*12). */
export function discoFloorArt(cols: number, rows: number): PixelCanvas {
    const w = cols * DISCO_TILE_W + 1;
    const top = rows * DISCO_TILE_H + 1;
    const pc = new PixelCanvas(w, top + 4);
    pc.rect(0, 0, w, top, 'ink');
    pc.rect(0, top, w, 1, 'cloud').rect(0, top + 1, w, 1, 'mist').rect(0, top + 2, w, 1, 'steel').rect(0, top + 3, w, 1, 'slate');
    for (let x = 3; x < w - 2; x += 6) pc.set(x, top + 1, 'white');
    return pc;
}

/**
 * The lighting rig: two truss towers joined by a truss beam, with spot cans under the beam and a chain down
 * to where the glitter ball hangs. `span` is the outside width; the ball's top is at `info.ball`.
 */
export function discoRigArt(span: number, height: number): { canvas: PixelCanvas; info: { ball: { x: number; y: number }; cans: { x: number; y: number }[] } } {
    const pc = new PixelCanvas(span, height);
    const tower = (x0: number) => {
        pc.rect(x0, 2, 1, height - 4, 'mist').rect(x0 + 4, 2, 1, height - 4, 'steel');
        for (let y = 4; y < height - 3; y += 4) pc.line(x0 + 1, y, x0 + 3, y + 3, 'steel');
        pc.rect(x0 - 1, height - 3, 7, 3, 'slate').rect(x0 - 1, height - 3, 7, 1, 'steel');
    };
    tower(1);
    tower(span - 6);
    pc.rect(1, 1, span - 2, 1, 'cloud').rect(1, 6, span - 2, 1, 'steel');
    for (let x = 2; x < span - 4; x += 5) pc.line(x, 2, x + 4, 5, 'mist');
    pc.rect(0, 0, 7, 8, 'slate').rect(1, 1, 5, 6, 'steel').rect(span - 7, 0, 7, 8, 'slate').rect(span - 6, 1, 5, 6, 'steel');

    const cx = Math.floor(span / 2);
    const ball = { x: cx, y: 22 };
    for (let y = 7; y < ball.y; y++) pc.set(cx, y, y % 2 ? 'mist' : 'steel');

    const cans = [Math.round(span * 0.22), Math.round(span * 0.78)].map((x) => {
        pc.rect(x - 2, 7, 5, 4, 'slate').rect(x - 1, 7, 3, 1, 'steel').rect(x - 2, 11, 5, 1, 'ink');
        return { x: x + 0.5, y: 11 };
    });
    pc.outline('ink');
    return { canvas: pc, info: { ball, cans } };
}

const BALL = 18;
const BALL_RAMP: ColorName[] = ['night', 'slate', 'steel', 'mist', 'cloud', 'white'];

/** A mirrored glitter ball, `frames` steps of one facet's turn (loop them to spin it). 18x18 per frame. */
export function glitterBallArt(frames = 6): { canvas: PixelCanvas; frames: FrameRect[] } {
    const pc = new PixelCanvas(BALL * frames, BALL);
    const r = BALL / 2 - 0.5;
    const columns = 14;
    const light = { x: -0.5, y: -0.62, z: 0.6 };
    for (let f = 0; f < frames; f++) {
        const ox = f * BALL;
        for (let y = 0; y < BALL; y++) {
            for (let x = 0; x < BALL; x++) {
                const nx = (x + 0.5 - BALL / 2) / r;
                const ny = (y + 0.5 - BALL / 2) / r;
                const rr = nx * nx + ny * ny;
                if (rr > 1) continue;
                const nz = Math.sqrt(1 - rr);
                const lon = (Math.atan2(nx, nz) / (Math.PI * 2)) * columns + f / frames;
                const lat = (Math.asin(ny) / Math.PI) * 9;
                const col = Math.floor(lon), row = Math.floor(lat);
                const sheen = Math.max(0, nx * light.x + ny * light.y + nz * light.z);
                const jitter = hash(((col % columns) + columns) % columns, row, 7);
                const checker = (col + row) & 1 ? 0.12 : 0;
                let level = Math.round((sheen * 0.85 + jitter * 0.4 + checker) * (BALL_RAMP.length - 1) - 0.6);
                level = Math.max(0, Math.min(BALL_RAMP.length - 1, level));
                let c: ColorName = BALL_RAMP[level];
                if (jitter > 0.93) c = 'white';
                else if (jitter > 0.88) c = sheen > 0.3 ? 'ice' : 'cyan';
                else if (jitter < 0.05) c = 'pink';
                pc.set(ox + x, y, c);
            }
        }
        pc.rect(ox + 7, 0, 4, 1, 'steel');
    }
    pc.outline('ink');
    return {
        canvas: pc,
        frames: Array.from({ length: frames }, (_, i) => ({ name: i, x: i * BALL, y: 0, w: BALL, h: BALL })),
    };
}

/** A four-point twinkle that pops on the glitter ball (7x7). */
export function discoSparkleArt(): PixelCanvas {
    return new PixelCanvas(7, 7)
        .rect(3, 0, 1, 7, 'ice').rect(0, 3, 7, 1, 'ice')
        .rect(3, 2, 1, 3, 'white').rect(2, 3, 3, 1, 'white');
}

/** A reflected spot of light thrown by the ball (3x3 diamond). */
export function discoSpeckArt(color: DiscoColor | 'white'): PixelCanvas {
    return new PixelCanvas(3, 3).set(1, 0, color).set(0, 1, color).set(2, 1, color).set(1, 2, color).set(1, 1, 'white');
}

/** A soft, dithered cone of light from a spot can, apex at top center (use with ADD blending). */
export function discoBeamArt(color: DiscoColor, w = 28, h = 72): PixelCanvas {
    const pc = new PixelCanvas(w, h);
    for (let y = 0; y < h; y++) {
        const half = 1 + (y / h) * (w / 2 - 1);
        for (let x = 0; x < w; x++) {
            const d = Math.abs(x + 0.5 - w / 2) / half;
            if (d > 1) continue;
            const t = (1 - d * d) * (1 - (y / h) * 0.55);
            if (t > bayer(x, y)) pc.set(x, y, d < 0.3 && y < h * 0.5 ? lighter(color) : color);
        }
    }
    return pc;
}

/** A soft round halo (use with ADD blending): the ball's shine, or a pool of light on the floor. */
export function discoGlowArt(color: ColorName, rx: number, ry = rx): PixelCanvas {
    const w = Math.ceil(rx * 2), h = Math.ceil(ry * 2);
    const pc = new PixelCanvas(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const d = Math.hypot((x + 0.5 - rx) / rx, (y + 0.5 - ry) / ry);
            if (d < 1 && (1 - d) ** 1.6 > bayer(x, y)) pc.set(x, y, color);
        }
    }
    return pc;
}
