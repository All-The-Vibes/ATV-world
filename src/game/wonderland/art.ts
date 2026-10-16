import type Phaser from 'phaser';
import { PixelCanvas, ensurePixels, fbm, hash, miniText, miniTextWidth, stripFrames, type Color } from '../kit';

/** The rabbit-hole portal's size, and where its hollow sits in the big tree (its bottom middle, from the tree's base). */
export const PORTAL = { w: 22, h: 34, frames: 4 };
export const TREE = { w: 128, h: 156, hollowBottom: 6 };

/** An arch: a rectangle with a round top. */
const inArch = (x: number, y: number, w: number) => {
    const r = w / 2;
    if (y >= r) return x >= 0 && x < w;
    return (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r;
};

/** A swirling violet-and-pink spiral in an arch, four frames turning. */
function portal() {
    const { w, h, frames } = PORTAL;
    const pc = new PixelCanvas(w * frames, h);
    const bands: Color[] = ['plum', 'violet', 'pink', 'peach', 'pink', 'violet'];
    for (let f = 0; f < frames; f++) {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!inArch(x, y, w)) continue;
                const dx = x + 0.5 - w / 2, dy = y + 0.5 - h * 0.58;
                const r = Math.hypot(dx, dy);
                const turn = Math.atan2(dy, dx) / (Math.PI * 2) + r / 7 - f / frames;
                let c: Color = bands[((Math.floor(turn * 6) % 6) + 6) % 6];
                if (r < 2.2) c = 'white';
                else if (r < 3.6) c = 'cream';
                const sparkle = hash(x, y, f + 11);
                if (sparkle > 0.975) c = 'white';
                else if (sparkle > 0.96) c = 'yellow';
                pc.set(f * w + x, y, c);
            }
        }
    }
    return { canvas: pc, frames: stripFrames(frames, w, h) };
}

function mushroomAt(pc: PixelCanvas, x: number, y: number, size: number, cap: Color = 'red') {
    const stemW = Math.max(2, Math.round(size * 0.45));
    pc.rect(x - Math.floor(stemW / 2), y - size, stemW, size, 'cream');
    pc.ellipse(x, y - size, size, size * 0.7, (px, py, nx, ny) => (ny > 0.2 ? (pc.filled(px, py) ? 'cream' : null) : nx > 0.5 ? 'wine' : cap));
    pc.set(x - Math.round(size / 2), y - size - Math.round(size * 0.35), 'white').set(x + Math.round(size / 3), y - size - 1, 'white');
    if (size > 4) pc.set(x, y - size - Math.round(size * 0.55), 'white');
}

