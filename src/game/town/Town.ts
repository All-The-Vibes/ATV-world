import Phaser from 'phaser';
import { PixelCanvas, addPixels, bayer, buildingArt, hash, shadowTexture, stripFrames, treeArt, type BuildingSpec, type Color } from '../kit';

/**
 * The town east of the plaza: a ring road with two-way traffic, a police station, a fire station, and houses.
 * Every so often a house catches fire (or click one): the fire truck rolls out with its lights on, drives
 * to the house, hoses it down, and backs into its bay again. The police car's lights flash until it's out.
 */

interface P { x: number; y: number }
type Facing = 'side' | 'down' | 'up';

const ROAD = 14;
const WALK = 6;
const LANE = 7;

interface Car { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; path: P[]; len: number; t: number; speed: number; police: boolean; key: string }
interface House {
    image: Phaser.GameObjects.Image;
    x: number;
    base: number;
    top: number;
    road: number;
    heat: number;
    age: number;
    burning: boolean;
    flames: Phaser.GameObjects.Sprite[];
    glow: Phaser.GameObjects.Image;
    alert: Phaser.GameObjects.Image;
    spots: P[];
}
interface Puff { img: Phaser.GameObjects.Image; vx: number; vy: number; g: number; life: number; max: number; grow: number; a0: number }

// --- art -------------------------------------------------------------------------------------------

type Ramp = [Color, Color, Color];

function carSide(pc: PixelCanvas, x: number, y: number, [d, b, l]: Ramp, light?: [Color, Color]) {
    pc.rect(x + 6, y + 1, 12, 4, b).rect(x + 7, y, 10, 1, l);
    pc.rect(x + 7, y + 2, 4, 2, 'sky').rect(x + 12, y + 2, 5, 2, 'sky').set(x + 12, y + 2, 'ice');
    pc.rect(x, y + 5, 24, 4, b).rect(x, y + 5, 24, 1, l).rect(x, y + 8, 24, 1, d).rect(x + 11, y + 5, 1, 3, d);
    pc.set(x + 23, y + 6, 'yellow').set(x, y + 6, 'red');
    pc.rect(x + 3, y + 8, 4, 3, 'ink').rect(x + 17, y + 8, 4, 3, 'ink').set(x + 4, y + 9, 'steel').set(x + 18, y + 9, 'steel');
    if (light) pc.rect(x + 9, y - 1, 3, 1, light[0]).rect(x + 12, y - 1, 3, 1, light[1]);
}

function carEnd(pc: PixelCanvas, x: number, y: number, [d, b, l]: Ramp, back: boolean, light?: [Color, Color]) {
    pc.rect(x + 2, y + 1, 10, 4, b).rect(x + 3, y + 2, 8, 2, back ? 'blue' : 'sky').set(x + 3, y + 2, back ? 'sky' : 'ice');
    pc.rect(x, y + 5, 14, 5, b).rect(x, y + 5, 14, 1, l).rect(x, y + 9, 14, 1, d);
    const lamp: Color = back ? 'red' : 'yellow';
    pc.rect(x + 1, y + 7, 2, 1, lamp).rect(x + 11, y + 7, 2, 1, lamp).rect(x + 5, y + 7, 4, 1, back ? d : 'steel');
    pc.rect(x + 1, y + 10, 3, 2, 'ink').rect(x + 10, y + 10, 3, 2, 'ink');
    if (light) pc.rect(x + 4, y, 3, 1, light[0]).rect(x + 7, y, 3, 1, light[1]);
}

