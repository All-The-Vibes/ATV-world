import Phaser from 'phaser';
import { FRAME_H, FRAME_W, PixelCanvas, addPixels, bayer, fbm, hash, stripFrames, type Ink } from '../kit';

const W = 440;
const H = 320;
const CX = W / 2;
const CY = H / 2;
const RX = 180;
const RY = 130;
/** Where the castle stands on the lakebed (its gate's sill). */
const BASE = 222;
const SURFACE_FRAMES = 4;
/** Lakebed under shadows (-1e8), with the life in the water stacked just above it. */
const BED = -1e8 - 5;
const GLOW = -1e8 - 4.5;
const FISH = -1e8 - 4;
const SURFACE = -1e8 - 3.5;
const BUBBLES = -1e8 - 3;
/** How much of a swimmer is under the water. */
const WADE = 8;

type Point = { x: number; y: number };
type Swimmer = { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image };

/** How far (x, y) is from the middle of the lake: under 1 is water, a little over is the shore. */
function reach(x: number, y: number): number {
    const nx = (x + 0.5 - CX) / RX;
    const ny = (y + 0.5 - CY) / RY;
    const angle = Math.atan2(ny, nx);
    const edge = 1 + (fbm(Math.cos(angle) * 60 + 200, Math.sin(angle) * 60 + 200, 28, 7) - 0.5) * 0.24;
    return Math.hypot(nx, ny) / edge;
}

function tower(pc: PixelCanvas, x: number, w: number, h: number, roof: number, windows: Point[], tips: Point[]) {
    const left = Math.round(x - w / 2);
    const top = BASE - h;
    for (let j = top; j < BASE; j++) {
        for (let i = left; i < left + w; i++) {
            const u = (i - left) / (w - 1);
            const row = j - top;
            const brick = row % 5 === 0 || ((i - left + (Math.floor(row / 5) % 2) * 3) % 6 === 0 && hash(i, j, 3) < 0.6);
            const c: Ink = u < 0.18 ? 'mist' : u > 0.78 ? 'slate' : 'steel';
            pc.set(i, j, brick ? (c === 'mist' ? 'steel' : 'slate') : c);
        }
    }
    // A pointed roof, lit from the left.
    for (let j = 0; j < roof; j++) {
        const half = (w / 2 + 2) * (1 - j / roof);
        for (let i = Math.floor(x - half); i <= Math.ceil(x + half - 1); i++) {
            const c: Ink = i < x - half * 0.35 ? 'pink' : i < x + half * 0.3 ? 'violet' : 'plum';
            pc.set(i, top - 1 - j, (top - 1 - j) % 4 === 0 && c === 'violet' ? 'plum' : c);
        }
    }
    if (roof > 0) {
        pc.set(Math.floor(x) - 1, top - roof - 1, 'violet').set(Math.floor(x) - 1, top - roof - 2, 'pink');
        tips.push({ x: Math.floor(x), y: top - roof - 2 });
    }
    for (let j = top + 8; j < BASE - 14; j += 16) windows.push({ x: Math.floor(x) - 1, y: j });
}

function crenellate(pc: PixelCanvas, left: number, right: number, top: number) {
    for (let i = left; i <= right; i++) if (Math.floor((i - left) / 3) % 2 === 0) pc.rect(i, top - 3, 1, 3, i % 6 < 2 ? 'mist' : 'steel');
}