/** A huge, gnarled old oak with flared roots, toadstools at its feet, and a hollow at the bottom of the trunk. */
function bigTree() {
    const { w: W, h: H } = TREE;
    const pc = new PixelCanvas(W, H);
    const cx = W / 2;

    // Boughs reaching up into the canopy.
    for (let t = -1; t <= 1; t++) {
        pc.line(cx - 6 + t, 78, cx - 40 + t, 42, 'earth').line(cx + 6 + t, 78, cx + 42 + t, 40, 'earth').line(cx + t, 74, cx + 4 + t, 30, 'earth');
    }

    // Trunk: wide, wavering, flaring into roots at the bottom.
    for (let y = 64; y < H - 2; y++) {
        const flare = y > 118 ? ((y - 118) / 36) ** 2 * 34 : 0;
        const half = Math.round(17 + flare + Math.sin(y / 6) * 1.5);
        const wob = y > 118 ? 0 : Math.round(Math.sin(y / 11) * 2);
        for (let x = cx - half + wob; x < cx + half + wob; x++) {
            const t = (x - (cx - half + wob)) / (half * 2);
            let c: Color = t < 0.16 ? 'bark' : t > 0.8 ? 'wood' : 'earth';
            if ((x + Math.round(Math.sin(y / 8) * 2)) % 7 === 0 && t > 0.08 && t < 0.92) c = 'bark';
            else if (hash(x, y, 4) > 0.97) c = 'clay';
            pc.set(x, y, c);
        }
    }
    pc.ellipse(cx - 8, 92, 3, 4, 'bark').ellipse(cx - 8, 92, 1.5, 2, 'earth').ellipse(cx + 10, 104, 2, 3, 'bark');

    // The canopy: big round clumps, lit from the top left, sprinkled with pink blossom.
    const leaves = (x: number, y: number, nx: number, ny: number): Color => {
        const n = hash(x, y, 7);
        if (ny < -0.45 && nx < 0.35) return n > 0.75 ? 'lime' : 'grass';
        if (ny > 0.45 || nx > 0.6) return n > 0.85 ? 'leaf' : 'forest';
        return n > 0.88 ? 'grass' : n < 0.06 ? 'forest' : 'leaf';
    };
    [[cx, 58, 34, 14], [cx - 36, 48, 26, 20], [cx + 36, 46, 27, 20], [cx - 18, 26, 26, 20], [cx + 20, 22, 27, 20], [cx, 40, 36, 26]]
        .forEach(([x, y, rx, ry]) => pc.ellipse(x, y, rx, ry, leaves));
    for (let i = 0; i < 70; i++) {
        const x = Math.floor(hash(i, 1, 21) * W), y = Math.floor(hash(i, 2, 21) * 74);
        if (!pc.filled(x, y)) continue;
        pc.set(x, y, i % 3 === 0 ? 'white' : 'pink');
        if (i % 4 === 0 && pc.filled(x + 1, y)) pc.set(x + 1, y, 'peach');
    }

    // The hollow: a dark arch with a ring of bark, where the portal glows.
    const hx = cx - PORTAL.w / 2, hy = H - TREE.hollowBottom - PORTAL.h;
    for (let y = -2; y < PORTAL.h; y++) {
        for (let x = -2; x < PORTAL.w + 2; x++) if (inArch(x + 2, y + 2, PORTAL.w + 4)) pc.set(hx + x, hy + y, 'bark');
    }
    for (let y = 0; y < PORTAL.h; y++) for (let x = 0; x < PORTAL.w; x++) if (inArch(x, y, PORTAL.w)) pc.set(hx + x, hy + y, 'ink');

    // Toadstools and grass around the roots.
    mushroomAt(pc, 16, H - 3, 6);
    mushroomAt(pc, 26, H - 2, 3, 'violet');
    mushroomAt(pc, W - 18, H - 4, 7);
    mushroomAt(pc, W - 29, H - 2, 3, 'orange');
    for (const x of [8, 36, 44, 86, 94, 112]) pc.line(x, H - 1, x - 1, H - 4, 'leaf').line(x + 1, H - 1, x + 2, H - 5, 'grass');
    return pc.outline('ink');
}

/**
 * The White Rabbit, side on and facing right: white fur, pink ears, a red waistcoat, and his gold pocket watch.
 * Three frames of running, then one of him stopped, holding the watch up to his face.
 */
function rabbit() {
    const W = 20, H = 22;
    const pc = new PixelCanvas(W * 4, H);
    for (let f = 0; f < 4; f++) {
        const o = f * W, b = f === 1 ? -1 : 0;
        // Ears: the back one swept back, the front one up with a pink inside.
        pc.line(o + 12, 1 + b, o + 9, 7 + b, 'cloud').line(o + 13, 1 + b, o + 10, 7 + b, 'cloud');
        pc.rect(o + 13, 1 + b, 2, 7, 'white').rect(o + 14, 2 + b, 1, 4, 'pink');
        // Legs first, so the body covers their tops.
        if (f === 0) {
            pc.line(o + 6, 15, o + 2, 19, 'white').line(o + 7, 15, o + 3, 19, 'white').rect(o + 1, 19, 3, 1, 'cloud');
            pc.line(o + 12, 15, o + 15, 19, 'white').rect(o + 15, 19, 3, 1, 'cloud');
        } else if (f === 1) {
            pc.rect(o + 6, 15, 3, 3, 'white').rect(o + 5, 17, 4, 1, 'cloud');
            pc.rect(o + 11, 15, 2, 3, 'white').rect(o + 11, 17, 3, 1, 'cloud');
        } else if (f === 2) {
            pc.line(o + 8, 15, o + 6, 20, 'white').line(o + 9, 15, o + 7, 20, 'white').rect(o + 5, 20, 3, 1, 'cloud');
            pc.line(o + 12, 15, o + 11, 20, 'white').rect(o + 11, 20, 3, 1, 'cloud');
        } else {
            pc.rect(o + 6, 15, 3, 5, 'white').rect(o + 5, 20, 4, 1, 'cloud');
            pc.rect(o + 11, 15, 2, 5, 'white').rect(o + 11, 20, 3, 1, 'cloud');
        }
        // Body, waistcoat with gold buttons, and a cotton tail.
        pc.ellipse(o + 9, 13 + b, 5.5, 4, (_x, _y, _nx, ny) => (ny > 0.55 ? 'cloud' : 'white'));
        pc.rect(o + 10, 11 + b, 4, 5, 'red').rect(o + 13, 11 + b, 1, 5, 'wine').set(o + 11, 12 + b, 'gold').set(o + 11, 14 + b, 'gold');
        pc.ellipse(o + 3, 11 + b, 2, 2, 'white').set(o + 2, 12 + b, 'cloud');
        // Head.
        pc.ellipse(o + 14.5, 9 + b, 3.5, 3, (_x, _y, _nx, ny) => (ny > 0.5 ? 'cloud' : 'white'));
        pc.set(o + 15, 8 + b, 'ink').set(o + 17, 9 + b, 'pink');
        // The pocket watch: held out in front while running, up to his face when he stops to check it.
        const wx = f === 3 ? 18 : 17, wy = f === 3 ? 11 : 14;
        pc.line(o + 13, 13 + b, o + wx - 1, wy + b, 'yellow');
        pc.ellipse(o + wx, wy + b, 1.6, 1.6, 'gold').set(o + wx, wy + b, 'cream');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(4, W, H) };
}

