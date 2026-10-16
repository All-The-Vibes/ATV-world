import { characterPortrait, randomLook, type CharacterLook } from './characters';
import { miniText, miniTextWidth } from './font';
import { bushArt, rockArt } from './nature';
import { hash } from './noise';
import { lighter, toRamp, type Color, type RampLike } from './palette';
import { asciiSize, DEFAULT_LEGEND, PixelCanvas, type Legend } from './pixels';

/** Per-instance options, e.g. `{ color: 'blue' }` or `{ text: 'BAKERY' }`. Props decide what they read. */
export type PropOptions = Record<string, unknown>;

type Sized = number | ((opts: PropOptions) => number);

/**
 * A prop is anything placeable: drawn with code (`draw`) or ASCII (`art`), any size, any colors,
 * optionally animated. Register your own with `defineProp(name, def)` (or pass a def inline).
 */
export interface PropDef {
    /** Art size in px (defaults to the ASCII art size). A 1px outline pad is added automatically. */
    w?: Sized;
    h?: Sized;
    frames?: number;
    fps?: number;
    /** Collision footprint [w, h] in px, centered at the bottom. `false` = walk-through. Default [w, min(h, 6)]. */
    solid?: readonly [number, number] | false | ((opts: PropOptions, w: number, h: number) => readonly [number, number] | false);
    /** Outline color, or false for none. Default 'ink'. */
    outline?: Color | false;
    /** Shadow width in px (false = none). Default ≈ width. */
    shadow?: number | false;
    /** Paint frame `frame` into the box at (x, y). */
    draw?: (pc: PixelCanvas, frame: number, x: number, y: number, opts: PropOptions) => void;
    /** ASCII art: one string[] for a still, or string[][] for frames. */
    art?: readonly string[] | readonly (readonly string[])[];
    legend?: Legend;
}

export interface PaintedProp {
    canvas: PixelCanvas;
    frameW: number;
    frameH: number;
    frames: number;
    fps: number;
    solid: readonly [number, number] | false;
    shadow: number | false;
}

const isFrames = (art: PropDef['art']): art is readonly (readonly string[])[] => Array.isArray(art?.[0]);

/** Paint a prop into a horizontal strip of outlined frames. */
export function paintProp(def: PropDef, opts: PropOptions = {}): PaintedProp {
    const artFrames = def.art ? (isFrames(def.art) ? def.art : [def.art as readonly string[]]) : [];
    const artSize = artFrames.length ? asciiSize(artFrames[0]) : { w: 16, h: 16 };
    const resolve = (v: Sized | undefined, fallback: number) => Math.max(1, Math.round(typeof v === 'function' ? v(opts) : v ?? fallback));
    const w = resolve(def.w, artSize.w);
    const h = resolve(def.h, artSize.h);
    const frames = Math.max(1, def.frames ?? (artFrames.length || 1));
    const fw = w + 2, fh = h + 2;
    const pc = new PixelCanvas(fw * frames, fh);
    for (let f = 0; f < frames; f++) {
        if (def.draw) def.draw(pc, f, f * fw + 1, 1, opts);
        else if (artFrames.length) pc.ascii(f * fw + 1, 1, artFrames[f % artFrames.length], def.legend ?? DEFAULT_LEGEND);
        if (def.outline !== false) pc.outline(def.outline ?? 'ink', false, { x: f * fw, y: 0, w: fw, h: fh });
    }
    const solid = typeof def.solid === 'function' ? def.solid(opts, w, h) : def.solid ?? [w, Math.min(h, 6)];
    return { canvas: pc, frameW: fw, frameH: fh, frames, fps: def.fps ?? 6, solid, shadow: def.shadow ?? w };
}

const opt = <T>(o: PropOptions, k: string, d: T): T => (o[k] ?? d) as T;