function truckSide(pc: PixelCanvas, x: number, y: number, light: [Color, Color]) {
    pc.rect(x, y + 5, 27, 8, 'red').rect(x, y + 5, 27, 1, 'orange').rect(x, y + 12, 36, 1, 'wine');
    for (const sx of [7, 14, 21]) pc.rect(x + sx, y + 6, 1, 6, 'wine');
    pc.rect(x + 1, y + 1, 25, 1, 'cloud').rect(x + 1, y + 3, 25, 1, 'cloud');
    for (let i = x + 2; i < x + 26; i += 3) pc.set(i, y + 2, 'mist');
    pc.rect(x + 3, y + 4, 1, 1, 'steel').rect(x + 22, y + 4, 1, 1, 'steel');
    pc.rect(x + 27, y + 2, 9, 11, 'red').rect(x + 27, y + 2, 9, 1, 'orange').rect(x + 29, y + 4, 6, 4, 'sky').set(x + 29, y + 4, 'ice');
    pc.rect(x, y + 9, 36, 1, 'white');
    pc.rect(x + 28, y, 3, 2, light[0]).rect(x + 32, y, 3, 2, light[1]);
    pc.set(x + 35, y + 7, 'yellow').rect(x + 35, y + 10, 1, 2, 'cloud');
    for (const wx of [3, 15, 28]) pc.rect(x + wx, y + 12, 5, 4, 'ink').rect(x + wx + 2, y + 13, 1, 2, 'steel');
}

function truckEnd(pc: PixelCanvas, x: number, y: number, back: boolean, light: [Color, Color]) {
    pc.rect(x + 3, y, 6, 2, light[0]).rect(x + 9, y, 6, 2, light[1]);
    pc.rect(x + 1, y + 2, 16, 15, 'red').rect(x + 1, y + 2, 16, 1, 'orange').rect(x + 1, y + 16, 16, 1, 'wine');
    if (back) {
        pc.rect(x + 4, y + 3, 10, 2, 'cloud').rect(x + 4, y + 7, 10, 7, 'wine').rect(x + 8, y + 7, 1, 7, 'red');
        pc.rect(x + 2, y + 14, 2, 2, 'red').rect(x + 14, y + 14, 2, 2, 'red');
    } else {
        pc.rect(x + 3, y + 4, 12, 5, 'sky').set(x + 3, y + 4, 'ice').set(x + 4, y + 4, 'ice');
        pc.rect(x + 6, y + 11, 6, 4, 'cloud');
        for (let j = y + 12; j < y + 15; j += 2) pc.rect(x + 6, j, 6, 1, 'mist');
        pc.rect(x + 2, y + 12, 3, 2, 'yellow').rect(x + 13, y + 12, 3, 2, 'yellow');
    }
    pc.rect(x + 1, y + 10, 16, 1, 'white').rect(x, y + 17, 18, 1, back ? 'slate' : 'cloud');
    pc.rect(x + 1, y + 18, 4, 2, 'ink').rect(x + 13, y + 18, 4, 2, 'ink');
}

const CELL = { w: 40, h: 24 };
const FACINGS: Facing[] = ['side', 'down', 'up'];

/** One sheet per vehicle look: frames `side-0`, `side-1`, `down-0`, ... (0 and 1 swap the roof lights). */
function vehicleSheet(kind: 'car' | 'police' | 'truck', body: Ramp) {
    const pc = new PixelCanvas(CELL.w * 6, CELL.h);
    const frames: { name: string; x: number; y: number; w: number; h: number }[] = [];
    FACINGS.forEach((facing, fi) => {
        for (let k = 0; k < 2; k++) {
            const cx = (fi * 2 + k) * CELL.w;
            const light: [Color, Color] | undefined =
                kind === 'truck' ? (k ? ['white', 'red'] : ['red', 'white']) : kind === 'police' ? (k ? ['wine', 'sky'] : ['red', 'navy']) : undefined;
            if (kind === 'truck') {
                if (facing === 'side') truckSide(pc, cx + 2, CELL.h - 17, light!);
                else truckEnd(pc, cx + 11, CELL.h - 21, facing === 'up', light!);
            } else if (facing === 'side') carSide(pc, cx + 8, CELL.h - 12, body, light);
            else carEnd(pc, cx + 13, CELL.h - 13, body, facing === 'up', light);
            pc.outline('ink', false, { x: cx, y: 0, w: CELL.w, h: CELL.h });
            frames.push({ name: `${facing}-${k}`, x: cx, y: 0, w: CELL.w, h: CELL.h });
        }
    });
    return { canvas: pc, frames };
}

