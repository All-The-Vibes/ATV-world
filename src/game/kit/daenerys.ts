import { PixelCanvas } from './pixels';
import type { characterSheet } from './characters';

/** Silver braids, a pleated gray gown, and the little green shoulder dragon from the reference. */
export function daenerysSheet(): ReturnType<typeof characterSheet> {
    const width = 26, height = 32;
    const canvas = new PixelCanvas(width * 3, height);
    const frames: ReturnType<typeof characterSheet>['frames'] = [];
    for (let frame = 0; frame < 3; frame++) {
        const step = [0, -1, 1][frame];
        const p = new PixelCanvas(width, height);

        // Loose silver hair streams behind her, independently of the skirt.
        p.line(10, 7, 6, 18, 'mist').line(9, 9, 4 + step, 21, 'cloud')
            .line(8, 12, 3 + step, 24, 'mist').line(9, 11, 6 + step, 24, 'white')
            .line(10, 12, 8 + step, 25, 'cloud');

        p.rect(11, 11, 6, 7, 'steel').line(11, 12, 10, 17, 'slate')
            .line(15, 12, 16, 17, 'mist').rect(10, 17, 7, 2, 'slate')
            .set(14, 17, 'cloud');
        for (let y = 19; y <= 29; y++) {
            const flare = Math.floor((y - 18) / 3);
            const sway = y > 24 ? step : 0;
            p.rect(10 - flare + sway, y, 8 + flare * 2, 1, 'steel')
                .set(10 - flare + sway, y, 'slate')
                .set(12 - Math.floor(flare / 2) + sway, y, 'mist')
                .set(14 + sway, y, 'cloud')
                .set(15 + sway, y, 'slate')
                .set(17 + flare + sway, y, 'slate');
        }
        p.line(6 + step, 29, 3 + step, 29, 'steel')
            .line(7 + step, 30, 18 + step, 30, 'slate')
            .rect(12 + step * 2, 30, 3, 1, 'earth');

        p.ascii(9, 1, [
            '..hHHHh...',
            '.hHWHHHh..',
            'hHHhhHHHh.',
            'hHhkKKKk..',
            'hHhkKKik..',
            'hHhkKKKkk.',
            'hHhhkKKk..',
            'hHHhkKk...',
            '.hHHkks...',
            '.hWHhss...',
            '.hHHhss...',
            '.hWHhss...',
            '.hHHhss...',
            '.hWHhss...',
            '.hHHhss...',
            '.hWHh.....',
            '..hHh.....',
            '..hWh.....',
            '...hH.....',
        ], { h: 'mist', H: 'cloud', W: 'white', k: 'clay', K: 'peach', i: 'ink', s: 'steel' });

        // Bare forearm and leather cuff swing with the two walk steps.
        p.line(17, 12, 17 - step, 16, 'clay')
            .line(18, 12, 18 - step, 16, 'peach')
            .line(17 - step, 17, 19 + step, 18, 'earth')
            .rect(19 + step, 18, 2, 2, 'peach');

        p.ascii(2, 7 + (frame === 2 ? 1 : 0), [
            'g...........',
            'gg......g...',
            'glgg...glg..',
            '.gllgggGlgg.',
            '..gllgGGGiG.',
            '...ggGGGGG..',
            '....gGGg....',
            '....gGgg....',
            '...gG..g....',
            '..gg........',
        ], { g: 'forest', G: 'leaf', l: 'grass', i: 'yellow' });
        p.outline('ink');
        canvas.blit(p, frame * width, 0);
        frames.push({ name: `side-${frame}`, x: frame * width, y: 0, w: width, h: height });
    }
    return { canvas, frames };
}
