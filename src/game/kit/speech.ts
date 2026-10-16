import { MINI_FONT_HEIGHT, miniText, miniTextWidth } from './font';
import { PixelCanvas } from './pixels';

/** Break `text` into lines of at most `maxChars` characters (long words get their own line). */
export function wrapWords(text: string, maxChars: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line && line.length + 1 + word.length > maxChars) {
            lines.push(line);
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    if (line) lines.push(line);
    return lines;
}

/** A white speech bubble with a tail at the bottom middle, wrapping onto several lines in the mini font. */
export function speechArt(text: string, maxChars = 20): PixelCanvas {
    const lines = wrapWords(text, maxChars);
    const tw = Math.max(...lines.map(miniTextWidth));
    const w = tw + 8;
    const bodyH = lines.length * (MINI_FONT_HEIGHT + 2) + 4;
    const pc = new PixelCanvas(w + 2, bodyH + 5);
    pc.rect(2, 1, w - 2, bodyH, 'white').rect(1, 2, w, bodyH - 2, 'white');
    const cx = Math.floor((w + 2) / 2);
    pc.rect(cx - 1, bodyH + 1, 3, 1, 'white').set(cx, bodyH + 2, 'white');
    lines.forEach((line, i) => {
        miniText(pc, 1 + Math.floor((w - miniTextWidth(line)) / 2), 4 + i * (MINI_FONT_HEIGHT + 2), line, 'ink');
    });
    return pc.outline('ink');
}
