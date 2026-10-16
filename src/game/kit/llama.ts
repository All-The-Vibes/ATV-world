import { PixelCanvas } from './pixels';
import { stripFrames } from './textures';

export function llamaSheet() {
    const width = 40, height = 44;
    const canvas = new PixelCanvas(width * 4, height);
    for (let frame = 0; frame < 4; frame++) {
        const pc = new PixelCanvas(width, height);
        const step = [-2, 0, 2, 0][frame];
        const bob = frame % 2;
        // Far legs move opposite the near pair.
        for (const x of [11, 24]) {
            pc.line(x, 30, x - step, 39, 'sand')
                .rect(x - step - 1, 39, 3, 2, 'bark');
        }
        pc.line(7, 28 - bob, 3, 23 - bob, 'cream')
            .ellipse(18, 28 - bob, 12, 7, 'cream')
            .ellipse(17, 26 - bob, 10, 5, 'white')
            .rect(26, 12 - bob, 6, 18, 'cream')
            .rect(27, 13 - bob, 3, 15, 'white')
            .rect(27, 3 - bob, 3, 8, 'cream')
            .rect(33, 2 - bob, 3, 9, 'cream')
            .line(28, 4 - bob, 28, 7 - bob, 'peach')
            .line(34, 3 - bob, 34, 7 - bob, 'peach')
            .ellipse(31, 12 - bob, 6, 5, 'white')
            .rect(34, 13 - bob, 4, 3, 'cream')
            .set(34, 10 - bob, 'ink')
            .set(37, 14 - bob, 'bark')
            .rect(25, 19 - bob, 8, 3, 'blue')
            .rect(25, 20 - bob, 3, 8, 'sky');
        for (const x of [9, 22]) {
            pc.line(x, 31 - bob, x + step, 40, 'cream')
                .rect(x + step - 1, 40, 4, 2, 'bark');
        }
        pc.set(9, 25 - bob, 'cream').set(15, 23 - bob, 'cream').set(21, 25 - bob, 'cream');
        canvas.blit(pc.outline('ink'), frame * width, 0);
    }
    return { canvas, frames: stripFrames(4, width, height) };
}
