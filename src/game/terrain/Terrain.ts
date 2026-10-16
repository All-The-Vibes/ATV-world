import Phaser from 'phaser';
import { PROPS, TREE_PRESETS, addPixels, hashString, rng, paintProp, shadowTexture, stripFrames, treeArt, type PixelCanvas, type PropOptions } from '../kit';
import { glintArt, pondShimmerArt, reedsArt, rippleArt, SWAY_FRAMES, tallGrassArt } from './art';
import { paintGround, paintOutskirts, spline, type Extras, type GroundArt } from './ground';
import { PATHS, PLAZA, POND } from './layout';

/** The ground sits just above Preview's fallback grass (-1e9) and below every shadow (-1e8). */
const DEPTH = -1e9 + 10;

let painted: { key: string; art: GroundArt } | null = null;

export interface TerrainOptions {
    /** The town's extent (Preview's worldBounds). The meadow darkens gently outside it. */
    bounds: () => Phaser.Geom.Rectangle;
}

type Thing = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite;

/** Props from the kit, placed with depth = y and origin at the bottom like the rest of town. */
const PROP_DECOR: { name: string; x: number; y: number; opts?: PropOptions; flip?: boolean }[] = [
    // Front garden of the house, either side of the door path.
    { name: 'flowers', x: -340, y: -64, opts: { colors: ['red', 'yellow', 'white'] } },
    { name: 'flowers', x: -327, y: -66, opts: { colors: ['pink', 'white', 'violet'] } },
    { name: 'flowers', x: -284, y: -66, opts: { colors: ['yellow', 'orange', 'white'] } },
    { name: 'flowers', x: -270, y: -64, opts: { colors: ['red', 'pink', 'yellow'] } },
    { name: 'bush', x: -364, y: -70, opts: { seed: 4 } },
    { name: 'bush', x: -246, y: -70, opts: { seed: 9, berries: 'red' } },
    // By ATV HQ.
    { name: 'bush', x: 164, y: -98, opts: { seed: 6 } },
    { name: 'bush', x: 236, y: -66, opts: { seed: 12, berries: 'pink' } },
    // By the pond.
    { name: 'rock', x: POND.x - 86, y: POND.y - 10, opts: { seed: 3, moss: 'leaf' } },
    { name: 'rock', x: POND.x + 86, y: POND.y + 26, opts: { seed: 8 } },
    { name: 'mushroom', x: POND.x + 52, y: POND.y + 58, opts: { color: 'red' } },
    // Under the trees.
    { name: 'mushroom', x: -176, y: -92, opts: { color: 'red' } },
    { name: 'mushroom', x: 384, y: 128, opts: { color: 'orange' } },
    { name: 'mushroom', x: -356, y: 36, opts: { color: 'red' } },
    // Signposts where the lanes leave town.
    { name: 'sign', x: 42, y: 392 },
    { name: 'sign', x: -414, y: 12 },
    // The south meadow: a little fenced corner, rocks, a log.
    { name: 'fence', x: -336, y: 266, opts: { length: 3, color: 'wood' } },
    { name: 'flowers', x: -350, y: 256, opts: { colors: ['pink', 'violet', 'white'] } },
    { name: 'flowers', x: -334, y: 255, opts: { colors: ['yellow', 'red', 'white'] } },
    { name: 'flowers', x: -318, y: 256, opts: { colors: ['pink', 'yellow', 'violet'] } },
    { name: 'bush', x: -376, y: 292, opts: { seed: 5 } },
    { name: 'rock', x: -276, y: 300, opts: { seed: 11, moss: 'leaf' } },
    { name: 'log', x: -218, y: 290 },
    { name: 'mushroom', x: -206, y: 296, opts: { color: 'orange' } },
    { name: 'bush', x: 118, y: 296, opts: { seed: 7 } },
    { name: 'rock', x: 152, y: 306, opts: { seed: 2 } },
    { name: 'bush', x: 384, y: 270, opts: { seed: 10, berries: 'red' } },
    { name: 'rock', x: -88, y: 304, opts: { seed: 13, moss: 'leaf' } },
];

/** Reeds and cattails around the pond. */
const REEDS = ([[-70, 6], [-56, -20], [-18, -30], [18, -32], [52, -24], [72, -6], [62, 24]] as const)
    .map(([dx, dy]): [number, number] => [POND.x + dx, POND.y + dy]);

