import Phaser from 'phaser';
import { isTyping } from '../commands';
import { BAYS, DESK_H, DESK_W, HQ_SPOTS, HQ_W, LOBBY_H, deskSpot } from '../hq/art';
import type { HQ } from '../hq/HQ';
import { HEX } from '../kit/palette';
import { hash } from '../kit/noise';
import { FX, emissiveTexture, ensureFxTextures } from './fxTextures';
import { DAY_LOOP_SECONDS, frozenTime, gradeMatrix, skyAt, toHex, type Sky } from './timeOfDay';

/**
 * Lighting, time of day and atmosphere for the town.
 *
 * Every frame a screen-sized light map (a DynamicTexture) is filled with the sky's ambient colour, cloud
 * shadows are laid in, soft light cookies are added at every light, and a vignette darkens the edges. That map
 * sits over the world with MULTIPLY, so at night the town goes moonlit blue except where light falls. Above it:
 * additive bloom halos, warm night windows, fireflies, dust motes, sun shafts and a golden-hour haze.
 *
 * Lamps, the fountain, portals, hell fires, building windows and trees are found by their texture keys, so
 * new ones placed anywhere in the scene light up on their own. Anyone can add more with `addLight`.
 */

/** Depths: the light map sits over everything in the world (sky objects at 1e6 included). */
const LM = 2e6;
const EMISSIVE = LM + 1;
const HALO = LM + 2;
const FLY = LM + 3;
const RAYS = LM + 4;
const HAZE = LM + 5;
/** Screen px per light-map px. Lights are soft, so half resolution is plenty. */
const DOWN = 2;

export interface LightHandle {
    setPosition(x: number, y: number): LightHandle;
    setIntensity(intensity: number): LightHandle;
    setColor(color: number): LightHandle;
    setVisible(visible: boolean): LightHandle;
    /** Track a game object (offset dx, dy). The light hides while the object is hidden or inactive. */
    follow(target: Followable | undefined, dx?: number, dy?: number): LightHandle;
    destroy(): void;
}

type Followable = { x: number; y: number; visible?: boolean; active?: boolean };

export interface LightOptions {
    /** Bloom halo radius in world px (0 = none). */
    halo?: number;
    haloAlpha?: number;
    /** Additive colour wash over the lit area (0..1): keeps warm light warm on green grass. */
    wash?: number;
    /** The light is at least this strong in daylight (0 = night only, 1 = always on). */
    minFactor?: number;
    /** Only shines in hell (true), only on the surface (false), or both (undefined). */
    hell?: boolean;
}

class Light implements LightHandle {
    target?: Followable;
    dx = 0;
    dy = 0;
    visible = true;
    alive = true;
    readonly phase: number;
    halo?: Phaser.GameObjects.Image;
    wash?: Phaser.GameObjects.Image;

    constructor(
        private readonly owner: Atmosphere,
        public x: number,
        public y: number,
        public radius: number,
        public color: number,
        public intensity: number,
        public flicker: number,
        readonly opts: LightOptions,
    ) {
        this.phase = Math.random() * 1000;
    }

    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
    setIntensity(i: number) { this.intensity = i; return this; }
    setColor(c: number) { this.color = c; this.halo?.setTint(c); this.wash?.setTint(c); return this; }
    setVisible(v: boolean) { this.visible = v; return this; }
    follow(target: Followable | undefined, dx = 0, dy = 0) { this.target = target; this.dx = dx; this.dy = dy; return this; }
    destroy() {
        if (!this.alive) return;
        this.alive = false;
        this.halo?.destroy();
        this.wash?.destroy();
        this.owner.forget(this);
    }

    /** Where it is this frame, or null if it shouldn't shine. */
    sync(): boolean {
        const t = this.target;
        if (t) {
            if (t.visible === false || t.active === false) return false;
            this.x = t.x + this.dx;
            this.y = t.y + this.dy;
        }
        return this.visible;
    }

    flick(time: number): number {
        if (!this.flicker) return 1;
        const s = time / 1000 + this.phase;
        const n = Math.sin(s * 7.3) * 0.5 + Math.sin(s * 13.1 + 1.7) * 0.3 + Math.sin(s * 23.7 + 0.4) * 0.2;
        return 1 - this.flicker * (0.5 + 0.5 * n);
    }
}

