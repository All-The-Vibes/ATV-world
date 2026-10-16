import { darker, lighter, type Color, type ColorName } from './palette';
import { PixelCanvas } from './pixels';
import { hashString, pick, rng } from './noise';

/** Built-in hair styles. Characters are a convenience: NPCs and the player can also use any texture you load or draw. */
export type HairStyle = 'short' | 'long' | 'spiky' | 'bald' | 'bun' | 'cap';
export type Facing = 'down' | 'up' | 'side';

/** How a built-in character looks; missing appearance fields are filled from a seed. */
export interface CharacterLook {
    /** Verified creator's GitHub login (without @), not the viewer or the latest editor. Unknown: omit. */
    githubUsername?: string;
    skin?: Color;
    hair?: Color;
    hairStyle?: HairStyle;
    hat?: Color;
    shirt?: Color;
    pants?: Color;
    shoes?: Color;
}

export type FullLook = Required<Omit<CharacterLook, 'githubUsername'>> & Pick<CharacterLook, 'githubUsername'>;

export const FRAME_W = 16;
export const FRAME_H = 22;
export const FACINGS: Facing[] = ['down', 'up', 'side'];

const SKINS: ColorName[] = ['cream', 'peach', 'sand', 'clay', 'wood', 'earth'];
const HAIRS: ColorName[] = ['ink', 'bark', 'earth', 'wood', 'gold', 'yellow', 'red', 'orange', 'white', 'mist', 'pink', 'violet', 'blue', 'cyan', 'leaf'];
const SHIRTS: ColorName[] = ['red', 'orange', 'gold', 'leaf', 'grass', 'blue', 'sky', 'violet', 'pink', 'white', 'cyan', 'wine', 'forest', 'plum', 'cream'];
const PANTS: ColorName[] = ['navy', 'slate', 'bark', 'earth', 'night', 'blue', 'forest', 'steel', 'wine', 'plum'];
const SHOES: ColorName[] = ['ink', 'bark', 'earth', 'night', 'white', 'red'];
const STYLES: HairStyle[] = ['short', 'short', 'long', 'long', 'spiky', 'bun', 'cap', 'bald'];

/** A full look from a seed, with any fields from `base` taking priority. */
export function randomLook(seed: number | string, base: CharacterLook = {}): FullLook {
    const r = rng(typeof seed === 'string' ? hashString(seed) : seed);
    const look: FullLook = {
        skin: pick(SKINS, r()),
        hair: pick(HAIRS, r()),
        hairStyle: pick(STYLES, r()),
        hat: pick(SHIRTS, r()),
        shirt: pick(SHIRTS, r()),
        pants: pick(PANTS, r()),
        shoes: pick(SHOES, r()),
    };
    for (const [k, v] of Object.entries(base)) if (v !== undefined && v !== null) (look as Record<string, unknown>)[k] = v;
    return look;
}

/** The same player outside and in the library. Creator verified at introduction, commit 9fd2cf3. */
export const PLAYER_LOOK = randomLook('player', {
    githubUsername: 'vvundela1111',
    skin: 'peach',
    hair: 'earth',
    hairStyle: 'cap',
    hat: 'gold',
    shirt: 'blue',
    pants: 'navy',
    shoes: 'white',
});

export const lookKey = (l: FullLook) =>
    `char|${l.skin}|${l.hair}|${l.hairStyle}|${l.hat}|${l.shirt}|${l.pants}|${l.shoes}`;

/** Arm poses for front-facing frames: swinging (walking), both raised, or one raised (viewer's left/right) with the other on the hip. */
type Arms = 'swing' | 'up' | 'left' | 'right';

/**
 * Draw one 16x22 character frame at (ox, 0). Frame 0 = standing, 1/2 = walk steps.
 * Drawn without outlines; the sheet is outlined once at the end.
 */