const lamp: PropDef = {
    w: 8, h: 30, solid: [4, 3], shadow: 8,
    draw(pc, _f, x, y, o) {
        const glow = opt<Color>(o, 'color', 'gold');
        pc.set(x + 3, y, 'night').set(x + 4, y, 'night');
        pc.rect(x + 1, y + 1, 6, 1, 'night').rect(x, y + 2, 8, 1, 'slate');
        pc.rect(x + 1, y + 3, 6, 5, glow).rect(x + 2, y + 4, 4, 3, lighter(glow)).set(x + 3, y + 4, 'white');
        pc.rect(x + 1, y + 3, 1, 5, 'night').rect(x + 6, y + 3, 1, 5, 'night').rect(x + 1, y + 8, 6, 1, 'slate');
        pc.rect(x + 3, y + 9, 2, 17, 'night').rect(x + 3, y + 9, 1, 17, 'slate');
        pc.rect(x + 1, y + 26, 6, 3, 'slate').rect(x + 1, y + 26, 6, 1, 'steel').rect(x, y + 29, 8, 1, 'night');
    },
};

const bench: PropDef = {
    w: 22, h: 12, solid: [22, 5],
    draw(pc, _f, x, y, o) {
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'wood'));
        pc.rect(x + 2, y, 2, 8, d).rect(x + 18, y, 2, 8, d);
        for (const yy of [y + 1, y + 4]) pc.rect(x + 1, yy, 20, 2, b).rect(x + 1, yy, 20, 1, l);
        pc.rect(x, y + 7, 22, 3, b).rect(x, y + 7, 22, 1, l).rect(x, y + 9, 22, 1, d);
        pc.rect(x + 2, y + 10, 2, 2, 'night').rect(x + 18, y + 10, 2, 2, 'night');
    },
};

const sign: PropDef = {
    w: 16, h: 16, solid: [4, 3], shadow: 8,
    draw(pc, _f, x, y, o) {
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'wood'));
        pc.rect(x + 7, y + 9, 2, 7, d).rect(x + 7, y + 9, 1, 7, b);
        pc.rect(x, y + 1, 16, 9, b).rect(x, y + 1, 16, 1, l).rect(x, y + 9, 16, 1, d);
        pc.rect(x, y + 1, 1, 9, d).rect(x + 15, y + 1, 1, 9, d);
        pc.rect(x + 3, y + 3, 10, 1, 'bark').rect(x + 3, y + 5, 7, 1, 'bark').rect(x + 3, y + 7, 9, 1, 'bark');
    },
};

const saleSign: PropDef = {
    w: 22, h: 20, solid: [20, 3], shadow: 18,
    draw(pc, _f, x, y) {
        pc.rect(x + 3, y + 14, 2, 6, 'wood').rect(x + 17, y + 14, 2, 6, 'wood');
        pc.rect(x + 3, y + 14, 1, 6, 'clay').rect(x + 17, y + 14, 1, 6, 'clay');
        pc.rect(x, y, 22, 15, 'red').rect(x + 1, y + 1, 20, 13, 'white').rect(x + 1, y + 13, 20, 1, 'cloud');
        miniText(pc, x + 6, y + 2, 'FOR', 'red');
        miniText(pc, x + 4, y + 8, 'SALE', 'red');
    },
};

const banner: PropDef = {
    w: (o) => miniTextWidth(String(o.text ?? 'HELLO')) + 10,
    h: 20,
    solid: (_o, w) => [w, 3],
    draw(pc, _f, x, y, o) {
        const text = String(o.text ?? 'HELLO');
        const w = miniTextWidth(text) + 10;
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'blue'));
        pc.rect(x, y + 1, 2, 19, 'earth').rect(x + w - 2, y + 1, 2, 19, 'earth');
        pc.rect(x, y, 2, 1, 'gold').rect(x + w - 2, y, 2, 1, 'gold');
        pc.rect(x + 2, y + 2, w - 4, 9, b).rect(x + 2, y + 2, w - 4, 1, l).rect(x + 2, y + 10, w - 4, 1, d);
        miniText(pc, x + 5, y + 4, text, opt<Color>(o, 'textColor', 'white'));
    },
};

const KEEP_OFF = ['KEEP OFF', 'THE GRASS'];

