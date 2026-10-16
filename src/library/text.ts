/**
 * Turns a Project Gutenberg plain-text eBook into structured blocks for the paged reader.
 * Every block keeps its [start, end) offsets so the original text, front matter, and license stay lossless.
 */
export type Heading = { type: 'heading'; level: 0 | 1 | 2; label: string; title: string };
export type Block = { start: number; end: number } & (
    | Heading
    | { type: 'para'; text: string; quote?: boolean }
    | { type: 'verse'; lines: { indent: number; text: string }[] }
    | { type: 'break' }
    | { type: 'art'; caption: string }
);
export type Chapter = { title: string; level: 0 | 1; index: number };
export type ParsedText = {
    source: string;
    front: Block[];
    body: Block[];
    back: Block[];
    chapters: Chapter[];
    meta: { title?: string; author?: string; released?: string; language?: string; copyrighted: boolean };
};

const NUMWORD = '(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY|FIFTY|SIXTY|SEVENTY|EIGHTY|NINETY|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|LAST)';
const NUM = `(?:[IVXLCDM]+|\\d+|${NUMWORD}(?:[- ]${NUMWORD})?)`;
const KEYWORD = new RegExp(`^(?:CHAPTER|STAVE|BOOK|PART|LETTER|VOLUME|ACT)\\.?\\s+${NUM}\\b\\.?(?=$|[\\s.:—–-])`, 'i');
const STANDALONE = /^(?:PREFACE|INTRODUCTION|PROLOGUE|EPILOGUE|CONCLUSION|POSTSCRIPT|AFTERWORD|FOREWORD|APPENDIX)\b\.?$/i;
const NUMERAL = /^(?:[IVXLC]+|\d{1,3})\.?$/;
const ROMAN_TITLE = /^([IVXLC]+)\.\s+([^a-z]{3,})$/;
const START = /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG E(?:BOOK|TEXT)[^\n]*$/im;
// Pre-2002 texts put the license first and end it with "*END*THE SMALL PRINT!" or "*END THE SMALL PRINT!".
const SMALL_PRINT = /^\*END\*?\s*THE SMALL PRINT[^\n]*$/im;
const END = /^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG E(?:BOOK|TEXT)[^\n]*$/im;
const END_NOTE = /^End of (?:the )?Project Gutenberg[^\n]*$/im;
const OLD_TITLE = /^\**\s*The Project Gutenberg E(?:text|Book) of (.+?), by (.+?)\s*\**$/im;

/** True when the text carries a Project Gutenberg start-of-book marker, old or new. */
export const hasGutenbergStart = (text: string) => START.test(text) || SMALL_PRINT.test(text);

export const normalize = (text: string) => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

type Raw = { start: number; end: number; lines: string[] };

