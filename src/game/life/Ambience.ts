/**
 * Ambient life for the town square: trees sway in a shared breeze and drop leaves, the fountain
 * sprays and ripples, the red house's chimney smokes, butterflies work the flowers, a flock of
 * birds crosses now and then, and footsteps kick up dust.
 *
 * It finds what it animates by texture key (trees, props, buildings already placed by Preview),
 * so Preview only constructs it, calls update(dt) and setVisible(on). Depth follows the scene's
 * convention: depth = y at the feet; ground decals ~ -1e8; flyers ~ 1e6.
 */
import Phaser from 'phaser';
import { PixelCanvas } from '../kit';
import {
    BUTTERFLY_MORPHS, birdTextures, butterflyTexture, dustTexture, leafTexture,
    paintFountain, smokeTexture, swayFrames, waterTextures,
} from './art';

type Img = Phaser.GameObjects.Image;

export interface AmbienceOptions {
    player?: () => Phaser.GameObjects.Sprite | undefined;
    walkers?: () => Phaser.GameObjects.Sprite[];
    /** True while the camera is inside HQ (sky flyers hide then). */
    indoors?: () => boolean;
}

/** A pooled, short-lived image with simple ballistic motion. */
interface Mote {
    img: Img;
    x: number; y: number; vx: number; vy: number;
    age: number; life: number;
    kind: 'leaf' | 'smoke' | 'drop' | 'ripple' | 'sparkle' | 'dust';
    landY: number;
    phase: number;
    /** leaf: 0 falling, 1 on the ground. drop: 0 spray, 1 drip. */
    state: number;
    frames: number;
}

interface Tree { img: Img; kind: string; x: number; y: number; h: number; key: string; sway: string | null; phase: number; stiff: number; nextLeaf: number }
interface Butterfly {
    img: Img; shadow: Img;
    gx: number; gy: number; h: number; vx: number; vy: number;
    tx: number; ty: number; th: number;
    ax: number; ay: number; range: number;
    perch: number; flap: number; phase: number; retarget: number;
    perches: { x: number; y: number; d: number }[];
    perchD: number;
}
interface Bird { img: Img; shadow: Img; ox: number; oy: number; phase: number }

const SKY = 1e6;

/** Tell a kit tree's kind from its pixels: pink blossoms, autumn oranges, or a narrow pine tip. */
function treeKind(img: Img): string {
    const m = /^preview-tree-([a-z]+)-\d+$/.exec(img.texture.key);
    if (m) return m[1];
    const src = img.texture.getSourceImage() as HTMLCanvasElement;
    const ctx = src.getContext?.('2d');
    if (!ctx) return 'oak';
    const d = ctx.getImageData(0, 0, src.width, src.height).data;
    let pink = 0, orange = 0, top = 0;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const hex = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        if (hex === 0xe26fa6) pink++;
        if (hex === 0xec7a3a) orange++;
        if (i / 4 < src.width * 5 && i / 4 >= src.width * 4) top++;
    }
    return pink > 15 ? 'cherry' : orange > 15 ? 'autumn' : top < 7 ? 'pine' : 'oak';
}
const GROUND = -1e8 + 2;
const LEANS = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3];

export class Ambience {
    private t = 0;
    private visible = true;
    private ready = false;
    private readonly still: boolean;
    private readonly objects: Img[] = [];
    private motes: Mote[] = [];
    private pool: Img[] = [];
    private trees: Tree[] = [];
    private fountain?: { x: number; y: number };
    private chimneys: { x: number; y: number; depth: number; acc: number }[] = [];
    private butterflies: Butterfly[] = [];
    private flock: Bird[] = [];
    private flockX = 0; private flockY = 0; private flockDir = 1; private nextFlock = 1.2;
    private steps = new Map<Phaser.GameObjects.Sprite, { x: number; y: number; acc: number; foot: number }>();
    private acc = { spray: 0, drip: 0, sparkle: 0 };
    private tex: ReturnType<typeof waterTextures> & ReturnType<typeof birdTextures> & { smoke: string; dust: string };

    constructor(private scene: Phaser.Scene, private opts: AmbienceOptions = {}) {
        this.still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        this.tex = {
            ...waterTextures(scene), ...birdTextures(scene),
            smoke: smokeTexture(scene), dust: dustTexture(scene),
        };
    }