interface Fly { img: Phaser.GameObjects.Image; hx: number; hy: number; r: number; ph: number; sp: number; tint: number }
interface Mote { img: Phaser.GameObjects.Image; u: number; v: number; vu: number; vv: number; ph: number }
interface Window { img: Phaser.GameObjects.Image; src: Phaser.GameObjects.Image; panes: { x: number; y: number; w: number; h: number }[] }
interface Vehicle { sprite: Phaser.GameObjects.Sprite; head: Phaser.GameObjects.Image; tail: Phaser.GameObjects.Image; siren?: Phaser.GameObjects.Image; kind: 'car' | 'police' | 'truck' }
interface Cloud { x: number; y: number; sx: number; sy: number; a: number }

export interface AtmosphereOptions {
    /** The walkable world (for clouds and fireflies). */
    bounds: () => Phaser.Geom.Rectangle;
    player?: Followable;
    vibes?: () => Followable[];
    hq?: HQ;
}

export class Atmosphere {
    private readonly lights: Light[] = [];
    private readonly lm: Phaser.Textures.DynamicTexture;
    private readonly lmImage: Phaser.GameObjects.Image;
    private readonly haze: Phaser.GameObjects.Image;
    private readonly rays: Phaser.GameObjects.Image[] = [];
    private readonly motes: Mote[] = [];
    private readonly stars: Mote[] = [];
    private flies: Fly[] = [];
    private readonly windows: Window[] = [];
    private readonly vehicles: Vehicle[] = [];
    private readonly discoTiles: Phaser.GameObjects.Image[] = [];
    private readonly clouds: Cloud[] = [];
    private readonly seen = new WeakSet<object>();
    private readonly treeSpots: { x: number; y: number }[] = [];
    private readonly frozen = frozenTime();
    private forcedTime?: number;
    private offset = 0;
    private offsetTarget = 0;
    private hell = false;
    private lastScan = -Infinity;
    private sky: Sky = skyAt(0);
    private nightness = 0;
    private readonly view = new Phaser.Geom.Rectangle();
    /** Debug: comma list of layers to leave out ('rays,haze,clouds,sun'), e.g. for profiling from the console. */
    skipFx = '';
    /** The colour grade over the whole camera (see gradeMatrix). */
    private grade?: Phaser.Filters.ColorMatrix;