/** A sign on two posts, lettered in `color`. */
function sign(text: string, color: Color = 'pink') {
    const w = miniTextWidth(text) + 8;
    const pc = new PixelCanvas(w, 18);
    pc.rect(3, 9, 2, 9, 'earth').rect(w - 5, 9, 2, 9, 'earth');
    pc.rect(0, 0, w, 11, 'night').rect(1, 1, w - 2, 9, 'plum');
    miniText(pc, 4, 3, text, color);
    return pc.outline('ink');
}

/** Textures for the big tree in town and the White Rabbit. */
export function rabbitTreeTextures(scene: Phaser.Scene) {
    ensurePixels(scene, 'wl-tree-big', bigTree);
    ensurePixels(scene, 'wl-portal', portal);
    ensurePixels(scene, 'wl-rabbit', rabbit);
    ensurePixels(scene, 'wl-sign', () => sign('DOWN THE RABBIT HOLE'));
    if (!scene.anims.exists('wl-portal')) {
        scene.anims.create({
            key: 'wl-portal',
            frames: [0, 1, 2, 3].map((frame) => ({ key: 'wl-portal', frame })),
            frameRate: 8,
            repeat: -1,
        });
    }
    if (!scene.anims.exists('wl-rabbit-run')) {
        scene.anims.create({
            key: 'wl-rabbit-run',
            frames: [0, 1, 2, 1].map((frame) => ({ key: 'wl-rabbit', frame })),
            frameRate: 12,
            repeat: -1,
        });
    }
}

/* ---------- Wonderland itself ---------- */

/** Lush, slightly too-green grass with tiny flowers. */
function ground() {
    const pc = new PixelCanvas(64, 64);
    for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
            pc.mix(x, y, 'leaf', 'grass', fbm(x, y, 16, 31) * 1.1 - 0.2);
            const h = hash(x, y, 9);
            if (h > 0.994) pc.set(x, y, 'pink');
            else if (h > 0.988) pc.set(x, y, 'yellow');
            else if (h > 0.982) pc.set(x, y, 'white');
            else if (h > 0.96) pc.set(x, y, 'forest');
        }
    }
    return pc;
}

/** A giant toadstool. */
function bigMushroom(cap: Color, dark: Color) {
    const pc = new PixelCanvas(48, 54);
    pc.rect(18, 22, 12, 32, 'cream').rect(27, 22, 3, 32, 'sand').rect(18, 22, 2, 32, 'white');
    pc.ellipse(24, 22, 23, 18, (_x, y, nx, ny) => (ny > 0.15 ? (y >= 22 && Math.abs(nx) < 0.27 ? 'cream' : null) : nx > 0.55 || ny > -0.05 ? dark : cap));
    pc.ellipse(24, 23, 20, 2, 'sand');
    [[14, 12, 3], [30, 8, 4], [38, 16, 2.5], [22, 16, 2], [8, 18, 2]].forEach(([x, y, r]) => pc.ellipse(x, y, r, r * 0.8, 'white'));
    return pc.outline('ink');
}

/** The Caterpillar lounging on top of his mushroom. */
function caterpillar() {
    const pc = new PixelCanvas(26, 16);
    [[4, 12], [8, 12], [12, 11], [16, 9]].forEach(([x, y]) => pc.ellipse(x, y, 3, 3, 'sky').set(x - 1, y - 1, 'cyan'));
    pc.ellipse(19, 6, 4, 4, 'sky').set(20, 5, 'ink').set(18, 5, 'ink').set(19, 8, 'navy');
    pc.line(18, 2, 16, 0, 'navy').line(21, 2, 23, 0, 'navy');
    for (const x of [3, 7, 11]) pc.set(x, 15, 'navy');
    return pc.outline('ink');
}

