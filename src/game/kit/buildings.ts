import { miniText, miniTextWidth } from './font';
import { bayer, hash, rng } from './noise';
import { darker, lighter, toRamp, type Color, type RampLike } from './palette';
import { PixelCanvas } from './pixels';

/** Built-in building looks. 'none' gives you a blank canvas to paint with `draw`. */
export type BuildingStyle = 'house' | 'shop' | 'brick' | 'tower' | 'hall' | 'none';

export interface BuildingSpec {
    /** Size in tiles (16px). Any size. */
    w: number;
    h: number;
    style?: BuildingStyle;
    roof?: RampLike;
    wall?: RampLike;
    /** Window frames / columns color. */
    trim?: Color;
    door?: 'left' | 'center' | 'right' | number | false;
    doorColor?: Color;
    windows?: boolean;
    chimney?: boolean;
    /** Shop awning stripes (shops get one by default). */
    awning?: RampLike | false;
    /** Short label painted on a plank with the 3x5 mini font. */
    sign?: string;
    seed?: number;
    /** Paint anything on top (or everything, with style 'none'). Called before the outline. */
    draw?: (pc: PixelCanvas, info: BuildingInfo) => void;
    /** Outline color, or false for none. */
    outline?: Color | false;
}

export interface BuildingInfo {
    W: number;
    H: number;
    /** y where the front wall starts (roof above). */
    wallTop: number;
    /** Door rectangle in px, or null when there is no door. */
    door: { x: number; y: number; w: number; h: number } | null;
}

function fitRow(a: number, b: number, size: number, gap: number): number[] {
    const n = Math.floor((b - a + gap) / (size + gap));
    if (n <= 0) return [];
    const total = n * size + (n - 1) * gap;
    const start = a + Math.floor((b - a - total) / 2);
    return Array.from({ length: n }, (_, i) => start + i * (size + gap));
}

function windowAt(pc: PixelCanvas, x: number, y: number, w: number, h: number, trim: Color, shutters?: readonly [Color, Color, Color]) {
    pc.rect(x, y, w, h, trim);
    for (let j = 1; j < h - 1; j++) {
        for (let i = 1; i < w - 1; i++) {
            const lower = j > (h - 2) / 2;
            pc.set(x + i, y + j, lower && bayer(x + i, y + j) < 0.5 ? 'blue' : 'sky');
        }
    }
    pc.set(x + 1, y + 1, 'ice').set(x + 2, y + 1, 'ice').set(x + 1, y + 2, 'ice');
    if (w >= 8) pc.rect(x + Math.floor(w / 2), y + 1, 1, h - 2, trim);
    if (h >= 8) pc.rect(x + 1, y + Math.floor(h / 2), w - 2, 1, trim);
    pc.rect(x - 1, y + h, w + 2, 1, darker(trim));
    if (shutters) {
        for (const sx of [x - 3, x + w + 1]) {
            pc.rect(sx, y, 2, h, shutters[1]);
            for (let j = 1; j < h; j += 2) pc.rect(sx, y + j, 2, 1, shutters[0]);
        }
    }
}

function doorAt(pc: PixelCanvas, x: number, y: number, w: number, h: number, color: Color, trim: Color, arched: boolean) {
    pc.rect(x - 1, y - 1, w + 2, h + 1, trim);
    const [d, b, l] = toRamp(color);
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            if (arched && j < 2 && (i < 2 - j || i >= w - 2 + j)) continue;
            pc.set(x + i, y + j, i % 3 === 2 ? d : i === 0 ? l : b);
        }
    }
    if (!arched && h > 10) pc.rect(x + 2, y + 2, w - 4, 3, 'sky').set(x + 2, y + 2, 'ice');
    pc.set(x + w - 3, y + Math.floor(h / 2) + 1, 'gold');
}

function plank(pc: PixelCanvas, cx: number, y: number, text: string) {
    const tw = miniTextWidth(text);
    const x = Math.round(cx - tw / 2) - 3;
    pc.rect(x, y, tw + 6, 9, 'wood').rect(x, y, tw + 6, 1, 'clay').rect(x, y + 8, tw + 6, 1, 'earth');
    pc.set(x + 1, y + 1, 'steel').set(x + tw + 4, y + 1, 'steel');
    miniText(pc, x + 3, y + 2, text, 'cream');
}

