/**
 * Pixel art for ATV HQ: the building, everyone's desk, coders typing away, name plates, speech
 * bubbles, the rooftop sign, and the LED ticker over the door. All drawn in code with the kit.
 */
import {
    FRAME_W, MINI_GLYPHS, PixelCanvas, characterPortrait, characterSheet, darker, hashString, lighter,
    miniText, miniTextWidth, pick, randomLook, rng, toU32, type Color, type FrameRect, type FullLook,
} from '../kit';

/** Desks per floor. Calls run 40-50 people, so eight across keeps HQ a wide panel rather than a needle. */
export const BAYS = 8;
export const FLOOR_H = 36;
export const LOBBY_H = 46;
const SIGN_H = 28;
const ROOF_H = 8;
const BAY_W = 30;
const BAY_H = 26;
const PIER = 4;
const SIDE = 6;
/** Building width: eight desk windows and the walls around them. */
export const HQ_W = SIDE * 2 + BAYS * BAY_W + (BAYS - 1) * PIER;

/** One desk's window glass: what the coder sprite and the lights-off overlay cover. */
export const DESK_W = BAY_W - 2;
export const DESK_H = BAY_H - 2;
/** Coder sprites cover the window from the top down to the desk top (keyboard row included). */
export const CODER_H = 17;
const DESK_TOP = 16;

// Desk furniture, in px inside the window glass (unflipped: coder on the left, screen on the right).
const CHAIR = { x: 2, y: 8, w: 2, h: 8 };
const MONITOR = { x: 14, y: 3, w: 12, h: 10 };
const SCREEN = { x: 15, y: 4, w: 10, h: 8 };
const KEYS = { x: 10, w: 7 };

export const hqHeight = (floors: number) => SIGN_H + ROOF_H + floors * FLOOR_H + LOBBY_H;
/** The building itself, roof to sidewalk (no rooftop sign): where you're inside HQ. */
export const hqBodyHeight = (floors: number) => ROOF_H + floors * FLOOR_H + LOBBY_H;

export interface DeskSpot {
    /** Window glass top-left, from the building's bottom-left corner (y is negative: up). */
    x: number;
    y: number;
    /** Odd desks face the other way. */
    flip: boolean;
    /** Name plate center, below the window. */
    plateX: number;
    plateY: number;
}

export function deskSpot(seat: number): DeskSpot {
    const floor = Math.floor(seat / BAYS);
    const bay = seat % BAYS;
    const bx = SIDE + bay * (BAY_W + PIER);
    const top = -(LOBBY_H + (floor + 1) * FLOOR_H);
    return { x: bx + 1, y: top + 3, flip: bay % 2 === 1, plateX: bx + BAY_W / 2, plateY: top + 29 };
}

const SIGN_W = 77;
const SIGN_BOARD_H = 21;

/** Where things on the facade sit, from the building's bottom-left corner. */
export const HQ_SPOTS = {
    /** Top-left of the LED ticker's glass. */
    ticker: { x: HQ_W / 2 - 48, y: -LOBBY_H + 5, w: 96, h: 7 },
    /** The rooftop sign's top-left, measured from the building's top. */
    sign: { x: Math.round(HQ_W / 2 - SIGN_W / 2), y: 1 },
    /** Antenna light, measured from the building's top. */
    beacon: { x: HQ_W - 19, y: 3 },
};

// ---------------------------------------------------------------- looks

/** Everyone gets a random look, seeded by their ID so every screen in the call shows the same avatar. */
export const callerLook = (id: string): FullLook => randomLook(`hq|${id}`);

const faces = new Map<string, string>();
/** Portraits kept for the call panel (the newest ones): enough for a big call plus comings and goings. */
const FACES_KEPT = 160;

/** A head-and-shoulders portrait as a data URL (for the call panel). */
export function callerFace(id: string): string {
    let url = faces.get(id);
    if (url) {
        // Most recently used goes last, so the oldest is first in line to go.
        faces.delete(id);
        faces.set(id, url);
        return url;
    }
    const full = characterPortrait(callerLook(id), 'down');
    const pc = new PixelCanvas(full.width, 15);
    pc.blit(full, 0, 0);
    url = pc.flush().toDataURL();
    faces.set(id, url);
    if (faces.size > FACES_KEPT) faces.delete(faces.keys().next().value!);
    return url;
}

// ---------------------------------------------------------------- text

const fold = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ');