    /**
     * Find what to animate. Runs on the first update, after Terrain lays out its decor (it builds on the
     * scene's first UPDATE event, which fires before the scene's own update).
     */
    private discover() {
        this.ready = true;
        const scene = this.scene;
        // Props are Sprites, trees and buildings Images: anything textured counts.
        const placed = scene.children.list.filter((o): o is Img =>
            (o instanceof Phaser.GameObjects.Image || o instanceof Phaser.GameObjects.Sprite) && !!o.texture);
        const byKey = (k: string) => placed.filter((o) => o.texture.key === k);
        for (const img of placed) {
            const key = img.texture.key;
            if (/^(preview|town|terrain)-(plaza-)?tree(-[\w-]+)?$/.test(key) && !key.endsWith('-sway')) this.addTree(img, treeKind(img));
        }
        const f = byKey('preview-prop-fountain')[0];
        if (f) {
            this.fountain = { x: f.x, y: f.y - 1 };
            this.repaintFountain(f);
        }
        for (const house of placed.filter((o) => /^(preview|town)-building-/.test(o.texture.key))) this.findChimney(house);
        // Butterflies work each cluster of flower beds (the plaza bed, the house garden, the meadow).
        const beds = placed.filter((o) => o.texture.key === 'preview-prop-flowers' || o.texture.key.startsWith('terrain-prop-flowers'));
        const clusters: Img[][] = [];
        for (const bed of beds) {
            const near = clusters.find((c) => c.some((o) => Math.hypot(o.x - bed.x, o.y - bed.y) < 70));
            if (near) near.push(bed); else clusters.push([bed]);
        }
        clusters.forEach((c, i) => this.addFlowerButterflies(c, i));
        for (const tr of this.trees.filter((t) => t.kind === 'cherry')) this.addButterfly(tr.x + 8, tr.y + 10, 2, 40, []);
        if (!this.visible) this.setVisible(false);
    }

    /** Show or hide everything (hell mode). Spawning pauses while hidden. */
    setVisible(on: boolean) {
        this.visible = on;
        for (const o of this.objects) o.setVisible(on);
        for (const m of this.motes) m.img.setVisible(on);
        if (!on) this.flock.forEach((b) => { b.img.setVisible(false); b.shadow.setVisible(false); });
    }

    update(dt: number) {
        if (!this.ready) this.discover();
        if (this.still) return;
        dt = Math.min(dt, 0.1);
        this.t += dt;
        const wind = this.wind();
        this.updateTrees(wind, dt);
        if (this.visible) {
            this.spawnFountain(dt);
            this.spawnSmoke(dt);
            this.footsteps(dt);
        }
        this.updateMotes(dt, wind);
        this.updateButterflies(dt);
        this.updateBirds(dt);
    }

    // ---------- wind ----------

    /** Shared breeze in [~0, ~1.6]: a slow swell plus an occasional gust. Positive = blowing east. */
    private wind(): number {
        const t = this.t;
        const swell = 0.45 + 0.25 * Math.sin(t * 0.31) + 0.12 * Math.sin(t * 0.83 + 1.3);
        const g = (t % 11) / 11;
        const gust = g > 0.62 ? Math.sin(((g - 0.62) / 0.38) * Math.PI) ** 2 * 0.9 : 0;
        return swell + gust;
    }

    // ---------- trees ----------

    private addTree(img: Img, kind: string) {
        const pine = kind === 'pine';
        const sway = swayFrames(this.scene, img.texture.key, LEANS, pine ? 0.66 : 0.6);
        this.trees.push({
            img, kind, x: img.x, y: img.y - 2, h: img.height, key: img.texture.key, sway,
            phase: this.trees.length * 1.7, stiff: pine ? 0.55 : 1, nextLeaf: 0.4 + this.trees.length * 0.5,
        });
    }

    private updateTrees(wind: number, dt: number) {
        for (const tr of this.trees) {
            if (!tr.sway || tr.img.texture.key !== tr.key && tr.img.texture.key !== tr.sway) continue;
            const flutter = Math.sin(this.t * 1.9 + tr.phase) * (0.55 + wind * 0.45) + Math.sin(this.t * 3.7 + tr.phase * 2) * 0.2;
            const lean = (wind * 1.1 + flutter) * tr.stiff;
            let best = 0;
            for (let i = 1; i < LEANS.length; i++) if (Math.abs(LEANS[i] - lean) < Math.abs(LEANS[best] - lean)) best = i;
            if (tr.img.texture.key !== tr.sway || String(tr.img.frame.name) !== String(best)) tr.img.setTexture(tr.sway, best);
            // Leaves: more in a gust.
            if (!this.visible || tr.kind === 'pine') continue;
            tr.nextLeaf -= dt * (0.6 + wind);
            if (tr.nextLeaf <= 0) {
                const rate = tr.kind === 'cherry' ? 1.1 : tr.kind === 'autumn' ? 1.6 : 4.5;
                tr.nextLeaf = rate * (0.5 + Math.random());
                this.spawnLeaf(tr);
            }
        }
    }