function sunkenCastle() {
    const pc = new PixelCanvas(W, H);
    const windows: Point[] = [];
    const tips: Point[] = [];
    // The curtain wall, its towers, and the great tower in the middle under a glass dome.
    for (let j = BASE - 44; j < BASE; j++) {
        for (let i = CX - 84; i < CX + 84; i++) {
            const brick = (j - BASE) % 5 === 0 || ((i + (Math.floor(j / 5) % 2) * 4) % 8 === 0 && hash(i, j, 5) < 0.7);
            pc.set(i, j, brick ? 'slate' : j < BASE - 40 ? 'mist' : 'steel');
        }
    }
    crenellate(pc, CX - 84, CX + 83, BASE - 44);
    tower(pc, CX - 80, 24, 86, 30, windows, tips);
    tower(pc, CX + 80, 24, 86, 30, windows, tips);
    tower(pc, CX - 46, 20, 108, 36, windows, tips);
    tower(pc, CX + 46, 20, 108, 36, windows, tips);
    const tall = 128;
    tower(pc, CX, 30, tall, 0, windows, tips);
    pc.ellipse(CX, BASE - tall, 17, 16, (_x, y, nx, ny) => (y > BASE - tall ? null : nx < -0.3 && ny < -0.3 ? 'white' : nx < 0.2 ? 'ice' : 'cyan'));
    pc.rect(CX - 17, BASE - tall, 34, 2, 'gold');
    pc.line(CX, BASE - tall - 16, CX, BASE - tall - 28, 'gold').set(CX, BASE - tall - 29, 'yellow');
    tips.push({ x: CX, y: BASE - tall - 29 });
    // The keep: a big arched gate with its portcullis up, and a rose window.
    const keepW = 56;
    for (let j = BASE - 58; j < BASE; j++) {
        for (let i = CX - keepW / 2; i < CX + keepW / 2; i++) {
            const u = (i - (CX - keepW / 2)) / keepW;
            const brick = (j - BASE) % 5 === 0 || ((i + (Math.floor(j / 5) % 2) * 3) % 7 === 0 && hash(i, j, 9) < 0.7);
            pc.set(i, j, brick ? 'slate' : u < 0.15 ? 'mist' : u > 0.85 ? 'slate' : 'steel');
        }
    }
    crenellate(pc, CX - keepW / 2, CX + keepW / 2 - 1, BASE - 58);
    pc.ellipse(CX, BASE - 22, 11, 12, 'night').rect(CX - 11, BASE - 22, 22, 22, 'night');
    for (let i = CX - 9; i <= CX + 9; i += 3) pc.line(i, BASE - 31, i, BASE - 26, 'steel');
    pc.ellipse(CX, BASE - 22, 11, 12, (_x, y, nx, ny) => (Math.hypot(nx, ny) > 0.86 && y <= BASE - 22 ? 'gold' : null));
    pc.ellipse(CX, BASE - 45, 7, 7, (_x, _y, nx, ny) => (Math.hypot(nx, ny) > 0.7 ? 'gold' : Math.abs(nx) < 0.15 || Math.abs(ny) < 0.15 ? 'violet' : 'cyan'));
    for (const dx of [-66, -60, -34, 32, 60, 66]) pc.rect(CX + dx, BASE - 30, 2, 6, 'night');
    pc.outline('night', true);

    // The water between you and the castle: deeper down means bluer.
    const top = BASE - tall - 30;
    for (let j = 0; j < H; j++) {
        for (let i = 0; i < W; i++) {
            if (!pc.filled(i, j)) continue;
            if (0.12 + ((j - top) / (BASE - top)) * 0.3 > bayer(i, j)) pc.set(i, j, j % 2 ? 'blue' : 'navy');
        }
    }
    for (const w of windows) pc.rect(w.x, w.y, 2, 4, 'cyan').set(w.x, w.y, 'ice');
    return { castle: pc, windows, tips };
}

function weed(pc: PixelCanvas, x: number, y: number, h: number, seed: number) {
    for (let j = 0; j < h; j++) pc.set(x + Math.round(Math.sin(j * 0.6 + seed) * 1.2), y - j, j % 3 === 0 ? 'leaf' : 'forest');
}

function coral(pc: PixelCanvas, x: number, y: number, color: 'pink' | 'orange', seed: number) {
    const tip: Ink = color === 'pink' ? 'peach' : 'gold';
    for (let b = -1; b <= 1; b++) {
        const h = 5 + Math.floor(hash(x, b, seed) * 5);
        pc.line(x, y, x + b * 3, y - h, color).set(x + b * 3, y - h - 1, tip);
    }
}

