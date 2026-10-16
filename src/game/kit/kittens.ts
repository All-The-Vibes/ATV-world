import { miniText, miniTextWidth } from './font';
import type { Color } from './palette';
import { PixelCanvas } from './pixels';

export const TOY_KINDS = ['yarn', 'ball', 'mouse', 'tunnel', 'scratcher', 'feather'] as const;
export type ToyKind = typeof TOY_KINDS[number];

export function kittenArt(coat: Color, patches: Color): PixelCanvas {
    const pc = new PixelCanvas(24, 20);
    pc.line(3, 13, 1, 9, coat).line(1, 9, 2, 6, coat).line(4, 13, 2, 9, patches);
    pc.ellipse(10, 13, 7, 4, coat).rect(6, 15, 3, 3, patches).rect(13, 15, 3, 3, coat);
    pc.rect(13, 5, 8, 9, coat).rect(13, 2, 2, 5, coat).rect(19, 2, 2, 5, patches);
    pc.set(14, 4, 'pink').set(19, 4, 'pink').rect(17, 6, 3, 3, patches);
    pc.set(15, 9, 'ink').set(20, 9, 'ink').set(18, 11, 'pink');
    pc.line(11, 11, 14, 12, 'cream').line(20, 12, 22, 11, 'cream');
    pc.rect(8, 10, 3, 2, patches).rect(14, 14, 6, 1, 'violet');
    return pc.outline('ink');
}

export function toyArt(kind: ToyKind, color: Color): PixelCanvas {
    const pc = new PixelCanvas(34, 34);
    switch (kind) {
        case 'yarn':
            pc.line(5, 29, 14, 28, color).line(5, 29, 3, 26, color);
            pc.ellipse(20, 24, 8, 7, color).line(14, 21, 24, 28, 'cream');
            pc.line(16, 18, 27, 25, 'cream').line(15, 28, 23, 19, 'white');
            break;
        case 'ball':
            pc.ellipse(17, 25, 7, 7, color).rect(16, 19, 2, 12, 'cream');
            pc.line(11, 24, 22, 24, 'white').set(14, 21, 'white');
            break;
        case 'mouse':
            pc.line(8, 28, 3, 25, 'pink').line(3, 25, 2, 28, 'pink');
            pc.ellipse(17, 26, 8, 4, 'cloud').ellipse(22, 22, 3, 3, color);
            pc.set(24, 25, 'ink').set(26, 27, 'pink');
            break;
        case 'tunnel':
            pc.rect(6, 16, 22, 15, color).ellipse(27, 23, 5, 8, 'plum');
            pc.ellipse(27, 23, 3, 6, 'night');
            for (const x of [8, 14, 20]) pc.line(x, 17, x, 29, 'cream');
            break;
        case 'scratcher':
            pc.rect(5, 28, 25, 4, 'plum').rect(15, 8, 5, 21, 'sand');
            for (let y = 10; y < 28; y += 3) pc.line(15, y, 19, y + 1, 'wood');
            pc.rect(7, 5, 21, 4, color).line(9, 9, 9, 18, 'cream');
            pc.ellipse(9, 20, 3, 3, 'pink');
            break;
        case 'feather':
            pc.rect(9, 29, 17, 3, 'wood').line(18, 29, 18, 6, 'clay');
            pc.line(18, 6, 28, 10, 'cream').line(28, 10, 28, 19, 'cream');
            pc.ellipse(27, 22, 3, 6, color).line(28, 18, 28, 26, 'white');
            break;
    }
    return pc.outline('ink');
}

export function fenceArt(width: number): PixelCanvas {
    const pc = new PixelCanvas(width, 18);
    pc.rect(0, 6, width, 3, 'wood').rect(0, 12, width, 3, 'clay');
    for (let x = 2; x < width; x += 12) {
        pc.rect(x, 3, 4, 15, 'wood').rect(x, 3, 1, 14, 'sand').rect(x + 1, 1, 2, 3, 'cream');
    }
    return pc.outline('bark');
}

export function corralSignArt(): PixelCanvas {
    const pc = new PixelCanvas(177, 29);
    pc.rect(5, 2, 167, 23, 'plum').rect(7, 4, 163, 19, 'cream');
    miniText(pc, (177 - miniTextWidth('CAT & KITTEN CORRAL')) / 2, 6, 'CAT & KITTEN CORRAL', 'plum');
    miniText(pc, (177 - miniTextWidth('LOTS OF TOYS. ZERO COMMITMENT.')) / 2, 15, 'LOTS OF TOYS. ZERO COMMITMENT.', 'earth');
    return pc.outline('bark');
}
