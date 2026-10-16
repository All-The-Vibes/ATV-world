import { PixelCanvas, type FrameRect } from '../../kit';

const W = 32;
const H = 44;
const CYAN = '#60fff2';
const PINK = '#ff52cf';

/** Original fuzzy puppet and retro hoverboard; feet stay planted while the suit bobs. */
export function vicsSheet(neon = false): { canvas: PixelCanvas; frames: FrameRect[] } {
    const canvas = new PixelCanvas(W * 3, H);
    const frames: FrameRect[] = [];
    for (let f = 0; f < 3; f++) {
        const p = new PixelCanvas(W, H);
        const bob = f === 1 ? -1 : 0;
        if (!neon) {
            p.ellipse(15, 12 + bob, 10, 8, '#9f62cc');
            p.rect(6, 6 + bob, 2, 3, '#bd86e9').rect(10, 3 + bob, 2, 4, '#bd86e9');
            p.rect(15, 2 + bob, 2, 4, '#bd86e9').rect(21, 4 + bob, 2, 3, '#bd86e9');
            p.ellipse(11, 10 + bob, 4, 4, 'white').ellipse(20, 10 + bob, 4, 4, 'white');
            p.rect(12, 9 + bob, 2, 3, 'ink').rect(21, 9 + bob, 2, 3, 'ink');
            p.ellipse(17, 15 + bob, 7, 3, '#38183f').rect(14, 17 + bob, 6, 1, 'pink');
            p.ellipse(18, 13 + bob, 3, 2, 'orange');
            p.rect(9, 21 + bob, 14, 10, '#182648').rect(7, 23 + bob, 3, 8, '#9f62cc');
            p.rect(23, 23 + bob, 3, 8, '#9f62cc');
            p.rect(10, 30 + bob, 5, 6 - bob, '#182648').rect(18, 30 + bob, 5, 6 - bob, '#182648');
            p.rect(9, 35, 7, 2, 'white').rect(18, 35, 7, 2, 'white');
            p.rect(4, 37, 24, 3, '#b82d83').rect(2, 36, 4, 2, 'pink');
            p.rect(27, 35, 3, 3, 'pink').rect(8, 37, 15, 1, 'cream');
            p.rect(7, 40, 5, 2, 'slate').rect(22, 40, 5, 2, 'slate');
        }
        p.line(10, 22 + bob, 22, 22 + bob, CYAN);
        p.line(10, 22 + bob, 10, 29 + bob, CYAN).line(22, 22 + bob, 22, 29 + bob, CYAN);
        p.rect(13, 25 + bob, 7, 2, PINK).set(16, 24 + bob, 'white');
        p.line(11, 31 + bob, 11, 34, CYAN).line(21, 31 + bob, 21, 34, PINK);
        p.rect(7, 25 + bob, 2, 2, CYAN).rect(24, 25 + bob, 2, 2, PINK);
        p.rect(9, 36, 7, 1, CYAN).rect(18, 36, 7, 1, PINK);
        p.rect(6, 39, 20, 1, PINK);
        p.rect(8, 41, 3, f === 2 ? 1 : 2, CYAN).rect(23, 41, 3, f === 1 ? 1 : 2, CYAN);
        if (!neon) p.outline('ink');
        canvas.blit(p, f * W, 0);
        frames.push({ name: `side-${f}`, x: f * W, y: 0, w: W, h: H });
    }
    return { canvas, frames };
}