function splitBlocks(src: string, a: number, b: number): Raw[] {
    const out: Raw[] = [];
    let i = a;
    let current: Raw | null = null;
    while (i < b) {
        let j = src.indexOf('\n', i);
        if (j < 0 || j > b) j = b;
        const line = src.slice(i, j);
        if (line.trim()) {
            if (!current) {
                current = { start: out.length ? i : a, end: j, lines: [] };
                if (out.length) out[out.length - 1].end = i;
                out.push(current);
            }
            current.lines.push(line);
        } else {
            current = null;
        }
        i = j + 1;
    }
    if (out.length) out[out.length - 1].end = b;
    // Illustration captions can span blank lines; keep them in one block until the bracket closes.
    for (let k = 0; k < out.length - 1; k++) {
        const text = out[k].lines.join('\n');
        if (!/^\s*\[Illustration/i.test(text)) continue;
        let depth = (text.match(/\[/g)?.length ?? 0) - (text.match(/\]/g)?.length ?? 0);
        while (depth > 0 && k + 1 < out.length && out[k].lines.length < 60) {
            const next = out.splice(k + 1, 1)[0];
            const nextText = next.lines.join('\n');
            depth += (nextText.match(/\[/g)?.length ?? 0) - (nextText.match(/\]/g)?.length ?? 0);
            out[k].lines.push('', ...next.lines);
            out[k].end = next.end;
        }
    }
    return out;
}

const indentOf = (line: string) => line.length - line.trimStart().length;
const clean = (line: string) => line.trim().replace(/\s{2,}/g, ' ');
const capsLine = (line: string) => {
    const t = line.trim();
    return t.length <= 48 && /^[A-Z0-9 ,'’‘“”.&:;—–-]+$/.test(t) && (t.match(/[A-Z]/g)?.length ?? 0) >= 4 && !/[,;:]$/.test(t);
};

function heading(raw: Raw): Heading | null {
    const lines = raw.lines.filter(line => line.trim());
    if (lines.length > 3 || lines.some(line => line.trim().length > 72)) return null;
    // Indented multi-line blocks are tables of contents, not headings.
    if (lines.length > 1 && lines.every(line => indentOf(line) >= 4)) return null;
    const first = clean(lines[0]);
    const rest = lines.slice(1).map(clean).join(' ');
    const keyword = KEYWORD.exec(first);
    if (keyword) {
        const label = keyword[0].replace(/[\s.:—–-]+$/, '');
        const inline = first.slice(keyword[0].length).replace(/^[\s.:—–-]+/, '').trim();
        const title = [inline, rest].filter(Boolean).join(' ');
        return { type: 'heading', level: /^(?:PART|BOOK|VOLUME)/i.test(first) ? 0 : 1, label, title };
    }
    if (STANDALONE.test(first) && lines.length === 1) return { type: 'heading', level: 1, label: first.replace(/\.$/, ''), title: '' };
    const roman = ROMAN_TITLE.exec(first);
    if (roman && lines.length === 1 && first.length <= 64) return { type: 'heading', level: 1, label: `${roman[1]}.`, title: roman[2].trim() };
    if (NUMERAL.test(first)) {
        if (!rest) return { type: 'heading', level: 2, label: first, title: '' };
        if (rest.length <= 72 && lines.length === 2 && !/[,;]$/.test(rest)) return { type: 'heading', level: 1, label: first, title: rest };
    }
    return null;
}

function classify(src: string, raw: Raw, inBody: boolean): Block[] {
    const { start, end } = raw;
    const lines = raw.lines;
    const joined = lines.map(line => line.trim()).join(' ');
    if (lines.length === 1 && /^\s*(?:\*\s*){3,}$/.test(lines[0])) return [{ start, end, type: 'break' }];
    if (/^\s*\[Illustration/i.test(lines[0])) {
        const caption = joined.replace(/^\[Illustration:?\s*/i, '').replace(/\]\s*$/, '').trim();
        const chapter = /(?:CHAPTER|Chapter)\s+[IVXLC\d]+\.?$/.exec(caption);
        if (inBody && chapter) {
            const offset = src.lastIndexOf(chapter[0], end);
            const label = chapter[0].replace(/\.$/, '');
            const before = caption.slice(0, chapter.index).replace(/^[·\s]+|[·\s]+$/g, '');
            if (offset > start) return [
                { start, end: offset, type: 'art', caption: before },
                { start: offset, end, type: 'heading', level: 1, label, title: '' },
            ];
        }
        return [{ start, end, type: 'art', caption }];
    }
    if (inBody) {
        const h = heading(raw);
        if (h) return [{ start, end, ...h }];
    }
    const min = Math.min(...lines.map(indentOf));
    const lengths = lines.map(line => line.trim().length);
    const allIndented = lines.every(line => indentOf(line) >= 2);
    const prose = lines.length >= 3 && lengths.slice(0, -1).every(length => length >= 48);
    if (allIndented && prose) return [{ start, end, type: 'para', text: joined, quote: true }];
    const short = lines.length >= 2 && lengths.every(length => length < 44);
    const broken = lines.length >= 2 && lengths.slice(0, -1).some(length => length < 30) && lengths.every(length => length < 56);
    if (allIndented || short || broken) {
        return [{ start, end, type: 'verse', lines: lines.map(line => ({ indent: Math.min(12, indentOf(line) - min), text: line.trim() })) }];
    }
    return [{ start, end, type: 'para', text: joined }];
}

function region(src: string, a: number, b: number, inBody: boolean): Block[] {
    return splitBlocks(src, a, b).flatMap(raw => classify(src, raw, inBody));
}

export function parseGutenberg(input: string): ParsedText {
    const source = normalize(input);
    const start = START.exec(source) ?? SMALL_PRINT.exec(source);
    const bodyStart = start ? start.index + start[0].length + 1 : 0;
    const endMatch = new RegExp(END.source, 'im');
    const tail = source.slice(bodyStart);
    const end = endMatch.exec(tail);
    let bodyEnd = end ? bodyStart + end.index : source.length;
    const note = END_NOTE.exec(tail);
    if (note && bodyStart + note.index < bodyEnd && bodyEnd - (bodyStart + note.index) < 700) bodyEnd = bodyStart + note.index;
    const front = region(source, 0, Math.min(bodyStart, source.length), false);
    const body = region(source, Math.min(bodyStart, source.length), bodyEnd, true);
    const back = region(source, bodyEnd, source.length, false);
    tidyHeadings(body);
    const chapters: Chapter[] = [];
    body.forEach((block, index) => {
        if (block.type === 'heading' && block.level < 2) chapters.push({ title: [block.label, block.title].filter(Boolean).join(' · '), level: block.level === 0 ? 0 : 1, index });
    });
    const header = source.slice(0, bodyStart);
    const field = (name: string) => new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(header)?.[1]?.trim();
    const old = OLD_TITLE.exec(header);
    return {
        source, front, body, back, chapters,
        meta: {
            title: field('Title') ?? old?.[1]?.trim(),
            author: field('Author') ?? old?.[2]?.replace(/^by\s+/i, '').trim(),
            released: field('Release [Dd]ate') ?? /^([A-Z][a-z]+,? \d{4})\s+\[E(?:text|Book) #\d+\]/m.exec(header)?.[1],
            language: field('Language'),
            copyrighted: /Copyrighted Project Gutenberg/i.test(header),
        },
    };
}

/** Demote headings that are really table-of-contents lines, and fold caps subtitles into their chapter. */
function tidyHeadings(body: Block[]) {
    for (let i = 0; i < body.length; i++) {
        const block = body[i];
        if (block.type !== 'heading') continue;
        const next = body[i + 1];
        if (next?.type === 'heading' && next.level === block.level && block.level < 2) {
            body[i] = { start: block.start, end: block.end, type: 'verse', lines: [{ indent: 0, text: [block.label, block.title].filter(Boolean).join(' ') }] };
            continue;
        }
        const subtitle = next?.type === 'para' ? next.text : next?.type === 'verse' && next.lines.length === 1 ? next.lines[0].text : '';
        if (block.level === 1 && !block.title && subtitle && capsLine(subtitle) && body[i + 2]?.type !== 'heading') {
            body.splice(i, 2, { start: block.start, end: next.end, type: 'heading', level: 1, label: block.label, title: subtitle.trim() });
        }
    }
}

/** Plain display text of a block, used for accessibility, search, and lossless checks. */
export function blockText(block: Block): string {
    switch (block.type) {
        case 'heading': return [block.label, block.title].filter(Boolean).join(' ');
        case 'para': return block.text;
        case 'verse': return block.lines.map(line => line.text).join('\n');
        case 'art': return block.caption;
        case 'break': return '* * *';
    }
}