/**
 * The ground of town: one big painted texture (meadow, plaza, lanes, pond) plus a few dozen
 * small sprites that need depth or motion (tall grass, reeds, water shimmer, bushes and rocks).
 */
export class Terrain {
    private readonly things: Thing[] = [];
    private shown = true;

    constructor(private readonly scene: Phaser.Scene, private readonly opts: TerrainOptions) {
        // Far meadow out to the horizon. The painted ground goes on top once the town is laid out
        // (the next frame), so it can fit the final bounds and keep decor clear of buildings.
        addPixels(scene, 'terrain-outskirts', paintOutskirts());
        this.keep(scene.add.tileSprite(0, 0, 16384, 16384, 'terrain-outskirts').setDepth(DEPTH - 1));
        scene.events.once(Phaser.Scenes.Events.UPDATE, () => this.build());
    }

    private build() {
        const scene = this.scene;
        const t0 = performance.now();
        const b = this.opts.bounds();
        const area = { x: Math.floor(b.left - 340), y: Math.floor(b.top - 300), w: Math.ceil(b.width + 680), h: Math.ceil(b.height + 600) };
        const town = { left: b.left, top: b.top, right: b.right, bottom: b.bottom };

        // Anything big already standing (buildings, roads, the disco, the corral, trees): decor keeps off it.
        const statics = scene.children.list
            // Static images only: sprites are people, pets and llamas passing through.
            .filter((o): o is Phaser.GameObjects.Image => o instanceof Phaser.GameObjects.Image && !this.things.includes(o))
            .filter((o) => o.depth > DEPTH + 100 && o.depth < 1e5 && o.displayWidth * o.displayHeight > 500);
        const blocked = statics.flatMap((o) => {
            const r = o.getBounds();
            if (o.texture.key !== 'town-roads') return [r];
            // The ring road is only its four strips (road plus sidewalk, 40 px); the block inside is open.
            return [
                new Phaser.Geom.Rectangle(r.x, r.y, r.width, 40), new Phaser.Geom.Rectangle(r.x, r.bottom - 40, r.width, 40),
                new Phaser.Geom.Rectangle(r.x, r.y, 40, r.height), new Phaser.Geom.Rectangle(r.right - 40, r.y, 40, r.height),
            ];
        });
        const free = (x: number, y: number, w: number) => !blocked.some((r) => x + w / 2 > r.left - 3 && x - w / 2 < r.right + 3 && y > r.top && y < r.bottom + 3);

        const extra = this.townExtras(statics, blocked);
        const key = `terrain-ground-${area.x},${area.y},${area.w},${area.h}-${hashString(JSON.stringify(extra))}`;
        if (painted?.key !== key || !scene.textures.exists(key)) {
            if (painted && scene.textures.exists(painted.key)) scene.textures.remove(painted.key);
            painted = { key, art: paintGround(area, town, extra) };
            addPixels(scene, key, painted.art.canvas);
        }
        const ground = painted.art;
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        this.keep(scene.add.image(area.x, area.y, key).setOrigin(0, 0).setDepth(DEPTH));

        this.water(ground, still);

        const decor = [...PROP_DECOR, ...this.parkDecor(extra)];
        // An apple tree in the middle of the plaza garden.
        if (free(PLAZA.x, PLAZA.y + 4, 20)) {
            addPixels(scene, 'terrain-plaza-tree', treeArt({ ...TREE_PRESETS.fruit, size: 0.95 }, 21).canvas);
            this.keep(scene.add.image(PLAZA.x, PLAZA.y + 4, shadowTexture(scene, 22)).setAlpha(0.25).setDepth(-1e8));
            this.keep(scene.add.image(PLAZA.x, PLAZA.y + 6, 'terrain-plaza-tree').setOrigin(0.5, 1).setDepth(PLAZA.y + 4));
            blocked.push(new Phaser.Geom.Rectangle(PLAZA.x - 16, PLAZA.y - 40, 32, 46));
        }

        const placed: { x: number; y: number }[] = [];
        for (const d of decor) {
            const p = paintProp(PROPS[d.name], d.opts ?? {});
            if (!free(d.x, d.y, p.frameW)) continue;
            // A plain lamp shares Preview's texture key, so the day/night lighting finds it and lights it.
            const pk = d.name === 'lamp' && !d.opts ? 'preview-prop-lamp' : `terrain-prop-${d.name}-${JSON.stringify(d.opts ?? {})}`;
            addPixels(scene, pk, p.canvas, stripFrames(p.frames, p.frameW, p.frameH));
            if (p.shadow) this.keep(scene.add.image(d.x, d.y, shadowTexture(scene, p.shadow)).setAlpha(0.25).setDepth(-1e8));
            this.keep(scene.add.sprite(d.x, d.y + 1, pk, 0).setOrigin(0.5, 1).setDepth(d.y).setFlipX(!!d.flip));
            placed.push({ x: d.x, y: d.y });
        }

        // Tall grass where it would really grow: along lane edges, at tree roots, round the pond, against walls.
        const spots: [number, number][] = [];
        const r = rng(907);
        const offer = (x: number, y: number, p: number) => {
            if (r() > p) return;
            x = Math.round(x); y = Math.round(y);
            if (!free(x, y, 14) || !ground.isGrass(x, y) || !ground.isGrass(x - 6, y) || !ground.isGrass(x + 6, y)) return;
            if ([...spots, ...placed.map((o) => [o.x, o.y] as [number, number])].some(([sx, sy]) => Math.abs(sx - x) < 14 && Math.abs(sy - y) < 8)) return;
            spots.push([x, y]);
        };
        for (const path of [...PATHS, ...extra.paths]) {
            if (path.kind !== 'dirt') continue;
            const pts = spline(path.points);
            for (let i = 20; i < pts.length - 20; i += 23) {
                const [x0, y0] = pts[i - 1], [x1, y1] = pts[i + 1];
                const len = Math.hypot(x1 - x0, y1 - y0) || 1;
                const side = r() < 0.5 ? -1 : 1, off = path.hw + 7 + r() * 5;
                offer(pts[i][0] - ((y1 - y0) / len) * off * side, pts[i][1] + ((x1 - x0) / len) * off * side, 0.42);
            }
        }
        for (const o of statics) {
            const bb = o.getBounds();
            const tree = o.texture.key.includes('tree');
            if (tree) {
                for (const dx of [-15, 13, -6]) offer(o.x + dx, o.y + 1 + r() * 4, 0.55);
            } else if (bb.width > 60 && bb.width < 300 && o.originY === 1) {
                offer(bb.left - 6, bb.bottom + 2, 0.6);
                offer(bb.right + 6, bb.bottom + 2, 0.6);
            }
        }
        for (let i = 0; i < 12; i++) {
            const th = (i / 12) * Math.PI * 2 + 0.3;
            if (Math.sin(th) < -0.3) continue; // the back bank has the reeds
            offer(POND.x + Math.cos(th) * POND.rx * 1.22, POND.y + Math.sin(th) * POND.ry * 1.3 + 4, 0.6);
        }
        this.plants('terrain-tallgrass', spots, 8, (s) => tallGrassArt(s), still);
        this.plants('terrain-reeds', REEDS, 4, (s) => reedsArt(s), still);
        this.setVisible(this.shown);
        console.info(`[ATV] terrain painted in ${Math.round(performance.now() - t0)}ms`);
    }

