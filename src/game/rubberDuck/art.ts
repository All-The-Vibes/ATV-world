import { PixelCanvas, stripFrames } from '../kit';

export const DUCK_WIDTH = 72;
export const DUCK_HEIGHT = 68;

export function rubberDuckSheet() {
    const canvas = new PixelCanvas(DUCK_WIDTH * 4, DUCK_HEIGHT);
    for (let frame = 0; frame < 4; frame++) {
        const pc = new PixelCanvas(DUCK_WIDTH, DUCK_HEIGHT);
        const bob = frame % 2;
        const wag = [0, 1, 0, -1][frame];
        const step = [-2, 0, 2, 0][frame];
        const farFoot = 25 - step;
        const nearFoot = 40 + step;
        pc.rect(farFoot - 1, 51, 3, 10, 'clay')
            .rect(farFoot - 2, 60, 7, 3, 'orange')
            .set(farFoot + 5, 62, 'orange')
            .ellipse(32, 53 - bob, 23, 4, 'gold')
            .line(12, 40 - bob, 4, 29 + wag, 'gold')
            .line(5, 30 + wag, 7, 44 - bob, 'yellow')
            .ellipse(30, 40 - bob, 25, 15, 'gold')
            .ellipse(30, 37 - bob, 24, 13, 'yellow')
            .ellipse(47, 24 - bob, 12, 18, 'gold')
            .ellipse(47, 20 - bob, 13, 15, 'yellow')
            .ellipse(60, 26 - bob, 9, 5, 'orange')
            .line(57, 28 - bob, 67, 28 - bob, 'clay')
            .ellipse(61, 24 - bob, 7, 2, 'gold')
            .ellipse(51, 18 - bob, 3, 4, 'ink')
            .set(52, 16 - bob, 'white')
            .ellipse(43, 10 - bob, 4, 2, 'cream')
            .ellipse(22, 31 - bob, 9, 3, 'cream')
            .ellipse(29, 40 - bob, 12, 7, 'gold')
            .ellipse(28, 38 - bob, 11, 6, 'yellow')
            .line(21, 40 - bob, 26, 43 - bob, 'gold')
            .line(26, 43 - bob, 34, 41 - bob, 'gold')
            .rect(nearFoot - 1, 53 - bob, 3, 11, 'orange')
            .rect(nearFoot - 2, 62, 8, 3, 'orange')
            .line(nearFoot, 62, nearFoot + 4, 62, 'gold')
            .set(nearFoot + 6, 64, 'orange');
        canvas.blit(pc.outline('ink'), frame * DUCK_WIDTH, 0);
    }
    return { canvas, frames: stripFrames(4, DUCK_WIDTH, DUCK_HEIGHT) };
}