function roadArt(w: number, h: number, ox: number, oy: number, rects: { x: number; y: number; w: number; h: number; walk: boolean }[], dashes: { x: number; y: number; w: number; h: number }[]) {
    const pc = new PixelCanvas(w, h);
    for (const r of rects.filter((r) => r.walk)) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            pc.set(x - ox, y - oy, (x % 8 === 0 || y % 8 === 0) ? 'mist' : 'cloud');
        }
    }
    for (const r of rects.filter((r) => !r.walk)) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            const n = hash(x, y, 77);
            pc.set(x - ox, y - oy, n < 0.06 ? 'night' : n > 0.95 ? 'steel' : 'slate');
        }
    }
    for (const d of dashes) pc.rect(d.x - ox, d.y - oy, d.w, d.h, 'gold');
    return pc;
}

// --- the town ------------------------------------------------------------------------------------

export class Town {
    surfing = false;
    private cars: Car[] = [];
    private houses: House[] = [];
    private puffs: Puff[] = [];
    private pool: Phaser.GameObjects.Image[] = [];
    private box: Phaser.Geom.Rectangle;
    private L: number;
    private R: number;
    private readonly T = -150;
    private readonly B = 240;
    private truck: {
        sprite: Phaser.GameObjects.Sprite;
        shadow: Phaser.GameObjects.Image;
        home: P;
        pos: P;
        path: P[];
        i: number;
        mode: 'home' | 'out' | 'spray' | 'back';
        house?: House;
        facing: Facing;
        flip: boolean;
    };
    private nextFire: number;
    private clock = 0;
    private sprayAcc = 0;
    private smokeAcc = 0;

