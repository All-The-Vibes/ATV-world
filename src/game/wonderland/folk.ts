import type Phaser from 'phaser';
import { PixelCanvas, ensurePixels, hash, miniText, stripFrames, type Color } from '../kit';

/** Wonderland's folk: tea-party guests, the Queen and her croquet kit, talking flowers, insects, and the Tweedles. */

/** The Mad Hatter from the waist up (he's sat at the table): resting, then sipping from his teacup. */
function hatter() {
    const W = 22, H = 30;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const o = f * W;
        pc.rect(o + 2, 21, 3, 8, 'plum');
        if (f === 0) pc.rect(o + 17, 21, 3, 8, 'plum');
        else pc.rect(o + 17, 15, 3, 7, 'plum').rect(o + 16, 11, 5, 4, 'white').rect(o + 16, 12, 5, 1, 'pink').rect(o + 15, 15, 7, 1, 'cloud');
        pc.rect(o + 4, 19, 14, 11, 'plum').line(o + 8, 21, o + 10, 29, 'violet').line(o + 14, 21, o + 12, 29, 'violet').rect(o + 10, 22, 2, 8, 'white');
        pc.rect(o + 3, 11, 3, 5, 'orange').rect(o + 16, 11, 3, 5, 'orange');
        pc.ellipse(o + 11, 14, 5, 4.5, 'peach').set(o + 9, 13, 'ink').set(o + 13, 13, 'ink').line(o + 9, 16, o + 13, 16, 'wine').set(o + 8, 15, 'wine').set(o + 14, 15, 'wine');
        pc.rect(o + 7, 19, 3, 3, 'yellow').rect(o + 12, 19, 3, 3, 'yellow').rect(o + 10, 20, 2, 1, 'gold');
        pc.rect(o + 2, 9, 18, 2, 'forest').rect(o + 5, 0, 12, 9, 'forest').rect(o + 5, 0, 3, 9, 'leaf').rect(o + 5, 6, 12, 2, 'pink');
        pc.rect(o + 13, 1, 5, 4, 'white').set(o + 14, 2, 'ink').set(o + 16, 2, 'ink');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** The March Hare from the waist up, with straw in his ears: sitting, then waving his paw about. */
function marchHare() {
    const W = 22, H = 30;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const o = f * W;
        pc.rect(o + 6, 0, 3, 12, 'clay').rect(o + 7, 2, 1, 8, 'pink').rect(o + 13, 1, 3, 11, 'clay').rect(o + 14, 3, 1, 7, 'pink');
        pc.line(o + 15, 0, o + 19, 4, 'yellow').line(o + 4, 2, o + 7, 3, 'yellow');
        if (f === 0) pc.rect(o + 2, 21, 3, 8, 'leaf');
        else pc.rect(o + 1, 13, 3, 9, 'leaf').ellipse(o + 2, 12, 2, 2, 'clay');
        pc.rect(o + 17, 21, 3, 8, 'leaf');
        pc.rect(o + 4, 20, 14, 10, 'leaf').rect(o + 4, 20, 14, 1, 'grass').rect(o + 9, 20, 4, 3, 'white').set(o + 11, 24, 'gold').set(o + 11, 27, 'gold');
        pc.ellipse(o + 11, 15, 6, 5, 'clay').ellipse(o + 11, 17, 3, 2, 'cream').set(o + 8, 14, 'ink').set(o + 14, 13, 'ink').set(o + 14, 14, 'ink').set(o + 11, 16, 'pink');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** The Dormouse, fast asleep (breathing in, breathing out). */
function dormouse() {
    const W = 16, H = 13;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const o = f * W, ry = f ? 4 : 4.6;
        pc.line(o + 1, 11, o + 3, 8, 'wood').set(o + 1, 12, 'wood');
        pc.ellipse(o + 4, 4, 2, 2, 'wood').set(o + 4, 4, 'pink').ellipse(o + 12, 4, 2, 2, 'wood').set(o + 12, 4, 'pink');
        pc.ellipse(o + 8, 8, 6, ry, 'wood').ellipse(o + 8, 10, 4, 2, 'cream');
        pc.line(o + 5, 7, o + 6, 7, 'ink').line(o + 10, 7, o + 11, 7, 'ink').set(o + 8, 9, 'pink');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** The Queen of Hearts in her heart-patterned gown: composed, then arms up and bellowing. */
function queen() {
    const W = 22, H = 34;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const o = f * W;
        if (f === 1) pc.rect(o + 3, 3, 2, 10, 'red').rect(o + 17, 3, 2, 10, 'red').rect(o + 3, 2, 2, 1, 'peach').rect(o + 17, 2, 2, 1, 'peach');
        for (let y = 16; y < 33; y++) {
            const half = Math.round(4 + (y - 16) * 0.45);
            for (let x = 11 - half; x < 11 + half; x++) pc.set(o + x, y, x >= 11 + half - 2 ? 'wine' : x < 11 - half + 1 ? 'wine' : 'red');
        }
        [[8, 22], [13, 25], [9, 29], [15, 30], [5, 31]].forEach(([x, y]) => pc.rect(o + x, y, 2, 1, 'ink').set(o + x, y + 1, 'ink').set(o + x + 1, y + 1, 'ink'));
        pc.rect(o + 9, 26, 4, 7, 'gold').rect(o + 10, 26, 2, 7, 'yellow');
        if (f === 0) pc.rect(o + 4, 14, 2, 8, 'red').rect(o + 16, 14, 2, 8, 'red').line(o + 17, 21, o + 17, 12, 'gold').rect(o + 16, 10, 3, 2, 'red');
        pc.rect(o + 8, 12, 6, 6, 'red').rect(o + 10, 12, 2, 6, 'ink');
        pc.ellipse(o + 11, 11, 7, 2, 'white');
        pc.rect(o + 7, 2, 8, 4, 'ink');
        pc.ellipse(o + 11, 7, 4, 3.5, 'peach').set(o + 9, 6, 'ink').set(o + 13, 6, 'ink').line(o + 8, 5, o + 10, 6, 'ink').line(o + 14, 5, o + 12, 6, 'ink');
        if (f === 0) pc.line(o + 10, 9, o + 12, 9, 'wine');
        else pc.rect(o + 9, 8, 4, 2, 'ink').rect(o + 10, 9, 2, 1, 'red');
        pc.rect(o + 8, 0, 6, 2, 'gold').set(o + 8, 0, 'yellow').set(o + 13, 0, 'yellow').set(o + 11, 0, 'red');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** A flamingo croquet mallet: standing, then swinging its head down to hit the ball. */
function flamingo() {
    const W = 24, H = 30;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const o = f * W;
        pc.line(o + 10, 19, o + 10, 29, 'pink').line(o + 13, 19, o + 14, 24, 'pink').line(o + 14, 24, o + 11, 25, 'pink');
        pc.ellipse(o + 11, 16, 7, 4, 'pink').ellipse(o + 9, 15, 4, 2, 'peach').set(o + 4, 16, 'violet').set(o + 5, 17, 'violet');
        if (f === 0) {
            pc.line(o + 16, 15, o + 18, 7, 'pink').line(o + 17, 15, o + 19, 7, 'pink').line(o + 18, 7, o + 16, 3, 'pink');
            pc.ellipse(o + 16, 3, 2.5, 2, 'pink').set(o + 16, 2, 'ink').line(o + 14, 3, o + 12, 5, 'ink').set(o + 13, 3, 'cream');
        } else {
            pc.line(o + 16, 16, o + 21, 25, 'pink').line(o + 17, 15, o + 22, 24, 'pink');
            pc.ellipse(o + 21, 27, 2.5, 2, 'pink').set(o + 22, 27, 'ink').line(o + 19, 28, o + 17, 29, 'ink');
        }
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** A hedgehog croquet ball: curled into a spiky ball, then uncurled and toddling off. */
function hedgehog() {
    const W = 13, H = 10;
    const pc = new PixelCanvas(W * 2, H);
    pc.ellipse(6, 5, 5, 4.5, (x, y) => (hash(x, y, 8) > 0.6 ? 'bark' : 'earth')).set(4, 3, 'clay').set(7, 2, 'clay');
    const o = W;
    pc.rect(o + 3, 8, 2, 2, 'clay').rect(o + 8, 8, 2, 2, 'clay');
    pc.ellipse(o + 5, 5, 5, 3.5, (x, y) => (hash(x, y, 9) > 0.55 ? 'bark' : 'earth'));
    pc.ellipse(o + 10, 6, 2.2, 2, 'peach').set(o + 10, 5, 'ink').set(o + 12, 6, 'ink');
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** A card soldier bent over into a croquet hoop. */
function cardHoop() {
    const pc = new PixelCanvas(18, 18);
    pc.ellipse(9, 9, 8.5, 8.5, (_x, y) => (y <= 9 ? 'white' : null)).ellipse(9, 9, 5, 5, null);
    pc.rect(1, 9, 4, 9, 'white').rect(13, 9, 4, 9, 'white');
    pc.set(9, 1, 'red').set(3, 5, 'red').set(15, 5, 'red').set(2, 13, 'red').set(15, 14, 'red');
    return pc.outline('ink');
}

/** A talking flower with a face (mouth shut, then singing). */
function flower(petal: Color, tip: Color) {
    const W = 14, H = 24;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const o = f * W;
        pc.line(o + 7, 11, o + 7, 23, 'leaf').ellipse(o + 4, 18, 3, 1.5, 'leaf').ellipse(o + 10, 15, 3, 1.5, 'grass');
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            pc.ellipse(o + 7 + Math.cos(a) * 4, 7 + Math.sin(a) * 4, 2.6, 2.6, (_x, _y, nx, ny) => (nx * nx + ny * ny > 0.5 ? tip : petal));
        }
        pc.ellipse(o + 7, 7, 3.2, 3.2, 'cream').set(o + 6, 6, 'ink').set(o + 8, 6, 'ink').set(o + 5, 7, 'pink').set(o + 9, 7, 'pink');
        if (f === 0) pc.set(o + 7, 8, 'wine');
        else pc.rect(o + 6, 8, 3, 2, 'wine');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** A bread-and-butterfly: wings of thin bread and butter, a body of crust, and a lump of sugar for a head. */
function breadButterfly() {
    const W = 15, H = 10;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const o = f * W, wy = f ? 4 : 0, wh = f ? 4 : 6;
        for (const x of [1, 9]) pc.rect(o + x, wy, 5, wh, 'clay').rect(o + x + 1, wy + 1, 3, wh - 2, 'cream').set(o + x + 2, wy + 1, 'yellow');
        pc.rect(o + 7, 3, 1, 6, 'wood').rect(o + 6, 1, 3, 2, 'white');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** Tweedledum or Tweedledee: round, in a striped cap, with his name on his collar. */
function tweedle(name: string) {
    const pc = new PixelCanvas(20, 30);
    pc.rect(5, 26, 4, 4, 'ink').rect(11, 26, 4, 4, 'ink');
    pc.rect(0, 13, 3, 8, 'yellow').rect(17, 13, 3, 8, 'yellow');
    pc.ellipse(10, 19, 8.5, 8, 'yellow').ellipse(10, 24, 8, 4, (_x, y) => (y >= 22 ? 'red' : 'yellow'));
    pc.rect(5, 11, 10, 3, 'white');
    miniText(pc, 4, 15, name, 'red');
    pc.ellipse(10, 7, 5.5, 5, 'peach').set(8, 6, 'ink').set(12, 6, 'ink').line(8, 9, 12, 9, 'wine').set(6, 8, 'pink').set(14, 8, 'pink');
    for (let x = 4; x < 16; x++) pc.rect(x, 0, 1, 4, Math.floor(x / 2) % 2 ? 'red' : 'yellow');
    pc.rect(9, 0, 2, 1, 'ink').rect(13, 3, 5, 1, 'red');
    return pc.outline('ink');
}

/** A musical note (for the singing flowers). */
function note(c: Color) {
    const pc = new PixelCanvas(6, 8);
    return pc.line(4, 0, 4, 5, c).set(5, 1, c).set(5, 2, c).ellipse(3, 6, 1.6, 1.3, c).outline('ink');
}

/** A sleepy Z. */
function zed() {
    const pc = new PixelCanvas(5, 7);
    return miniText(pc, 1, 1, 'Z', 'white').outline('ink');
}

export const FLOWER_KINDS = ['pink', 'red', 'violet', 'gold'] as const;

export function folkTextures(scene: Phaser.Scene) {
    ensurePixels(scene, 'wl-hatter', hatter);
    ensurePixels(scene, 'wl-hare', marchHare);
    ensurePixels(scene, 'wl-dormouse', dormouse);
    ensurePixels(scene, 'wl-queen', queen);
    ensurePixels(scene, 'wl-flamingo', flamingo);
    ensurePixels(scene, 'wl-hedgehog', hedgehog);
    ensurePixels(scene, 'wl-hoop', cardHoop);
    ensurePixels(scene, 'wl-flower-pink', () => flower('pink', 'peach'));
    ensurePixels(scene, 'wl-flower-red', () => flower('red', 'orange'));
    ensurePixels(scene, 'wl-flower-violet', () => flower('violet', 'pink'));
    ensurePixels(scene, 'wl-flower-gold', () => flower('gold', 'yellow'));
    ensurePixels(scene, 'wl-bbfly', breadButterfly);
    ensurePixels(scene, 'wl-dum', () => tweedle('DUM'));
    ensurePixels(scene, 'wl-dee', () => tweedle('DEE'));
    ensurePixels(scene, 'wl-note-a', () => note('violet'));
    ensurePixels(scene, 'wl-note-b', () => note('blue'));
    ensurePixels(scene, 'wl-zed', zed);
    if (!scene.anims.exists('wl-bbfly')) {
        scene.anims.create({ key: 'wl-bbfly', frames: [0, 1].map((frame) => ({ key: 'wl-bbfly', frame })), frameRate: 8, repeat: -1 });
    }
    if (!scene.anims.exists('wl-dormouse')) {
        scene.anims.create({ key: 'wl-dormouse', frames: [0, 1].map((frame) => ({ key: 'wl-dormouse', frame })), frameRate: 1.5, repeat: -1 });
    }
    for (const kind of FLOWER_KINDS) {
        const key = `wl-flower-${kind}`;
        if (!scene.anims.exists(`${key}-sing`)) {
            scene.anims.create({ key: `${key}-sing`, frames: [0, 1].map((frame) => ({ key, frame })), frameRate: 5, repeat: -1 });
        }
    }
}
