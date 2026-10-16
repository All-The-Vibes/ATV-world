import type Phaser from 'phaser';
import { PixelCanvas, addPixels, ensurePixels, miniText, miniTextWidth, stripFrames, type Color } from '../kit';

/** The arcade cabinet that stands on Mars (two frames: the attract screen flickers). Its base is the bottom of the canvas. */
function cabinet() {
    const W = 26;
    const H = 44;
    const pc = new PixelCanvas(W * 2, H);
    for (let f = 0; f < 2; f++) {
        const ox = f * W;
        pc.rect(ox + 2, 0, 22, 9, 'plum').rect(ox + 3, 1, 20, 7, f ? 'pink' : 'violet');
        miniText(pc, ox + 3, 2, 'BLAST', f ? 'yellow' : 'cream');
        pc.rect(ox + 3, 9, 20, 18, 'ink').rect(ox + 4, 10, 18, 15, 'night');
        for (const [sx, sy] of [[6, 12], [17, 14], [10, 21], [20, 22], [13, 11]]) pc.set(ox + sx, sy, 'cloud');
        const ax = f ? 9 : 7;
        pc.rect(ox + ax, 13, 3, 2, 'lime').set(ox + ax - 1, 14, 'grass').set(ox + ax + 3, 14, 'grass');
        pc.rect(ox + ax + 6, 15, 3, 2, 'lime').set(ox + ax + 5, 16, 'grass').set(ox + ax + 9, 16, 'grass');
        pc.set(ox + 12, f ? 17 : 19, 'yellow').set(ox + 12, f ? 18 : 20, 'yellow');
        pc.rect(ox + 11, 22, 3, 2, 'cyan').set(ox + 12, 21, 'white');
        pc.rect(ox + 1, 27, 24, 5, 'violet').rect(ox + 1, 27, 24, 1, 'pink');
        pc.line(ox + 7, 29, ox + 7, 26, 'steel').set(ox + 7, 25, 'red').set(ox + 6, 25, 'red');
        pc.set(ox + 15, 29, 'red').set(ox + 18, 29, 'gold').set(ox + 21, 29, 'cyan');
        pc.rect(ox + 3, 32, 20, 12, 'plum').rect(ox + 3, 32, 2, 12, 'violet');
        pc.rect(ox + 10, 36, 6, 4, 'ink').rect(ox + 12, 37, 2, 2, f ? 'gold' : 'clay');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, W, H) };
}

/** The player's fighter: white hull, red stripes, a cyan cockpit (two frames of engine flicker). */
function ship() {
    const pc = new PixelCanvas(30, 18);
    const rows = [
        '......w......',
        '.....wcw.....',
        '.....cic.....',
        '....wcccw....',
        '....wwwww....',
        '...rwwwwwr...',
        '..rrwwwwwrr..',
        '.rrwwmwmwwrr.',
        'rrwwwmwmwwwrr',
        'r.wwwwwwwww.r',
        '...ss...ss...',
    ];
    const legend = { '.': null, w: 'white', c: 'cyan', i: 'ice', r: 'red', m: 'mist', s: 'steel' } as const;
    for (let f = 0; f < 2; f++) {
        const ox = f * 15 + 1;
        pc.ascii(ox, 1, rows, legend);
        pc.rect(ox + 3, 12, 2, f ? 3 : 2, 'gold').set(ox + 3, f ? 15 : 14, 'orange');
        pc.rect(ox + 8, 12, 2, f ? 2 : 3, 'gold').set(ox + 8, f ? 14 : 15, 'orange');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, 15, 18) };
}

function rockAt(pc: PixelCanvas, cx: number, cy: number, r: number, seed: number) {
    pc.ellipse(cx, cy, r, r * 0.92, (x, y, nx, ny) => {
        const lump = Math.sin(Math.atan2(ny, nx) * 5 + seed) * 0.12;
        if (nx * nx + ny * ny > 0.88 + lump) return null;
        return nx + ny < -0.6 ? 'clay' : nx + ny > 0.5 ? 'bark' : (x * 7 + y * 3 + seed) % 11 === 0 ? 'bark' : 'earth';
    });
    pc.ellipse(cx + r * 0.25, cy + r * 0.15, r * 0.25, r * 0.2, 'bark');
    pc.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.18, r * 0.15, 'bark');
}

function asteroids() {
    const pc = new PixelCanvas(40, 18);
    rockAt(pc, 9, 9, 8, 1);
    rockAt(pc, 27, 9, 8, 4);
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, 18, 18) };
}

function pebble() {
    const pc = new PixelCanvas(10, 10);
    rockAt(pc, 5, 5, 4, 2);
    return pc.outline('ink');
}