/** A smoke ring. */
function ring() {
    return new PixelCanvas(8, 6).ellipse(4, 3, 3.5, 2.5, 'cloud').ellipse(4, 3, 2, 1.2, null);
}

/** The Mad Hatter's tea party: a long table, chairs, mismatched teapots and cups, and a cake. */
function teaParty() {
    const pc = new PixelCanvas(108, 52);
    ([[10, 'violet'], [34, 'sky'], [62, 'pink'], [88, 'gold']] as const).forEach(([x, c]) => pc.rect(x, 4, 12, 22, c).rect(x + 2, 6, 8, 6, 'cream'));
    pc.rect(2, 24, 104, 14, 'white').rect(2, 24, 104, 2, 'cloud');
    for (let x = 2; x < 106; x += 6) pc.ellipse(x + 3, 38, 3, 2, 'white');
    pc.rect(6, 40, 3, 11, 'earth').rect(99, 40, 3, 11, 'earth').rect(52, 40, 3, 11, 'earth');
    const pot = (x: number, c: Color) => {
        pc.ellipse(x, 18, 6, 5, c).rect(x - 2, 11, 4, 2, c).set(x, 10, 'gold');
        pc.line(x + 6, 17, x + 9, 13, c).ellipse(x - 7, 17, 2, 2.5, c).ellipse(x - 7, 17, 1, 1.5, 'white');
    };
    pot(20, 'gold');
    pot(76, 'sky');
    const cup = (x: number, c: Color) => pc.rect(x, 19, 5, 4, c).rect(x - 1, 23, 7, 1, 'cloud').set(x + 5, 20, c);
    ([[8, 'pink'], [32, 'violet'], [42, 'red'], [62, 'lime'], [90, 'pink'], [98, 'orange']] as const).forEach(([x, c]) => cup(x, c));
    pc.rect(50, 14, 10, 9, 'peach').rect(50, 14, 10, 2, 'pink').rect(54, 11, 1, 3, 'cream').set(54, 10, 'yellow');
    return pc.outline('ink');
}

/** The Cheshire Cat: a striped purple-and-pink head with a huge grin (or just the grin). */
function cheshire(onlyGrin: boolean) {
    const pc = new PixelCanvas(30, 24);
    if (!onlyGrin) {
        pc.line(4, 1, 8, 7, 'violet').line(5, 1, 10, 6, 'violet').line(25, 1, 21, 7, 'violet').line(24, 1, 19, 6, 'violet');
        pc.ellipse(15, 13, 13, 10, (_x, y) => (Math.floor(y / 3) % 2 ? 'pink' : 'violet'));
    }
    pc.ellipse(10, 9, 2.6, 2, 'yellow').ellipse(20, 9, 2.6, 2, 'yellow').rect(10, 8, 1, 3, 'ink').rect(20, 8, 1, 3, 'ink');
    pc.ellipse(15, 16, 10, 5, (px, py, _nx, ny) => (ny < -0.15 ? (pc.filled(px, py) ? (Math.floor(py / 3) % 2 ? 'pink' : 'violet') : null) : 'white'));
    for (let x = 7; x <= 23; x += 3) pc.line(x, 17, x, 19, 'mist');
    pc.line(5, 16, 25, 16, 'ink');
    return pc.outline('ink');
}