/** The lake with the castle lying on its bed, its shimmering surface, and where the water and the lit windows are. */
export function lakeArt() {
    const pc = new PixelCanvas(W, H);
    const mask = new Uint8Array(W * H);
    const deep: Ink[] = ['navy', 'blue', 'sky', 'cyan'];
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const d = reach(x, y);
            if (d >= 1.08) continue;
            if (d >= 1) {
                pc.set(x, y, d > 1.05 ? (hash(x, y, 1) < 0.5 ? 'sand' : 'clay') : hash(x, y, 2) < 0.15 ? 'cream' : 'sand');
                continue;
            }
            mask[y * W + x] = 1;
            if (d > 0.96) {
                pc.set(x, y, 'clay');
                continue;
            }
            // Bands from deep in the middle to shallow at the edge, dithered into each other.
            const t = Math.max(0, Math.min(deep.length - 1.001, ((d - 0.35) / 0.61) * (deep.length - 1)));
            const k = Math.floor(t);
            pc.mix(x, y, deep[k], deep[k + 1], (t - k) ** 2);
        }
    }
    // The lakebed: a dark hollow under the castle, rocks, weed and coral.
    pc.ellipse(CX, BASE - 2, 104, 18, (x, y, nx, ny) => (Math.hypot(nx, ny) > bayer(x, y) * 0.6 + 0.4 ? null : 'night'));
    const r = (i: number, s: number) => hash(i, s, 11);
    for (let i = 0; i < 70; i++) {
        const x = Math.floor(CX + (r(i, 1) - 0.5) * RX * 1.6);
        const y = Math.floor(CY + (r(i, 2) - 0.5) * RY * 1.5);
        if (reach(x, y) > 0.82) continue;
        if (i % 3 === 0) pc.ellipse(x, y, 2 + r(i, 3) * 3, 1.5 + r(i, 4) * 1.5, (_x, _y, nx, ny) => (ny < -0.2 && nx < 0.2 ? 'steel' : 'slate'));
        else weed(pc, x, y, 6 + Math.floor(r(i, 5) * 10), i);
    }
    const { castle, windows, tips } = sunkenCastle();
    pc.blit(castle, 0, 0);
    for (let i = 0; i < 26; i++) {
        const x = Math.floor(CX - 100 + r(i, 6) * 200);
        const y = BASE + 1 + Math.floor(r(i, 7) * 6);
        if (i % 2) coral(pc, x, y, i % 4 === 1 ? 'pink' : 'orange', i);
        else weed(pc, x, y, 8 + Math.floor(r(i, 8) * 14), i * 7);
    }
    // Reeds and cattails along the shore.
    for (let i = 0; i < 22; i++) {
        const a = r(i, 9) * Math.PI * 2;
        let x = CX + Math.cos(a) * RX * 0.8;
        let y = CY + Math.sin(a) * RY * 0.8;
        for (let s = 0; s < 80 && reach(x, y) < 1; s++) { x += Math.cos(a); y += Math.sin(a); }
        for (let n = 0; n < 4; n++) {
            const h = 6 + Math.floor(r(i * 4 + n, 10) * 7);
            const bx = Math.floor(x) + n * 2 - 3;
            const by = Math.floor(y) + (n % 2);
            if (by - h < 1) continue;
            pc.line(bx, by, bx + (n === 0 ? -1 : n === 3 ? 1 : 0), by - h, n % 2 ? 'leaf' : 'forest');
            if (n % 2 === 0) pc.rect(bx + (n === 0 ? -1 : 0), by - h - 1, 1, 3, 'earth');
        }
    }

    // The surface: light dancing on the water and foam lapping the shore, a few frames of it.
    const surface = new PixelCanvas(W * SURFACE_FRAMES, H);
    for (let f = 0; f < SURFACE_FRAMES; f++) {
        const p = (f / SURFACE_FRAMES) * Math.PI * 2;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (!mask[y * W + x]) continue;
                const d = reach(x, y);
                if (d > 0.9) {
                    const lap = 0.22 + Math.sin(Math.atan2(y - CY, x - CX) * 9 + p) * 0.2;
                    if (hash(x, y, f + 20) < lap) surface.set(f * W + x, y, d > 0.95 ? 'white' : 'ice');
                    continue;
                }
                const v = Math.sin(x * 0.19 + Math.sin(y * 0.11 + p) * 2.4 + p) + Math.sin(y * 0.23 + Math.sin(x * 0.07 - p) * 2.1);
                if (v > 1.72) surface.set(f * W + x, y, v > 1.9 ? 'white' : 'ice');
            }
        }
    }
    return { canvas: pc, surface, mask, windows, tips };
}

