import { COLOR_NAMES, PALETTE_CHARS, toU32, type Color } from './palette';
import { bayer } from './noise';

/** Any Color, or null for transparent. */
export type Ink = Color | null;

/** Legend for ASCII sprites: one character → any color (or null = transparent). */
export type Legend = Record<string, Ink>;

/** Default legend: '0'..'v' map to ATV-32 in palette order; '.' and ' ' are transparent. */
export const DEFAULT_LEGEND: Legend = {
    '.': null,
    ' ': null,
    ...Object.fromEntries(COLOR_NAMES.map((name, i) => [PALETTE_CHARS[i], name])),
};

/**
 * A tiny pixel editor backed by ImageData. Every built-in texture is painted with this,
 * then handed to Phaser via `scene.textures.addCanvas()`.
 */
export class PixelCanvas {
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;
    readonly image: ImageData;
    readonly px: Uint32Array;

    constructor(readonly width: number, readonly height: number) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('2D canvas is not available');
        this.ctx = ctx;
        this.image = ctx.createImageData(width, height);
        this.px = new Uint32Array(this.image.data.buffer);
    }

    inside(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    set(x: number, y: number, c: Ink): this {
        x = Math.floor(x);
        y = Math.floor(y);
        if (this.inside(x, y)) this.px[y * this.width + x] = c === null ? 0 : toU32(c);
        return this;
    }

    raw(x: number, y: number): number {
        return this.inside(x, y) ? this.px[y * this.width + x] : 0;
    }

    filled(x: number, y: number): boolean {
        return this.raw(x, y) >>> 24 !== 0;
    }

    rect(x: number, y: number, w: number, h: number, c: Ink): this {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
        return this;
    }

    /** Ordered-dither between two colors at one pixel. t=0 → all `a`, t=1 → all `b`. */
    mix(x: number, y: number, a: Ink, b: Ink, t: number): this {
        return this.set(x, y, t > bayer(x, y) ? b : a);
    }

    /** Filled ellipse. `paint` can be a color or a function of (x, y, nx, ny) where nx/ny ∈ [-1, 1]. */
    ellipse(cx: number, cy: number, rx: number, ry: number, paint: Ink | ((x: number, y: number, nx: number, ny: number) => Ink)): this {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                const nx = (x + 0.5 - cx) / rx;
                const ny = (y + 0.5 - cy) / ry;
                if (nx * nx + ny * ny > 1) continue;
                this.set(x, y, typeof paint === 'function' ? paint(x, y, nx, ny) : paint);
            }
        }
        return this;
    }

    line(x0: number, y0: number, x1: number, y1: number, c: Ink): this {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            this.set(x0, y0, c);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return this;
    }

    /** Paint ASCII art. Unknown characters are skipped. */
    ascii(x: number, y: number, rows: readonly string[], legend: Legend = DEFAULT_LEGEND, flipX = false): this {
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i++) {
                const ch = row[i];
                if (!(ch in legend)) continue;
                const c = legend[ch];
                if (c === null) continue;
                this.set(flipX ? x + row.length - 1 - i : x + i, y + j, c);
            }
        });
        return this;
    }

    /** Wrap every filled pixel in a 1px outline (4-neighbour, or 8 with `diagonal`). */
    outline(c: Color = 'ink', diagonal = false, region?: { x: number; y: number; w: number; h: number }): this {
        const { x: rx, y: ry, w: rw, h: rh } = region ?? { x: 0, y: 0, w: this.width, h: this.height };
        const snapshot = this.px.slice();
        const at = (x: number, y: number) =>
            x >= rx && y >= ry && x < rx + rw && y < ry + rh && snapshot[y * this.width + x] >>> 24 !== 0;
        const color = toU32(c);
        for (let y = ry; y < ry + rh; y++) {
            for (let x = rx; x < rx + rw; x++) {
                if (at(x, y)) continue;
                const near = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ||
                    (diagonal && (at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)));
                if (near) this.px[y * this.width + x] = color;
            }
        }
        return this;
    }

    /** Copy another canvas onto this one (transparent pixels are skipped). */
    blit(src: PixelCanvas, dx: number, dy: number, flipX = false): this {
        for (let y = 0; y < src.height; y++) {
            for (let x = 0; x < src.width; x++) {
                const v = src.px[y * src.width + x];
                if (v >>> 24 === 0) continue;
                const tx = dx + (flipX ? src.width - 1 - x : x);
                const ty = dy + y;
                if (this.inside(tx, ty)) this.px[ty * this.width + tx] = v;
            }
        }
        return this;
    }

    /** Push pixels to the backing canvas and return it. */
    flush(): HTMLCanvasElement {
        this.ctx.putImageData(this.image, 0, 0);
        return this.canvas;
    }
}

/** Size of ASCII art: width = longest row. */
export const asciiSize = (rows: readonly string[]) => ({
    w: rows.reduce((m, r) => Math.max(m, r.length), 0),
    h: rows.length,
});
