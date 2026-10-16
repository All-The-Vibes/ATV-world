/**
 * Pixel art for the town's ambient life: leaves, smoke, water, butterflies, birds, dust.
 * Everything is painted with the kit's PixelCanvas in ATV-32 colors and registered once per game.
 */
import type Phaser from 'phaser';
import { PixelCanvas, addPixels, bayer, stripFrames, type Color, type Legend } from '../kit';

/** Paint a strip of equal ASCII frames with a small legend. */
function asciiStrip(scene: Phaser.Scene, key: string, frames: string[][], legend: Legend, outline?: Color): string {
    if (scene.textures.exists(key)) return key;
    const w = Math.max(...frames.flat().map((r) => r.length)) + (outline ? 2 : 0);
    const h = Math.max(...frames.map((f) => f.length)) + (outline ? 2 : 0);
    const pc = new PixelCanvas(w * frames.length, h);
    const o = outline ? 1 : 0;
    frames.forEach((rows, i) => {
        pc.ascii(i * w + o, o, rows, { '.': null, ...legend });
        if (outline) pc.outline(outline, false, { x: i * w, y: 0, w, h });
    });
    return addPixels(scene, key, pc, stripFrames(frames.length, w, h));
}

/** Falling leaf / petal: 4 flutter frames per kind. */
export const LEAF_COLORS: Record<string, [Color, Color, Color]> = {
    cherry: ['pink', 'peach', 'cream'],
    autumn: ['red', 'orange', 'gold'],
    oak: ['forest', 'grass', 'lime'],
};

export function leafTexture(scene: Phaser.Scene, kind: string): string | null {
    const c = LEAF_COLORS[kind];
    if (!c) return null;
    const petal = kind === 'cherry';
    const frames = petal
        ? [
            ['....', '.bc.', '.a..', '....'],
            ['....', '.bc.', '.ab.', '....'],
            ['....', '.cb.', '..a.', '....'],
            ['....', '.bba', '....', '....'],
        ]
        : [
            ['.....', '..cb.', '.bba.', '.a...', '.....'],
            ['.....', '.cbb.', '.bba.', '.....', '.....'],
            ['.....', '.bc..', '.abb.', '...a.', '.....'],
            ['.....', '.....', 'abbc.', '.....', '.....'],
        ];
    return asciiStrip(scene, `life-leaf-${kind}`, frames, { a: c[0], b: c[1], c: c[2] });
}

/** Chimney smoke puffs: 5 frames, growing and thinning. */
export function smokeTexture(scene: Phaser.Scene): string {
    const key = 'life-smoke';
    if (scene.textures.exists(key)) return key;
    const S = 18, N = 6;
    const pc = new PixelCanvas(S * N, S);
    const radii = [2.4, 3.5, 4.6, 5.7, 6.8, 7.8];
    const density = [1, 1, 0.95, 0.8, 0.6, 0.38];
    for (let f = 0; f < N; f++) {
        const r = radii[f];
        const cx = f * S + S / 2, cy = S / 2;
        for (let y = 0; y < S; y++) {
            for (let x = f * S; x < f * S + S; x++) {
                const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r;
                const d = Math.hypot(nx, ny);
                if (d > 1) continue;
                const edge = Math.min(1, (1 - d) / 0.45) * density[f];
                if (edge <= bayer(x, y)) continue;
                const light = -(nx * -0.6 + ny * -0.8);
                const c: Color = light > 0.35 ? 'white' : light > -0.3 ? 'cloud' : 'mist';
                pc.set(x, y, c);
            }
        }
    }
    return addPixels(scene, key, pc, stripFrames(N, S, S));
}

/** Water: droplets (0 = bright, 1 = streak, 2 = small), ripples and sparkles. */
export function waterTextures(scene: Phaser.Scene) {
    const drop = asciiStrip(scene, 'life-drop', [['a.', 'b.'], ['a.', 'c.'], ['c.', '..']], { a: 'white', b: 'ice', c: 'cyan' });

    const rippleKey = 'life-ripple';
    if (!scene.textures.exists(rippleKey)) {
        const W = 15, H = 7, N = 5;
        const pc = new PixelCanvas(W * N, H);
        for (let f = 0; f < N; f++) {
            const rx = 1.6 + f * 1.25, ry = Math.max(0.9, rx * 0.4);
            const cx = f * W + W / 2, cy = H / 2;
            for (let y = 0; y < H; y++) {
                for (let x = f * W; x < f * W + W; x++) {
                    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
                    if (Math.abs(d - 1) > 0.32 / Math.max(1, f * 0.55)) continue;
                    if (f >= 3 && bayer(x, y) < (f - 2) * 0.3) continue;
                    pc.set(x, y, y + 0.5 < cy ? 'cyan' : 'ice');
                }
            }
        }
        addPixels(scene, rippleKey, pc, stripFrames(N, W, H));
    }

    const sparkle = asciiStrip(scene, 'life-sparkle', [
        ['.....', '.....', '..a..', '.....', '.....'],
        ['.....', '..b..', '.bab.', '..b..', '.....'],
        ['..b..', '..b..', 'bbabb', '..b..', '..b..'],
        ['.....', '..b..', '.bab.', '..b..', '.....'],
    ], { a: 'white', b: 'ice' });
    return { drop, ripple: rippleKey, sparkle };
}

