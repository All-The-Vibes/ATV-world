import Phaser from 'phaser';
import type { Rider } from '../ocean/riders';
import { PixelCanvas, addPixels, characterSheet, hash, lookKey, miniText, miniTextWidth, randomLook, shadowTexture, treeArt, type Color } from '../kit';

/**
 * Microsoft's Redmond campus, west of the plaza: glass office buildings (Building 99 and Building 92, the visitor
 * center), The Commons with its sports field, a treehouse up in the pines, the logo sign at the entrance, people
 * walking between buildings, and a Connector shuttle running along the road out front.
 */

const LOGO = { red: '#f25022', green: '#7fba00', blue: '#00a4ef', yellow: '#ffb900' } as const;

/** The four-square logo: each square `s` px, 1px apart. */
function logo(pc: PixelCanvas, x: number, y: number, s: number) {
    pc.rect(x, y, s, s, LOGO.red).rect(x + s + 1, y, s, s, LOGO.green);
    pc.rect(x, y + s + 1, s, s, LOGO.blue).rect(x + s + 1, y + s + 1, s, s, LOGO.yellow);
}

/** A glass-and-concrete office building, `w`×`h` px, with `floors` floors of curtain wall and its name over the door. */
function officeArt(w: number, h: number, opts: { name: string; floors: number; glass?: [Color, Color, Color]; logo?: number }) {
    const pc = new PixelCanvas(w + 2, h + 2);
    const x0 = 1, y0 = 1;
    const [gd, gb, gl] = opts.glass ?? ['blue', 'sky', 'ice'];
    pc.rect(x0, y0, w, 7, 'steel').rect(x0, y0, w, 1, 'mist').rect(x0, y0 + 6, w, 1, 'slate');
    for (let i = 0; i < 3; i++) {
        const ux = x0 + 8 + Math.floor(hash(i, w, 3) * (w - 28));
        pc.rect(ux, y0 + 1, 10, 4, 'mist').rect(ux, y0 + 1, 10, 1, 'white').rect(ux + 2, y0 + 3, 6, 1, 'steel');
    }
    const lobby = 18;
    const top = y0 + 7, bottom = y0 + h - lobby;
    const fh = (bottom - top) / opts.floors;
    for (let f = 0; f < opts.floors; f++) {
        const fy = Math.round(top + f * fh), fy2 = Math.round(top + (f + 1) * fh);
        for (let y = fy + 3; y < fy2; y++) {
            for (let x = x0 + 2; x < x0 + w - 2; x++) {
                const mullion = (x - x0 - 2) % 9 === 8;
                const shine = (((x - y) % 23) + 23) % 23 < 3;
                pc.set(x, y, mullion ? 'mist' : shine ? gl : y - fy < 5 ? gd : gb);
            }
        }
        pc.rect(x0, fy, w, 3, 'cloud').rect(x0, fy, w, 1, 'white');
        pc.rect(x0, fy, 2, fy2 - fy, 'cloud').rect(x0 + w - 2, fy, 2, fy2 - fy, 'mist');
    }
    const ly = y0 + h - lobby;
    pc.rect(x0, ly, w, lobby, 'cloud').rect(x0, ly, w, 2, 'white');
    for (let x = x0 + 5; x + 10 < x0 + w - 4; x += 14) pc.rect(x, ly + 4, 10, lobby - 4, gd).rect(x + 1, ly + 5, 3, lobby - 6, gb);
    const dx = x0 + Math.floor(w / 2) - 8;
    pc.rect(dx, ly + 3, 16, lobby - 3, 'night').rect(dx + 1, ly + 4, 6, lobby - 4, 'sky').rect(dx + 9, ly + 4, 6, lobby - 4, 'sky');
    pc.rect(dx + 2, ly + 5, 1, lobby - 7, 'ice').rect(dx + 10, ly + 5, 1, lobby - 7, 'ice');
    const tw = miniTextWidth(opts.name);
    const px = x0 + Math.floor((w - tw) / 2) - 3;
    pc.rect(px, ly - 9, tw + 6, 9, 'night').rect(px, ly - 9, tw + 6, 1, 'slate');
    miniText(pc, px + 3, ly - 7, opts.name, 'white');
    if (opts.logo) {
        const s = opts.logo, lx = x0 + w - (2 * s + 1) - 8, lt = y0 + 12;
        pc.rect(lx - 3, lt - 3, 2 * s + 7, 2 * s + 7, 'white');
        logo(pc, lx, lt, s);
    }
    return pc.outline('ink');
}