    /** Lanes to the town's ring road, and a little park inside the ring, fitted round its trees and houses. */
    private townExtras(statics: Phaser.GameObjects.Image[], blocked: Phaser.Geom.Rectangle[]): Extras {
        const roads = statics.find((o) => o.texture.key === 'town-roads');
        const extra: Extras = { paths: [], courts: [] };
        if (!roads) {
            extra.paths.push({ kind: 'dirt', hw: 7, fade: true, points: [[322, 240], [380, 250], [440, 246], [520, 256]] });
            return extra;
        }
        const rx = roads.x, ry = roads.y, rw = roads.displayWidth, rh = roads.displayHeight;
        const bottomRoad = ry + rh - 20;
        // The library's forecourt to the ring road's south-west corner sidewalk.
        extra.paths.push({ kind: 'dirt', hw: 7, points: [[322, 240], [370, 250], [Math.min(rx - 30, 420), bottomRoad + 6], [rx + 8, bottomRoad + 4]] });

        // The park: a round court where it's most open (in plaza space, y counts double), paths out to the sidewalks.
        const L = rx + 40, R = rx + rw - 40, T = ry + 40, B = ry + rh - 40;
        const inside = blocked.filter((b) => b.right > L && b.left < R && b.bottom > T && b.top < B && b.width < rw * 0.8);
        const clearance = (x: number, y: number) => {
            let d = Math.min(x - L, R - x, (y - T) * 2, (B - y) * 2);
            for (const b of inside) {
                const dx = Math.max(b.left - x, 0, x - b.right), dy = Math.max(b.top - y, 0, y - b.bottom) * 2;
                d = Math.min(d, Math.hypot(dx, dy));
            }
            return d;
        };
        let best = { x: (L + R) / 2, y: (T + B) / 2, d: -1 };
        for (let y = T + 20; y < B - 20; y += 6) for (let x = L + 30; x < R - 30; x += 6) {
            const d = clearance(x, y) - Math.abs(x - (L + R) / 2) * 0.08;
            if (d > best.d) best = { x, y, d };
        }
        if (best.d < 30) return extra;
        const court = { x: Math.round(best.x), y: Math.round(best.y), r: Math.round(Math.min(48, best.d - 6)), garden: true };
        extra.courts.push(court);
        const clear = (x0: number, y0: number, x1: number, y1: number) => {
            for (let t = 0; t <= 1; t += 0.02) {
                const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
                if (inside.some((b) => x > b.left - 8 && x < b.right + 8 && y > b.top && y < b.bottom + 6)) return false;
            }
            return true;
        };
        const ends: [number, number][] = [[rx + 30, court.y], [rx + rw - 30, court.y], [court.x, ry + 30]];
        for (const [ex, ey] of ends) {
            const sx = court.x + Math.sign(ex - court.x) * court.r * 0.9, sy = ey === court.y ? court.y : court.y - court.r / 2 + 2;
            if (!clear(sx, sy, ex, ey)) continue;
            const mx = (sx + ex) / 2, my = (sy + ey) / 2 + (ey === court.y ? 6 : 0);
            extra.paths.push({ kind: 'dirt', hw: 5, points: [[sx, sy], [mx, my], [ex, ey]] });
        }
        return extra;
    }