/** Keep only characters the mini font can draw. */
export const miniSafe = (s: string) => [...fold(s)].filter((ch) => ch in MINI_GLYPHS).join('').trim();

/** A name short enough for a desk plate (7 characters): "DARTH V", "PAC-MAN", "STEPH". */
export function plateText(name: string): string {
    const clean = miniSafe(name).replace(/\s+/g, ' ');
    if (!clean) return 'GUEST';
    if (clean.length <= 7) return clean;
    const words = clean.split(' ').filter(Boolean);
    const first = words[0].slice(0, 7);
    const initial = words.length > 1 ? words[words.length - 1][0] : '';
    return first.length <= 5 && initial ? `${first} ${initial}` : first;
}

/** The mini font at `scale`× (each font pixel becomes a scale×scale block). */
function bigText(pc: PixelCanvas, x: number, y: number, text: string, color: Color, scale = 2) {
    [...text].forEach((ch, i) => {
        const g = MINI_GLYPHS[ch] ?? MINI_GLYPHS[ch.toUpperCase()];
        if (!g) return;
        for (let k = 0; k < 15; k++) {
            if (g[k] === '1') pc.rect(x + (i * 4 + (k % 3)) * scale, y + Math.floor(k / 3) * scale, scale, scale, color);
        }
    });
}

// ---------------------------------------------------------------- the building

/** Maps desk px (x, width) to canvas px, mirrored for desks that face the other way. */
type DeskX = (dx: number, w: number) => number;

/** One desk, lights on, nobody home: wall, desk, empty chair, sleeping monitor, keyboard. */
function paintDesk(pc: PixelCanvas, ox: number, oy: number, flip: boolean) {
    const X: DeskX = (dx, w) => (flip ? ox + DESK_W - dx - w : ox + dx);
    const rect = (dx: number, dy: number, w: number, h: number, c: Color) => {
        pc.rect(X(dx, w), oy + dy, w, h, c);
    };
    for (let dy = 0; dy < DESK_TOP; dy++) {
        for (let dx = 0; dx < DESK_W; dx++) pc.mix(X(dx, 1), oy + dy, 'cream', 'sand', dy < 2 ? 0 : ((dy - 2) / 14) * 0.75);
    }
    rect(0, 0, DESK_W, 1, 'sand');
    rect(7, 0, 14, 1, 'white');
    // Desk: top, edge, front panel.
    rect(0, DESK_TOP, DESK_W, 1, 'clay');
    rect(0, DESK_TOP + 1, DESK_W, 1, 'wood');
    rect(0, DESK_TOP + 2, DESK_W, DESK_H - DESK_TOP - 2, 'earth');
    rect(0, DESK_TOP + 2, DESK_W, 1, 'bark');
    rect(3, DESK_TOP + 4, DESK_W - 6, 1, 'wood');
    // Empty chair, sleeping monitor, keyboard.
    rect(CHAIR.x, CHAIR.y, CHAIR.w, CHAIR.h, 'slate');
    rect(CHAIR.x, CHAIR.y, 1, CHAIR.h, 'steel');
    paintMonitor(pc, X, oy);
    rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, 'night');
    rect(SCREEN.x, SCREEN.y, 2, 1, 'slate');
    for (let i = 0; i < KEYS.w; i++) rect(KEYS.x + i, DESK_TOP, 1, 1, i % 2 ? 'mist' : 'cloud');
}

/** Bezel and stand (the screen is painted by whoever owns the desk). */
function paintMonitor(pc: PixelCanvas, X: DeskX, oy: number) {
    const rect = (dx: number, dy: number, w: number, h: number, c: Color) => {
        pc.rect(X(dx, w), oy + dy, w, h, c);
    };
    rect(MONITOR.x, MONITOR.y, MONITOR.w, MONITOR.h, 'slate');
    rect(MONITOR.x, MONITOR.y, MONITOR.w, 1, 'steel');
    // The far edge is in shadow: the screen is turned toward the coder.
    rect(MONITOR.x + MONITOR.w - 1, MONITOR.y + 1, 1, MONITOR.h - 1, 'night');
    rect(19, MONITOR.y + MONITOR.h, 2, 2, 'steel');
    rect(17, DESK_TOP - 1, 6, 1, 'slate');
}

/**
 * The building with `floors` office floors: rooftop, desk windows, and the lobby. Desks are painted
 * lit and empty; coders, the lights-off overlay, and name plates sit on top as their own sprites.
 */
