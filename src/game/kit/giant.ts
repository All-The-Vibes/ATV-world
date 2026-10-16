import { PixelCanvas } from './pixels';
import { stripFrames } from './textures';

export const GIANT_W = 44;
export const GIANT_H = 78;

/** A giant facing us with his mouth wide open, stomping: 4 frames (left foot, passing, right foot, passing). */
export function giantSheet() {
    const canvas = new PixelCanvas(GIANT_W * 4, GIANT_H);
    for (let frame = 0; frame < 4; frame++) {
        const pc = new PixelCanvas(GIANT_W, GIANT_H);
        const lift = [3, 0, 0, 0][frame];
        const liftR = [0, 0, 3, 0][frame];
        const bob = frame % 2;

        // Legs and boots.
        pc.rect(12, 50, 9, 22 - lift, 'navy').rect(11, 71 - lift, 11, 5, 'bark');
        pc.rect(23, 50, 9, 22 - liftR, 'navy').rect(22, 71 - liftR, 11, 5, 'bark');
        pc.rect(12, 50, 3, 20 - lift, 'blue').rect(23, 50, 3, 20 - liftR, 'blue');

        // Torso, belt, and arms (one swinging, one cupped to the mouth for shouting).
        pc.rect(9, 21 - bob, 26, 30, 'red').rect(9, 21 - bob, 8, 30, 'orange').rect(27, 21 - bob, 8, 30, 'wine');
        pc.rect(9, 47 - bob, 26, 4, 'bark').rect(20, 47 - bob, 4, 4, 'gold');
        pc.rect(3, 23 - bob, 7, 22 + bob, 'red').rect(3, 44, 7, 6, 'peach');
        pc.rect(34, 23 - bob, 7, 10, 'red').rect(37, 15 - bob, 5, 10, 'peach').rect(35, 12 - bob, 7, 4, 'peach');

        // Head: beard, hair, angry brows, and a big open mouth.
        pc.ellipse(22, 12 - bob, 10, 11, 'peach');
        pc.ellipse(22, 19 - bob, 9, 5, 'earth');
        pc.ellipse(22, 3 - bob, 11, 5, 'earth').rect(11, 3 - bob, 22, 3, 'earth');
        pc.rect(13, 8 - bob, 6, 2, 'ink').rect(25, 8 - bob, 6, 2, 'ink');
        pc.rect(15, 11 - bob, 3, 3, 'white').rect(26, 11 - bob, 3, 3, 'white');
        pc.set(17, 12 - bob, 'ink').set(26, 12 - bob, 'ink');
        pc.rect(16, 16 - bob, 12, 7, 'ink').rect(18, 20 - bob, 8, 3, 'red');
        pc.rect(18, 16 - bob, 8, 1, 'white');
        canvas.blit(pc.outline('ink'), frame * GIANT_W, 0);
    }
    return { canvas, frames: stripFrames(4, GIANT_W, GIANT_H) };
}