const grassSign: PropDef = {
    w: miniTextWidth(KEEP_OFF[1]) + 8, h: 26, solid: [4, 3], shadow: 12,
    draw(pc, _f, x, y) {
        const w = miniTextWidth(KEEP_OFF[1]) + 8;
        const mid = x + Math.floor(w / 2);
        pc.rect(mid - 1, y + 16, 2, 10, 'wood').rect(mid - 1, y + 16, 1, 10, 'clay');
        pc.rect(x, y, w, 17, 'leaf').rect(x + 1, y + 1, w - 2, 15, 'white').rect(x + 1, y + 15, w - 2, 1, 'cloud');
        KEEP_OFF.forEach((line, i) => miniText(pc, x + Math.floor((w - miniTextWidth(line)) / 2), y + 3 + i * 6, line, 'leaf'));
    },
};

const mailbox: PropDef = {
    w: 10, h: 16, solid: [4, 3], shadow: 8,
    draw(pc, _f, x, y, o) {
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'blue'));
        pc.rect(x + 4, y + 8, 2, 8, 'earth').rect(x + 4, y + 8, 1, 8, 'wood');
        pc.rect(x + 1, y + 1, 8, 1, b).rect(x, y + 2, 10, 6, b).rect(x + 1, y + 2, 8, 1, l).rect(x, y + 7, 10, 1, d);
        pc.rect(x + 1, y + 3, 1, 4, d);
        pc.rect(x + 8, y, 1, 5, 'red').rect(x + 9, y, 1, 2, 'red');
    },
};

const barrel: PropDef = {
    w: 12, h: 14, solid: [10, 5],
    draw(pc, _f, x, y) {
        for (let j = 0; j < 14; j++) {
            const inset = j < 2 || j > 11 ? 1 : 0;
            for (let i = inset; i < 12 - inset; i++) {
                const rel = (i - inset) / (11 - 2 * inset);
                pc.set(x + i, y + j, rel < 0.25 ? 'clay' : rel > 0.75 ? 'earth' : 'wood');
            }
        }
        pc.rect(x + 1, y, 10, 2, 'earth').rect(x + 2, y, 8, 1, 'wood');
        pc.rect(x, y + 3, 12, 1, 'slate').rect(x, y + 10, 12, 1, 'slate');
        pc.set(x + 2, y + 3, 'steel').set(x + 2, y + 10, 'steel');
    },
};

const crate: PropDef = {
    w: 14, h: 14, solid: [14, 7],
    draw(pc, _f, x, y, o) {
        const label = o.text ? String(o.text).slice(0, 3) : '';
        pc.rect(x, y, 14, 14, 'wood').rect(x, y, 14, 2, 'clay');
        pc.rect(x, y + 2, 2, 12, 'earth').rect(x + 12, y + 2, 2, 12, 'earth').rect(x, y + 12, 14, 2, 'earth').rect(x + 2, y + 2, 10, 1, 'earth');
        if (label) miniText(pc, x + 7 - Math.floor(miniTextWidth(label) / 2), y + 5, label, 'bark');
        else pc.line(x + 2, y + 11, x + 11, y + 3, 'clay').line(x + 3, y + 11, x + 11, y + 4, 'earth');
        pc.set(x + 1, y + 3, 'steel').set(x + 12, y + 3, 'steel').set(x + 1, y + 12, 'steel').set(x + 12, y + 12, 'steel');
    },
};

const bush: PropDef = {
    w: 18, h: 14, solid: [12, 4],
    draw(pc, _f, x, y, o) {
        pc.blit(bushArt(opt<Color[]>(o, 'leaves', ['pine', 'forest', 'leaf', 'grass', 'lime']), o.berries as Color | undefined, Number(o.seed ?? 3)), x, y);
    },
};

const rock: PropDef = {
    w: 16, h: 12, solid: [12, 5],
    draw(pc, _f, x, y, o) {
        pc.blit(rockArt(opt<Color[]>(o, 'stone', ['slate', 'steel', 'mist', 'cloud']), o.moss as Color | undefined, Number(o.seed ?? 5)), x, y);
    },
};