function drawFrame(pc: PixelCanvas, ox: number, facing: Facing, frame: number, look: FullLook, arms: Arms = 'swing') {
    const oy = 1;
    const p = (x: number, y: number, c: Color) => pc.set(ox + x, oy + y, c);
    const row = (y: number, x0: number, x1: number, c: Color) => { for (let x = x0; x <= x1; x++) p(x, y, c); };

    const S = look.skin, Ss = darker(S), Sl = lighter(S);
    const style = look.hairStyle;
    const H = look.hair, Hs = darker(H), Hl = lighter(H);
    const C = look.hat, Cs = darker(C), Cl = lighter(C);
    const T = look.shirt, Ts = darker(T), Tl = lighter(T);
    const P = look.pants, Ps = darker(P);
    const F = look.shoes;
    const bald = style === 'bald';
    const step = frame === 0 ? 0 : frame === 1 ? -1 : 1;

    if (facing === 'side') {
        row(2, 6, 10, S); row(3, 5, 11, S);
        for (let y = 4; y <= 9; y++) row(y, 4, 11, S);
        row(10, 5, 10, S);
        p(12, 8, S);
        p(9, 7, 'ink'); p(9, 8, 'ink');
        p(7, 7, Ss);
        if (!bald) {
            row(2, 6, 10, H); row(3, 5, 11, H); row(4, 4, 11, H); row(5, 4, 10, H);
            for (let y = 6; y <= 8; y++) row(y, 4, 6, H);
            row(9, 4, 5, H);
            p(7, 3, Hl); p(8, 3, Hl);
            if (style === 'long') for (let y = 9; y <= 12; y++) row(y, 4, 5, Hs);
            if (style === 'spiky') { p(5, 1, H); p(7, 1, H); p(9, 1, H); }
            if (style === 'bun') { row(1, 3, 4, H); row(2, 3, 5, H); p(4, 3, H); }
            if (style === 'cap') {
                row(2, 6, 10, C); row(3, 5, 11, C); row(4, 4, 11, C);
                row(5, 4, 13, Cs); p(7, 3, Cl); p(8, 3, Cl);
            }
        } else {
            p(7, 3, Sl);
        }
        row(11, 6, 9, T); p(8, 11, Ss);
        for (let y = 12; y <= 15; y++) row(y, 5, 10, T);
        p(6, 12, Tl); p(5, 12, Ts); row(15, 5, 10, Ts);
        const ax = step === 0 ? 7 : step < 0 ? 8 : 6;
        p(ax, 12, Ts); p(ax, 13, Ts); p(ax + 1, 13, Ts); p(ax, 14, Ts); p(ax + (step < 0 ? 1 : 0), 15, S);
        row(16, 6, 9, P);
        if (step === 0) {
            row(17, 6, 9, P); row(18, 6, 9, P); p(6, 17, Ps); p(6, 18, Ps);
            row(19, 6, 10, F);
        } else {
            const back = step < 0 ? Ps : P, front = step < 0 ? P : Ps;
            row(17, 5, 6, back); row(18, 4, 5, back); row(19, 3, 5, F);
            row(17, 8, 9, front); row(18, 9, 10, front); row(19, 9, 11, F);
        }
        return;
    }

    row(2, 5, 10, S); row(3, 4, 11, S);
    for (let y = 4; y <= 9; y++) row(y, 3, 12, S);
    row(10, 4, 11, S);

    if (facing === 'down') {
        p(5, 7, 'ink'); p(5, 8, 'ink'); p(10, 7, 'ink'); p(10, 8, 'ink');
        p(12, 8, Ss); p(12, 9, Ss); row(10, 9, 11, Ss);
        if (!bald) {
            row(2, 5, 10, H); row(3, 4, 11, H); row(4, 3, 12, H); row(5, 3, 12, H);
            p(3, 6, H); p(12, 6, H); p(3, 7, H); p(12, 7, H);
            p(5, 3, Hl); p(6, 3, Hl); p(7, 4, Hl);
            p(7, 5, S); p(8, 5, S);
            if (style === 'long') for (let y = 8; y <= 12; y++) { p(3, y, Hs); p(12, y, Hs); }
            if (style === 'spiky') { p(4, 1, H); p(6, 1, H); p(9, 1, H); p(11, 1, H); }
            if (style === 'bun') { row(0, 6, 9, H); row(1, 6, 9, H); p(7, 0, Hl); }
            if (style === 'cap') {
                row(2, 5, 10, C); row(3, 4, 11, C); row(4, 3, 12, C);
                row(5, 2, 13, Cs); p(5, 3, Cl); p(6, 3, Cl);
                p(7, 5, Cs); p(8, 5, Cs);
            }
        } else {
            p(5, 3, Sl); p(6, 3, Sl);
        }
    } else {
        if (!bald) {
            row(2, 5, 10, H); row(3, 4, 11, H);
            for (let y = 4; y <= 9; y++) row(y, 3, 12, H);
            row(10, 4, 11, Hs);
            p(5, 3, Hl); p(6, 3, Hl); p(5, 4, Hl);
            if (style === 'long') for (let y = 11; y <= 13; y++) row(y, 4, 11, Hs);
            if (style === 'spiky') { p(4, 1, H); p(6, 1, H); p(9, 1, H); p(11, 1, H); }
            if (style === 'bun') { row(0, 6, 9, H); row(1, 6, 9, H); p(7, 0, Hl); }
            if (style === 'cap') {
                row(2, 5, 10, C); row(3, 4, 11, C); row(4, 3, 12, C); row(5, 3, 12, Cs);
                p(5, 3, Cl); p(6, 3, Cl);
            }
        } else {
            row(10, 4, 11, Ss);
        }
    }

    row(11, 5, 10, T);
    if (facing === 'down') { p(7, 11, Ss); p(8, 11, Ss); }
    for (let y = 12; y <= 15; y++) row(y, 4, 11, T);
    for (let y = 12; y <= 15; y++) p(11, y, Ts);
    p(5, 12, Tl); p(6, 12, Tl);
    row(15, 4, 11, Ts);
    const leftUp = step < 0 ? 1 : 0, rightUp = step > 0 ? 1 : 0;
    p(3, 12, T);
    if (arms === 'up' || arms === 'left') { p(2, 11, T); p(1, 10, S); p(1, 9, S); p(1, 8, S); }
    else if (arms === 'right') { p(2, 13, S); p(3, 14, S); }
    else { p(3, 13 - leftUp, S); p(3, 14 - leftUp, S); if (!leftUp) p(3, 15, S); }
    p(12, 12, Ts);
    if (arms === 'up' || arms === 'right') { p(13, 11, Ts); p(14, 10, Ss); p(14, 9, Ss); p(14, 8, Ss); }
    else if (arms === 'left') { p(13, 13, Ss); p(12, 14, Ss); }
    else { p(12, 13 - rightUp, Ss); p(12, 14 - rightUp, Ss); if (!rightUp) p(12, 15, Ss); }

    row(16, 5, 10, P); p(10, 16, Ps);
    const leg = (x0: number, up: boolean, shaded: boolean) => {
        const c = shaded ? Ps : P;
        p(x0, 17, c); p(x0 + 1, 17, c);
        if (up) { p(x0, 18, F); p(x0 + 1, 18, F); }
        else { p(x0, 18, c); p(x0 + 1, 18, c); p(x0, 19, F); p(x0 + 1, 19, F); }
    };
    leg(5, step < 0, false);
    leg(9, step > 0, true);
}