export function hqFacade(floors: number): PixelCanvas {
    const W = HQ_W;
    const H = hqHeight(floors);
    const pc = new PixelCanvas(W, H);
    const roofTop = SIGN_H;
    const bodyTop = roofTop + ROOF_H;
    const lobbyTop = bodyTop + floors * FLOOR_H;
    const x0 = 1, x1 = W - 2;

    // Walls: crisp white panels with a cool shadow toward the right.
    for (let y = bodyTop; y < H - 1; y++) {
        for (let x = x0; x <= x1; x++) pc.set(x, y, x <= x0 + 1 ? 'white' : x >= x1 - 1 ? 'mist' : 'cloud');
    }

    // Rooftop: coping, blue fascia, and the shadow it casts.
    pc.rect(x0, roofTop, x1 - x0 + 1, 2, 'mist').rect(x0, roofTop, x1 - x0 + 1, 1, 'cloud');
    pc.rect(x0, roofTop + 2, x1 - x0 + 1, 5, 'blue').rect(x0, roofTop + 2, x1 - x0 + 1, 1, 'sky').rect(x0, roofTop + 6, x1 - x0 + 1, 1, 'navy');
    for (let x = x0; x <= x1; x++) if (x % 8 === 3) pc.set(x, roofTop + 4, 'navy');
    for (let x = x0; x <= x1; x++) pc.set(x, roofTop + 7, x % 2 ? 'mist' : 'steel');
    // Sign posts, the antenna mast, and rooftop kit (the sign itself and the light are separate sprites).
    const signBottom = HQ_SPOTS.sign.y + SIGN_BOARD_H;
    for (const px of [HQ_SPOTS.sign.x + 10, HQ_SPOTS.sign.x + SIGN_W - 12]) {
        pc.rect(px, signBottom - 1, 2, roofTop - signBottom + 1, 'slate').rect(px, signBottom - 1, 1, roofTop - signBottom + 1, 'steel');
    }
    const mast = HQ_SPOTS.beacon.x;
    pc.rect(mast, HQ_SPOTS.beacon.y + 2, 1, roofTop - HQ_SPOTS.beacon.y - 2, 'steel');
    for (const y of [9, 15, 21]) pc.rect(mast - 1, y, 3, 1, 'slate');
    pc.rect(mast - 3, roofTop - 2, 7, 2, 'slate').rect(mast - 3, roofTop - 2, 7, 1, 'steel');
    for (const ax of [16, 34]) {
        pc.rect(ax, roofTop - 6, 14, 6, 'mist').rect(ax, roofTop - 6, 14, 1, 'cloud').rect(ax + 1, roofTop - 4, 12, 3, 'steel');
        for (let i = ax + 2; i < ax + 13; i += 2) pc.rect(i, roofTop - 4, 1, 3, 'slate');
    }
    // A satellite dish, pointed at wherever the Wi-Fi is.
    const dish = W - 52;
    pc.ellipse(dish, roofTop - 6, 5, 4, (_x, _y, nx, ny) => (nx + ny < -0.4 ? 'white' : nx + ny > 0.6 ? 'mist' : 'cloud'));
    pc.rect(dish, roofTop - 3, 1, 3, 'steel').rect(dish - 2, roofTop - 1, 5, 1, 'slate').line(dish - 1, roofTop - 7, dish - 4, roofTop - 10, 'slate');

    // Office floors, top to bottom.
    for (let f = floors - 1; f >= 0; f--) {
        const top = bodyTop + (floors - 1 - f) * FLOOR_H;
        pc.rect(x0, top, x1 - x0 + 1, 1, 'mist');
        for (let bay = 0; bay < BAYS; bay++) {
            const bx = SIDE + bay * (BAY_W + PIER);
            const wy = top + 2;
            pc.rect(bx, wy, BAY_W, BAY_H, 'navy');
            paintDesk(pc, bx + 1, wy + 1, bay % 2 === 1);
            pc.rect(bx - 1, wy + BAY_H, BAY_W + 2, 1, 'white').rect(bx - 1, wy + BAY_H + 1, BAY_W + 2, 1, 'mist');
        }
    }

    // Lobby: blue band, ticker frame, glass doors, and two big windows.
    const ly = lobbyTop;
    pc.rect(x0, ly, x1 - x0 + 1, 3, 'blue').rect(x0, ly, x1 - x0 + 1, 1, 'sky').rect(x0, ly + 2, x1 - x0 + 1, 1, 'navy');
    const t = HQ_SPOTS.ticker;
    pc.rect(t.x - 2, ly + 4, t.w + 4, t.h + 2, 'slate').rect(t.x - 1, ly + 5, t.w + 2, t.h, 'ink');
    const doorW = 26, doorH = 25, dx = W / 2 - doorW / 2, dy = H - 4 - doorH;
    pc.rect(dx - 3, dy - 3, doorW + 6, 3, 'navy').rect(dx - 3, dy - 3, doorW + 6, 1, 'blue');
    pc.rect(dx - 1, dy - 1, doorW + 2, doorH + 1, 'navy');
    for (let y = 0; y < doorH; y++) {
        for (let x = 0; x < doorW; x++) {
            const glint = (x + y) % 13 < 2 && y < doorH - 3;
            pc.set(dx + x, dy + y, glint ? 'ice' : y > doorH - 5 ? 'blue' : 'sky');
        }
    }
    pc.rect(dx + doorW / 2 - 1, dy, 2, doorH, 'navy');
    pc.rect(dx + doorW / 2 - 3, dy + 11, 1, 4, 'gold').rect(dx + doorW / 2 + 2, dy + 11, 1, 4, 'gold');
    // Two lobby windows each side of the door.
    const winW = 44, winY = ly + 17;
    lobbyWindow(pc, 12, winY, winW, 20, 'reception');
    lobbyWindow(pc, 62, winY, winW, 20, 'lounge');
    lobbyWindow(pc, W - 62 - winW, winY, winW, 20, 'coffee');
    lobbyWindow(pc, W - 12 - winW, winY, winW, 20, 'servers');
    // Planters by the door.
    for (const px of [dx - 12, dx + doorW + 4]) {
        pc.rect(px, H - 10, 8, 6, 'earth').rect(px, H - 10, 8, 1, 'wood');
        pc.ellipse(px + 4, H - 12, 5, 3.5, (x, y) => ((x + y) % 3 === 0 ? 'grass' : 'leaf'));
    }
    // Foundation.
    pc.rect(x0, H - 4, x1 - x0 + 1, 3, 'steel').rect(x0, H - 4, x1 - x0 + 1, 1, 'mist').rect(x0, H - 2, x1 - x0 + 1, 1, 'slate');

    return pc.outline('ink');
}