const flowerpot: PropDef = {
    w: 10, h: 14, solid: [8, 4],
    draw(pc, _f, x, y, o) {
        const bloom = opt<Color>(o, 'color', 'pink');
        pc.rect(x + 2, y + 4, 1, 5, 'leaf').rect(x + 5, y + 2, 1, 7, 'forest').rect(x + 8, y + 5, 1, 4, 'leaf');
        const flower = (cx: number, cy: number, c: Color) =>
            pc.set(cx, cy - 1, c).set(cx - 1, cy, c).set(cx + 1, cy, c).set(cx, cy + 1, c).set(cx, cy, 'yellow');
        flower(x + 2, y + 3, bloom);
        flower(x + 5, y + 1, 'white');
        flower(x + 8, y + 4, bloom);
        pc.rect(x, y + 8, 10, 2, 'clay').rect(x, y + 8, 10, 1, 'sand');
        pc.rect(x + 1, y + 10, 8, 3, 'orange').rect(x + 2, y + 13, 6, 1, 'orange').rect(x + 7, y + 10, 1, 4, 'red');
    },
};

const fence: PropDef = {
    w: (o) => Math.max(1, Number(o.length ?? 1)) * 16,
    h: 12,
    shadow: false,
    solid: (_o, w) => [w, 4],
    draw(pc, _f, x, y, o) {
        const w = Math.max(1, Number(o.length ?? 1)) * 16;
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'white'));
        pc.rect(x, y + 3, w, 2, b).rect(x, y + 4, w, 1, d).rect(x, y + 7, w, 2, b).rect(x, y + 8, w, 1, d);
        for (let px = x + 2; px < x + w; px += 8) {
            pc.rect(px, y + 1, 4, 11, b).rect(px, y + 1, 1, 11, l).rect(px + 3, y + 1, 1, 11, d).rect(px + 1, y, 2, 1, b);
        }
    },
};

const fenceV: PropDef = {
    w: 6,
    h: (o) => Math.max(1, Number(o.length ?? 1)) * 16,
    shadow: false,
    solid: (_o, _w, h) => [4, h],
    draw(pc, _f, x, y, o) {
        const h = Math.max(1, Number(o.length ?? 1)) * 16;
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'white'));
        pc.rect(x + 2, y, 2, h, b).rect(x + 3, y, 1, h, d);
        for (let py = y + 1; py < y + h - 3; py += 8) pc.rect(x + 1, py, 4, 4, l).rect(x + 1, py + 3, 4, 1, d);
    },
};

const campfire: PropDef = {
    w: 16, h: 16, frames: 3, fps: 8, solid: [12, 5], shadow: false,
    draw(pc, f, x, y) {
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            pc.rect(Math.round(x + 8 + Math.cos(a) * 6.5 - 1), Math.round(y + 12.5 + Math.sin(a) * 2.5 - 1), 2, 2, i % 2 ? 'steel' : 'mist');
        }
        pc.ellipse(x + 8, y + 12.5, 5, 1.8, 'bark');
        pc.line(x + 3, y + 14, x + 12, y + 10, 'earth').line(x + 3, y + 10, x + 12, y + 14, 'wood');
        for (let j = 0; j < 11; j++) {
            const k = j / 10;
            const hw = (1 - k) ** 0.8 * 4.5 + (hash(j, f, 9) - 0.5) * 1.6;
            const sway = Math.sin(j * 0.9 + f * 2.2) * k * 1.6;
            for (let i = -6; i <= 6; i++) {
                const dd = Math.abs(i - sway) / Math.max(0.5, hw);
                if (dd > 1) continue;
                pc.set(x + 8 + i, y + 12 - j, dd < 0.35 && k < 0.6 ? 'yellow' : dd < 0.65 ? 'gold' : k > 0.7 ? 'red' : 'orange');
            }
        }
        if (f !== 1) pc.set(x + 5 + f * 3, y + 1 + f, 'gold');
    },
};