/** Butterflies: frames 0 open, 1 half, 2 closed (wings up). Color morphs: [edge, wing, spot]. */
export const BUTTERFLY_MORPHS: [Color, Color, Color][] = [
    ['earth', 'orange', 'gold'], // monarch-ish
    ['violet', 'pink', 'peach'],
    ['steel', 'white', 'cloud'], // cabbage white
    ['blue', 'sky', 'ice'],
    ['clay', 'yellow', 'cream'], // brimstone
];

export function butterflyTexture(scene: Phaser.Scene, morph: number): string {
    const [d, a, b] = BUTTERFLY_MORPHS[morph % BUTTERFLY_MORPHS.length];
    return asciiStrip(scene, `life-butterfly-${morph}`, [
        ['db.k.bd', 'dabkbad', '.dakad.', '..d.d..'],
        ['.......', '.dbkbd.', '..aka..', '..d.d..'],
        ['.......', '...d...', '..dk...', '...k...'],
    ], { a, b, d, k: 'ink' });
}

/** A swallow-ish silhouette in 3 flap frames, plus its ground shadow. */
export function birdTextures(scene: Phaser.Scene) {
    const bird = asciiStrip(scene, 'life-bird', [
        ['k...k', '.kkk.', '..k..'],
        ['.....', 'kkkkk', '..k..'],
        ['.....', '.kkk.', 'k.k.k'],
    ], { k: 'night' });
    const shadowKey = 'life-bird-shadow';
    if (!scene.textures.exists(shadowKey)) {
        addPixels(scene, shadowKey, new PixelCanvas(7, 3).rect(1, 0, 5, 3, 'ink').rect(0, 1, 7, 1, 'ink'));
    }
    const dot = 'life-dot';
    if (!scene.textures.exists(dot)) addPixels(scene, dot, new PixelCanvas(3, 1).rect(0, 0, 3, 1, 'ink'));
    return { bird, shadow: shadowKey, dot };
}

/** Footstep dust: 4 frames from a tight puff to a dissolving wisp. */
export function dustTexture(scene: Phaser.Scene): string {
    const key = 'life-dust';
    if (scene.textures.exists(key)) return key;
    const W = 9, H = 5, N = 4;
    const pc = new PixelCanvas(W * N, H);
    for (let f = 0; f < N; f++) {
        const rx = 1.6 + f * 1.05, ry = 1.1 + f * 0.45;
        const cx = f * W + W / 2, cy = H - 1 - ry * 0.8;
        for (let y = 0; y < H; y++) {
            for (let x = f * W; x < f * W + W; x++) {
                const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
                const d = Math.hypot(nx, ny);
                if (d > 1) continue;
                if (f >= 2 && bayer(x, y) < (f - 1) * 0.33 + d * 0.2) continue;
                pc.set(x, y, ny < 0 ? 'cream' : 'sand');
            }
        }
    }
    return addPixels(scene, key, pc, stripFrames(N, W, H));
}

/**
 * Pixel-sheared sway frames for a tree texture. Rows above the trunk lean by up to `amp` px
 * (rounded per row, so the canopy staircases like hand-animated pixel art); the outline is redrawn
 * after shifting so edges stay closed. Frame i leans `leans[i]` px at the very top.
 */