    /** Benches, bushes and flowers round the park court. */
    private parkDecor(extra: Extras): typeof PROP_DECOR {
        const out: typeof PROP_DECOR = [];
        for (const c of extra.courts) {
            if (!c.garden) continue;
            out.push(
                { name: 'bench', x: c.x - c.r - 26, y: c.y - 8 },
                { name: 'bench', x: c.x + c.r + 26, y: c.y - 8, flip: true },
                { name: 'bush', x: c.x - c.r - 52, y: c.y - 9, opts: { seed: 14 } },
                { name: 'bush', x: c.x + c.r + 52, y: c.y - 9, opts: { seed: 15, berries: 'pink' } },
                { name: 'bush', x: c.x - c.r - 6, y: c.y + Math.round(c.r / 2) + 8, opts: { seed: 16, berries: 'red' } },
                { name: 'bush', x: c.x + c.r + 6, y: c.y + Math.round(c.r / 2) + 8, opts: { seed: 17 } },
                { name: 'flowers', x: c.x - 18, y: c.y + Math.round(c.r / 2) + 8, opts: { colors: ['pink', 'yellow', 'white'] } },
                { name: 'flowers', x: c.x + 18, y: c.y + Math.round(c.r / 2) + 8, opts: { colors: ['violet', 'white', 'orange'] } },
                { name: 'lamp', x: c.x, y: c.y - Math.round(c.r / 2) - 6 },
            );
        }
        // Flower beds along the park's footpaths.
        extra.paths.forEach((p, i) => {
            if (p.hw !== 5) return;
            const [a, b] = [p.points[0], p.points[p.points.length - 1]];
            for (const t of [0.35, 0.7]) {
                const x = Math.round(a[0] + (b[0] - a[0]) * t), y = Math.round(a[1] + (b[1] - a[1]) * t);
                const horizontal = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
                const colors = [['pink', 'white', 'yellow'], ['red', 'orange', 'yellow'], ['violet', 'pink', 'white']][(i + Math.round(t * 2)) % 3];
                if (horizontal) out.push({ name: 'flowers', x, y: y - 9, opts: { colors } }, { name: 'flowers', x: x + 6, y: y + 15, opts: { colors } });
                else out.push({ name: 'flowers', x: x - 14, y, opts: { colors } }, { name: 'flowers', x: x + 14, y: y + 2, opts: { colors } });
            }
        });
        return out;
    }