    private spawnLeaf(tr: Tree) {
        const key = leafTexture(this.scene, tr.kind);
        if (!key || this.motes.filter((m) => m.kind === 'leaf').length > 36) return;
        const x = tr.x + Phaser.Math.FloatBetween(-11, 11);
        const y = tr.y - tr.h * Phaser.Math.FloatBetween(0.45, 0.8);
        const landY = tr.y + Phaser.Math.FloatBetween(-3, 16);
        this.mote('leaf', key, x, y, 0, Phaser.Math.FloatBetween(6, 10), 20, landY, 4).img.setDepth(landY);
    }

    // ---------- fountain ----------

    private spawnFountain(dt: number) {
        const f = this.fountain;
        if (!f) return;
        this.acc.spray += dt * 34;
        while (this.acc.spray >= 1) {
            this.acc.spray -= 1;
            // Four arcs (two each side) plus a short crown that falls back into the top bowl.
            const side = Math.random() < 0.5 ? -1 : 1;
            const lane = Math.random();
            const vx = side * (lane < 0.42 ? 5 : lane < 0.84 ? 9.5 : 1.5) + Phaser.Math.FloatBetween(-0.5, 0.5);
            const vy = -(lane < 0.84 ? 31 : 26) + Phaser.Math.FloatBetween(-1.5, 1.5);
            const landY = lane < 0.84 ? f.y - 10 + (lane < 0.42 ? -1 : 1) + Phaser.Math.FloatBetween(-1, 1) : f.y - 21;
            const m = this.mote('drop', this.tex.drop, f.x + (side < 0 ? -0.5 : 0.5), f.y - 25, vx, vy, 3, landY, 0);
            m.img.setFrame(Math.random() < 0.6 ? 2 : 0).setDepth(f.y + 0.4);
        }
        this.acc.drip += dt * 14;
        while (this.acc.drip >= 1) {
            this.acc.drip -= 1;
            const side = Math.random() < 0.5 ? -1 : 1;
            const m = this.mote('drop', this.tex.drop, f.x + side * Phaser.Math.FloatBetween(5, 7), f.y - 21,
                side * Phaser.Math.FloatBetween(1, 3.5), Phaser.Math.FloatBetween(0, 4), 3, f.y - 10 + Phaser.Math.FloatBetween(-1.5, 1.5), 0);
            m.state = 1;
            m.img.setFrame(1).setDepth(f.y + 0.3);
        }
        this.acc.sparkle += dt * 2.6;
        while (this.acc.sparkle >= 1) {
            this.acc.sparkle -= 1;
            const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.8;
            this.mote('sparkle', this.tex.sparkle, f.x + Math.cos(a) * 14 * r, f.y - 10 + Math.sin(a) * 4 * r, 0, 0, 0.55, 0, 4)
                .img.setDepth(f.y + 0.5);
        }
    }

    private splash(x: number, y: number) {
        const f = this.fountain;
        if (!f) return;
        const nx = (x - f.x) / 16.5, ny = (y - (f.y - 10)) / 5.5;
        if (nx * nx + ny * ny > 0.55) return;
        if (Math.random() < 0.45) this.mote('ripple', this.tex.ripple, x, y, 0, 0, 0.75, 0, 5).img.setDepth(f.y + 0.2).setAlpha(0.85);
    }

    /** Repaint the fountain prop's frames in place (same texture key, so lighting still finds it). */
    private repaintFountain(f: Img) {
        const tex = f.texture as Phaser.Textures.CanvasTexture;
        const src = tex.getSourceImage() as HTMLCanvasElement;
        const ctx = src.getContext?.('2d');
        if (!ctx || src.height !== 32 || src.width < 42) return;
        const frames = Math.floor(src.width / 42);
        const pc = new PixelCanvas(src.width, src.height);
        for (let i = 0; i < frames; i++) paintFountain(pc, i % 3, i * 42 + 1, 1);
        ctx.clearRect(0, 0, src.width, src.height);
        ctx.drawImage(pc.flush(), 0, 0);
        if (typeof tex.refresh === 'function') tex.refresh();
    }