/** The sign at the entrance. */
function signArt() {
    const pc = new PixelCanvas(88, 34);
    pc.rect(1, 1, 86, 26, 'slate').rect(1, 1, 86, 1, 'steel').rect(3, 3, 82, 22, 'night');
    logo(pc, 7, 7, 7);
    miniText(pc, 26, 8, 'MICROSOFT', 'white');
    miniText(pc, 26, 16, 'REDMOND CAMPUS', 'mist');
    pc.rect(5, 27, 78, 6, 'steel').rect(5, 27, 78, 1, 'mist');
    return pc.outline('ink');
}

/** A soccer field, mowed in stripes. */
function fieldArt(w: number, h: number) {
    const pc = new PixelCanvas(w, h);
    const turf = (x: number): Color => (Math.floor(x / 10) % 2 ? 'grass' : 'leaf');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pc.set(x, y, turf(x));
    const mx = Math.floor(w / 2), my = Math.floor(h / 2);
    pc.ellipse(mx, my, 10, 10, (x, _y, nx, ny) => (nx * nx + ny * ny > 0.7 ? 'white' : turf(x)));
    pc.rect(3, 3, w - 6, 1, 'white').rect(3, h - 4, w - 6, 1, 'white').rect(3, 3, 1, h - 6, 'white').rect(w - 4, 3, 1, h - 6, 'white');
    pc.rect(mx, 3, 1, h - 6, 'white');
    for (const x of [3, w - 17]) pc.rect(x, my - 12, 14, 1, 'white').rect(x, my + 12, 14, 1, 'white');
    pc.rect(16, my - 12, 1, 25, 'white').rect(w - 17, my - 12, 1, 25, 'white');
    pc.rect(0, my - 6, 3, 13, 'cloud').rect(w - 3, my - 6, 3, 13, 'cloud');
    return pc;
}

/** A cabin built up in a big pine, with a lit window and a ladder down. */
function treehouseArt() {
    const W = 72, H = 112, cx = 36;
    const pc = new PixelCanvas(W, H);
    pc.rect(cx - 4, 20, 8, H - 22, 'bark').rect(cx - 4, 20, 2, H - 22, 'earth');
    for (let t = 0; t < 4; t++) {
        const ty = 2 + t * 16, th = 24, grow = 6 + t * 5;
        for (let j = 0; j < th; j++) {
            const hw = Math.round(2 + (j / th) * grow + t * 1.5);
            for (let i = -hw; i <= hw; i++) {
                const k = i / hw;
                pc.set(cx + i, ty + j, j >= th - 3 ? 'pine' : k < -0.45 ? 'leaf' : k > 0.5 ? 'pine' : 'forest');
            }
        }
    }
    const by = 72;
    pc.rect(cx - 24, by, 48, 3, 'earth').rect(cx - 24, by, 48, 1, 'wood');
    pc.rect(cx - 22, by + 3, 2, 6, 'earth').rect(cx + 20, by + 3, 2, 6, 'earth');
    pc.rect(cx - 16, by - 20, 32, 20, 'wood');
    for (let j = by - 17; j < by; j += 4) pc.rect(cx - 16, j, 32, 1, 'earth');
    for (let j = 0; j <= 12; j++) {
        const hw = Math.round((j * 19) / 12);
        pc.rect(cx - hw, by - 32 + j, 2 * hw + 1, 1, j === 12 ? 'bark' : 'earth').set(cx - hw, by - 32 + j, 'clay');
    }
    pc.rect(cx - 10, by - 14, 9, 7, 'yellow').rect(cx - 10, by - 14, 9, 1, 'gold').rect(cx - 6, by - 14, 1, 7, 'earth');
    pc.rect(cx + 5, by - 14, 6, 14, 'bark').set(cx + 9, by - 7, 'gold');
    pc.rect(cx - 24, by - 6, 1, 6, 'earth').rect(cx + 23, by - 6, 1, 6, 'earth').rect(cx - 24, by - 6, 8, 1, 'wood').rect(cx + 16, by - 6, 8, 1, 'wood');
    for (let j = by + 3; j < H - 2; j++) {
        pc.set(cx + 8, j, 'clay').set(cx + 13, j, 'clay');
        if ((j - by) % 5 === 0) pc.rect(cx + 8, j, 6, 1, 'wood');
    }
    return pc.outline('ink');
}

