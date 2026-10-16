import type Phaser from 'phaser';
import { PixelCanvas, ensurePixels, fbm, hash, miniText, miniTextWidth, stripFrames } from '../kit';

/** The ATV rocket: red nose cone, white body with a porthole, red fins. Its base is the bottom of the canvas. */
function rocket() {
    const pc = new PixelCanvas(28, 54);
    const cx = 14;
    for (let y = 1; y <= 14; y++) {
        const half = Math.max(1, Math.round(6 * Math.sqrt((y - 1) / 13)));
        for (let x = cx - half; x < cx + half; x++) pc.set(x, y, x >= cx + half - 2 ? 'wine' : 'red');
    }
    for (let y = 15; y <= 47; y++) for (let x = 8; x < 20; x++) pc.set(x, y, x >= 18 ? 'mist' : x >= 16 ? 'cloud' : 'white');
    pc.rect(8, 15, 12, 2, 'gold').rect(18, 15, 2, 2, 'orange');
    pc.ellipse(14, 24, 4, 4, 'steel').ellipse(14, 24, 2.6, 2.6, 'cyan').set(13, 23, 'ice').set(12, 24, 'ice');
    miniText(pc, 9, 31, 'ATV', 'navy');
    pc.rect(8, 39, 12, 2, 'red').rect(18, 39, 2, 2, 'wine');
    for (let y = 36; y <= 52; y++) {
        const reach = Math.round(6 * Math.min(1, (y - 36) / 12));
        for (let x = 8 - reach; x < 8; x++) pc.set(x, y, 'red');
        for (let x = 20; x < 20 + reach; x++) pc.set(x, y, 'wine');
    }
    pc.rect(10, 48, 8, 3, 'slate').rect(11, 51, 6, 2, 'steel');
    return pc.outline('ink');
}

/** Three flickering frames of exhaust, hanging down from the nozzle. */
function flame() {
    const pc = new PixelCanvas(36, 22);
    [16, 20, 14].forEach((len, f) => {
        const ox = f * 12;
        pc.ellipse(ox + 6, len / 2, 5, len / 2, 'orange')
            .ellipse(ox + 6, len / 2 - 2, 3.5, len / 2 - 3, 'gold')
            .ellipse(ox + 6, 4, 2, 4, 'yellow')
            .rect(ox + 5, 0, 2, 3, 'white')
            .set(ox + 6 + (f - 1) * 2, len, 'red')
            .set(ox + 3 + f, len - 3, 'red');
    });
    return { canvas: pc, frames: stripFrames(3, 12, 22) };
}

function smoke() {
    const pc = new PixelCanvas(10, 8);
    return pc.ellipse(5, 4, 5, 4, 'cloud').ellipse(4, 3, 3, 2, 'white').ellipse(6, 5, 3, 2, 'mist');
}

/** The launch tower that stands beside the rocket, with an arm reaching over to it. */
function tower() {
    const pc = new PixelCanvas(20, 72);
    for (let y = 8; y < 70; y += 8) pc.line(3, y, 9, y + 7, 'wine').rect(1, y, 11, 1, 'wine');
    pc.rect(1, 6, 2, 66, 'red').rect(10, 6, 2, 66, 'red');
    pc.rect(0, 4, 14, 2, 'slate').rect(5, 1, 2, 3, 'steel').set(5, 0, 'yellow').set(6, 0, 'yellow');
    pc.rect(12, 32, 8, 2, 'slate').rect(12, 32, 8, 1, 'steel');
    return pc.outline('ink');
}

/** A concrete pad with hazard stripes along the front. */
function pad() {
    const pc = new PixelCanvas(56, 16);
    pc.ellipse(28, 8, 27, 7, 'slate').ellipse(28, 7, 25, 5.5, 'steel');
    for (let x = 6; x < 50; x++) if (Math.floor(x / 3) % 2 === 0) pc.set(x, 13, 'gold');
    pc.ellipse(28, 7, 6, 2.5, 'ink');
    return pc.outline('ink');
}

function sign(text: string) {
    const pc = new PixelCanvas(miniTextWidth(text) + 6, 11);
    pc.rect(0, 0, pc.width, pc.height, 'ink');
    return miniText(pc, 3, 3, text, 'orange');
}