const flag: PropDef = {
    w: 16, h: 28, frames: 3, fps: 5, solid: [4, 3], shadow: 6,
    draw(pc, f, x, y, o) {
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'red'));
        pc.rect(x + 1, y + 2, 1, 26, 'cloud').rect(x + 2, y + 2, 1, 26, 'steel').rect(x + 1, y, 2, 2, 'gold').rect(x, y + 26, 4, 2, 'slate');
        for (let i = 0; i < 12; i++) {
            const t = i / 11;
            const wave = Math.sin(t * Math.PI * 1.6 - f * 2.1);
            pc.rect(x + 3 + i, y + 3 + Math.round(wave * 1.3 * t), 1, 8, wave > 0.45 ? l : wave < -0.45 ? d : b);
        }
    },
};

const well: PropDef = {
    w: 24, h: 28, solid: [22, 9],
    draw(pc, _f, x, y, o) {
        const [rd, rb, rl] = toRamp(opt<RampLike>(o, 'roof', 'red'));
        pc.rect(x + 3, y + 7, 2, 12, 'earth').rect(x + 19, y + 7, 2, 12, 'earth').rect(x + 3, y + 7, 1, 12, 'wood').rect(x + 19, y + 7, 1, 12, 'wood');
        for (let j = 0; j < 7; j++) {
            const hw = 3 + j * 1.6;
            for (let i = Math.round(12 - hw); i < Math.round(12 + hw); i++) pc.set(x + i, y + j, j === 6 || (i + j) % 4 === 0 ? rd : j < 2 ? rl : rb);
        }
        pc.rect(x + 5, y + 9, 14, 1, 'bark').rect(x + 12, y + 10, 1, 3, 'cream').rect(x + 10, y + 12, 5, 3, 'wood').rect(x + 10, y + 12, 5, 1, 'clay');
        for (let j = 0; j < 9; j++) {
            for (let i = 0; i < 22; i++) {
                const mortar = j % 3 === 2 || (i + (Math.floor(j / 3) % 2) * 3) % 6 === 0;
                pc.set(x + 1 + i, y + 19 + j, mortar ? 'slate' : i < 4 ? 'mist' : i > 17 ? 'slate' : 'steel');
            }
        }
        pc.ellipse(x + 12, y + 18.5, 11, 4.5, (_x, _y, _nx, ny) => (ny < -0.2 ? 'cloud' : 'mist'));
        pc.ellipse(x + 12, y + 18.5, 7.5, 2.5, (_x, _y, _nx, ny) => (ny > 0.3 ? 'blue' : 'navy'));
    },
};

const fountain: PropDef = {
    w: 40, h: 30, frames: 3, fps: 6, solid: [38, 12],
    draw(pc, f, x, y, o) {
        const water = toRamp(opt<RampLike>(o, 'water', 'sky'));
        const colors = Array.isArray(o.colors) && o.colors.length ? (o.colors as Color[]) : null;
        const cx = x + 20;
        for (let j = 0; j < 5; j++) {
            for (let i = 0; i < 38; i++) {
                const seam = (i + (j > 2 ? 3 : 0)) % 7 === 0 || j === 2;
                pc.set(x + 1 + i, y + 24 + j, seam ? 'steel' : i < 6 ? 'cloud' : i > 31 ? 'steel' : 'mist');
            }
        }
        pc.ellipse(cx, y + 20, 19.5, 7.5, (_x, _y, _nx, ny) => (ny < -0.3 ? 'white' : 'cloud'));
        pc.ellipse(cx, y + 20, 16.5, 5.5, (_x, _y, nx, ny) => {
            const r = Math.sqrt(nx * nx + ny * ny);
            const ring = Math.abs(((r * 3 - f / 3 + 3) % 1) - 0.5) < 0.09;
            if (colors) {
                const angle = (Math.atan2(ny, nx) / (Math.PI * 2) + 1) % 1;
                const idx = Math.floor((angle * colors.length + r * 2 + f) % colors.length);
                const c = colors[idx];
                return ring ? lighter(c) : c;
            }
            return ring ? water[2] : ny < -0.4 ? water[0] : water[1];
        });
        pc.rect(cx - 2, y + 9, 4, 12, 'mist').rect(cx - 2, y + 9, 1, 12, 'cloud').rect(cx + 1, y + 9, 1, 12, 'steel');
        pc.ellipse(cx, y + 9, 6, 2, 'cloud');
        pc.ellipse(cx, y + 8.5, 4, 1.2, colors ? colors[f % colors.length] : water[1]);
        for (let j = 0; j < 7; j++) {
            const jetColor = colors ? colors[(j + f) % colors.length] : (j % 2 ? water[2] : 'white');
            pc.set(cx - (j % 2), y + 1 + j, jetColor);
        }
        const drops = [[-5, 3], [5, 3], [-8, 6], [8, 6], [-10, 10], [10, 10], [-11, 13], [11, 13]];
        drops.forEach(([dx, dy], i) => {
            if ((i + f) % 3 !== 0) {
                const dropColor = colors ? colors[(i + f) % colors.length] : (i % 2 ? water[2] : 'white');
                pc.set(cx + dx, y + 2 + dy, dropColor);
            }
        });
    },
};

