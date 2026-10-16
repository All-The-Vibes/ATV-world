import Phaser from 'phaser';
import { fbm, hash } from '../kit/noise';

/**
 * Soft textures for the atmosphere: light cookies, halos, cloud shadows, the vignette and sun shafts.
 * Light-ish ones are opaque greyscale (black adds nothing under ADD), the rest are white with an alpha mask.
 * All are drawn in code; the smooth ones use LINEAR filtering, the pixel ones stay NEAREST like the rest of the game.
 */
export const FX = {
    light: 'atm-light',
    core: 'atm-core',
    cloud: 'atm-cloud',
    vignette: 'atm-vignette',
    ray: 'atm-ray',
    px: 'atm-px',
    flat: 'atm-flat',
    firefly: 'atm-firefly',
    mote: 'atm-mote',
    star: 'atm-star',
} as const;

const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
};

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, linear: boolean, paint: (x: number, y: number) => [number, number, number, number]) {
    if (scene.textures.exists(key)) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const [r, g, b, a] = paint(x, y);
            const i = (y * w + x) * 4;
            img.data[i] = r;
            img.data[i + 1] = g;
            img.data[i + 2] = b;
            img.data[i + 3] = a;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = scene.textures.addCanvas(key, canvas);
    if (linear) tex?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** A tiny bit of noise (±0.5 of a step) so 8-bit gradients don't band. */
const grain = (x: number, y: number) => hash(x, y, 77) - 0.5;
const grey = (v: number, x: number, y: number): [number, number, number, number] => {
    const c = Math.max(0, Math.min(255, Math.round(v * 255 + grain(x, y))));
    return [c, c, c, 255];
};

export function ensureFxTextures(scene: Phaser.Scene) {
    // Light cookie: a long soft falloff that fades to exactly black at the edge.
    makeTexture(scene, FX.light, 128, 128, true, (x, y) => {
        const d = Math.hypot(x + 0.5 - 64, y + 0.5 - 64) / 64;
        // Bright, defined core with a quick tail: pools of light, not fog.
        const f = d >= 1 ? 0 : (1 - d) ** 1.6 * (1 - d * d) * (0.7 + 0.3 * (1 - smooth(0, 0.35, d)));
        return grey(f, x, y);
    });
    // Hot core for bloom: tight and bright, with a short tail.
    makeTexture(scene, FX.core, 64, 64, true, (x, y) => {
        const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32;
        const f = d >= 1 ? 0 : Math.exp(-d * d * 7) * (1 - d) ;
        return grey(f, x, y);
    });
    // Cloud shadow: a lumpy fbm blob, white with a soft alpha mask.
    makeTexture(scene, FX.cloud, 160, 112, true, (x, y) => {
        const nx = (x + 0.5 - 80) / 80, ny = (y + 0.5 - 56) / 56;
        const r = Math.hypot(nx, ny);
        const n = fbm(x, y, 40, 9, 4);
        const m = smooth(0.15, 0.75, (1 - r) * 0.9 + (n - 0.5) * 0.9);
        return [255, 255, 255, Math.round(m * 255)];
    });
    // Vignette: transparent middle, opaque corners.
    makeTexture(scene, FX.vignette, 160, 100, true, (x, y) => {
        const nx = (x + 0.5 - 80) / 80, ny = (y + 0.5 - 50) / 50;
        const d = Math.hypot(nx * 0.92, ny);
        const a = smooth(0.45, 1.45, d) ** 1.3;
        return [255, 255, 255, Math.round(a * 255 + grain(x, y))];
    });
    // Sun shaft: a soft vertical beam fading out at both ends.
    makeTexture(scene, FX.ray, 32, 256, true, (x, y) => {
        const u = (x + 0.5 - 16) / 16;
        const v = (y + 0.5) / 256;
        const f = Math.exp(-u * u * 4) * smooth(0, 0.35, v) * (1 - smooth(0.55, 1, v));
        return grey(f, x, y);
    });
    makeTexture(scene, FX.px, 2, 2, false, () => [255, 255, 255, 255]);
    makeTexture(scene, FX.flat, 64, 64, false, () => [255, 255, 255, 255]);
    // Firefly: a crisp pixel cross with a dim halo (opaque greyscale, for ADD + tint).
    makeTexture(scene, FX.firefly, 7, 7, false, (x, y) => {
        const dx = Math.abs(x - 3), dy = Math.abs(y - 3);
        const v = dx + dy === 0 ? 1 : dx + dy === 1 ? 0.75 : dx === 1 && dy === 1 ? 0.35 : dx + dy === 2 ? 0.22 : dx + dy === 3 && (dx === 0 || dy === 0) ? 0.08 : 0;
        return grey(v, 0, 0);
    });
    // Dust mote: one bright pixel and a faint plus.
    makeTexture(scene, FX.mote, 3, 3, false, (x, y) => {
        const d = Math.abs(x - 1) + Math.abs(y - 1);
        return grey(d === 0 ? 1 : d === 1 ? 0.3 : 0, 0, 0);
    });
    // Twinkle star: a 4-point pixel sparkle.
    makeTexture(scene, FX.star, 5, 5, false, (x, y) => {
        const dx = Math.abs(x - 2), dy = Math.abs(y - 2);
        const v = dx + dy === 0 ? 1 : (dx === 0 || dy === 0) ? (dx + dy === 1 ? 0.6 : 0.2) : 0;
        return grey(v, 0, 0);
    });
}

/**
 * Night windows: a copy of a building texture where only the glass shows, recoloured warm.
 * `glass` maps 0xRRGGBB source colours to the lit colour. Also returns the lit panes' bounding boxes
 * (texture px) so lights can spill out of each one.
 */
export function emissiveTexture(scene: Phaser.Scene, srcKey: string, outKey: string, glass: Map<number, number>, maxPane = Infinity):
    { key: string; panes: { x: number; y: number; w: number; h: number }[]; width: number; height: number } | null {
    const src = scene.textures.get(srcKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    const w = src.width, h = src.height;
    if (!w || !h) return null;
    const read = document.createElement('canvas');
    read.width = w;
    read.height = h;
    const rctx = read.getContext('2d', { willReadFrequently: true })!;
    rctx.drawImage(src as CanvasImageSource, 0, 0);
    const data = rctx.getImageData(0, 0, w, h);
    const out = rctx.createImageData(w, h);
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        if (data.data[o + 3] < 200) continue;
        const rgb = (data.data[o] << 16) | (data.data[o + 1] << 8) | data.data[o + 2];
        const lit = glass.get(rgb);
        if (lit === undefined) continue;
        mask[i] = 1;
        out.data[o] = lit >> 16 & 255;
        out.data[o + 1] = lit >> 8 & 255;
        out.data[o + 2] = lit & 255;
        out.data[o + 3] = 255;
    }
    // Connected panes (8-way, bridging 1px mullions) → bounding boxes.
    const seen = new Uint8Array(w * h);
    const panes: { x: number; y: number; w: number; h: number }[] = [];
    const stack: number[] = [];
    for (let i = 0; i < w * h; i++) {
        if (!mask[i] || seen[i]) continue;
        let x0 = w, y0 = h, x1 = 0, y1 = 0, count = 0;
        const members: number[] = [];
        stack.push(i);
        seen[i] = 1;
        while (stack.length) {
            const j = stack.pop()!;
            const x = j % w, y = (j / w) | 0;
            count++;
            members.push(j);
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const xx = x + dx, yy = y + dy;
                    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                    const k = yy * w + xx;
                    if (mask[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
                }
            }
        }
        const pw = x1 - x0 + 1, ph = y1 - y0 + 1;
        // Too big to be a window (a blue roof, say), or a stray speck: leave it dark.
        if (count >= 6 && pw <= maxPane && ph <= maxPane) panes.push({ x: x0, y: y0, w: pw, h: ph });
        else for (const m of members) out.data[m * 4 + 3] = 0;
    }
    if (scene.textures.exists(outKey)) scene.textures.remove(outKey);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.putImageData(out, 0, 0);
    scene.textures.addCanvas(outKey, canvas);
    return { key: outKey, panes, width: w, height: h };
}