    constructor(private readonly scene: Phaser.Scene, readonly left: number) {
        const ox = left;
        this.L = ox + 20;
        this.R = ox + 400;
        const { L, R, T, B } = this;
        this.box = new Phaser.Geom.Rectangle(ox, -256, 420, 522);
        this.textures();

        // Roads: a ring with sidewalks and dashed middle lines.
        const outer = ROAD + WALK;
        const rects = [
            { x: L - outer, y: T - outer, w: R - L + outer * 2, h: outer * 2, walk: true },
            { x: L - outer, y: B - outer, w: R - L + outer * 2, h: outer * 2, walk: true },
            { x: L - outer, y: T - outer, w: outer * 2, h: B - T + outer * 2, walk: true },
            { x: R - outer, y: T - outer, w: outer * 2, h: B - T + outer * 2, walk: true },
            { x: L - ROAD, y: T - ROAD, w: R - L + ROAD * 2, h: ROAD * 2, walk: false },
            { x: L - ROAD, y: B - ROAD, w: R - L + ROAD * 2, h: ROAD * 2, walk: false },
            { x: L - ROAD, y: T - ROAD, w: ROAD * 2, h: B - T + ROAD * 2, walk: false },
            { x: R - ROAD, y: T - ROAD, w: ROAD * 2, h: B - T + ROAD * 2, walk: false },
        ];
        const dashes: { x: number; y: number; w: number; h: number }[] = [];
        for (let x = L + 24; x < R - 24; x += 10) dashes.push({ x, y: T, w: 5, h: 1 }, { x, y: B, w: 5, h: 1 });
        for (let y = T + 24; y < B - 24; y += 10) dashes.push({ x: L, y, w: 1, h: 5 }, { x: R, y, w: 1, h: 5 });
        const rw = R - L + outer * 2, rh = B - T + outer * 2;
        addPixels(scene, 'town-roads', roadArt(rw, rh, L - outer, T - outer, rects, dashes));
        scene.add.image(L - outer, T - outer, 'town-roads').setOrigin(0, 0).setDepth(-5e8);

        // Buildings face the street south of them.
        const top = T - outer - 1, bottom = B - outer - 1;
        this.building(ox + 110, top, { w: 7, h: 5, style: 'hall', roof: 'blue', wall: 'white', trim: 'navy', doorColor: 'navy', sign: 'POLICE', seed: 4 });
        this.house(ox + 236, top, { w: 5, h: 5, roof: 'green', wall: 'cream', seed: 11 });
        this.house(ox + 336, top, { w: 5, h: 4, roof: 'purple', wall: 'white', seed: 12 });
        this.house(ox + 92, bottom, { w: 5, h: 4, roof: 'orange', wall: 'cream', seed: 13 });
        const station = this.building(ox + 214, bottom, {
            w: 8, h: 6, style: 'brick', wall: 'red', roof: 'stone', door: false, windows: false, sign: 'FIRE STATION', seed: 5,
            draw: (pc, info) => {
                const bx = 44, by = info.H - 2;
                pc.rect(bx - 14, by - 27, 28, 27, 'cloud');
                pc.rect(bx - 12, by - 25, 24, 25, 'night').rect(bx - 12, by - 25, 24, 3, 'mist').rect(bx - 12, by - 23, 24, 1, 'steel');
                pc.rect(bx - 12, by - 1, 24, 1, 'slate');
                pc.rect(98, by - 16, 9, 16, 'cloud').rect(99, by - 15, 7, 15, 'wine').set(104, by - 8, 'gold');
                pc.rect(86, info.wallTop + 6, 24, 9, 'white').rect(87, info.wallTop + 7, 10, 7, 'sky').rect(99, info.wallTop + 7, 10, 7, 'sky');
                pc.ellipse(102, by - 22, 3, 3, 'gold').set(102, by - 22, 'red');
            },
        });
        this.house(ox + 338, bottom, { w: 5, h: 5, roof: 'teal', wall: 'pink', seed: 14 });
        [[ox + 130, 40, 'oak'], [ox + 215, 10, 'cherry'], [ox + 300, 70, 'autumn'], [ox + 180, 110, 'pine'], [ox + 360, 20, 'oak']].forEach(([x, y, kind], i) => {
            const { canvas } = treeArt(String(kind), 30 + i);
            const k = `town-tree-${i}`;
            addPixels(scene, k, canvas);
            scene.add.image(Number(x), Number(y), shadowTexture(scene, 18)).setAlpha(0.25).setDepth(-1e8);
            scene.add.image(Number(x), Number(y) + 2, k).setOrigin(0.5, 1).setDepth(Number(y));
        });

        // Traffic: clockwise on the inner lane, counter-clockwise on the outer lane.
        const inner = [{ x: L + LANE, y: T + LANE }, { x: R - LANE, y: T + LANE }, { x: R - LANE, y: B - LANE }, { x: L + LANE, y: B - LANE }];
        const outerLane = [{ x: L - LANE, y: T - LANE }, { x: L - LANE, y: B + LANE }, { x: R + LANE, y: B + LANE }, { x: R + LANE, y: T - LANE }];
        const colors: Ramp[] = [['navy', 'blue', 'sky'], ['clay', 'gold', 'yellow'], ['pine', 'forest', 'leaf'], ['plum', 'violet', 'pink'], ['wine', 'red', 'orange'], ['earth', 'orange', 'gold']];
        for (let i = 0; i < 4; i++) this.car(inner, i / 4, 42, i === 0 ? 'police' : 'car', colors[i]);
        for (let i = 0; i < 3; i++) this.car(outerLane, i / 3 + 0.1, 36, 'car', colors[(i + 4) % colors.length]);

        // The fire truck waits in its bay.
        const sb = station.getBounds();
        const home = { x: sb.x + 44, y: bottom - 9 };
        const sheet = vehicleSheet('truck', ['wine', 'red', 'orange']);
        addPixels(scene, 'town-truck', sheet.canvas, sheet.frames);
        this.truck = {
            sprite: scene.add.sprite(home.x, home.y, 'town-truck', 'down-0').setOrigin(0.5, 1),
            shadow: scene.add.image(home.x, home.y, shadowTexture(scene, 20)).setAlpha(0.3).setDepth(-1e8),
            home, pos: { ...home }, path: [], i: 0, mode: 'home', facing: 'down', flip: false,
        };
        this.place(this.truck.sprite, this.truck.shadow, home, 'down', false, 'truck');

        this.nextFire = 6 + Math.random() * 4;
        scene.events.on('update', this.tick, this);
        const stop = () => scene.events.off('update', this.tick, this);
        scene.events.once('shutdown', stop);
        scene.events.once('destroy', stop);
        const w = window as unknown as { atv?: Record<string, unknown> };
        w.atv = { ...w.atv, town: { ignite: (i?: number) => this.ignite(this.houses[i ?? Math.floor(Math.random() * this.houses.length)]), town: this } };
    }