const stall: PropDef = {
    w: 30, h: 28, solid: [30, 9],
    draw(pc, _f, x, y, o) {
        const [ad, ab] = toRamp(opt<RampLike>(o, 'color', 'red'));
        pc.rect(x + 1, y + 7, 2, 14, 'earth').rect(x + 27, y + 7, 2, 14, 'earth');
        for (let j = 0; j < 8; j++) {
            for (let i = 0; i < 30; i++) {
                if (j === 7 && i % 4 === 3) continue;
                pc.set(x + i, y + j, j === 0 ? ad : Math.floor(i / 4) % 2 === 0 ? ab : 'white');
            }
        }
        pc.rect(x, y + 19, 30, 9, 'wood').rect(x, y + 19, 30, 2, 'clay').rect(x, y + 27, 30, 1, 'earth');
        for (let i = 4; i < 30; i += 7) pc.rect(x + i, y + 21, 1, 6, 'earth');
        const goods = opt<Color[]>(o, 'goods', ['red', 'orange', 'lime', 'gold', 'red', 'pink', 'lime']);
        goods.slice(0, 7).forEach((c, i) => {
            const gx = x + 3 + Math.round(i * 3.6), gy = y + 16 + (i % 2);
            pc.rect(gx, gy, 3, 3, c).set(gx, gy, lighter(c));
        });
    },
};

const statue: PropDef = {
    w: 20, h: 36, solid: [18, 9],
    draw(pc, _f, x, y, o) {
        const stone = opt<Color[]>(o, 'stone', ['slate', 'steel', 'mist', 'cloud']);
        const fig = characterPortrait(randomLook(String(o.seed ?? 'statue'), opt<CharacterLook>(o, 'look', {})));
        for (let j = 0; j < fig.height; j++) {
            for (let i = 0; i < fig.width; i++) {
                const v = fig.raw(i, j);
                if (v >>> 24 === 0) continue;
                const lum = (0.3 * (v & 255) + 0.59 * ((v >> 8) & 255) + 0.11 * ((v >> 16) & 255)) / 255;
                pc.set(x + 2 + i, y + 2 + j, stone[Math.min(stone.length - 1, Math.floor(lum * stone.length * 1.25))]);
            }
        }
        pc.rect(x + 1, y + 23, 18, 13, stone[1]).rect(x + 1, y + 23, 18, 2, stone[2]).rect(x + 16, y + 25, 3, 11, stone[0]).rect(x, y + 34, 20, 2, stone[0]);
        pc.rect(x + 6, y + 28, 8, 4, 'gold').rect(x + 6, y + 28, 8, 1, 'yellow');
    },
};