/** A flying saucer with blinking lights (two frames). */
function saucer() {
    const pc = new PixelCanvas(40, 12);
    for (let f = 0; f < 2; f++) {
        const ox = f * 20 + 1;
        pc.ellipse(ox + 9, 4, 4.5, 3.5, (_x, _y, nx, ny) => (ny > 0.4 ? null : nx < -0.2 && ny < -0.2 ? 'ice' : 'cyan'));
        pc.ellipse(ox + 9, 7, 9, 2.6, (_x, _y, _nx, ny) => (ny < -0.2 ? 'cloud' : 'steel'));
        for (let i = 0; i < 4; i++) pc.set(ox + 3 + i * 4, 7, (i + f) % 2 ? 'yellow' : 'red');
        pc.rect(ox + 7, 9, 4, 1, 'slate');
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, 20, 12) };
}

/** A space gremlin with flapping bat wings that dives at you (two frames). */
function diver() {
    const pc = new PixelCanvas(32, 14);
    for (let f = 0; f < 2; f++) {
        const ox = f * 16 + 1;
        const up = f === 0;
        pc.ellipse(ox + 7, 7, 3.5, 4, 'grass').ellipse(ox + 7, 9, 2.5, 2, 'lime');
        pc.set(ox + 5, 6, 'red').set(ox + 9, 6, 'red').set(ox + 5, 5, 'yellow').set(ox + 9, 5, 'yellow');
        pc.set(ox + 6, 9, 'white').set(ox + 8, 9, 'white');
        pc.line(ox + 5, 3, ox + 4, 1, 'leaf').line(ox + 9, 3, ox + 10, 1, 'leaf');
        if (up) {
            pc.line(ox + 3, 6, ox + 0, 2, 'forest').line(ox + 3, 7, ox + 0, 4, 'leaf').line(ox + 0, 2, ox + 0, 5, 'forest');
            pc.line(ox + 11, 6, ox + 14, 2, 'forest').line(ox + 11, 7, ox + 14, 4, 'leaf').line(ox + 14, 2, ox + 14, 5, 'forest');
        } else {
            pc.line(ox + 3, 7, ox + 0, 10, 'forest').line(ox + 3, 8, ox + 1, 11, 'leaf');
            pc.line(ox + 11, 7, ox + 14, 10, 'forest').line(ox + 11, 8, ox + 13, 11, 'leaf');
        }
    }
    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(2, 16, 14) };
}

/** The Mega Gremlin Mothership: a wide armored hull with a gremlin pilot under the glass. */
function mothership() {
    const pc = new PixelCanvas(70, 32);
    pc.ellipse(35, 12, 12, 9, (_x, _y, nx, ny) => (ny > 0.5 ? null : nx < -0.3 && ny < -0.3 ? 'ice' : 'cyan'));
    pc.ellipse(35, 13, 5, 4, 'grass').set(33, 12, 'red').set(37, 12, 'red').rect(34, 15, 3, 1, 'white');
    pc.ellipse(35, 19, 33, 7, (_x, _y, nx, ny) => (ny < -0.3 ? 'mist' : ny > 0.4 ? 'slate' : nx < -0.6 || nx > 0.6 ? 'steel' : 'plum'));
    for (let i = 0; i < 8; i++) pc.set(10 + i * 7, 19, i % 2 ? 'yellow' : 'pink');
    for (const x of [14, 35, 56]) pc.rect(x - 2, 24, 4, 5, 'slate').rect(x - 1, 28, 2, 2, 'red');
    pc.rect(2, 17, 4, 4, 'wine').rect(64, 17, 4, 4, 'wine');
    return pc.outline('ink');
}

/** A burst: four frames growing and fading. */
function boom() {
    const pc = new PixelCanvas(80, 20);
    const steps: [number, Color, Color][] = [[3, 'white', 'yellow'], [6, 'yellow', 'orange'], [8, 'orange', 'red'], [9, 'red', 'wine']];
    steps.forEach(([r, inner, outer], f) => {
        const cx = f * 20 + 10;
        pc.ellipse(cx, 10, r, r, (x, y, nx, ny) => {
            const d = nx * nx + ny * ny;
            if (f === 3 && (x + y) % 2) return null;
            if (f >= 2 && d < 0.3) return null;
            return d < 0.45 ? inner : outer;
        });
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + f;
            pc.set(cx + Math.cos(a) * (r + 1), 10 + Math.sin(a) * (r + 1), f < 2 ? 'yellow' : 'orange');
        }
    });
    return { canvas: pc, frames: stripFrames(4, 20, 20) };
}