    /** Show the town's ground (false while the world is in hell). */
    setVisible(on: boolean) {
        this.shown = on;
        for (const t of this.things) t.setVisible(on);
    }

    private keep<T extends Thing>(t: T): T {
        this.things.push(t);
        return t;
    }

    /** Sprites of a few variants, each swaying on its own clock. */
    private plants(prefix: string, spots: [number, number][], variants: number, art: (seed: number) => { canvas: PixelCanvas; w: number; h: number }, still: boolean) {
        const scene = this.scene;
        for (let v = 0; v < variants; v++) {
            const key = `${prefix}-${v}`;
            const a = art(v + 1);
            addPixels(scene, key, a.canvas, stripFrames(SWAY_FRAMES, a.w, a.h));
            if (!scene.anims.exists(key)) {
                scene.anims.create({ key, frames: Array.from({ length: SWAY_FRAMES }, (_, frame) => ({ key, frame })), frameRate: 3, repeat: -1 });
            }
        }
        spots.forEach(([x, y], i) => {
            const key = `${prefix}-${i % variants}`;
            const s = this.keep(scene.add.sprite(x, y + 1, key, 0).setOrigin(0.5, 1).setDepth(y).setFlipX(i % 3 === 1));
            if (!still) {
                s.play({ key, startFrame: i % SWAY_FRAMES });
                s.anims.timeScale = 0.75 + ((i * 37) % 10) / 20;
            }
        });
    }

    /** The pond comes alive: shimmering light, the odd ripple, sun glints. */
    private water(ground: GroundArt, still: boolean) {
        const scene = this.scene;
        const sh = pondShimmerArt(ground.isWater);
        addPixels(scene, 'terrain-shimmer', sh.canvas, stripFrames(sh.frames, sh.w, sh.h));
        if (!scene.anims.exists('terrain-shimmer')) {
            scene.anims.create({ key: 'terrain-shimmer', frames: Array.from({ length: sh.frames }, (_, frame) => ({ key: 'terrain-shimmer', frame })), frameRate: 4, repeat: -1 });
        }
        const shimmer = this.keep(scene.add.sprite(sh.x0, sh.y0, 'terrain-shimmer', 0).setOrigin(0, 0).setDepth(DEPTH + 1));
        if (still) return;
        shimmer.play('terrain-shimmer');

        const rp = rippleArt();
        addPixels(scene, 'terrain-ripple', rp.canvas, stripFrames(rp.frames, rp.w, rp.h));
        if (!scene.anims.exists('terrain-ripple')) {
            scene.anims.create({ key: 'terrain-ripple', frames: Array.from({ length: rp.frames }, (_, frame) => ({ key: 'terrain-ripple', frame })), frameRate: 6, repeat: 0 });
        }
        addPixels(scene, 'terrain-glint', glintArt(), stripFrames(3, 5, 5));
        if (!scene.anims.exists('terrain-glint')) {
            scene.anims.create({ key: 'terrain-glint', frames: [0, 1, 2, 1, 0].map((frame) => ({ key: 'terrain-glint', frame })), frameRate: 10, repeat: 0 });
        }
        const spot = (margin: number) => {
            for (let i = 0; i < 40; i++) {
                const x = POND.x + Phaser.Math.Between(-POND.rx, POND.rx), y = POND.y + Phaser.Math.Between(-POND.ry, POND.ry);
                if (ground.isWater(x - margin, y) && ground.isWater(x + margin, y) && ground.isWater(x, y - 5) && ground.isWater(x, y + 3)) return { x, y };
            }
            return { x: POND.x, y: POND.y };
        };
        const loop = (key: string, margin: number, gap: [number, number]) => {
            const s = this.keep(scene.add.sprite(0, 0, key, 0).setDepth(DEPTH + 2).setVisible(false));
            const go = () => {
                const at = spot(margin);
                s.setPosition(at.x, at.y).play(key);
                s.setVisible(this.shown);
            };
            s.on('animationcomplete', () => {
                s.setVisible(false);
                if (!s.scene) return;
                scene.time.delayedCall(Phaser.Math.Between(...gap), go);
            });
            scene.time.delayedCall(Phaser.Math.Between(0, gap[1]), go);
        };
        loop('terrain-ripple', 10, [900, 2600]);
        loop('terrain-ripple', 10, [1500, 3800]);
        loop('terrain-glint', 3, [300, 1400]);
        loop('terrain-glint', 3, [500, 2000]);
    }
}