    constructor(private readonly scene: Phaser.Scene, private readonly opts: AtmosphereOptions) {
        ensureFxTextures(scene);
        const cam = scene.cameras.main;
        const key = 'atm-lightmap';
        if (scene.textures.exists(key)) scene.textures.remove(key);
        this.lm = scene.textures.addDynamicTexture(key, Math.ceil(cam.width / DOWN), Math.ceil(cam.height / DOWN))!;
        this.lm.setFilter(Phaser.Textures.FilterMode.LINEAR);
        this.lmImage = scene.add.image(0, 0, key).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(LM);
        this.grade = cam.filters?.internal.addColorMatrix();
        this.haze = scene.add.image(0, 0, FX.flat).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(HAZE);

        for (let i = 0; i < 5; i++) {
            this.rays.push(scene.add.image(0, 0, FX.ray).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(RAYS).setVisible(false));
        }
        for (let i = 0; i < 34; i++) {
            this.motes.push({
                img: scene.add.image(0, 0, FX.mote).setBlendMode(Phaser.BlendModes.ADD).setDepth(FLY).setVisible(false),
                u: Math.random(), v: Math.random(), vu: (Math.random() - 0.3) * 0.006, vv: -0.004 - Math.random() * 0.006, ph: Math.random() * 10,
            });
        }
        for (let i = 0; i < 26; i++) {
            this.stars.push({
                img: scene.add.image(0, 0, FX.star).setBlendMode(Phaser.BlendModes.ADD).setDepth(FLY).setVisible(false),
                u: Math.random(), v: Math.random(), vu: 0, vv: 0, ph: Math.random() * 10,
            });
        }
        // Big slow cloud shadows, spread over the world.
        const b = opts.bounds();
        for (let i = 0; i < 6; i++) {
            this.clouds.push({
                x: b.left + hash(i, 1, 5) * b.width,
                y: b.top + hash(i, 2, 5) * b.height,
                sx: 1.6 + hash(i, 3, 5) * 1.6,
                sy: 1.3 + hash(i, 4, 5) * 1.0,
                a: 0.7 + hash(i, 5, 5) * 0.3,
            });
        }

        // The player's own little warm glow at night, and the vibe shards' sparkle.
        if (opts.player) this.addLight(0, 0, 70, 0xffd9a8, 0.42, 0, { hell: undefined }).follow(opts.player, 0, -12);
        for (const v of opts.vibes?.() ?? []) this.addLight(0, 0, 26, 0xffc23c, 0.55, 0.12, { halo: 12, haloAlpha: 0.5, minFactor: 0.08 }).follow(v, 0, 0);

        const onKey = (e: KeyboardEvent) => {
            if (!scene.sys.isActive() || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
            if (e.key === 't' || e.key === 'T') this.skip(e.shiftKey ? -1 : 1);
        };
        window.addEventListener('keydown', onKey);
        // ?atmosphere=off: plain daylight, for comparing.
        const off = new URLSearchParams(location.search).get('atmosphere') === 'off';
        if (off) {
            this.lmImage.setVisible(false);
            this.haze.setVisible(false);
            if (this.grade) this.grade.active = false;
        } else {
            scene.events.on('update', this.update, this);
            scene.events.on('postupdate', this.render, this);
        }
        const stop = () => {
            window.removeEventListener('keydown', onKey);
            scene.events.off('update', this.update, this);
            scene.events.off('postupdate', this.render, this);
            if (this.grade) cam.filters?.internal.remove(this.grade);
        };
        scene.events.once('shutdown', stop);
        scene.events.once('destroy', stop);

        const w = window as unknown as { atv?: Record<string, unknown> };
        w.atv = { ...w.atv, atmosphere: this };
        this.scan();
    }

    /** Add a light. Lights shine at night (and dusk); see LightOptions.minFactor for daytime. */
    addLight(x: number, y: number, radius: number, color = 0xffc070, intensity = 1, flicker = 0, opts: LightOptions = {}): LightHandle {
        const light = new Light(this, x, y, radius, color, intensity, flicker, opts);
        if (opts.halo) {
            light.halo = this.scene.add.image(x, y, FX.core).setBlendMode(Phaser.BlendModes.ADD).setDepth(HALO).setTint(color).setVisible(false);
        }
        if (opts.wash) {
            light.wash = this.scene.add.image(x, y, FX.light).setBlendMode(Phaser.BlendModes.ADD).setDepth(HALO).setTint(color).setVisible(false);
        }
        this.lights.push(light);
        return light;
    }

    /** @internal */
    forget(light: Light) {
        const i = this.lights.indexOf(light);
        if (i >= 0) this.lights.splice(i, 1);
    }

    /** Time of day, 0..1 (0 dawn, ~0.33 day, ~0.62 sunset, ~0.84 night). */
    get time(): number {
        if (this.forcedTime !== undefined) return this.forcedTime;
        const base = this.frozen ?? (Date.now() / 1000 / DAY_LOOP_SECONDS);
        return (((base + this.offset) % 1) + 1) % 1;
    }

    /** 0 in daylight, 1 at night. */
    get night(): number {
        return this.nightness;
    }

    /** True when Night View lock is toggled on. */
    get nightMode(): boolean {
        return this.forcedTime === 0.84;
    }

    /** Toggle or set locked Night View (0.84 deep night) vs normal day/night cycle. */
    setNightMode(active: boolean) {
        this.forcedTime = active ? 0.84 : undefined;
        if (!active) {
            // Ensure when turning night view off we return to bright daylight (0.33).
            this.setTime(0.33);
        }
    }

    /** Jump to a time of day (0..1). */
    setTime(t: number) {
        this.forcedTime = undefined;
        const base = this.frozen ?? (Date.now() / 1000 / DAY_LOOP_SECONDS);
        this.offset = this.offsetTarget = t - base;
    }

    /** The T key: glide an eighth of a day forward (Shift+T back). */
    skip(dir: 1 | -1 = 1) {
        this.offsetTarget += dir * 0.125;
    }

    /** Hell has its own fixed, fire-lit mood: no sun, no clouds, no fireflies. */
    setHell(active: boolean) {
        this.hell = active;
        // The hell theme tints every object in the scene; ours keep their own colours.
        const mine: Phaser.GameObjects.Image[] = [
            this.lmImage, this.haze, ...this.rays, ...this.motes.map((m) => m.img), ...this.stars.map((m) => m.img),
            ...this.flies.map((f) => f.img), ...this.windows.map((w) => w.img), ...this.lights.flatMap((l) => [l.halo, l.wash].filter((o): o is Phaser.GameObjects.Image => !!o)),
            ...this.vehicles.flatMap((v) => [v.head, v.tail, ...(v.siren ? [v.siren] : [])]),
        ];
        mine.forEach((o) => o.clearTint());
        this.lights.forEach((l) => l.halo?.setTint(l.color));
        this.flies.forEach((f) => f.img.setTint(f.tint));
        this.vehicles.forEach((v) => { v.head.setTint(0xfff0c0); v.tail.setTint(0xff2a2a); });
    }

    /** Find lamps, windows, portals and trees placed in the scene (cheap; reruns every couple of seconds). */
    private scan() {
        for (const o of this.scene.children.list) {
            if (this.seen.has(o) || !(o instanceof Phaser.GameObjects.Image || o instanceof Phaser.GameObjects.Sprite)) continue;
            const key = o.texture?.key ?? '';
            if (!key.startsWith('preview-') && !key.startsWith('town-') && !key.startsWith('disco-') && !key.startsWith('ufo-')) continue;
            this.seen.add(o);
            if (key === 'preview-prop-lamp') {
                // The lamp head is ~25px above its feet.
                // A warm pool on the ground around the post, and the glow of the head itself.
                this.addLight(o.x, o.y - 6, 84, 0xff7a30, 1.1, 0.03, { wash: 0.14, hell: false });
                this.addLight(o.x, o.y - 25, 30, 0xffc070, 0.8, 0.03, { halo: 24, haloAlpha: 0.75, hell: false });
            } else if (key === 'preview-prop-fountain') {
                this.addLight(o.x, o.y - 8, 62, 0x6fcfff, 0.42, 0.06, { halo: 16, haloAlpha: 0.3 });
            } else if (key === 'preview-hell-portal') {
                this.addLight(0, 0, 78, 0xff4a1c, 1.0, 0.2, { halo: 30, haloAlpha: 0.8, minFactor: 0.35 }).follow(o, 0, 1);
            } else if (key === 'preview-hell-fire') {
                this.addLight(0, 0, 96, 0xff7426, 1.1, 0.28, { halo: 22, haloAlpha: 0.7, minFactor: 1, hell: true }).follow(o, 0, -8);
            } else if (key === 'town-flame') {
                // House fires: hot, flickering, and visible even by day.
                this.addLight(0, 0, 64, 0xff6a1e, 1.0, 0.35, { halo: 16, haloAlpha: 0.55, minFactor: 0.3 }).follow(o, 0, -6);
            } else if (key.startsWith('town-car-') || key === 'town-police' || key === 'town-truck') {
                const glow = () => this.scene.add.image(0, 0, FX.core).setBlendMode(Phaser.BlendModes.ADD).setDepth(HALO).setVisible(false);
                const kind = key === 'town-police' ? 'police' : key === 'town-truck' ? 'truck' : 'car';
                this.vehicles.push({ sprite: o as Phaser.GameObjects.Sprite, head: glow().setTint(0xfff0c0), tail: glow().setTint(0xff2a2a), siren: kind === 'car' ? undefined : glow(), kind });
            } else if (key.startsWith('disco-tile-')) {
                this.discoTiles.push(o as Phaser.GameObjects.Image);
            } else if (key === 'disco-ball') {
                this.addLight(0, 0, 70, 0xd8f4ff, 0.55, 0.15, { halo: 18, haloAlpha: 0.6 }).follow(o, 0, 9);
            } else if (key === 'ufo-saucer') {
                // A glow under the saucer and its tractor-beam spot on the grass below.
                this.addLight(0, 0, 40, 0x7fffd0, 0.5, 0.1, { halo: 30, haloAlpha: 0.45 }).follow(o, 0, 8);
                this.addLight(0, 0, 46, 0x7fffd0, 0.6, 0.12, { wash: 0.12 }).follow(o, 0, 70);
            } else if (key === 'preview-library-glow') {
                this.addLight(o.x, o.y, 46, 0xffc060, 0.8, 0.05, { halo: 10, haloAlpha: 0.6 });
            } else if (key.startsWith('preview-tree-') || key.startsWith('town-tree-')) {
                this.treeSpots.push({ x: o.x, y: o.y });
            } else if (key.startsWith('preview-building-') || key.startsWith('town-building-') || key === 'preview-library') {
                this.addWindows(o as Phaser.GameObjects.Image, key === 'preview-library');
            }
        }
    }

    private addWindows(src: Phaser.GameObjects.Image, library: boolean) {
        const glass = new Map<number, number>(library
            ? [[HEX.yellow, 0xfff4b0], [HEX.gold, 0xffcc50], [HEX.orange, 0xf59a48]]
            : [[HEX.sky, 0xffcf68], [HEX.blue, 0xf08c3c], [HEX.ice, 0xfff2c4]]);
        const em = emissiveTexture(this.scene, src.texture.key, `atm-windows-${src.texture.key}`, glass, library ? Infinity : 26);
        if (!em) return;
        const img = this.scene.add.image(src.x, src.y, em.key).setOrigin(src.originX, src.originY).setDepth(EMISSIVE).setAlpha(0);
        // Library glass also counts book spines and frames inside the arches; lighting the whole pane shows them.
        const panes = em.panes.filter((p) => p.w >= 3 && p.h >= 3);
        this.windows.push({ img, src, panes });
        const left = src.x - src.displayWidth * src.originX, top = src.y - src.displayHeight * src.originY;
        for (const p of panes) {
            // Light spilling out of each pane onto the wall and the grass in front.
            this.addLight(left + p.x + p.w / 2, top + p.y + p.h * 0.7, Math.max(30, p.w * 2.6), 0xffa050, 0.6, 0.02, { halo: Math.max(8, p.w * 0.9), haloAlpha: 0.22, wash: 0.06 });
        }
    }

    private update(_time: number, deltaMs: number) {
        const dt = Math.min(0.1, deltaMs / 1000);
        // T glides time forward instead of snapping.
        const gap = this.offsetTarget - this.offset;
        this.offset += Math.abs(gap) < 1e-4 ? gap : gap * (1 - Math.exp(-dt * 3));
        const b = this.opts.bounds();
        for (const c of this.clouds) {
            c.x += 7 * dt;
            c.y += 2.2 * dt;
            const margin = 260;
            if (c.x > b.right + margin) c.x = b.left - margin;
            if (c.y > b.bottom + margin) c.y = b.top - margin;
        }
        for (const m of this.motes) {
            m.u += m.vu * dt * 3;
            m.v += m.vv * dt * 3;
            if (m.v < -0.05) { m.v = 1.05; m.u = Math.random(); }
            if (m.u < -0.05) m.u = 1.05;
            if (m.u > 1.05) m.u = -0.05;
        }
        if (this.scene.time.now - this.lastScan > 2000) {
            this.lastScan = this.scene.time.now;
            this.scan();
        }
    }

    private makeFlies() {
        const b = this.opts.bounds();
        const homes = [...this.treeSpots.flatMap((t) => [0, 1, 2, 3].map((i) => ({ x: t.x + (hash(t.x, i, 3) - 0.5) * 50, y: t.y - 4 - hash(t.y, i, 4) * 26 })))];
        for (let i = 0; i < 22; i++) homes.push({ x: b.left + 30 + hash(i, 9, 11) * (b.width - 60), y: b.top + b.height * 0.25 + hash(i, 8, 11) * b.height * 0.7 });
        this.flies = homes.map((h, i) => {
            const tint = i % 3 ? 0xe4ff6a : 0xfff27a;
            return {
                img: this.scene.add.image(h.x, h.y, FX.firefly).setBlendMode(Phaser.BlendModes.ADD).setDepth(FLY).setTint(tint).setVisible(false),
                hx: h.x, hy: h.y, r: 10 + hash(i, 1, 2) * 22, ph: hash(i, 2, 2) * 100, sp: 0.25 + hash(i, 3, 2) * 0.35, tint,
            };
        });
    }

    /** After the camera has moved for this frame: redraw the light map and place the overlays. */
    private render() {
        const scene = this.scene;
        const cam = scene.cameras.main;
        const now = scene.time.now;
        const zoom = cam.zoom;
        // The camera's world view for this frame (its own worldView only updates during render).
        const vw = cam.width / zoom, vh = cam.height / zoom;
        const vx = cam.scrollX + cam.width * cam.originX - vw * cam.originX;
        const vy = cam.scrollY + cam.height * cam.originY - vh * cam.originY;
        this.view.setTo(vx, vy, vw, vh);

        const dw = Math.ceil(cam.width / DOWN), dh = Math.ceil(cam.height / DOWN);
        if (Math.abs(this.lm.width - dw) > 1 || Math.abs(this.lm.height - dh) > 1) this.lm.setSize(dw, dh);
        const sx = this.lm.width / vw, sy = this.lm.height / vh;
        this.lmImage.setPosition(vx, vy).setScale(vw / this.lm.width, vh / this.lm.height);

        const sky = this.sky = this.hell ? HELL : skyAt(this.time);
        const night = this.nightness = this.hell ? 1 : sky.night;
        const lm = this.lm;
        lm.fill(toHex(sky.ambient), 1);
        if (this.grade) {
            this.grade.active = !this.skipFx.includes('grade');
            this.grade.colorMatrix.set(gradeMatrix(sky));
        }


        // Moonlight: a cool wash from the upper left.
        if (sky.moon > 0.01 && !this.hell) {
            lm.stamp(FX.light, undefined, lm.width * 0.12, lm.height * 0.02, {
                scaleX: lm.width * 1.5 / 128, scaleY: lm.height * 1.6 / 128, tint: 0x2a3a66, alpha: sky.moon * 0.55, blendMode: Phaser.BlendModes.ADD,
            });
        }
        // A low sun: warm light raking in from one side of the view.
        if (sky.sun > 0.01 && !this.hell && !this.skipFx.includes('sun')) {
            const side = sky.sunSide > 0 ? lm.width * 1.05 : -lm.width * 0.05;
            lm.stamp(FX.light, undefined, side, lm.height * 0.3, {
                scaleX: lm.width * 2.2 / 128, scaleY: lm.height * 2.6 / 128, tint: toHex(sky.rayColor), alpha: sky.sun * 0.42, blendMode: Phaser.BlendModes.ADD,
            });
        }
        // Cloud shadows drifting over the ground.
        if (sky.clouds > 0.01 && !this.hell && !this.skipFx.includes('clouds')) {
            for (const c of this.clouds) {
                const cx = (c.x - vx) * sx, cy = (c.y - vy) * sy;
                const w = 160 * c.sx * sx, h = 112 * c.sy * sy;
                if (cx + w < 0 || cx - w > lm.width || cy + h < 0 || cy - h > lm.height) continue;
                lm.stamp(FX.cloud, undefined, cx, cy, {
                    scaleX: c.sx * sx, scaleY: c.sy * sy, tint: 0x4a5a78, alpha: sky.clouds * 0.2 * c.a, blendMode: Phaser.BlendModes.NORMAL,
                });
            }
        }

        // Lights.
        const lightFactor = night;
        for (const l of this.lights) {
            const on = l.sync() && (l.opts.hell === undefined || l.opts.hell === this.hell);
            const f = Math.max(lightFactor, l.opts.minFactor ?? 0) * l.flick(now);
            if (!on || f <= 0.01) {
                l.halo?.setVisible(false);
                l.wash?.setVisible(false);
                continue;
            }
            const r = l.radius;
            const cx = (l.x - vx) * sx, cy = (l.y - vy) * sy;
            if (cx + r * sx > 0 && cx - r * sx < lm.width && cy + r * sy > 0 && cy - r * sy < lm.height) {
                lm.stamp(FX.light, undefined, cx, cy, {
                    scaleX: r * 2 * sx / 128, scaleY: r * 2 * sy / 128 * 0.82, tint: l.color, alpha: Math.min(1, l.intensity * f), blendMode: Phaser.BlendModes.ADD,
                });
            }
            if (l.wash) {
                l.wash.setVisible(true).setPosition(l.x, l.y).setScale(r * 2 / 128, r * 2 / 128 * 0.82).setAlpha((l.opts.wash ?? 0) * f);
            }
            if (l.halo) {
                const hr = l.opts.halo ?? 0;
                l.halo.setVisible(true).setPosition(l.x, l.y).setScale(hr * 2 / 64).setAlpha((l.opts.haloAlpha ?? 0.6) * f);
            }
        }
        // Fireflies brighten the grass around them a touch.
        const flyOn = !this.hell && night > 0.3;
        if (flyOn && !this.flies.length) this.makeFlies();
        const t = now / 1000;
        for (let i = 0; i < this.flies.length; i++) {
            const fl = this.flies[i];
            if (!flyOn) { fl.img.setVisible(false); continue; }
            const a = t * fl.sp + fl.ph;
            const x = fl.hx + Math.sin(a) * fl.r + Math.sin(a * 2.3 + 1) * fl.r * 0.35;
            const y = fl.hy + Math.cos(a * 0.8) * fl.r * 0.5 + Math.sin(a * 3.1) * 3;
            const blink = Math.max(0, Math.sin(t * (0.9 + (i % 5) * 0.17) + fl.ph)) ** 2;
            const alpha = (night - 0.3) / 0.7 * (0.25 + 0.75 * blink);
            fl.img.setVisible(true).setPosition(Math.round(x), Math.round(y)).setAlpha(alpha);
            if (alpha > 0.15) {
                lm.stamp(FX.light, undefined, (x - vx) * sx, (y - vy) * sy, {
                    scale: 26 * sx / 128, tint: 0xc8ff60, alpha: alpha * 0.35, blendMode: Phaser.BlendModes.ADD,
                });
            }
        }

        this.renderVehicles(night, vx, vy, sx, sy, now);
        // The disco floor's lit tiles throw their colour around.
        if (night > 0.05) {
            for (const tile of this.discoTiles) {
                const k = tile.texture.key;
                if (!tile.visible || k === 'disco-tile-off') continue;
                const c = HEX[k.slice(11) as keyof typeof HEX] ?? 0xffffff;
                const cx = tile.x + tile.displayWidth / 2, cy = tile.y + tile.displayHeight / 2;
                lm.stamp(FX.light, undefined, (cx - vx) * sx, (cy - vy) * sy, {
                    scale: 30 * sx / 128, tint: c, alpha: 0.9 * night, blendMode: Phaser.BlendModes.ADD,
                });
            }
        }

        // Windows: lit panes let the room's own colours through, and glow warm.
        const winAlpha = this.hell ? 0 : Phaser.Math.Clamp((night - 0.15) / 0.55, 0, 1);
        for (const w of this.windows) {
            const s = w.src;
            w.img.setPosition(s.x, s.y).setOrigin(s.originX, s.originY).setScale(s.scaleX, s.scaleY).setFlip(s.flipX, s.flipY)
                .setVisible(s.visible && winAlpha > 0).setAlpha(winAlpha * 0.92);
        }
        if (winAlpha > 0) this.hqWindows(winAlpha, vx, vy, sx, sy, now);

        // Vignette last, so it frames the lights too.
        lm.stamp(FX.vignette, undefined, 0, 0, {
            originX: 0, originY: 0, scaleX: lm.width / 160, scaleY: lm.height / 100,
            tint: toHex(sky.vignetteColor), alpha: sky.vignette, blendMode: Phaser.BlendModes.NORMAL,
        });
        lm.render();

        // Golden-hour haze over everything.
        this.haze.setPosition(vx, vy).setScale(vw / 64, vh / 64).setTint(toHex(sky.haze)).setAlpha(sky.hazeAlpha).setVisible(sky.hazeAlpha > 0.003 && !this.skipFx.includes('haze'));

        // Sun shafts slanting in from the upper left.
        const rays = this.hell || this.skipFx.includes('rays') ? 0 : sky.rays;
        for (let i = 0; i < this.rays.length; i++) {
            const r = this.rays[i];
            if (rays < 0.02) { r.setVisible(false); continue; }
            const sway = Math.sin(t * 0.07 + i * 1.9) * 0.04;
            const u = 0.08 + i * 0.21 + sway;
            const pulse = 0.55 + 0.45 * Math.sin(t * 0.23 + i * 2.4);
            r.setVisible(true).setTint(toHex(sky.rayColor))
                .setPosition(vx + vw * u, vy - vh * 0.15)
                .setRotation(-0.5)
                .setScale(vw * (0.07 + (i % 3) * 0.035) / 32, vh * 1.6 / 256)
                .setAlpha(rays * 0.2 * pulse);
        }
        // Dust motes in the sunbeams by day.
        const moteA = this.hell ? 0 : Math.max(0, sky.rays - 0.1) * (1 - night);
        for (const m of this.motes) {
            if (moteA < 0.02) { m.img.setVisible(false); continue; }
            const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + m.ph);
            m.img.setVisible(true).setTint(toHex(sky.rayColor))
                .setPosition(Math.round(vx + vw * m.u + Math.sin(t * 0.6 + m.ph) * 6), Math.round(vy + vh * m.v))
                .setAlpha(moteA * 0.55 * tw);
        }
        // Starlight glints twinkling across the dark.
        const starA = this.hell ? 0 : Math.max(0, sky.moon - 0.2) / 0.8;
        for (let i = 0; i < this.stars.length; i++) {
            const s = this.stars[i];
            if (starA < 0.02) { s.img.setVisible(false); continue; }
            const cycle = t * 0.35 + s.ph;
            const k = Math.floor(cycle);
            const p = cycle - k;
            const tw = Math.max(0, Math.sin(p * Math.PI)) ** 6;
            const u = hash(i, k, 21), v = hash(i, k, 22) * 0.45;
            s.img.setVisible(true).setTint(i % 4 ? 0xcfe0ff : 0xfff2c0)
                .setPosition(Math.round(vx + vw * u), Math.round(vy + vh * v)).setAlpha(starA * tw * 0.8);
        }
    }

