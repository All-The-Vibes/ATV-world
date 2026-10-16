import type { Color } from './palette';
import type { PixelCanvas } from './pixels';

/**
 * A 3x5 pixel font for painting short labels straight into textures (signs, crates, screens).
 * Each glyph is 15 bits, row by row. Add or replace glyphs freely: `MINI_GLYPHS['♥'] = '000101111111010'`.
 */
export const MINI_GLYPHS: Record<string, string> = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    ' ': '000000000000000', '!': '010010010000010', '?': '110001010000010', '.': '000000000000010',
    ',': '000000000010100', '-': '000000111000000', ':': '000010000010000', "'": '010010000000000',
    '&': '010101010101011', '+': '000010111010000', '/': '001001010100100', '#': '101111101111101',
    '*': '000101010101000', '(': '010100100100010', ')': '010001001001010', '<': '001010100010001',
    '>': '100010001010100', '=': '000111000111000', '_': '000000000000111', '$': '010110010011010',
    '%': '101001010100101',
};

export const MINI_FONT_HEIGHT = 5;

/** Width in pixels of `text` drawn with the mini font (3px glyphs + 1px spacing). */
export const miniTextWidth = (text: string) => Math.max(0, text.length * 4 - 1);

/** Paint `text` at (x, y). Lowercase letters fall back to uppercase glyphs; unknown characters render as blanks. */
export function miniText(pc: PixelCanvas, x: number, y: number, text: string, color: Color): PixelCanvas {
    for (let i = 0; i < text.length; i++) {
        const g = MINI_GLYPHS[text[i]] ?? MINI_GLYPHS[text[i].toUpperCase()];
        if (!g) continue;
        for (let k = 0; k < 15; k++) if (g[k] === '1') pc.set(x + i * 4 + (k % 3), y + Math.floor(k / 3), color);
    }
    return pc;
}