    // ---------- chimney ----------

    /** The kit paints the chimney cap in steel on row 1; find it in the house texture. */
    private findChimney(house: Img) {
        const src = house.texture.getSourceImage() as HTMLCanvasElement;
        const ctx = src.getContext?.('2d');
        if (!ctx) return;
        const row = ctx.getImageData(0, 1, src.width, 1).data;
        let x0 = -1, x1 = -1;
        for (let x = 0; x < src.width; x++) {
            const [r, g, b] = [row[x * 4], row[x * 4 + 1], row[x * 4 + 2]];
            if (r === 0x5d && g === 0x6b && b === 0x85) { if (x0 < 0) x0 = x; x1 = x; }
        }
        if (x0 < 0) return;
        const left = house.x - src.width * house.originX;
        const top = house.y - src.height * house.originY;
        this.chimneys.push({ x: left + (x0 + x1 + 1) / 2, y: top + 1, depth: house.depth + 1, acc: Math.random() });
    }

    private spawnSmoke(dt: number) {
        for (const c of this.chimneys) {
        c.acc += dt / 0.42;
        while (c.acc >= 1) {
            c.acc -= 1;
            const m = this.mote('smoke', this.tex.smoke, c.x + Phaser.Math.FloatBetween(-1, 1), c.y - 1, 0, -Phaser.Math.FloatBetween(9, 12), Phaser.Math.FloatBetween(5, 6.5), 0, 6);
            m.img.setDepth(c.depth).setAlpha(0);
        }
        }
    }

    // ---------- footsteps ----------

    private footsteps(dt: number) {
        const movers: [Phaser.GameObjects.Sprite, boolean][] = [];
        const p = this.opts.player?.();
        if (p) movers.push([p, true]);
        for (const w of this.opts.walkers?.() ?? []) movers.push([w, false]);
        for (const [s, isPlayer] of movers) {
            let st = this.steps.get(s);
            if (!st) { st = { x: s.x, y: s.y, acc: 0, foot: 0 }; this.steps.set(s, st); }
            const moved = Math.hypot(s.x - st.x, s.y - st.y);
            st.x = s.x; st.y = s.y;
            if (!s.visible || moved < 0.05 || moved > 20) { st.acc = 0.7; continue; }
            st.acc += moved / (isPlayer ? 11 : 14);
            if (st.acc < 1) continue;
            st.acc = 0;
            st.foot ^= 1;
            const m = this.mote('dust', this.tex.dust, s.x + (st.foot ? 2 : -2), s.y + 0.5, 0, -2, 0.42, 0, 4);
            m.img.setDepth(s.y - 0.5).setAlpha(isPlayer ? 0.75 : 0.5).setOrigin(0.5, 1);
        }
    }

    // ---------- motes ----------

    private mote(kind: Mote['kind'], key: string, x: number, y: number, vx: number, vy: number, life: number, landY: number, frames: number): Mote {
        const img = (this.pool.pop() ?? this.scene.add.image(0, 0, key)).setTexture(key, 0)
            .setActive(true).setVisible(this.visible).setAlpha(1).setOrigin(0.5).setFlipX(false);
        img.clearTint?.();
        const m: Mote = { img, x, y, vx, vy, age: 0, life, kind, landY, phase: Math.random() * 10, state: 0, frames };
        img.setPosition(Math.round(x), Math.round(y));
        this.motes.push(m);
        return m;
    }

    private updateMotes(dt: number, wind: number) {
        const keep: Mote[] = [];
        for (const m of this.motes) {
            m.age += dt;
            if (this.step(m, dt, wind)) {
                m.img.setPosition(Math.round(m.x), Math.round(m.y));
                keep.push(m);
            } else {
                m.img.setVisible(false).setActive(false);
                this.pool.push(m.img);
            }
        }
        this.motes = keep;
    }