/** A Connector shuttle, facing right. */
function busArt() {
    const pc = new PixelCanvas(60, 26);
    const x = 1, y = 1;
    pc.rect(x, y + 2, 56, 17, 'cloud').rect(x + 1, y + 1, 54, 1, 'white').rect(x, y + 2, 56, 1, 'white');
    pc.rect(x + 3, y + 4, 46, 7, 'navy');
    for (let i = 0; i < 6; i++) pc.rect(x + 4 + i * 8, y + 5, 6, 5, 'sky').set(x + 4 + i * 8, y + 5, 'ice');
    pc.rect(x + 51, y + 4, 4, 8, 'sky').set(x + 52, y + 4, 'ice');
    miniText(pc, x + 8, y + 12, 'CONNECTOR', 'blue');
    pc.rect(x, y + 18, 56, 1, 'mist');
    pc.set(x + 55, y + 14, 'yellow').set(x, y + 14, 'red');
    for (const wx of [8, 42]) pc.rect(x + wx, y + 17, 8, 6, 'ink').rect(x + wx + 3, y + 19, 2, 2, 'steel');
    return pc.outline('ink');
}

function busStopArt() {
    const pc = new PixelCanvas(20, 34);
    pc.rect(9, 10, 2, 23, 'steel');
    pc.rect(1, 1, 18, 11, LOGO.blue).rect(1, 1, 18, 1, 'sky');
    miniText(pc, 4, 4, 'BUS', 'white');
    return pc.outline('ink');
}

interface Walker { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; dir: number; speed: number }

export class Campus {
    surfing = false;
    private readonly parts: Phaser.GameObjects.Image[] = [];
    private readonly walkers: Walker[] = [];
    private readonly box: Phaser.Geom.Rectangle;
    private readonly left: number;
    private readonly right: number;
    private readonly stopX: number;
    private readonly bus: { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; x: number; y: number; dir: number; wait: number; served: boolean };

    /** `right` is the campus's east edge; it reaches 470px west of there. */
    constructor(private readonly scene: Phaser.Scene, right: number) {
        const W = 470;
        const x0 = right - W;
        const at = (u: number) => x0 + u;
        this.left = x0;
        this.right = right;

        // Paths, the sidewalk, and the road out front.
        const GY = 10, GH = 264;
        const g = new PixelCanvas(W, GH);
        const path = (u: number, y: number, w: number, h: number) => {
            for (let j = 0; j < h; j++) {
                for (let i = 0; i < w; i++) {
                    const edge = j === 0 || j === h - 1 || i === 0 || i === w - 1;
                    g.set(u + i, y - GY + j, edge || (u + i) % 10 === 0 || (y + j) % 10 === 0 ? 'mist' : 'cloud');
                }
            }
        };
        path(0, 30, W, 20);
        path(92, 14, 16, 18);
        path(342, 14, 16, 18);
        path(136, 48, 12, 176);
        path(372, 210, 16, 14);
        path(0, 222, W, 8);
        for (let y = 230; y < 270; y++) {
            for (let x = 0; x < W; x++) {
                const n = hash(x, y, 21);
                g.set(x, y - GY, n < 0.05 ? 'night' : n > 0.96 ? 'steel' : 'slate');
            }
        }
        for (let x = 4; x < W - 4; x += 12) g.rect(x, 250 - GY, 6, 1, 'gold');
        g.rect(0, 270 - GY, W, 4, 'cloud').rect(0, 270 - GY, W, 1, 'mist');
        addPixels(scene, 'campus-ground', g);
        scene.add.image(x0, GY, 'campus-ground').setOrigin(0, 0).setDepth(-5e8);
        addPixels(scene, 'campus-field', fieldArt(120, 80));
        scene.add.image(at(165), 118, 'campus-field').setOrigin(0, 0).setDepth(-5e8 + 1);

        this.place('campus-b99', officeArt(150, 100, { name: 'BUILDING 99', floors: 4, glass: ['navy', 'blue', 'sky'] }), at(100), 16);
        this.place('campus-b92', officeArt(170, 92, { name: 'BUILDING 92 VISITOR CENTER', floors: 3, logo: 8 }), at(350), 16);
        this.place('campus-commons', officeArt(160, 64, { name: 'THE COMMONS', floors: 1, glass: ['navy', 'forest', 'cyan'] }), at(380), 212);
        this.place('campus-sign', signArt(), at(425), 104);
        this.place('campus-treehouse', treehouseArt(), at(60), 212);
        this.place('campus-stop', busStopArt(), at(330), 228);
        [[220, 6], [204, -44], [246, -80], [458, -24], [12, -10], [14, 150], [112, 208], [110, 126], [296, 112]].forEach(([u, y], i) => {
            const { canvas } = treeArt('pine', 50 + i);
            const key = `campus-pine-${i}`;
            addPixels(scene, key, canvas);
            scene.add.image(at(u), y, shadowTexture(scene, 16)).setAlpha(0.25).setDepth(-1e8);
            this.parts.push(scene.add.image(at(u), y + 2, key).setOrigin(0.5, 1).setDepth(y));
        });

        // People walking between buildings.
        [36, 44, 40, 227, 33].forEach((y, i) => {
            const look = randomLook(`campus-${i}`);
            const key = lookKey(look);
            const sheet = characterSheet(look);
            addPixels(scene, key, sheet.canvas, sheet.frames);
            const anim = `${key}-walk`;
            if (!scene.anims.exists(anim)) {
                scene.anims.create({ key: anim, frames: ['side-1', 'side-0', 'side-2', 'side-0'].map((frame) => ({ key, frame })), frameRate: 8, repeat: -1 });
            }
            const x = at(20 + hash(i, 1, 9) * (W - 40));
            const sprite = scene.add.sprite(x, y, key, 'side-0').setOrigin(0.5, 1).setDepth(y).play(anim);
            const shadow = scene.add.image(x, y, shadowTexture(scene, 12)).setAlpha(0.3).setDepth(-1e8);
            this.walkers.push({ sprite, shadow, dir: i % 2 ? -1 : 1, speed: 18 + hash(i, 2, 9) * 14 });
        });

        // The Connector: east in the south lane, west in the north lane, stopping at the bus stop on the way west.
        addPixels(scene, 'campus-bus', busArt());
        this.stopX = at(352);
        this.bus = {
            sprite: scene.add.image(at(40), 265, 'campus-bus').setOrigin(0.5, 1),
            shadow: scene.add.image(at(40), 264, shadowTexture(scene, 44)).setAlpha(0.3).setDepth(-1e8),
            x: at(40), y: 259, dir: 1, wait: 0, served: false,
        };

        let l = x0, t = GY, r = right, b = GY + GH;
        for (const p of this.parts) {
            const pb = p.getBounds();
            l = Math.min(l, pb.left);
            t = Math.min(t, pb.top);
            r = Math.max(r, pb.right);
            b = Math.max(b, pb.bottom);
        }
        this.box = new Phaser.Geom.Rectangle(l, t, r - l, b - t);

        scene.events.on('update', this.tick, this);
        const stop = () => scene.events.off('update', this.tick, this);
        scene.events.once('shutdown', stop);
        scene.events.once('destroy', stop);
    }