type LobbyRoom = 'reception' | 'lounge' | 'coffee' | 'servers';

function lobbyWindow(pc: PixelCanvas, x: number, y: number, w: number, h: number, room: LobbyRoom) {
    pc.rect(x - 1, y - 1, w + 2, h + 2, 'navy');
    const [wallTop, wallLow]: [Color, Color] = room === 'servers' ? ['cloud', 'mist'] : ['cream', 'sand'];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pc.mix(x + i, y + j, wallTop, wallLow, j / h);
    pc.rect(x, y + h - 4, w, 4, room === 'servers' ? 'steel' : 'clay').rect(x, y + h - 4, w, 1, room === 'servers' ? 'mist' : 'wood');
    if (room === 'reception') {
        // The ATV logo on the wall and a desk with a plant.
        pc.rect(x + 4, y + 3, 15, 9, 'blue').rect(x + 4, y + 3, 15, 1, 'sky');
        miniText(pc, x + 6, y + 5, 'ATV', 'gold');
        pc.rect(x + 24, y + 10, 16, 6, 'wood').rect(x + 24, y + 10, 16, 1, 'clay');
        pc.rect(x + 34, y + 8, 3, 2, 'clay').rect(x + 33, y + 5, 5, 3, 'leaf').set(x + 35, y + 4, 'grass');
    } else if (room === 'lounge') {
        // A comfy couch, a painting of somewhere nicer, and a floor lamp.
        pc.rect(x + 8, y + 2, 14, 6, 'sky').rect(x + 8, y + 6, 14, 2, 'grass').rect(x + 15, y + 4, 4, 2, 'lime').set(x + 11, y + 3, 'white');
        pc.rect(x + 5, y + 9, 26, 4, 'wine').rect(x + 6, y + 12, 24, 4, 'red').rect(x + 6, y + 12, 24, 1, 'orange');
        pc.rect(x + 3, y + 11, 3, 5, 'wine').rect(x + 30, y + 11, 3, 5, 'wine');
        pc.rect(x + 37, y + 5, 1, 11, 'slate').rect(x + 35, y + 3, 5, 3, 'gold').set(x + 37, y + 6, 'yellow');
    } else if (room === 'coffee') {
        // The coffee bar: machine, mugs, and a very important sign.
        pc.rect(x + 4, y + 6, 8, 10, 'slate').rect(x + 4, y + 6, 8, 1, 'steel').rect(x + 6, y + 9, 4, 2, 'red').set(x + 7, y + 13, 'cream');
        pc.rect(x + 2, y + 16, w - 4, 2, 'wood').rect(x + 2, y + 16, w - 4, 1, 'clay');
        pc.rect(x + 15, y + 13, 2, 3, 'white').rect(x + 19, y + 13, 2, 3, 'gold').rect(x + 23, y + 13, 2, 3, 'pink');
        pc.rect(x + 15, y + 2, 25, 7, 'night');
        miniText(pc, x + 16, y + 3, 'COFFEE', 'cream');
    } else {
        // The server room: three racks, blinking away (well, frozen mid-blink).
        [x + 5, x + 17, x + 29].forEach((rx, n) => {
            pc.rect(rx, y + 2, 10, 14, 'night').rect(rx, y + 2, 10, 1, 'slate');
            for (let r = 0; r < 6; r++) {
                pc.rect(rx + 1, y + 4 + r * 2, 8, 1, 'slate');
                pc.set(rx + 2 + ((r * 3 + n) % 5), y + 4 + r * 2, (r + n) % 3 ? 'lime' : 'cyan');
                if ((r + n) % 4 === 1) pc.set(rx + 8, y + 4 + r * 2, 'red');
            }
        });
    }
    // Reflections.
    for (let i = 0; i < 6; i++) if (x + 3 + i < x + w) pc.set(x + 3 + i, y + 1 + (i >> 1), 'white');
}