    /** Cars at night: a headlight beam ahead, red tail lights behind, and flashing roof lights on duty. */
    private renderVehicles(night: number, vx: number, vy: number, sx: number, sy: number, now: number) {
        const lm = this.lm;
        const on = !this.hell && night > 0.05;
        for (const v of this.vehicles) {
            const s = v.sprite;
            if (!on || !s.visible || !s.active) {
                v.head.setVisible(false); v.tail.setVisible(false); v.siren?.setVisible(false);
                continue;
            }
            const [facing, k] = String(s.frame.name).split('-');
            const dx = facing === 'side' ? (s.flipX ? -1 : 1) : 0;
            const dy = facing === 'down' ? 1 : facing === 'up' ? -1 : 0;
            const big = v.kind === 'truck' ? 1.3 : 1;
            const cx = s.x, cy = s.y - 6 * big;
            const along = 30 * big, across = 15 * big;
            const hx = cx + dx * 20 * big, hy = cy + dy * 16 * big + (dy ? 0 : 3);
            lm.stamp(FX.light, undefined, (hx - vx) * sx, (hy - vy) * sy, {
                scaleX: (dx ? along : across) * 2 * sx / 128, scaleY: (dx ? across : along) * 2 * sy / 128,
                tint: 0xfff0c8, alpha: 0.75 * night, blendMode: Phaser.BlendModes.ADD,
            });
            v.head.setVisible(true).setPosition(cx + dx * 9 * big, cy + dy * 6 * big + 1).setScale(0.32 * big, 0.22 * big).setAlpha(0.8 * night);
            v.tail.setVisible(true).setPosition(cx - dx * 9 * big, cy - dy * 6 * big + 1).setScale(0.2 * big, 0.14 * big).setAlpha(0.75 * night);
            if (v.siren) {
                // Frame 1 is the roof lights' "on" half of the flash.
                const lit = k === '1';
                const col = v.kind === 'police' ? (Math.floor(now / 180) % 2 ? 0x3a6aff : 0xff2a3a) : 0xff3020;
                if (lit) {
                    v.siren.setVisible(true).setTint(col).setPosition(cx, cy - 6 * big).setScale(0.7).setAlpha(0.8 * night);
                    lm.stamp(FX.light, undefined, (cx - vx) * sx, (cy - vy) * sy, { scale: 44 * sx / 128, tint: col, alpha: 0.8 * night, blendMode: Phaser.BlendModes.ADD });
                } else v.siren.setVisible(false);
            }
        }
    }