/** A 9-frame sheet: down/up/side × stand/step/step (frames named e.g. 'down-0'). */
export function characterSheet(look: FullLook): { canvas: PixelCanvas; frames: { name: string; x: number; y: number; w: number; h: number }[] } {
    return drawSheet(look, []);
}

/** Front-facing dance poses: 'cheer-0/1/2' (both arms up, standing/stepping) and 'point-l'/'point-r' (one arm up). */
const DANCE_POSES: { name: string; arms: Arms; step: number }[] = [
    { name: 'cheer-0', arms: 'up', step: 0 },
    { name: 'cheer-1', arms: 'up', step: 1 },
    { name: 'cheer-2', arms: 'up', step: 2 },
    { name: 'point-l', arms: 'left', step: 2 },
    { name: 'point-r', arms: 'right', step: 1 },
];

/** The 9-frame character sheet plus the dance poses, for people who dance (see ../disco). */
export function dancerSheet(look: FullLook): { canvas: PixelCanvas; frames: { name: string; x: number; y: number; w: number; h: number }[] } {
    return drawSheet(look, DANCE_POSES);
}

function drawSheet(look: FullLook, poses: typeof DANCE_POSES) {
    const pc = new PixelCanvas(FRAME_W * (9 + poses.length), FRAME_H);
    const frames: { name: string; x: number; y: number; w: number; h: number }[] = [];
    FACINGS.forEach((facing, fi) => {
        for (let f = 0; f < 3; f++) {
            const x = (fi * 3 + f) * FRAME_W;
            drawFrame(pc, x, facing, f, look);
            frames.push({ name: `${facing}-${f}`, x, y: 0, w: FRAME_W, h: FRAME_H });
        }
    });
    poses.forEach(({ name, arms, step }, i) => {
        const x = (9 + i) * FRAME_W;
        drawFrame(pc, x, 'down', step, look, arms);
        frames.push({ name, x, y: 0, w: FRAME_W, h: FRAME_H });
    });
    pc.outline('ink');
    return { canvas: pc, frames };
}

/** A single standing frame (handy for statues, portraits, and icons). */
export function characterPortrait(look: FullLook, facing: Facing = 'down'): PixelCanvas {
    const pc = new PixelCanvas(FRAME_W, FRAME_H);
    drawFrame(pc, 0, facing, 0, look);
    return pc.outline('ink');
}