/** Glass glare over every desk window, drawn above the coders. */
export function hqGlass(floors: number): PixelCanvas {
    const pc = new PixelCanvas(HQ_W, hqHeight(floors));
    const glare = 'rgba(255, 255, 255, 0.16)';
    for (let seat = 0; seat < floors * BAYS; seat++) {
        const s = deskSpot(seat);
        const ox = s.x, oy = hqHeight(floors) + s.y;
        for (let j = 0; j < DESK_H; j++) {
            for (let i = 0; i < DESK_W; i++) {
                const d = i + j;
                if ((d >= 20 && d <= 22) || d === 25 || (d >= 38 && d <= 39)) pc.set(ox + i, oy + j, glare);
            }
        }
    }
    return pc;
}

/** Lights off: the dark over an empty desk, with the monitor's standby light. */
export function deskDarkArt(): PixelCanvas {
    const pc = new PixelCanvas(DESK_W, DESK_H);
    pc.rect(0, 0, DESK_W, DESK_H, 'rgba(20, 16, 30, 0.84)');
    pc.set(MONITOR.x + MONITOR.w - 2, MONITOR.y + MONITOR.h - 1, 'orange');
    return pc;
}

/** The rooftop sign, lit (with chasing bulbs, 2 frames) or dark. */
export function signArt(lit: boolean): { canvas: PixelCanvas; frames: FrameRect[] } {
    const w = SIGN_W, h = SIGN_BOARD_H;
    const pc = new PixelCanvas(w * 2, h);
    for (let f = 0; f < 2; f++) {
        const ox = f * w;
        pc.rect(ox + 1, 1, w - 2, h - 2, 'slate').rect(ox + 2, 2, w - 4, h - 4, lit ? 'night' : 'ink');
        if (lit) bigText(pc, ox + 5, 4, 'ATV HQ', 'orange', 3);
        bigText(pc, ox + 4, 3, 'ATV HQ', lit ? 'gold' : 'slate', 3);
        for (let i = 3; i < w - 2; i += 3) {
            const bulb: Color = !lit ? 'night' : Math.floor(i / 3 + f) % 2 ? 'clay' : 'yellow';
            pc.set(ox + i, 1, bulb).set(ox + i, h - 2, bulb);
        }
        pc.outline('ink', false, { x: ox, y: 0, w, h });
    }
    return { canvas: pc, frames: [0, 1].map((f) => ({ name: f, x: f * w, y: 0, w, h })) };
}