/** Paint a building of any size. Everything is optional except w/h. */
export function buildingArt(spec: BuildingSpec): { canvas: PixelCanvas; info: BuildingInfo } {
    const W = Math.max(8, Math.round(spec.w * 16));
    const H = Math.max(8, Math.round(spec.h * 16));
    const pc = new PixelCanvas(W, H);
    const style = spec.style ?? 'house';
    const seed = spec.seed ?? 1;
    const r = rng(seed);
    const tower = style === 'tower';
    const wallTop = tower ? 9 : Math.max(8, H - Math.max(18, Math.min(Math.round(H * 0.46), 64)));
    const info: BuildingInfo = { W, H, wallTop, door: null };

    if (style === 'none') {
        spec.draw?.(pc, info);
        if (spec.outline !== false) pc.outline(spec.outline ?? 'ink');
        return { canvas: pc, info };
    }

    const roof = toRamp(spec.roof ?? (tower || style === 'hall' ? 'stone' : 'red'));
    const wall = toRamp(spec.wall ?? (style === 'brick' ? 'red' : tower ? 'stone' : style === 'hall' ? 'white' : 'cream'));
    const trim = spec.trim ?? 'white';
    const [w0, w1, w2] = wall;
    const [r0, r1, r2] = roof;
    const wx0 = tower ? 1 : 2, wx1 = W - (tower ? 2 : 3);
    const wy1 = H - 2;

    // Front wall
    const blockRows: number[][] = [];
    for (let y = wallTop; y <= wy1; y++) {
        const wy = y - wallTop;
        for (let x = wx0; x <= wx1; x++) {
            let c: Color = w1;
            if (style === 'house' || style === 'shop') {
                const k = wy % 4;
                c = k === 3 ? w0 : k === 0 && bayer(x, y) < 0.5 ? w2 : w1;
            } else if (style === 'brick') {
                const course = Math.floor(wy / 4);
                const k = wy % 4;
                const joint = (x + (course % 2) * 4) % 8 === 0;
                c = k === 3 || joint ? w0 : k === 0 && hash(x >> 3, course, seed) < 0.5 ? w2 : w1;
            } else {
                const course = Math.floor(wy / 6);
                if (!blockRows[course]) {
                    const edges: number[] = [];
                    for (let e = wx0 - Math.floor(r() * 10); e <= wx1; e += 9 + Math.floor(r() * 6)) edges.push(e);
                    blockRows[course] = edges;
                }
                const edges = blockRows[course];
                const joint = edges.includes(x);
                const block = edges.filter((e) => e <= x).length;
                const k = wy % 6;
                c = k === 5 || joint ? w0 : hash(block, course, seed) < 0.3 ? w2 : k === 0 ? w2 : w1;
            }
            if (x <= wx0) c = w2;
            if (x >= wx1 - 1) c = w0;
            pc.set(x, y, c);
        }
    }

    // Hall columns
    if (style === 'hall') {
        for (let x = wx0 + 4; x + 4 <= wx1 - 3; x += 14) {
            pc.rect(x, wallTop + 3, 5, wy1 - wallTop - 5, 'cloud').rect(x, wallTop + 3, 1, wy1 - wallTop - 5, 'white').rect(x + 4, wallTop + 3, 1, wy1 - wallTop - 5, 'mist');
            pc.rect(x - 1, wallTop + 2, 7, 2, 'white').rect(x - 1, wy1 - 3, 7, 2, 'mist');
        }
    }

    // Foundation
    if (!tower) {
        pc.rect(wx0, wy1 - 2, wx1 - wx0 + 1, 3, 'steel').rect(wx0, wy1 - 2, wx1 - wx0 + 1, 1, 'mist').rect(wx0, wy1, wx1 - wx0 + 1, 1, 'slate');
    }

    // Roof (or battlements for towers)
    if (tower) {
        for (let x = wx0; x <= wx1; x++) {
            const merlon = Math.floor((x - wx0) / 4) % 2 === 0;
            for (let y = 1; y < wallTop; y++) {
                if (y < 5 && !merlon) continue;
                pc.set(x, y, y === 1 || (y === 5 && !merlon) ? w2 : y >= wallTop - 2 ? w0 : x <= wx0 + 1 ? w2 : x >= wx1 - 1 ? w0 : w1);
            }
        }
    } else {
        const top = 1, bottom = wallTop + 1;
        for (let y = top; y <= bottom; y++) {
            const t = (y - top) / Math.max(1, bottom - top);
            const course = Math.floor((y - top - 2) / 4);
            const k = (y - top - 2) % 4;
            const off = (course % 2) * 4;
            for (let x = 1; x <= W - 2; x++) {
                let c: Color = r1;
                if (y - top < 2) c = (x >> 1) % 3 === 0 ? r1 : r2;
                else if (k === 3) c = r0;
                else if ((x + off) % 8 === 0 && k > 0) c = r0;
                else if (k === 0 && (x + off) % 8 === 1) c = r2;
                else if (t < 0.3 && bayer(x, y) < (0.3 - t) * 2.2) c = r2;
                else if (t > 0.78 && bayer(x, y) < (t - 0.78) * 2.5) c = r0;
                if (x <= 2) c = y - top < 2 ? r2 : r1;
                if (x >= W - 4) c = r0;
                if (y >= bottom - 1) c = y === bottom ? darker(r0) : r0;
                pc.set(x, y, c);
            }
        }
        // Eave shadow on the wall
        for (let x = wx0; x <= wx1; x++) {
            pc.set(x, wallTop + 2, w0);
            if (bayer(x, wallTop + 3) < 0.5) pc.set(x, wallTop + 3, w0);
        }
        const chimney = spec.chimney ?? ((style === 'house' || style === 'brick') && W >= 48 && wallTop >= 18);
        if (chimney) {
            const cx = Math.round(W * 0.72) + Math.floor(r() * 4) - 2;
            pc.rect(cx, 3, 6, 9, 'red').rect(cx, 3, 1, 9, 'orange').rect(cx + 5, 3, 1, 9, 'wine');
            for (let y = 5; y < 12; y += 3) pc.rect(cx, y, 6, 1, 'wine');
            pc.rect(cx - 1, 1, 8, 2, 'slate').rect(cx - 1, 1, 8, 1, 'steel');
            pc.rect(cx, 12, 6, 1, darker(r0));
        }
    }

    // Door
    const wallH = wy1 - wallTop;
    const doorW = tower ? 8 : 10;
    const doorH = Math.max(8, Math.min(tower ? 14 : 16, wallH - 5));
    let doorX: number | null = null;
    const door = spec.door ?? 'center';
    if (door !== false) {
        doorX = door === 'left' ? Math.max(wx0 + 6, Math.round(W * 0.25 - doorW / 2))
            : door === 'right' ? Math.min(wx1 - 6 - doorW, Math.round(W * 0.75 - doorW / 2))
            : door === 'center' ? Math.round(W / 2 - doorW / 2)
            : Math.round((door + 0.5) * 16 - doorW / 2);
        doorX = Math.max(wx0 + 2, Math.min(wx1 - 2 - doorW, doorX));
        const doorY = wy1 - doorH + 1;
        info.door = { x: doorX, y: doorY, w: doorW, h: doorH };
    }

    // Windows
    const shopAwning = style === 'shop' && spec.awning !== false;
    if (spec.windows !== false) {
        const big = style === 'shop';
        const ww = tower ? 5 : big ? 18 : 10;
        const wh = tower ? 8 : Math.max(6, Math.min(big ? 14 : 10, wallH - (shopAwning ? 16 : 10)));
        const floors = tower ? Math.max(1, Math.floor((wallH - doorH - 6) / 20)) : 1;
        const shutters = style === 'house' ? roof : undefined;
        const pad = shutters ? 6 : 4;
        for (let fl = 0; fl < floors; fl++) {
            const wy = tower ? wallTop + 6 + fl * 20 : wallTop + 4 + (shopAwning ? 7 : 0) + Math.max(0, Math.floor((wallH - 9 - (shopAwning ? 7 : 0) - wh) / 2));
            const spans: [number, number][] = [];
            const nearDoor = info.door && (tower ? fl === floors - 1 && wy + wh > info.door.y - 2 : true);
            if (info.door && nearDoor) {
                spans.push([wx0 + pad, info.door.x - pad - 2], [info.door.x + doorW + pad + 2, wx1 - pad]);
            } else {
                spans.push([wx0 + pad, wx1 - pad]);
            }
            for (const [a, b] of spans) for (const x of fitRow(a, b, ww, shutters ? 12 : 8)) windowAt(pc, x, wy, ww, wh, trim, shutters);
        }
    }

    // Shop awning
    if (shopAwning) {
        const [a0, a1] = toRamp(spec.awning || roof[1]);
        const ay = wallTop + 3;
        for (let y = ay; y < ay + 6; y++) {
            for (let x = wx0; x <= wx1; x++) {
                if (y === ay + 5 && (x - wx0) % 4 === 3) continue;
                pc.set(x, y, y === ay ? a0 : Math.floor((x - wx0) / 4) % 2 === 0 ? a1 : 'white');
            }
        }
        for (let x = wx0; x <= wx1; x++) if ((x - wx0) % 4 !== 3 && bayer(x, ay + 6) < 0.6) pc.set(x, ay + 6, w0);
    }

    if (info.door) doorAt(pc, info.door.x, info.door.y, info.door.w, info.door.h, spec.doorColor ?? r0, trim, tower);

    if (spec.sign) {
        const text = spec.sign.slice(0, Math.max(1, Math.floor((W - 12) / 4)));
        plank(pc, info.door ? info.door.x + doorW / 2 : W / 2, Math.max(2, wallTop - 6), text);
    }

    spec.draw?.(pc, info);
    if (spec.outline !== false) pc.outline(spec.outline ?? 'ink');
    void lighter;
    return { canvas: pc, info };
}