    /** Advance one mote; false when it's done. */
    private step(m: Mote, dt: number, wind: number): boolean {
        const k = m.age / m.life;
        switch (m.kind) {
            case 'leaf': {
                if (m.state === 0) {
                    m.x += (Math.sin(m.age * 2.4 + m.phase) * 9 + wind * 7) * dt;
                    m.y += m.vy * dt * (0.75 + 0.35 * Math.sin(m.age * 4.8 + m.phase));
                    if (Math.floor(m.age * 7 + m.phase) !== Math.floor((m.age - dt) * 7 + m.phase)) m.img.setFrame(Math.floor(m.age * 7 + m.phase) % 4);
                    if (m.y >= m.landY) {
                        m.state = 1; m.y = m.landY; m.age = 0; m.life = Phaser.Math.FloatBetween(3, 6);
                        m.img.setDepth(GROUND).setFrame(Math.random() < 0.5 ? 1 : 3);
                    }
                    return m.age < 20;
                }
                if (k > 0.7) m.img.setAlpha(1 - (k - 0.7) / 0.3);
                return k < 1;
            }
            case 'smoke': {
                m.vy *= 1 - 0.18 * dt;
                m.y += m.vy * dt;
                m.x += (wind * 6 * Math.min(1, m.age * 0.8) + Math.sin(m.age * 2.1 + m.phase) * 2.2) * dt;
                m.img.setFrame(Math.min(m.frames - 1, Math.floor(k * m.frames)));
                m.img.setAlpha(Math.min(1, m.age / 0.4) * (1 - k ** 1.6) * 0.82);
                return k < 1;
            }
            case 'drop': {
                m.vy += (m.state ? 70 : 105) * dt;
                m.x += m.vx * dt;
                m.y += m.vy * dt;
                if (m.state === 0 && m.vy > 0) m.img.setFrame(m.vy > 14 ? 1 : 0);
                if (m.vy > 4 && m.y >= m.landY) {
                    if (m.landY > (this.fountain?.y ?? 0) - 15) this.splash(m.x, m.landY);
                    return false;
                }
                return m.age < m.life;
            }
            case 'ripple':
            case 'sparkle':
            case 'dust': {
                if (m.kind === 'dust') { m.y += m.vy * dt; m.vy *= 1 - 3 * dt; }
                m.img.setFrame(Math.min(m.frames - 1, Math.floor(k * m.frames)));
                if (m.kind === 'ripple' && k > 0.6) m.img.setAlpha(0.85 * (1 - (k - 0.6) / 0.4));
                return k < 1;
            }
        }
    }

    // ---------- butterflies ----------

    private addFlowerButterflies(beds: Img[], cluster: number) {
        // Flower heads in the kit's 12x9 bed (frame padded by 1px; origin bottom-centre at y + 1).
        const perches = beds.flatMap((bed) => {
            const left = bed.x - 7, top = bed.y - 11;
            return [[2, 3], [6, 1], [9, 4], [4, 6]].map(([x, y]) => ({ x: left + 1 + x, y: top + 1 + y, d: bed.depth + 0.5 }));
        });
        const cx = beds.reduce((a, o) => a + o.x, 0) / beds.length;
        const cy = beds.reduce((a, o) => a + o.y, 0) / beds.length - 1;
        const n = cluster === 0 ? 3 : 2;
        for (let i = 0; i < n; i++) this.addButterfly(cx + (i - 1) * 9, cy - 4 + i * 3, cluster * 2 + i, 40 + i * 8, perches);
    }

    private addButterfly(x: number, y: number, morph: number, range: number, perches: { x: number; y: number; d: number }[]) {
        const key = butterflyTexture(this.scene, morph % BUTTERFLY_MORPHS.length);
        const img = this.scene.add.image(x, y, key, 0).setOrigin(0.5, 1);
        const shadow = this.scene.add.image(x, y, this.tex.dot).setAlpha(0.22).setDepth(GROUND);
        this.objects.push(img, shadow);
        this.butterflies.push({
            img, shadow, gx: x + morph * 7, gy: y, h: 10, vx: 0, vy: 0, tx: x, ty: y, th: 10,
            ax: x, ay: y, range, perch: 0, flap: Math.random(), phase: morph * 2.1, retarget: 0, perches, perchD: 0,
        });
    }