    /** The whole campus, road included. */
    bounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(this.box.x, this.box.y, this.box.width, this.box.height);
    }

    surfRiders(): Rider[] {
        return this.walkers.map(w => ({ sprite: w.sprite, hide: [w.shadow] }));
    }

    private place(key: string, pc: PixelCanvas, x: number, base: number) {
        addPixels(this.scene, key, pc);
        this.parts.push(this.scene.add.image(x, base, key).setOrigin(0.5, 1).setDepth(base));
    }

    private tick(_time: number, deltaMs: number) {
        if (this.surfing) return;
        const dt = Math.min(0.1, deltaMs / 1000);
        for (const w of this.walkers) {
            w.sprite.x += w.dir * w.speed * dt;
            if (w.sprite.x < this.left + 12 || w.sprite.x > this.right - 12) {
                w.sprite.x = Phaser.Math.Clamp(w.sprite.x, this.left + 12, this.right - 12);
                w.dir *= -1;
            }
            w.sprite.setFlipX(w.dir < 0);
            w.shadow.setPosition(w.sprite.x, w.sprite.y);
        }

        const bus = this.bus;
        if (bus.wait > 0) bus.wait -= dt;
        else {
            bus.x += bus.dir * 46 * dt;
            if (bus.dir < 0 && !bus.served && Math.abs(bus.x - this.stopX) < 2) {
                bus.wait = 2.5;
                bus.served = true;
            }
            if (bus.dir > 0 && bus.x > this.right - 34) bus.dir = -1;
            else if (bus.dir < 0 && bus.x < this.left + 34) {
                bus.dir = 1;
                bus.served = false;
            }
        }
        bus.y += Phaser.Math.Clamp((bus.dir > 0 ? 259 : 241) - bus.y, -22 * dt, 22 * dt);
        bus.sprite.setFlipX(bus.dir < 0).setPosition(Math.round(bus.x), Math.round(bus.y + 6)).setDepth(bus.y + 6);
        bus.shadow.setPosition(Math.round(bus.x), Math.round(bus.y + 5));
    }
}
