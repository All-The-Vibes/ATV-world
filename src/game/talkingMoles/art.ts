import { PixelCanvas } from '../kit/pixels';
import { stripFrames } from '../kit/textures';

export const MOLE_HEIGHT = 24;

export function moleSheet() {
    const mole = new PixelCanvas(36, 28);
    mole.ellipse(18, 19, 10, 9, 'earth');
    mole.ellipse(18, 12, 9, 10, 'wood');
    mole.ellipse(15, 9, 5, 6, 'clay');
    mole.ellipse(18, 17, 6, 4, 'sand');
    mole.rect(12, 10, 2, 2, 'ink').rect(22, 10, 2, 2, 'ink');
    mole.set(12, 10, 'white').set(22, 10, 'white');
    mole.ellipse(18, 15, 3, 2, 'pink');
    mole.line(16, 20, 20, 20, 'ink').rect(17, 20, 2, 2, 'white');
    mole.ellipse(7, 23, 4, 3, 'clay').ellipse(29, 23, 4, 3, 'clay');
    for (const x of [5, 8, 27, 30]) mole.rect(x, 23, 1, 3, 'cream');
    mole.outline();
    const canvas = new PixelCanvas(36 * (MOLE_HEIGHT + 1), 28);
    for (let lift = 1; lift <= MOLE_HEIGHT; lift++) {
        const frame = new PixelCanvas(36, 28);
        frame.blit(mole, 0, MOLE_HEIGHT - lift);
        canvas.blit(frame, lift * 36, 0);
    }
    return { canvas, frames: stripFrames(MOLE_HEIGHT + 1, 36, 28) };
}

export function burrowArt(front = false) {
    const pc = new PixelCanvas(40, 14);
    pc.ellipse(20, 7, 19, 6, 'earth').ellipse(20, 5, 14, 4, 'ink');
    pc.ellipse(7, 8, 5, 3, 'wood').ellipse(33, 8, 5, 3, 'wood');
    pc.rect(10, 10, 20, 2, 'clay').set(5, 7, 'sand').set(34, 7, 'sand');
    if (front) {
        for (let y = 0; y < 8; y++) pc.rect(0, y, 40, 1, null);
    }
    return pc;
}