    /** ATV HQ at night: every desk window, the lobby and the rooftop sign glow. */
    private hqWindows(a: number, vx: number, vy: number, sx: number, sy: number, now: number) {
        const hq = this.opts.hq;
        if (!hq) return;
        const b = hq.bounds();
        const floors = Math.max(1, Math.round((b.height - 82) / 36));
        const left = hq.left, bottom = hq.bottom, top = b.y;
        const lm = this.lm;
        const punch = (x: number, y: number, w: number, h: number, alpha: number, tint = 0xffffff) => {
            lm.stamp(FX.px, undefined, (x - vx) * sx, (y - vy) * sy, {
                originX: 0, originY: 0, scaleX: w * sx / 2, scaleY: h * sy / 2, tint, alpha: alpha * a, blendMode: Phaser.BlendModes.ADD,
            });
        };
        const spill = (x: number, y: number, r: number, alpha: number, tint = 0xffb860) => {
            lm.stamp(FX.light, undefined, (x - vx) * sx, (y - vy) * sy, {
                scaleX: r * 2 * sx / 128, scaleY: r * 1.4 * sy / 128, tint, alpha: alpha * a, blendMode: Phaser.BlendModes.ADD,
            });
        };
        for (let seat = 0; seat < floors * BAYS; seat++) {
            const s = deskSpot(seat);
            const x = left + s.x, y = bottom + s.y;
            spill(x + DESK_W / 2, y + DESK_H * 0.6, 30, 0.35, 0xb8d4ff);
            punch(x, y, DESK_W, DESK_H, 0.85);
        }
        const lobbyTop = bottom - LOBBY_H;
        for (const wx of [12, 62, HQ_W - 62 - 44, HQ_W - 12 - 44]) {
            spill(left + wx + 22, lobbyTop + 30, 48, 0.55);
            punch(left + wx, lobbyTop + 17, 44, 20, 0.9);
        }
        // Glass doors and the light pooling on the sidewalk.
        spill(hq.x, bottom + 4, 50, 0.45, 0xffd8a0);
        punch(hq.x - 13, bottom - 29, 26, 25, 0.8);
        const t = HQ_SPOTS.ticker;
        punch(left + t.x, bottom + t.y, t.w, t.h, 1, 0xffd080);
        // The rooftop sign.
        punch(left + HQ_SPOTS.sign.x, top + 1, 77, 21, 0.6);
        // The antenna beacon, blinking.
        if (Math.floor(now / 700) % 2 === 0) spill(left + HQ_SPOTS.beacon.x, top + HQ_SPOTS.beacon.y, 18, 0.9, 0xff4040);
    }
}

const HELL: Sky = {
    ambient: [1, 0.74, 0.68],
    night: 1,
    haze: [0.45, 0.06, 0.02],
    hazeAlpha: 0.05,
    vignette: 0.7,
    vignetteColor: [0.12, 0.0, 0.01],
    rays: 0,
    rayColor: [0, 0, 0],
    clouds: 0,
    moon: 0,
    sun: 0,
    sunSide: 1,
    sat: 1.15,
    gain: [1, 1, 1],
    shadow: [0.03, 0, 0.005],
    hi: [0.05, 0.01, -0.02],
};