export function swayFrames(scene: Phaser.Scene, srcKey: string, leans: number[], pivot: number): string | null {
    const key = `${srcKey}-sway`;
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.get(srcKey);
    const img = tex?.getSourceImage() as HTMLCanvasElement | HTMLImageElement | undefined;
    if (!img || !img.width) return null;
    const W = img.width, H = img.height;
    const probe = document.createElement('canvas');
    probe.width = W;
    probe.height = H;
    const ctx = probe.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const src = new Uint32Array(ctx.getImageData(0, 0, W, H).data.buffer);
    const ink = src.find((v) => v >>> 24 !== 0 && (v & 0xffffff) === 0x1e1014) ?? 0xff1e1014;
    const pad = Math.ceil(Math.max(...leans.map(Math.abs)));
    const FW = W + pad * 2;
    const pc = new PixelCanvas(FW * leans.length, H);
    const py = Math.round(H * pivot);
    leans.forEach((lean, f) => {
        for (let y = 0; y < H; y++) {
            const w = y >= py ? 0 : ((py - y) / py) ** 1.15;
            const dx = Math.round(lean * w);
            for (let x = 0; x < W; x++) {
                const v = src[y * W + x];
                if (v >>> 24 === 0 || v === ink) continue;
                pc.px[y * pc.width + f * FW + pad + x + dx] = v;
            }
        }
        // Re-close the outline around the shifted canopy (4-neighbour, like the kit's trees).
        const snap = pc.px.slice();
        const at = (x: number, y: number) => x >= f * FW && x < (f + 1) * FW && y >= 0 && y < H && snap[y * pc.width + x] >>> 24 !== 0;
        for (let y = 0; y < H; y++) {
            for (let x = f * FW; x < (f + 1) * FW; x++) {
                if (at(x, y)) continue;
                if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) pc.px[y * pc.width + x] = ink;
            }
        }
    });
    return addPixels(scene, key, pc, stripFrames(leans.length, FW, H));
}

/**
 * A finer fountain body for the kit's 40x30 fountain frame (drawn at x, y; frame f of 3). No painted
 * jet: the live spray in Ambience supplies the water. Light comes from the upper left like the kit.
 */
export function paintFountain(pc: PixelCanvas, f: number, x: number, y: number) {
    const cx = x + 20;
    // Front wall: two courses of dressed stone, lit from the left, a dark foot and a little moss.
    for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 38; i++) {
            const course = j < 2 ? 0 : 1;
            const seam = j === 2 || (i + course * 4) % 8 === 0;
            const t = i / 37;
            let c: Color = t < 0.15 ? 'cloud' : t < 0.78 ? 'mist' : 'steel';
            if (seam) c = t < 0.78 ? 'steel' : 'slate';
            if (j === 0 && !seam) c = t < 0.78 ? 'cloud' : 'mist';
            if (j === 4) c = t < 0.15 ? 'steel' : 'slate';
            if (j >= 3 && hashMoss(i, j)) c = j === 4 ? 'forest' : 'leaf';
            pc.set(x + 1 + i, y + 24 + j, c);
        }
    }
    // Rim, inner lip, then water.
    pc.ellipse(cx, y + 20, 19.5, 7.5, (_x, _y, nx, ny) => (ny < -0.25 ? (nx < 0.55 ? 'white' : 'cloud') : ny > 0.75 && nx > 0.2 ? 'mist' : 'cloud'));
    pc.ellipse(cx, y + 19.6, 17.2, 5.9, 'mist');
    pc.ellipse(cx, y + 20.4, 16.5, 5.3, (px, py, nx, ny) => {
        const r = Math.hypot(nx, ny);
        const ring = Math.abs(((r * 2.6 - f / 3 + 3) % 1) - 0.5) < 0.07 && r > 0.3;
        if (ny < -0.55) return bayer(px, py) < 0.5 ? 'blue' : 'navy';
        if (ny < -0.3) return 'blue';
        if (ring) return ny < 0.2 ? 'cyan' : 'ice';
        // A soft sky reflection band across the front of the pool.
        if (ny > 0.25 && ny < 0.6 && nx < 0.1 && bayer(px, py) < 0.35) return 'cyan';
        return 'sky';
    });
    // Pedestal with a flared foot, the upper bowl, and a little finial for the jet.
    pc.rect(cx - 3, y + 19, 6, 2, 'mist').rect(cx - 3, y + 19, 2, 2, 'cloud').rect(cx + 2, y + 19, 1, 2, 'steel');
    pc.rect(cx - 2, y + 10, 4, 10, 'mist').rect(cx - 2, y + 10, 1, 10, 'cloud').rect(cx + 1, y + 10, 1, 10, 'steel');
    pc.rect(cx - 2, y + 11, 4, 1, 'steel');
    pc.ellipse(cx, y + 9, 6.5, 2.4, (_x, _y, nx, ny) => (ny < -0.2 ? 'white' : nx > 0.5 ? 'mist' : 'cloud'));
    pc.ellipse(cx, y + 8.6, 4.6, 1.3, (_x, _y, nx) => (nx < -0.4 ? 'ice' : f === 1 && nx > 0.3 ? 'cyan' : 'sky'));
    pc.rect(cx - 1, y + 6, 2, 3, 'cloud').set(cx - 1, y + 6, 'white').set(cx, y + 8, 'mist');
    pc.outline('ink', false, { x: x - 1, y: y - 1, w: 42, h: 32 });
}

const hashMoss = (i: number, j: number) => ((i * 73 + j * 151) % 23) === 0 || ((i * 37 + j * 11) % 29) === 0;