type Fish = { sprite: Phaser.GameObjects.Sprite; cx: number; cy: number; rx: number; ry: number; angle: number; speed: number };

/**
 * A huge lake with a castle sunk to the bottom of it: lit windows, fish circling the towers, bubbles rising off
 * the spires, and light rippling over the surface. Walk into the water and you swim.
 */
export class Lake {
    /** The lake and its shore, in world space. */
    readonly bounds: Phaser.Geom.Rectangle;
    /** What the world's bounds should include. */
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    private readonly mask: Uint8Array;
    private readonly tips: Point[];
    private readonly fish: Fish[] = [];
    private readonly still: boolean;
    private bubbleIn = 0;
    private rippleIn = 0;
    private swimmer?: Swimmer;

    constructor(private readonly scene: Phaser.Scene, x: number, y: number) {
        const left = Math.round(x - W / 2);
        const top = Math.round(y - H / 2);
        this.bounds = new Phaser.Geom.Rectangle(left, top, W, H);
        this.still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        const art = lakeArt();
        this.mask = art.mask;
        this.tips = art.tips.map((p) => ({ x: left + p.x, y: top + p.y }));
        addPixels(scene, 'lake-bed', art.canvas);
        addPixels(scene, 'lake-surface', art.surface, stripFrames(SURFACE_FRAMES, W, H));
        this.textures();

        this.parts.push(scene.add.image(left, top, 'lake-bed').setOrigin(0).setDepth(BED));
        const surface = scene.add.sprite(left, top, 'lake-surface', 0).setOrigin(0).setDepth(SURFACE)
            .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3);
        if (!this.still) {
            if (!scene.anims.exists('lake-surface')) {
                scene.anims.create({
                    key: 'lake-surface',
                    frames: Array.from({ length: SURFACE_FRAMES }, (_, frame) => ({ key: 'lake-surface', frame })),
                    frameRate: 3,
                    repeat: -1,
                });
            }
            surface.play('lake-surface');
        }