/** A small name plate for under someone's window. Your own is gold. */
export function plateArt(text: string, me: boolean): PixelCanvas {
    const w = miniTextWidth(text) + 6;
    const pc = new PixelCanvas(w, 7);
    pc.rect(0, 0, w, 7, me ? 'gold' : 'night').rect(0, 6, w, 1, me ? 'orange' : 'ink');
    miniText(pc, 3, 1, text, me ? 'bark' : 'cream');
    return pc;
}

/** A speech bubble ("HI!", "BYE!"). */
export function bubbleArt(text: string): PixelCanvas {
    const tw = miniTextWidth(text);
    const w = tw + 6;
    const pc = new PixelCanvas(w + 2, 13);
    pc.rect(2, 1, w - 2, 9, 'white').rect(1, 2, w, 7, 'white');
    const cx = Math.floor((w + 2) / 2);
    pc.rect(cx - 1, 10, 3, 1, 'white').set(cx, 11, 'white');
    miniText(pc, 4, 3, text, 'ink');
    return pc.outline('ink');
}

/** LED ticker text, made to loop seamlessly in a TileSprite. */
export function tickerArt(text: string): PixelCanvas {
    const msg = `${miniSafe(text)}   *   `;
    const pc = new PixelCanvas(Math.max(8, miniTextWidth(msg) + 1), 7);
    pc.rect(0, 0, pc.width, 7, 'ink');
    miniText(pc, 0, 1, msg, 'lime');
    return pc;
}

/** The antenna's warning light. */
export function beaconArt(): PixelCanvas {
    return new PixelCanvas(3, 3).rect(0, 1, 3, 1, 'red').rect(1, 0, 1, 3, 'red').set(1, 1, 'pink');
}

// ---------------------------------------------------------------- coders

type Pose = 'typeA' | 'typeB' | 'rest' | 'think' | 'cheer';

interface Token {
    w: number;
    c: Color;
}

interface Line {
    indent: number;
    toks: Token[];
}

type ScreenState =
    | { kind: 'code'; done: Line[]; line: Line | null; typed: number; cursor: boolean }
    | { kind: 'run'; progress: number }
    | { kind: 'pass' }
    | { kind: 'fail' };

interface Beat {
    pose: Pose;
    screen: ScreenState;
}

const THEMES: { bg: Color; fg: Color[]; cursor: Color }[] = [
    { bg: 'ink', fg: ['lime', 'cyan', 'pink', 'gold', 'cloud', 'sky'], cursor: 'white' },
    { bg: 'night', fg: ['yellow', 'cyan', 'peach', 'lime', 'cloud'], cursor: 'white' },
    { bg: 'navy', fg: ['ice', 'gold', 'pink', 'lime', 'white'], cursor: 'yellow' },
    { bg: 'pine', fg: ['lime', 'yellow', 'ice', 'peach'], cursor: 'white' },
    { bg: 'white', fg: ['blue', 'red', 'forest', 'violet', 'steel'], cursor: 'ink' },
];

const MUGS: Color[] = ['white', 'red', 'blue', 'gold', 'leaf', 'pink', 'violet'];
const LINE_MAX = SCREEN.w - 2;

const lineWidth = (l: Line) => l.indent * 2 + l.toks.reduce((s, t) => s + t.w, 0) + Math.max(0, l.toks.length - 1);

function writeLine(r: () => number, theme: (typeof THEMES)[number], indent: number): Line {
    const toks: Token[] = [];
    let width = indent * 2 - 1;
    const room = LINE_MAX - Math.floor(r() * 3);
    while (toks.length < 4) {
        const w = 1 + Math.floor(r() * 3);
        if (width + 1 + w > room) break;
        toks.push({ w, c: toks.length === 0 && r() < 0.5 ? theme.fg[0] : pick(theme.fg, r()) });
        width += 1 + w;
    }
    return { indent, toks };
}