const chest: PropDef = {
    w: 14, h: 12, solid: [14, 6],
    draw(pc, _f, x, y) {
        pc.rect(x, y + 5, 14, 7, 'wood').rect(x, y + 11, 14, 1, 'earth').rect(x + 12, y + 5, 2, 7, 'earth');
        pc.rect(x + 1, y, 12, 1, 'clay').rect(x, y + 1, 14, 4, 'wood').rect(x, y + 1, 14, 1, 'clay').rect(x, y + 4, 14, 1, 'earth');
        pc.rect(x + 3, y, 1, 12, 'gold').rect(x + 10, y, 1, 12, 'gold');
        pc.rect(x + 6, y + 4, 2, 3, 'yellow').set(x + 6, y + 5, 'ink');
    },
};

const table: PropDef = {
    w: 20, h: 12, solid: [20, 5],
    draw(pc, _f, x, y, o) {
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'wood'));
        pc.rect(x + 1, y + 6, 2, 6, d).rect(x + 17, y + 6, 2, 6, d);
        pc.rect(x, y, 20, 6, b).rect(x, y, 20, 1, l).rect(x, y + 5, 20, 1, d).rect(x + 6, y + 2, 1, 2, l);
    },
};

const log: PropDef = {
    w: 20, h: 9, solid: [18, 5],
    draw(pc, _f, x, y) {
        pc.rect(x + 3, y + 1, 16, 7, 'wood').rect(x + 3, y + 1, 16, 1, 'clay').rect(x + 3, y + 7, 16, 1, 'earth');
        for (let i = 6; i < 18; i += 4) pc.rect(x + i, y + 3 + (i % 3), 3, 1, 'earth');
        pc.ellipse(x + 3, y + 4.5, 3, 3.5, (_x, _y, nx, ny) => {
            const r = Math.hypot(nx, ny);
            return r > 0.75 ? 'earth' : r > 0.4 ? 'clay' : 'sand';
        });
    },
};

const mushroom: PropDef = {
    w: 10, h: 10, solid: false, shadow: 8,
    draw(pc, _f, x, y, o) {
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'red'));
        pc.rect(x + 3, y + 5, 4, 5, 'cream').rect(x + 6, y + 5, 1, 5, 'sand');
        pc.ellipse(x + 5, y + 3.5, 5, 3.5, (_x, _y, nx, ny) => (ny > 0.45 ? d : nx < -0.3 && ny < 0 ? l : b));
        pc.set(x + 3, y + 2, 'white').set(x + 6, y + 1, 'white').set(x + 7, y + 4, 'white').set(x + 2, y + 4, 'white');
    },
};

const cactus: PropDef = {
    w: 12, h: 18, solid: [6, 4],
    draw(pc, _f, x, y) {
        pc.rect(x + 4, y + 1, 4, 17, 'leaf').rect(x + 4, y + 1, 1, 17, 'grass').rect(x + 7, y + 1, 1, 17, 'forest').rect(x + 5, y, 2, 1, 'leaf');
        pc.rect(x, y + 6, 2, 6, 'leaf').rect(x, y + 11, 4, 2, 'leaf').rect(x, y + 6, 1, 6, 'grass');
        pc.rect(x + 10, y + 4, 2, 5, 'leaf').rect(x + 8, y + 8, 4, 2, 'leaf').rect(x + 11, y + 4, 1, 5, 'forest');
        pc.set(x + 5, y + 4, 'cream').set(x + 6, y + 9, 'cream').set(x + 5, y + 13, 'cream').set(x + 5, y, 'pink').set(x + 6, y, 'pink');
    },
};

const pumpkin: PropDef = {
    w: 12, h: 10, solid: [10, 4],
    draw(pc, _f, x, y, o) {
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'orange'));
        pc.ellipse(x + 6, y + 5.5, 6, 4, (_x, _y, nx, ny) => {
            const a = Math.abs(nx);
            return (a > 0.3 && a < 0.45) || a < 0.08 ? d : nx < -0.5 && ny < 0 ? l : b;
        });
        pc.rect(x + 5, y, 2, 3, 'leaf').set(x + 7, y + 1, 'forest');
    },
};