/** A playing-card soldier of hearts (two marching frames), with a brush of red paint. */
function cardSoldier() {
    const W = 18, H = 28;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const o = f * W;
        pc.ellipse(o + 8, 4, 3, 3, 'peach').rect(o + 5, 0, 7, 2, 'earth').set(o + 7, 4, 'ink').set(o + 9, 4, 'ink');
        pc.rect(o + (f ? 5 : 6), 20, 2, 7, 'ink').rect(o + (f ? 9 : 8), 20, 2, 7, 'ink');
        pc.line(o + 2, 10, o + 0, 16, 'ink').line(o + 13, 10, o + 15, 14 + f, 'ink');
        pc.line(o + 15, 14 + f, o + 15, 8 + f, 'wood').rect(o + 14, 6 + f, 3, 2, 'red');
        pc.rect(o + 2, 8, 12, 13, 'white').rect(o + 2, 8, 12, 1, 'cloud');
        pc.set(o + 3, 9, 'red').set(o + 12, 19, 'red');
        pc.rect(o + 5, 12, 2, 2, 'red').rect(o + 9, 12, 2, 2, 'red').rect(o + 5, 13, 6, 2, 'red').rect(o + 6, 15, 4, 1, 'red').rect(o + 7, 16, 2, 1, 'red');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** A rose bush, its roses half painted red and half still white. */
function roses() {
    const pc = new PixelCanvas(34, 22);
    pc.ellipse(17, 12, 16, 9, (x, y) => (hash(x, y, 5) > 0.8 ? 'forest' : 'leaf'));
    pc.ellipse(14, 9, 8, 4, 'grass');
    [[6, 10], [12, 6], [18, 9], [24, 6], [28, 12], [10, 14], [21, 14]].forEach(([x, y], i) => {
        pc.rect(x, y, 3, 3, i % 2 ? 'white' : 'red').set(x + 1, y + 1, i % 2 ? 'cloud' : 'wine');
    });
    return pc.outline('ink');
}

/** A curly pink-blossom tree. */
function blossomTree() {
    const pc = new PixelCanvas(52, 66);
    pc.rect(23, 34, 6, 32, 'earth').rect(23, 34, 2, 32, 'bark');
    pc.line(26, 40, 14, 30, 'earth').line(26, 38, 38, 28, 'earth');
    [[26, 20, 20, 16], [12, 30, 11, 9], [40, 28, 11, 9]].forEach(([x, y, rx, ry]) =>
        pc.ellipse(x, y, rx, ry, (px, py, nx, ny) => (ny < -0.4 && nx < 0.3 ? 'peach' : hash(px, py, 3) > 0.85 ? 'white' : ny > 0.4 ? 'violet' : 'pink')));
    return pc.outline('ink');
}

/** The little door home, in a hedge arch with roses. The portal plays in its doorway. */
function hedgeDoor() {
    const w = PORTAL.w + 14, h = PORTAL.h + 12;
    const pc = new PixelCanvas(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (inArch(x, y, w)) pc.set(x, y, hash(x, y, 2) > 0.8 ? 'forest' : hash(x, y, 3) > 0.9 ? 'grass' : 'leaf');
    }
    for (let y = 0; y < PORTAL.h; y++) for (let x = 0; x < PORTAL.w; x++) if (inArch(x, y, PORTAL.w)) pc.set(7 + x, h - PORTAL.h + y, 'ink');
    [[4, 14], [w - 6, 18], [3, 28], [w - 5, 32], [w / 2 - 1, 3], [9, 6], [w - 11, 6]].forEach(([x, y]) => pc.rect(x, y, 2, 2, 'red'));
    return pc.outline('ink');
}

/** A "drink me" bottle on a little glass table. */
function drinkMe() {
    const pc = new PixelCanvas(30, 30);
    pc.rect(2, 16, 26, 2, 'ice').rect(2, 16, 26, 1, 'white').rect(4, 18, 2, 12, 'cyan').rect(24, 18, 2, 12, 'cyan');
    pc.rect(12, 2, 4, 3, 'wood').rect(13, 5, 2, 2, 'cyan').ellipse(14, 11, 5, 5, (_x, _y, _nx, ny) => (ny < -0.2 ? 'ice' : 'sky'));
    pc.rect(11, 10, 7, 3, 'white');
    return pc.outline('ink');
}

/** Everything in Wonderland. */
export function wonderlandTextures(scene: Phaser.Scene) {
    rabbitTreeTextures(scene);
    ensurePixels(scene, 'wl-ground', ground);
    ensurePixels(scene, 'wl-mushroom-red', () => bigMushroom('red', 'wine'));
    ensurePixels(scene, 'wl-mushroom-blue', () => bigMushroom('sky', 'blue'));
    ensurePixels(scene, 'wl-caterpillar', caterpillar);
    ensurePixels(scene, 'wl-ring', ring);
    ensurePixels(scene, 'wl-tea', teaParty);
    ensurePixels(scene, 'wl-cat', () => cheshire(false));
    ensurePixels(scene, 'wl-grin', () => cheshire(true));
    ensurePixels(scene, 'wl-card', cardSoldier);
    ensurePixels(scene, 'wl-roses', roses);
    ensurePixels(scene, 'wl-blossom', blossomTree);
    ensurePixels(scene, 'wl-door', hedgeDoor);
    ensurePixels(scene, 'wl-drink', drinkMe);
    ensurePixels(scene, 'wl-petal', () => new PixelCanvas(2, 2).rect(0, 0, 2, 1, 'pink').set(0, 1, 'peach'));
    ensurePixels(scene, 'wl-welcome', () => sign('WELCOME TO WONDERLAND', 'yellow'));
    if (!scene.anims.exists('wl-card')) {
        scene.anims.create({ key: 'wl-card', frames: [0, 1].map((frame) => ({ key: 'wl-card', frame })), frameRate: 4, repeat: -1 });
    }
}