/** Rocket, flame, smoke, and launch-site textures (shared by the town and Mars). */
export function rocketTextures(scene: Phaser.Scene) {
    ensurePixels(scene, 'rocket', rocket);
    ensurePixels(scene, 'rocket-flame', flame);
    ensurePixels(scene, 'rocket-smoke', smoke);
    ensurePixels(scene, 'rocket-tower', tower);
    ensurePixels(scene, 'rocket-pad', pad);
    ensurePixels(scene, 'rocket-sign', () => sign('ROCKET TO MARS'));
    if (!scene.anims.exists('rocket-flame')) {
        scene.anims.create({
            key: 'rocket-flame',
            frames: [0, 1, 2].map((frame) => ({ key: 'rocket-flame', frame })),
            frameRate: 14,
            repeat: -1,
        });
    }
}

/** Rusty red dirt with pale dust and dark pebbles. */
function ground() {
    const pc = new PixelCanvas(64, 64);
    for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
            pc.mix(x, y, 'orange', 'clay', fbm(x, y, 16, 11) * 0.9 - 0.3);
            const h = hash(x, y, 3);
            if (h > 0.992) pc.set(x, y, 'wine');
            else if (h > 0.982) pc.set(x, y, 'earth');
            else if (h > 0.976) pc.set(x, y, 'sand');
        }
    }
    return pc;
}

function crater() {
    const pc = new PixelCanvas(40, 22);
    pc.ellipse(20, 11, 19, 10, (_x, _y, nx, ny) => (ny < -0.4 || nx < -0.7 ? 'clay' : 'orange'));
    pc.ellipse(20, 12, 15, 7, (_x, _y, _nx, ny) => (ny < 0 ? 'wine' : 'earth'));
    return pc.ellipse(22, 14, 8, 3, 'earth');
}

function rock() {
    const pc = new PixelCanvas(16, 12);
    return pc.ellipse(8, 7, 7, 4.5, 'earth').ellipse(6, 5, 4, 2.5, 'clay').set(5, 4, 'sand').outline('ink');
}

/** A glass habitat dome on a steel base, with plants growing inside. */
function dome() {
    const pc = new PixelCanvas(76, 46);
    pc.ellipse(38, 34, 32, 28, (_x, y, nx, ny) => {
        if (y >= 34) return null;
        if (nx < -0.25 && nx > -0.55 && ny < -0.35) return 'ice';
        return nx * nx + ny * ny > 0.82 ? 'sky' : 'cyan';
    });
    pc.line(38, 6, 38, 33, 'steel').line(38, 6, 14, 30, 'steel').line(38, 6, 62, 30, 'steel').line(10, 22, 66, 22, 'steel');
    for (let i = 0; i < 9; i++) {
        const x = 22 + i * 4;
        pc.line(x, 33, x, 30 - (i % 3), 'leaf').set(x, 29 - (i % 3), i % 2 ? 'pink' : 'lime');
    }
    pc.rect(4, 34, 68, 10, 'slate').rect(4, 34, 68, 2, 'steel');
    pc.rect(9, 25, 9, 19, 'navy').rect(10, 27, 7, 6, 'blue').set(15, 37, 'yellow');
    miniText(pc, 28, 37, 'ATV BASE', 'yellow');
    return pc.outline('ink');
}

function flag() {
    const pc = new PixelCanvas(20, 30);
    pc.line(2, 1, 2, 29, 'cloud').rect(3, 2, 16, 10, 'gold').rect(3, 10, 16, 2, 'orange');
    miniText(pc, 5, 4, 'ATV', 'navy');
    return pc.outline('ink');
}