const trash: PropDef = {
    w: 10, h: 13, solid: [8, 4],
    draw(pc, _f, x, y, o) {
        const [d, b, l] = toRamp(opt<RampLike>(o, 'color', 'stone'));
        pc.rect(x + 1, y + 2, 8, 11, b);
        for (let i = 3; i < 9; i += 2) pc.rect(x + i, y + 3, 1, 9, d);
        pc.rect(x + 1, y + 2, 1, 11, l).rect(x, y + 1, 10, 2, l).rect(x, y + 2, 10, 1, d).rect(x + 4, y, 2, 1, d);
    },
};

const terminal: PropDef = {
    w: 18, h: 17, frames: 2, fps: 2, solid: [16, 6],
    draw(pc, f, x, y, o) {
        const glow = opt<Color>(o, 'color', 'lime');
        pc.rect(x + 1, y, 16, 12, 'cloud').rect(x + 1, y, 16, 1, 'white').rect(x + 16, y, 1, 12, 'mist');
        pc.rect(x + 3, y + 2, 12, 8, 'ink');
        pc.rect(x + 4, y + 3, 7, 1, glow).rect(x + 4, y + 5, 5, 1, glow).rect(x + 4, y + 7, 3, 1, glow);
        if (f === 0) pc.rect(x + 8, y + 7, 2, 1, glow);
        pc.rect(x + 7, y + 12, 4, 2, 'mist').rect(x, y + 14, 18, 3, 'mist').rect(x, y + 14, 18, 1, 'cloud');
        for (let i = 1; i < 17; i += 2) pc.set(x + i, y + 15, 'steel');
    },
};

const portal: PropDef = {
    w: 22, h: 30, frames: 4, fps: 8, solid: false,
    draw(pc, f, x, y, o) {
        const swirl = opt<Color[]>(o, 'colors', ['plum', 'violet', 'pink', 'cyan']);
        pc.ellipse(x + 11, y + 16, 7.5, 12, (_x, _y, nx, ny) => {
            const v = (Math.atan2(ny, nx) / (Math.PI * 2) + Math.hypot(nx, ny) * 1.5 - f / 4 + 2) % 1;
            return swirl[Math.floor(v * swirl.length) % swirl.length];
        });
        for (const sx of [x, x + 18]) pc.rect(sx, y + 8, 4, 22, 'steel').rect(sx, y + 8, 1, 22, 'mist').rect(sx + 3, y + 8, 1, 22, 'slate');
        for (let i = 0; i < 22; i++) pc.rect(x + i, y + Math.round(8 - Math.sin((i / 21) * Math.PI) * 7), 1, 3, i % 5 === 0 ? 'slate' : 'steel');
        pc.rect(x + 9, y, 4, 2, 'gold');
    },
};

const flowers: PropDef = {
    w: 12, h: 9, solid: false, shadow: false, outline: false,
    draw(pc, _f, x, y, o) {
        const colors = opt<Color[]>(o, 'colors', ['pink', 'white', 'yellow']);
        [[2, 3], [6, 1], [9, 4], [4, 6]].forEach(([fx, fy], i) => {
            const c = colors[i % colors.length];
            pc.set(x + fx, y + fy + 1, 'leaf').set(x + fx, y + fy + 2, 'forest');
            pc.set(x + fx - 1, y + fy, c).set(x + fx + 1, y + fy, c).set(x + fx, y + fy - 1, c).set(x + fx, y + fy, 'gold');
        });
    },
};

/** Every built-in prop. This is a starting set, not a limit: add or replace entries freely. */
export const PROPS: Record<string, PropDef> = {
    lamp, bench, sign, saleSign, banner, grassSign, mailbox, barrel, crate, bush, rock, flowerpot, fence, fenceV,
    campfire, flag, well, fountain, stall, statue, chest, table, log, mushroom, cactus, pumpkin, trash,
    terminal, portal, flowers,
};

/** Register (or replace) a prop everyone can use by name. */
export function defineProp(name: string, def: PropDef): PropDef {
    PROPS[name] = def;
    return def;
}