/** Power-ups: S spread shot, a shield, and a heart. */
function powerups() {
    const pc = new PixelCanvas(33, 11);
    const box = (ox: number, fill: Color, rim: Color) => pc.ellipse(ox + 5.5, 5.5, 5, 5, (_x, _y, nx, ny) => (nx * nx + ny * ny > 0.6 ? rim : fill));
    box(0, 'orange', 'gold');
    miniText(pc, 4, 3, 'S', 'white');
    box(11, 'blue', 'cyan');
    pc.rect(14, 3, 5, 3, 'ice').rect(15, 6, 3, 1, 'ice').set(16, 7, 'ice');
    box(22, 'wine', 'pink');
    pc.ascii(25, 3, ['.p.p.', 'ppppp', '.ppp.', '..p..'], { '.': null, p: 'pink' });
    pc.set(26, 3, 'white');
    return pc.outline('ink');
}

function shield() {
    const pc = new PixelCanvas(24, 24);
    return pc.ellipse(12, 12, 11.5, 11.5, (x, y, nx, ny) => {
        const d = nx * nx + ny * ny;
        if (d < 0.72) return null;
        return (x + y) % 3 === 0 ? 'ice' : 'cyan';
    });
}

/** The red planet filling the bottom of the screen, with craters. */
function planet(w: number) {
    const h = 40;
    const pc = new PixelCanvas(w, h);
    const r = w * 1.4;
    pc.ellipse(w / 2, r + 8, r + 3, r + 3, (_x, y) => (y < 10 ? 'wine' : null));
    pc.ellipse(w / 2, r + 8, r, r, (x, y) => {
        const t = (y - 8) / (h - 8);
        if ((x * 13 + y * 7) % 23 === 0) return 'earth';
        return t < 0.15 ? 'clay' : t < 0.55 ? 'orange' : 'red';
    });
    for (const [cx, cy, cr] of [[30, 22, 5], [110, 18, 3], [150, 30, 6], [70, 33, 4]]) {
        pc.ellipse(cx, cy, cr, cr * 0.5, 'earth').ellipse(cx + 1, cy + 1, cr * 0.7, cr * 0.3, 'red');
    }
    return pc;
}

/** Every texture the arcade game needs. */
export function blasterTextures(scene: Phaser.Scene, fieldWidth: number) {
    ensurePixels(scene, 'blaster-ship', ship);
    ensurePixels(scene, 'blaster-rock', asteroids);
    ensurePixels(scene, 'blaster-pebble', pebble);
    ensurePixels(scene, 'blaster-saucer', saucer);
    ensurePixels(scene, 'blaster-diver', diver);
    ensurePixels(scene, 'blaster-boss', mothership);
    ensurePixels(scene, 'blaster-boom', boom);
    ensurePixels(scene, 'blaster-powerups', () => ({ canvas: powerups(), frames: stripFrames(3, 11, 11) }));
    ensurePixels(scene, 'blaster-shield', shield);
    ensurePixels(scene, 'blaster-planet', () => planet(fieldWidth));
    ensurePixels(scene, 'blaster-shot', () => new PixelCanvas(2, 6).rect(0, 0, 2, 6, 'yellow').rect(0, 0, 2, 2, 'white'));
    ensurePixels(scene, 'blaster-zap', () => new PixelCanvas(4, 4).ellipse(2, 2, 2, 2, 'pink').set(1, 1, 'white'));
    ensurePixels(scene, 'blaster-star', () => new PixelCanvas(1, 1).set(0, 0, 'white'));
    for (const key of ['blaster-ship', 'blaster-saucer', 'blaster-diver']) {
        if (!scene.anims.exists(key)) scene.anims.create({ key, frames: [0, 1].map((frame) => ({ key, frame })), frameRate: 8, repeat: -1 });
    }
    if (!scene.anims.exists('blaster-boom')) {
        scene.anims.create({ key: 'blaster-boom', frames: [0, 1, 2, 3].map((frame) => ({ key: 'blaster-boom', frame })), frameRate: 18 });
    }
}

/** The cabinet on the Martian plain. */
export function cabinetTexture(scene: Phaser.Scene) {
    ensurePixels(scene, 'mars-arcade', cabinet);
    if (!scene.anims.exists('mars-arcade')) {
        scene.anims.create({ key: 'mars-arcade', frames: [0, 1].map((frame) => ({ key: 'mars-arcade', frame })), frameRate: 3, repeat: -1 });
    }
}

/** A line of mini-font text outlined in ink. `key` is redrawn in place, so a changing score doesn't pile up textures. */
export function textTexture(scene: Phaser.Scene, key: string, text: string, color: Color): string {
    const pc = new PixelCanvas(miniTextWidth(text) + 2, 7);
    miniText(pc, 1, 1, text, color);
    return addPixels(scene, key, pc.outline('ink', true), [], true);
}