/** A little six-wheeled rover with a solar panel and a camera mast (two frames of rolling wheels). */
function rover() {
    const pc = new PixelCanvas(56, 22);
    for (let f = 0; f < 2; f++) {
        const ox = f * 28;
        pc.line(ox + 20, 5, ox + 20, 2, 'steel').rect(ox + 18, 0, 5, 2, 'slate').set(ox + 22, 1, 'cyan');
        pc.rect(ox + 4, 8, 20, 7, 'cloud').rect(ox + 4, 8, 20, 2, 'white').rect(ox + 4, 13, 20, 2, 'mist');
        pc.rect(ox + 2, 5, 24, 3, 'navy');
        for (let x = 4; x < 26; x += 4) pc.set(ox + x, 6, 'blue');
        for (const wx of [6, 14, 22]) {
            pc.line(ox + wx, 15, ox + wx, 14, 'steel').ellipse(ox + wx, 18, 3, 3, 'slate');
            if (f === 0) pc.set(ox + wx, 16, 'mist');
            else pc.set(ox + wx + 1, 18, 'mist');
        }
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, 28, 22) };
}

/** Skin and jumpsuit colors for each kind of Martian. */
export const MARTIAN_LOOKS = [
    { skin: 'grass', shade: 'leaf', suit: 'violet' },
    { skin: 'lime', shade: 'grass', suit: 'blue' },
    { skin: 'cyan', shade: 'sky', suit: 'red' },
    { skin: 'pink', shade: 'violet', suit: 'navy' },
] as const;

/** A little Martian: big head, huge black eyes, bobbly antennae. Frames: walk, walk, wave. */
function martian(look: (typeof MARTIAN_LOOKS)[number]) {
    const pc = new PixelCanvas(48, 20);
    for (let f = 0; f < 3; f++) {
        const ox = f * 16;
        pc.line(ox + 5, 4, ox + 3, 1, look.shade).line(ox + 10, 4, ox + 12, 1, look.shade);
        pc.set(ox + 3, 0, 'yellow').set(ox + 12, 0, 'yellow');
        pc.ellipse(ox + 8, 7, 6, 4.5, (_x, _y, _nx, ny) => (ny > 0.55 ? look.shade : look.skin));
        pc.ellipse(ox + 5.5, 7, 1.8, 2, 'ink').ellipse(ox + 10.5, 7, 1.8, 2, 'ink');
        pc.set(ox + 5, 6, 'white').set(ox + 10, 6, 'white');
        pc.rect(ox + 7, 10, 2, 1, look.shade);
        pc.rect(ox + 5, 12, 6, 4, look.suit).rect(ox + 5, 14, 6, 1, 'gold');
        pc.set(ox + 4, 13, look.skin).set(ox + 4, 14, look.skin);
        if (f === 2) pc.set(ox + 11, 12, look.skin).set(ox + 12, 11, look.skin).set(ox + 12, 10, look.skin);
        else pc.set(ox + 11, 13, look.skin).set(ox + 11, 14, look.skin);
        const [l, r] = f === 1 ? [1, 0] : f === 0 ? [0, 1] : [0, 0];
        pc.rect(ox + 6, 16, 1, 3 - l, look.shade).rect(ox + 9, 16, 1, 3 - r, look.shade);
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(3, 16, 20) };
}

/** Everything on the Martian surface. */
export function marsTextures(scene: Phaser.Scene) {
    rocketTextures(scene);
    ensurePixels(scene, 'mars-ground', ground);
    ensurePixels(scene, 'mars-crater', crater);
    ensurePixels(scene, 'mars-rock', rock);
    ensurePixels(scene, 'mars-dome', dome);
    ensurePixels(scene, 'mars-flag', flag);
    ensurePixels(scene, 'mars-rover', rover);
    ensurePixels(scene, 'mars-dust', () => new PixelCanvas(2, 1).rect(0, 0, 2, 1, 'sand'));
    ensurePixels(scene, 'mars-sign', () => sign('WELCOME TO MARS'));
    MARTIAN_LOOKS.forEach((look, i) => {
        const key = `martian-${i}`;
        ensurePixels(scene, key, () => martian(look));
        if (!scene.anims.exists(key)) {
            scene.anims.create({ key, frames: [0, 1].map((frame) => ({ key, frame })), frameRate: 6, repeat: -1 });
        }
    });
    if (!scene.anims.exists('mars-rover')) {
        scene.anims.create({
            key: 'mars-rover',
            frames: [0, 1].map((frame) => ({ key: 'mars-rover', frame })),
            frameRate: 6,
            repeat: -1,
        });
    }
}