/** A loop of one coder's day: type some lines, pause to think, run it, (maybe fix it,) celebrate. */
function script(r: () => number, theme: (typeof THEMES)[number]): Beat[] {
    const beats: Beat[] = [];
    let done: Line[] = [];
    let indent = 0;
    const type = (count: number) => {
        for (let n = 0; n < count; n++) {
            if (r() < 0.12 && done.length) {
                done = [...done, { indent: 0, toks: [] }];
                beats.push({ pose: 'rest', screen: { kind: 'code', done, line: null, typed: 0, cursor: true } });
                continue;
            }
            const line = writeLine(r, theme, indent);
            const w = lineWidth(line);
            for (let t = 1; t <= w; t++) {
                beats.push({ pose: t % 2 ? 'typeA' : 'typeB', screen: { kind: 'code', done, line, typed: t, cursor: true } });
            }
            done = [...done, line];
            beats.push({ pose: 'rest', screen: { kind: 'code', done, line: null, typed: 0, cursor: true } });
            if (r() < 0.25) {
                const pause = 2 + Math.floor(r() * 4);
                for (let k = 0; k < pause; k++) beats.push({ pose: 'think', screen: { kind: 'code', done, line: null, typed: 0, cursor: k % 2 === 1 } });
            }
            indent = Math.max(0, Math.min(2, indent + (r() < 0.35 ? 1 : r() < 0.45 ? -1 : 0)));
        }
    };
    const run = () => {
        for (let p = 1; p <= 4; p++) beats.push({ pose: 'rest', screen: { kind: 'run', progress: p / 4 } });
    };
    type(5 + Math.floor(r() * 4));
    run();
    if (r() < 0.35) {
        for (let k = 0; k < 4; k++) beats.push({ pose: 'think', screen: { kind: 'fail' } });
        done = [];
        type(2 + Math.floor(r() * 2));
        run();
    }
    for (let k = 0; k < 6; k++) beats.push({ pose: k < 4 ? 'cheer' : 'rest', screen: { kind: 'pass' } });
    beats.push({ pose: 'rest', screen: { kind: 'code', done: [], line: null, typed: 0, cursor: true } });
    return beats;
}

const CHECK = ['.......#', '......##', '.#...##.', '.##.##..', '..###...', '...#....'];
const CROSS = ['#....#', '##..##', '.####.', '.####.', '##..##', '#....#'];

function paintScreen(pc: PixelCanvas, ox: number, oy: number, s: ScreenState, theme: (typeof THEMES)[number]) {
    const sx = ox + SCREEN.x, sy = oy + SCREEN.y;
    const glyph = (rows: string[], c: Color) => {
        const gx = sx + Math.floor((SCREEN.w - rows[0].length) / 2), gy = sy + 1;
        rows.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && pc.set(gx + i, gy + j, c)));
    };
    if (s.kind === 'pass') {
        pc.rect(sx, sy, SCREEN.w, SCREEN.h, 'forest');
        glyph(CHECK, 'lime');
        return;
    }
    if (s.kind === 'fail') {
        pc.rect(sx, sy, SCREEN.w, SCREEN.h, 'wine');
        glyph(CROSS, 'pink');
        return;
    }
    pc.rect(sx, sy, SCREEN.w, SCREEN.h, theme.bg);
    if (s.kind === 'run') {
        pc.rect(sx + 1, sy + 3, SCREEN.w - 2, 2, 'slate').rect(sx + 1, sy + 3, Math.max(1, Math.round((SCREEN.w - 2) * s.progress)), 2, 'gold');
        return;
    }
    // Code: the last four lines, one row of text every 2px, newest at the bottom.
    const rows = [...s.done.map((line) => ({ line, typed: Infinity })), { line: s.line ?? { indent: 0, toks: [] }, typed: s.typed }];
    const shown = rows.slice(-4);
    shown.forEach(({ line, typed }, k) => {
        const y = sy + k * 2;
        let x = sx + 1 + line.indent * 2;
        let left = typed === Infinity ? Infinity : typed - line.indent * 2;
        for (const tok of line.toks) {
            for (let i = 0; i < tok.w && left > 0; i++, left--) pc.set(x + i, y, tok.c);
            x += tok.w + 1;
            left--;
        }
        if (k === shown.length - 1 && s.cursor) {
            const cx = sx + 1 + Math.min(Math.max(0, typed), lineWidth(line) + 1, SCREEN.w - 2);
            pc.set(Math.min(cx, sx + SCREEN.w - 1), y, theme.cursor);
        }
    });
}