    /** The whole town, roads and roofs. */
    bounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(this.box.x, this.box.y, this.box.width, this.box.height);
    }

    private textures() {
        const s = this.scene;
        const fl = new PixelCanvas(40, 14);
        for (let f = 0; f < 4; f++) {
            for (let j = 0; j < 14; j++) {
                const k = j / 13;
                const hw = (1 - k) ** 0.7 * 4.5 + (hash(j, f, 3) - 0.5) * 1.2;
                const sway = Math.sin(j * 0.9 + f * 1.7) * k * 1.5;
                for (let i = 0; i < 10; i++) {
                    const dd = Math.abs(i - 4.5 - sway) / Math.max(0.5, hw);
                    if (dd > 1) continue;
                    fl.set(f * 10 + i, 13 - j, dd < 0.35 && k < 0.55 ? 'yellow' : dd < 0.7 && k < 0.8 ? 'gold' : k > 0.7 ? 'red' : 'orange');
                }
            }
        }
        addPixels(s, 'town-flame', fl, stripFrames(4, 10, 14));
        if (!s.anims.exists('town-flame')) {
            s.anims.create({ key: 'town-flame', frames: [0, 1, 2, 3].map((frame) => ({ key: 'town-flame', frame })), frameRate: 10, repeat: -1 });
        }
        const puff = (c1: Color, c2: Color) => new PixelCanvas(8, 8).ellipse(4, 4, 4, 4, (x, y, nx, ny) => (nx + ny < -0.4 && bayer(x, y) < 0.6 ? c2 : c1));
        addPixels(s, 'town-smoke', puff('slate', 'steel'));
        addPixels(s, 'town-steam', puff('cloud', 'white'));
        addPixels(s, 'town-drop', new PixelCanvas(2, 2).rect(0, 0, 2, 2, 'cyan').set(0, 0, 'ice'));
        const glow = new PixelCanvas(40, 40);
        for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) {
            const d = Math.hypot(i - 19.5, j - 19.5) / 20;
            if (d < 1 && (1 - d) ** 1.4 > bayer(i, j)) glow.set(i, j, d < 0.4 ? 'gold' : 'orange');
        }
        addPixels(s, 'town-glow', glow);
        addPixels(s, 'town-alert', new PixelCanvas(9, 11).rect(1, 0, 7, 9, 'red').rect(3, 9, 3, 1, 'red').rect(4, 10, 1, 1, 'red').rect(4, 2, 1, 3, 'white').set(4, 6, 'white').outline('ink'));
    }

    private building(x: number, base: number, spec: BuildingSpec): Phaser.GameObjects.Image {
        const { canvas } = buildingArt(spec);
        const key = `town-building-${x}-${base}`;
        addPixels(this.scene, key, canvas);
        return this.scene.add.image(x, base, key).setOrigin(0.5, 1).setDepth(base);
    }

    private house(x: number, base: number, spec: BuildingSpec) {
        const image = this.building(x, base, { style: 'house', ...spec });
        const b = image.getBounds();
        const road = base < 0 ? this.T : this.B;
        const glow = this.scene.add.image(x, b.centerY, 'town-glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2).setAlpha(0).setDepth(base + 1);
        const alert = this.scene.add.image(x, b.top - 4, 'town-alert').setOrigin(0.5, 1).setDepth(base + 3).setVisible(false);
        const spots = [
            { x: x - b.width * 0.25, y: b.top + 14 }, { x: x + b.width * 0.2, y: b.top + 10 },
            { x: x - b.width * 0.3, y: base - 10 }, { x: x + b.width * 0.3, y: base - 10 }, { x, y: b.top + 22 },
        ];
        const house: House = { image, x, base, top: b.top, road, heat: 0, age: 0, burning: false, flames: [], glow, alert, spots };
        image.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
            if (p.getDistance() < 6) this.ignite(house);
        });
        this.houses.push(house);
    }

    private car(path: P[], at: number, speed: number, kind: 'car' | 'police', body: Ramp) {
        const key = kind === 'police' ? 'town-police' : `town-car-${body[1]}`;
        if (!this.scene.textures.exists(key)) {
            const sheet = vehicleSheet(kind, kind === 'police' ? ['mist', 'white', 'white'] : body);
            addPixels(this.scene, key, sheet.canvas, sheet.frames);
        }
        let len = 0;
        for (let i = 0; i < path.length; i++) len += Math.hypot(path[(i + 1) % path.length].x - path[i].x, path[(i + 1) % path.length].y - path[i].y);
        const sprite = this.scene.add.sprite(0, 0, key, 'side-0').setOrigin(0.5, 1);
        const shadow = this.scene.add.image(0, 0, shadowTexture(this.scene, 20)).setAlpha(0.25).setDepth(-1e8);
        this.cars.push({ sprite, shadow, path, len, t: at * len, speed, police: kind === 'police', key });
    }

    private along(path: P[], t: number): { p: P; d: P } {
        for (let i = 0; i < path.length; i++) {
            const a = path[i], b = path[(i + 1) % path.length];
            const seg = Math.hypot(b.x - a.x, b.y - a.y);
            if (t <= seg) return { p: { x: a.x + (b.x - a.x) * t / seg, y: a.y + (b.y - a.y) * t / seg }, d: { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg } };
            t -= seg;
        }
        return { p: path[0], d: { x: 1, y: 0 } };
    }

    private place(sprite: Phaser.GameObjects.Sprite, shadow: Phaser.GameObjects.Image, p: P, facing: Facing, flip: boolean, kind: 'car' | 'truck', lights = false) {
        const foot = kind === 'truck' ? (facing === 'side' ? 6 : 9) : facing === 'side' ? 5 : 6;
        const k = lights && Math.floor(this.clock * 5) % 2 ? 1 : 0;
        sprite.setFrame(`${facing}-${k}`).setFlipX(flip).setPosition(Math.round(p.x), Math.round(p.y + foot)).setDepth(p.y + foot + 0.5);
        shadow.setPosition(Math.round(p.x), Math.round(p.y + foot - 1));
    }

    private face(d: P): { facing: Facing; flip: boolean } {
        if (Math.abs(d.x) >= Math.abs(d.y)) return { facing: 'side', flip: d.x < 0 };
        return { facing: d.y > 0 ? 'down' : 'up', flip: false };
    }

    /** Set a house on fire (no-op if it's already burning). */
    ignite(house?: House) {
        if (!house || house.burning) return;
        house.burning = true;
        house.age = 0;
        house.heat = Math.max(house.heat, 0.15);
        house.alert.setVisible(true);
        if (!house.flames.length) {
            house.flames = house.spots.map((s, i) =>
                this.scene.add.sprite(Math.round(s.x), Math.round(s.y), 'town-flame', i % 4).setOrigin(0.5, 1).setDepth(house.base + 2).setVisible(false).play({ key: 'town-flame', startFrame: i % 4 }),
            );
        }
    }

    private puff(key: string, x: number, y: number, vx: number, vy: number, life: number, opts: { g?: number; grow?: number; a0?: number; depth: number }) {
        if (this.puffs.length > 260) return;
        const img = (this.pool.pop() ?? this.scene.add.image(0, 0, key)).setTexture(key).setPosition(x, y).setVisible(true).setScale(1).setAlpha(opts.a0 ?? 0.8).setDepth(opts.depth);
        this.puffs.push({ img, vx, vy, g: opts.g ?? 0, life: 0, max: life, grow: opts.grow ?? 0, a0: opts.a0 ?? 0.8 });
    }

    private tick(_time: number, deltaMs: number) {
        if (this.surfing) return;
        const dt = Math.min(0.1, deltaMs / 1000);
        this.clock += dt;
        const burning = this.houses.filter((h) => h.burning);

        for (const c of this.cars) {
            c.t = (c.t + c.speed * dt) % c.len;
            const { p, d } = this.along(c.path, c.t);
            const { facing, flip } = this.face(d);
            this.place(c.sprite, c.shadow, p, facing, flip, 'car', c.police && burning.length > 0);
        }

        // Random fires, one at a time.
        if (!burning.length && this.truck.mode === 'home') {
            this.nextFire -= dt;
            if (this.nextFire <= 0) {
                this.ignite(this.houses[Math.floor(Math.random() * this.houses.length)]);
                this.nextFire = 18 + Math.random() * 12;
            }
        }

        this.fires(dt);
        this.drive(dt, burning);

        for (let i = this.puffs.length - 1; i >= 0; i--) {
            const q = this.puffs[i];
            q.life += dt;
            const t = q.life / q.max;
            if (t >= 1) {
                q.img.setVisible(false);
                this.pool.push(q.img);
                this.puffs.splice(i, 1);
                continue;
            }
            q.vy += q.g * dt;
            q.img.setPosition(q.img.x + q.vx * dt, q.img.y + q.vy * dt).setAlpha(q.a0 * (1 - t)).setScale(1 + q.grow * t);
        }
    }

    private fires(dt: number) {
        this.smokeAcc += dt;
        const smoke = this.smokeAcc > 0.12;
        if (smoke) this.smokeAcc = 0;
        for (const h of this.houses) {
            if (!h.burning && h.heat <= 0) continue;
            const sprayed = this.truck.mode === 'spray' && this.truck.house === h;
            if (h.burning) h.heat = sprayed ? h.heat - 0.2 * dt : Math.min(1, h.heat + 0.08 * dt);
            // A fire nobody reaches burns itself out.
            if (h.burning && (h.age += dt) > 90) h.heat = 0;
            if (h.burning && h.heat <= 0) {
                h.burning = false;
                h.heat = 0;
                for (let i = 0; i < 10; i++) this.puff('town-steam', h.x + (Math.random() - 0.5) * 50, h.top + 20, (Math.random() - 0.5) * 8, -18 - Math.random() * 10, 2.5, { grow: 1.5, a0: 0.7, depth: h.base + 4 });
            }
            const show = Math.ceil(h.heat * h.flames.length);
            h.flames.forEach((f, i) => f.setVisible(h.burning && i < show));
            h.glow.setAlpha(h.burning ? (0.25 + 0.1 * Math.sin(this.clock * 13)) * h.heat : 0);
            h.alert.setVisible(h.burning && !sprayed && Math.floor(this.clock * 3) % 2 === 0);
            if (h.burning && smoke) {
                const s = h.spots[Math.floor(Math.random() * 2)];
                this.puff(sprayed ? 'town-steam' : 'town-smoke', s.x + (Math.random() - 0.5) * 6, s.y - 12, 5 + Math.random() * 4, -16 - Math.random() * 8, 2.6, { grow: 1.6, a0: 0.75 * Math.max(0.4, h.heat), depth: h.base + 4 });
            }
        }
    }

    /** How far round the ring road (clockwise from its top-left corner) a point on its middle line is. */
    private ring(p: P): number {
        const { L, R, T, B } = this, W = R - L, H = B - T;
        if (Math.abs(p.y - T) < 1) return p.x - L;
        if (Math.abs(p.x - R) < 1) return W + p.y - T;
        if (Math.abs(p.y - B) < 1) return W + H + R - p.x;
        return 2 * W + H + B - p.y;
    }

    /** From one point on the ring road's middle line to another, the short way round, turning at the corners. */
    private ringPath(a: P, b: P): P[] {
        const { L, R, T, B } = this, W = R - L, H = B - T, per = 2 * (W + H);
        const mod = (v: number) => ((v % per) + per) % per;
        const s1 = this.ring(a), cw = mod(this.ring(b) - s1);
        const dir = cw <= per / 2 ? 1 : -1, dist = dir > 0 ? cw : per - cw;
        const corners: [number, P][] = [[0, { x: L, y: T }], [W, { x: R, y: T }], [W + H, { x: R, y: B }], [2 * W + H, { x: L, y: B }]];
        const turns = corners
            .map(([s, p]) => ({ along: mod(dir * (s - s1)), p }))
            .filter((c) => c.along > 0.5 && c.along < dist - 0.5)
            .sort((x, y) => x.along - y.along)
            .map((c) => c.p);
        return [...turns, { ...b }];
    }

    /** Where the truck parks for a house: at the curb in front of it. */
    private stopFor(h: House): P {
        return { x: h.x + 12, y: h.road - LANE + 2 };
    }

    /** Pull out onto the road, go round the ring, and pull in at `to`. */
    private trip(from: P, fromRoad: number, to: P, toRoad: number): P[] {
        const a = { x: from.x, y: fromRoad }, b = { x: to.x, y: toRoad };
        return [{ ...from }, a, ...this.ringPath(a, b), { ...to }];
    }

    private drive(dt: number, burning: House[]) {
        const tr = this.truck;
        if (tr.mode === 'home') {
            const h = burning[0];
            if (!h) return;
            tr.house = h;
            tr.path = this.trip(tr.pos, this.B, this.stopFor(h), h.road);
            tr.i = 1;
            tr.mode = 'out';
        }
        if (tr.mode === 'out' || tr.mode === 'back') {
            let step = (tr.mode === 'out' ? 68 : 48) * dt;
            while (step > 0 && tr.i < tr.path.length) {
                const goal = tr.path[tr.i];
                const dx = goal.x - tr.pos.x, dy = goal.y - tr.pos.y, d = Math.hypot(dx, dy);
                if (d > 0.01) ({ facing: tr.facing, flip: tr.flip } = this.face({ x: dx / d, y: dy / d }));
                if (d <= step) {
                    tr.pos = { ...goal };
                    step -= d;
                    tr.i++;
                } else {
                    tr.pos = { x: tr.pos.x + dx / d * step, y: tr.pos.y + dy / d * step };
                    step = 0;
                }
            }
            // Backing into the bay: nose out, ready for the next call.
            if (tr.mode === 'back' && tr.i === tr.path.length - 1 && tr.pos.x === tr.home.x) tr.facing = 'down';
            if (tr.i >= tr.path.length) {
                if (tr.mode === 'out') tr.mode = 'spray';
                else {
                    tr.mode = 'home';
                    tr.facing = 'down';
                    tr.flip = false;
                }
            }
        }
        if (tr.mode === 'spray') {
            const h = tr.house;
            if (!h || !h.burning) {
                const next = this.houses.find((x) => x.burning);
                const road = h?.road ?? this.B;
                if (next) {
                    tr.house = next;
                    tr.path = this.trip(tr.pos, road, this.stopFor(next), next.road);
                    tr.mode = 'out';
                } else {
                    tr.path = this.trip(tr.pos, road, tr.home, this.B);
                    tr.mode = 'back';
                }
                tr.i = 1;
            } else {
                this.sprayAcc += dt;
                while (this.sprayAcc > 0.03) {
                    this.sprayAcc -= 0.03;
                    const live = h.flames.filter((f) => f.visible);
                    const target = live.length ? live[Math.floor(Math.random() * live.length)] : h.image;
                    const sx = tr.pos.x - 4, sy = tr.pos.y - 14, T = 0.55, g = 140;
                    const tx = target.x + (Math.random() - 0.5) * 6, ty = target.y - 6;
                    this.puff('town-drop', sx, sy, (tx - sx) / T, (ty - sy) / T - 0.5 * g * T, T, { g, a0: 0.95, depth: h.base + 5 });
                }
            }
        }
        const lights = tr.mode === 'out' || tr.mode === 'spray';
        this.place(tr.sprite, tr.shadow, tr.pos, tr.facing, tr.flip, 'truck', lights);
    }
}