    private updateButterflies(dt: number) {
        for (const b of this.butterflies) {
            b.retarget -= dt;
            if (b.perch > 0) {
                b.perch -= dt;
                // Perched: wings mostly closed, a slow open now and then.
                const open = Math.sin(this.t * 2.2 + b.phase) > 0.75;
                b.img.setFrame(open ? 1 : 2);
                if (b.perch <= 0) { b.retarget = 0; b.th = 12; }
            } else {
                if (b.retarget <= 0) {
                    const perch = b.perches.length && Math.random() < 0.35 ? b.perches[Math.floor(Math.random() * b.perches.length)] : null;
                    if (perch) { b.tx = perch.x; b.ty = perch.y + 1; b.th = 0.01; b.perchD = perch.d; }
                    else {
                        b.perchD = 0;
                        b.tx = b.ax + Phaser.Math.FloatBetween(-b.range, b.range);
                        b.ty = b.ay + Phaser.Math.FloatBetween(-b.range * 0.45, b.range * 0.45);
                        b.th = Phaser.Math.FloatBetween(7, 18);
                    }
                    b.retarget = Phaser.Math.FloatBetween(1.6, 3.4);
                }
                const dx = b.tx - b.gx, dy = b.ty - b.gy;
                const d = Math.hypot(dx, dy) || 1;
                const sp = 26;
                b.vx += ((dx / d) * sp - b.vx) * Math.min(1, dt * 2.2) + Math.sin(this.t * 7.3 + b.phase) * 30 * dt;
                b.vy += ((dy / d) * sp * 0.7 - b.vy) * Math.min(1, dt * 2.2) + Math.cos(this.t * 5.9 + b.phase) * 22 * dt;
                b.gx += b.vx * dt;
                b.gy += b.vy * dt;
                b.h += (b.th - b.h) * Math.min(1, dt * 2.5);
                const landing = b.th < 0.1 && d < 2.5 && b.h < 1.5;
                if (landing) { b.gx = b.tx; b.gy = b.ty; b.h = 0; b.vx = b.vy = 0; b.perch = Phaser.Math.FloatBetween(2.5, 5); }
                b.flap += dt * 11;
                b.img.setFrame([0, 1, 2, 1][Math.floor(b.flap) % 4]).setFlipX(b.vx < 0);
            }
            const bob = b.perch > 0 ? 0 : Math.sin(this.t * 6 + b.phase) * 1.5;
            // Ground line is just below the bed so they sort in front of the flowers they sit on.
            b.img.setPosition(Math.round(b.gx), Math.round(b.gy - b.h - bob)).setDepth(b.perch > 0 && b.perchD ? b.perchD : b.gy + 1.5);
            b.shadow.setPosition(Math.round(b.gx), Math.round(b.gy + 1)).setVisible(this.visible && b.h > 1.5);
        }
    }

    // ---------- birds ----------

    private updateBirds(dt: number) {
        const cam = this.scene.cameras.main.worldView;
        if (!this.flock.length) {
            this.nextFlock -= dt;
            if (this.nextFlock > 0 || !this.visible) return;
            this.flockDir = Math.random() < 0.7 ? 1 : -1;
            this.flockX = this.flockDir > 0 ? cam.x - 40 : cam.right + 40;
            this.flockY = Phaser.Math.FloatBetween(cam.y + cam.height * 0.15, cam.y + cam.height * 0.55);
            const n = 5 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) {
                const rank = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
                const img = this.scene.add.image(0, 0, this.tex.bird, 0).setDepth(SKY).setFlipX(this.flockDir < 0);
                const shadow = this.scene.add.image(0, 0, this.tex.shadow).setDepth(GROUND).setAlpha(0.14);
                this.flock.push({ img, shadow, ox: -rank * 8 * this.flockDir + Phaser.Math.FloatBetween(-1.5, 1.5), oy: rank * 5 * side + Phaser.Math.FloatBetween(-1, 1), phase: Math.random() * 6 });
            }
        }
        this.flockX += this.flockDir * 44 * dt;
        this.flockY += Math.sin(this.t * 0.7) * 3 * dt;
        const hide = !this.visible || !!this.opts.indoors?.();
        for (const b of this.flock) {
            const x = this.flockX + b.ox + Math.sin(this.t * 1.3 + b.phase) * 2;
            const y = this.flockY + b.oy + Math.sin(this.t * 2.1 + b.phase) * 1.5;
            const beat = (this.t * 2.2 + b.phase) % 3;
            // Flap a few beats, then glide on the middle frame.
            const frame = beat < 1.2 ? [0, 1, 2, 1][Math.floor(beat * 10) % 4] : 1;
            b.img.setPosition(Math.round(x), Math.round(y)).setFrame(frame).setVisible(!hide);
            b.shadow.setPosition(Math.round(x + 18), Math.round(y + 64)).setVisible(!hide);
        }
        const gone = this.flockDir > 0 ? this.flockX - 80 > cam.right : this.flockX + 80 < cam.x;
        if (gone) {
            this.flock.forEach((b) => { b.img.destroy(); b.shadow.destroy(); });
            this.flock = [];
            this.nextFlock = Phaser.Math.FloatBetween(16, 30);
        }
    }


}