        art.windows.forEach((w, i) => {
            const glow = scene.add.image(left + w.x + 1, top + w.y + 2, 'lake-glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(GLOW);
            if (!this.still) {
                scene.tweens.add({ targets: glow, alpha: { from: 0.2, to: 0.6 }, duration: 1100 + (i % 5) * 230, delay: i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            }
        });
        for (let i = 0; i < 9; i++) {
            this.fish.push({
                sprite: scene.add.sprite(0, 0, 'lake-fish', i % 3 === 0 ? 2 : 0).setDepth(FISH).setAlpha(0.9),
                cx: left + CX + (hash(i, 1, 40) - 0.5) * 40,
                cy: top + CY + (hash(i, 2, 40) - 0.5) * 30,
                rx: 50 + hash(i, 3, 40) * 80,
                ry: 24 + hash(i, 4, 40) * 44,
                angle: hash(i, 5, 40) * Math.PI * 2,
                speed: (0.25 + hash(i, 6, 40) * 0.35) * (i % 2 ? 1 : -1),
            });
        }
        this.update(0);
    }

    /** Is (x, y) in the water? */
    contains(x: number, y: number): boolean {
        const i = Math.floor(x - this.bounds.x);
        const j = Math.floor(y - this.bounds.y);
        return i >= 0 && j >= 0 && i < W && j < H && this.mask[j * W + i] === 1;
    }

    /** Swim the fish, blow bubbles, and wade whoever's in the water (the player, unless they're indoors). */
    update(dt: number, player?: Swimmer) {
        for (const f of this.fish) {
            if (!this.still) f.angle += f.speed * dt;
            f.sprite
                .setPosition(Math.round(f.cx + Math.cos(f.angle) * f.rx), Math.round(f.cy + Math.sin(f.angle) * f.ry))
                .setFlipX(-Math.sin(f.angle) * f.speed > 0)
                .setFrame((Number(f.sprite.frame.name) & 2) | (Math.floor(f.angle * 6) & 1));
        }
        if (!this.still && dt > 0) {
            this.bubbleIn -= dt;
            if (this.bubbleIn <= 0) {
                this.bubbleIn = 0.18 + Math.random() * 0.3;
                const from = Math.random() < 0.7 ? Phaser.Utils.Array.GetRandom(this.tips) as Point : (Phaser.Utils.Array.GetRandom(this.fish) as Fish).sprite;
                this.bubble(from.x + Phaser.Math.Between(-2, 2), from.y);
            }
        }
        this.wade(dt, player);
    }

    private wade(dt: number, player?: Swimmer) {
        const swimming = player && this.contains(player.sprite.x, player.sprite.y) ? player : undefined;
        if (this.swimmer && this.swimmer !== swimming) {
            this.swimmer.sprite.setCrop();
            this.swimmer.shadow.setVisible(true);
            this.swimmer = undefined;
        }
        if (!swimming) return;
        if (!this.swimmer) {
            this.swimmer = swimming;
            this.ripple(swimming.sprite.x, swimming.sprite.y - WADE, 1.6);
        }
        swimming.sprite.setCrop(0, 0, FRAME_W, FRAME_H - WADE);
        swimming.shadow.setVisible(false);
        this.rippleIn -= dt;
        if (this.rippleIn <= 0 && !this.still) {
            this.rippleIn = swimming.sprite.anims.isPlaying ? 0.28 : 0.9;
            this.ripple(swimming.sprite.x, swimming.sprite.y - WADE, 1);
        }
    }

    private bubble(x: number, y: number) {
        const b = this.scene.add.image(x, y, 'lake-bubble').setDepth(BUBBLES).setAlpha(0.8).setScale(Math.random() < 0.3 ? 0.67 : 1);
        this.scene.tweens.add({
            targets: b,
            y: y - Phaser.Math.Between(16, 36),
            x: x + Phaser.Math.Between(-4, 4),
            alpha: 0,
            duration: Phaser.Math.Between(1400, 2400),
            ease: 'Sine.easeIn',
            onComplete: () => b.destroy(),
        });
    }

    private ripple(x: number, y: number, size: number) {
        const ring = this.scene.add.image(x, y, 'lake-ripple').setDepth(y - 0.5).setAlpha(0.8).setScale(0.6 * size);
        this.scene.tweens.add({ targets: ring, scale: 1.7 * size, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }

    private textures() {
        const glow = new PixelCanvas(11, 11);
        glow.ellipse(5.5, 5.5, 5.5, 5.5, (x, y, nx, ny) => (Math.hypot(nx, ny) < 0.4 ? 'cyan' : (1 - Math.hypot(nx, ny)) * 1.4 > bayer(x, y) ? 'sky' : null));
        addPixels(this.scene, 'lake-glow', glow);
        const bubble = new PixelCanvas(3, 3);
        bubble.set(1, 0, 'ice').set(0, 1, 'ice').set(2, 1, 'ice').set(1, 2, 'ice').set(0, 0, 'white');
        addPixels(this.scene, 'lake-bubble', bubble);
        const ripple = new PixelCanvas(16, 6);
        ripple.ellipse(8, 3, 8, 3, 'ice').ellipse(8, 3, 6.5, 2, null);
        addPixels(this.scene, 'lake-ripple', ripple);
        // Fish, two tail wags each: frames 0-1 gold, 2-3 pink.
        const fish = new PixelCanvas(36, 5);
        ([['gold', 'orange'], ['pink', 'violet']] as const).forEach(([body, fin], k) => {
            for (let f = 0; f < 2; f++) {
                const ox = (k * 2 + f) * 9;
                fish.ellipse(ox + 4, 2.5, 3.5, 2, body).set(ox + 2, 1, 'white').set(ox + 2, 2, 'ink');
                fish.set(ox + 7, f ? 1 : 2, fin).set(ox + 8, f ? 0 : 1, fin).set(ox + 8, f ? 2 : 3, fin);
                fish.set(ox + 4, 0, fin).set(ox + 5, 4, fin);
            }
        });
        addPixels(this.scene, 'lake-fish', fish, stripFrames(4, 9, 5));
    }
}