/** Head and body of a look, seen from the side, without its outline or its hanging arm. */
function sideFigure(look: FullLook): PixelCanvas {
    const sheet = characterSheet(look).canvas;
    const fx = 6 * FRAME_W; // the 'side-0' frame
    const out = new PixelCanvas(FRAME_W, 16);
    const ink = toU32('ink');
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < FRAME_W && sheet.filled(fx + x, y);
    for (let y = 1; y <= 16; y++) {
        for (let x = 0; x < FRAME_W; x++) {
            const v = sheet.raw(fx + x, y);
            if (v >>> 24 === 0) continue;
            const edge = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1);
            if (v === ink && edge) continue;
            out.px[(y - 1) * FRAME_W + x] = v;
        }
    }
    // Tuck the hanging arm back into the shirt: the seated arm reaches for the keyboard instead.
    const T = look.shirt, Ts = darker(look.shirt);
    out.set(7, 12, T).set(7, 13, T).set(8, 13, T).set(7, 14, T).set(7, 15, Ts);
    return out.outline('ink');
}

/** Draw one beat of a coder at their desk into the frame at (ox, oy). */
function paintBeat(pc: PixelCanvas, ox: number, oy: number, beat: Beat, fig: PixelCanvas, look: FullLook, theme: (typeof THEMES)[number], mug: Color, duck: boolean) {
    const S = look.skin, Ss = darker(look.skin), Ts = darker(look.shirt);
    const X = (dx: number) => ox + dx;
    // Chair, then the coder (1px left of their sheet position), then the arm.
    pc.rect(X(CHAIR.x), oy + CHAIR.y, CHAIR.w, CHAIR.h, 'slate').rect(X(CHAIR.x), oy + CHAIR.y, 1, CHAIR.h, 'steel');
    pc.blit(fig, ox - 1, oy);
    pc.set(X(6), oy + 12, Ts).set(X(6), oy + 13, Ts);
    if (beat.pose === 'think') {
        // Hand on chin.
        [[7, 14], [8, 13], [8, 12], [9, 11]].forEach(([x, y]) => pc.set(X(x), oy + y, S));
        pc.set(X(10), oy + 10, Ss).set(X(10), oy + 9, Ss);
    } else if (beat.pose === 'cheer') {
        // Fists in the air.
        pc.rect(X(4), oy, 2, 1, S).rect(X(9), oy, 2, 1, Ss);
        pc.set(X(6), oy + 14, S);
    } else {
        for (let x = 6; x <= 10; x++) pc.set(X(x), oy + 14, S);
        const nearUp = beat.pose === 'typeB';
        const farUp = beat.pose === 'typeA';
        pc.set(X(11), oy + (nearUp ? 14 : 15), S).set(X(12), oy + (nearUp ? 14 : 15), S);
        pc.set(X(13), oy + (farUp ? 14 : 15), Ss);
    }
    // Monitor and its screen.
    paintMonitor(pc, (dx) => ox + dx, oy);
    paintScreen(pc, ox, oy, beat.screen, theme);
    if (duck) pc.rect(X(22), oy + 1, 3, 2, 'yellow').set(X(23), oy, 'yellow').set(X(24), oy, 'orange').set(X(22), oy + 2, 'gold');
    // Keyboard and mug on the desk.
    for (let i = 0; i < KEYS.w; i++) pc.set(X(KEYS.x + i), oy + DESK_TOP, i % 2 ? 'mist' : 'cloud');
    pc.rect(X(24), oy + 13, 3, 3, mug).rect(X(24), oy + 13, 1, 3, lighter(mug)).set(X(27), oy + 14, mug).set(X(25), oy + 13, darker(mug));
}

export interface CoderSheet {
    canvas: PixelCanvas;
    frames: FrameRect[];
    fps: number;
}

/** Someone coding at their desk, as a looping sprite sheet (coder, chair, monitor, mug). Seeded by their ID. */
export function coderSheet(id: string): CoderSheet {
    const seed = hashString(`desk|${id}`);
    const r = rng(seed);
    const look = callerLook(id);
    const theme = pick(THEMES, r());
    const mug = pick(MUGS, r());
    const duck = r() < 0.3;
    const fps = 8 + Math.floor(r() * 4);
    const beats = script(r, theme);
    const fig = sideFigure(look);
    const cols = 12;
    const rows = Math.ceil(beats.length / cols);
    const pc = new PixelCanvas(cols * DESK_W, rows * CODER_H);
    const frames: FrameRect[] = [];
    beats.forEach((beat, i) => {
        const ox = (i % cols) * DESK_W, oy = Math.floor(i / cols) * CODER_H;
        paintBeat(pc, ox, oy, beat, fig, look, theme, mug, duck);
        frames.push({ name: i, x: ox, y: oy, w: DESK_W, h: CODER_H });
    });
    return { canvas: pc, frames, fps };
}
