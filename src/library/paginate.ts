/**
 * Lays parsed book text out into fixed-size pages, like a typesetter.
 * Measurement is injected so layout matches the reader's fonts in the browser and stays testable in Node.
 */

/** Marks an italic toggle inside line text (Gutenberg writes italics as _words_). */
export const TOGGLE = '\u0001';

export type Style = 'body' | 'italic' | 'small' | 'smallItalic' | 'title' | 'titleItalic' | 'label' | 'cap';
type Base = 'body' | 'small' | 'title' | 'label';
const ITALIC: Record<Base, Style> = { body: 'italic', small: 'smallItalic', title: 'titleItalic', label: 'label' };

export type Metrics = {
    /** Width in px of `text` set in `style`. */
    measure: (text: string, style: Style) => number;
    /** Text box of one page. */
    width: number;
    height: number;
    /** Body font size and line heights in px. */
    size: number;
    line: number;
    smallLine: number;
    titleLine: number;
    labelLine: number;
};

export type LayoutBlock =
    | { type: 'heading'; level: 0 | 1 | 2; label: string; title: string }
    | { type: 'para'; text: string; quote?: boolean }
    | { type: 'verse'; lines: { indent: number; text: string }[] }
    | { type: 'break' }
    | { type: 'art'; caption: string }
    | { type: 'link'; text: string; href: string };

export type Flow = {
    id: string;
    /** Running head for pages before the first chapter heading. */
    head: string;
    blocks: LayoutBlock[];
    /** Chapter-style opening: a small label and an optional display title. */
    opener?: { label: string; title?: string };
    /** Level 0 and 1 headings open new pages, get drop caps, and enter the contents. */
    chapters?: boolean;
    /** Contents entry for the flow itself. */
    toc?: string;
    /** In two-page mode, start on a right-hand page. */
    recto?: boolean;
    /** Pages from the first numbered flow onward get page numbers. */
    numbered?: boolean;
    /** Generate the table of contents here instead of laying out blocks. */
    contents?: boolean;
    /** Set the flow in small type. */
    small?: boolean;
};

export type Row = {
    kind: 'line' | 'cap' | 'label' | 'title' | 'orn' | 'toc' | 'link' | 'caption';
    x: number;
    y: number;
    w: number;
    h: number;
    /** One line of text: words separated by single spaces, italics marked with TOGGLE. */
    text?: string;
    lines?: string[];
    justify?: boolean;
    center?: boolean;
    small?: boolean;
    href?: string;
    entry?: number;
    target?: number;
    folio?: string;
    level?: 0 | 1;
};

export type PageKind = 'endpaper' | 'title' | 'colophon' | 'text' | 'blank';
export type Page = {
    kind: PageKind;
    rows: Row[];
    /** Reading position of the first thing on the page; blank pages have -1. */
    pos: number;
    flow: string;
    head: string;
    /** Chapter opening pages carry no running head. */
    opener: boolean;
    folio: string;
};
export type Entry = { text: string; level: 0 | 1; page: number; folio: string };
export type Paged = {
    pages: Page[];
    entries: Entry[];
    /** First page of each flow, by id. */
    flows: Record<string, number>;
};

type Item = {
    row?: Omit<Row, 'y'>;
    h: number;
    pos: number;
    /** Optional space, dropped at the top of a page. */
    spacer?: boolean;
    breakBefore?: boolean;
    breakAfter?: boolean;
    /** Keep with this many following items. */
    keep?: number;
    head?: string;
    opener?: boolean;
    entry?: number;
};

type Tok = { text: string; glue: boolean; word: number };
type Line = { text: string; width: number; gaps: number; word: number; last: boolean };

const FLOW = 1e10;
const BLOCK = 1e5;

/** Turns Gutenberg conventions into display text: -- becomes an em dash and single underscores toggle italics. */
export function prepare(text: string) {
    return text.replace(/--/g, '—').replace(/_+/g, run => (run.length === 1 ? TOGGLE : run));
}

export function tokenize(text: string): Tok[] {
    const out: Tok[] = [];
    prepare(text).split(/[ \t\n\r]+/).filter(Boolean).forEach((word, index) => {
        // Allow a line break after an em dash that joins two words.
        word.split(/(?<=[^—]—+)(?=[^—])/).forEach((part, j) => out.push({ text: part, glue: j > 0, word: index }));
    });
    return out;
}

/** Splits rendered line text into words of italic and roman segments. */
export function segments(text: string, italic = false): { text: string; italic: boolean }[][] {
    return text.split(' ').map(word => {
        const parts: { text: string; italic: boolean }[] = [];
        word.split(TOGGLE).forEach((part, index) => {
            if (index) italic = !italic;
            if (part) parts.push({ text: part, italic });
        });
        return parts;
    });
}

/** Plain text of a line, without italic marks. */
export const plain = (text: string) => text.split(TOGGLE).join('');

class Measurer {
    private cache = new Map<string, number>();
    private fn: Metrics['measure'];
    constructor(fn: Metrics['measure']) {
        this.fn = fn;
    }

    get(text: string, style: Style) {
        const key = style + '\u0000' + text;
        let width = this.cache.get(key);
        if (width === undefined) {
            width = this.fn(text, style);
            this.cache.set(key, width);
        }
        return width;
    }

    run(text: string, base: Base, italic: boolean) {
        let width = 0;
        const parts = text.split(TOGGLE);
        for (let i = 0; i < parts.length; i++) {
            if (i) italic = !italic;
            if (parts[i]) width += this.get(parts[i], italic ? ITALIC[base] : base);
        }
        return { width, italic };
    }
}

function wrap(toks: Tok[], avail: (line: number) => number, base: Base, m: Measurer, startItalic = false): Line[] {
    const lines: Line[] = [];
    const space = m.get(' ', base);
    let italic = startItalic;
    let lineItalic = italic;
    let parts: string[] = [];
    let width = 0;
    let gaps = 0;
    let word = toks[0]?.word ?? 0;
    const flush = (last: boolean) => {
        lines.push({ text: (lineItalic ? TOGGLE : '') + parts.join(''), width, gaps, word, last });
        parts = [];
        width = 0;
        gaps = 0;
        lineItalic = italic;
    };
    for (const tok of toks) {
        let text = tok.text;
        let run = m.run(text, base, italic);
        const gap = parts.length && !tok.glue ? space : 0;
        if (parts.length && width + gap + run.width <= avail(lines.length) + 0.01) {
            if (gap) {
                parts.push(' ');
                gaps++;
            }
            parts.push(text);
            width += gap + run.width;
            italic = run.italic;
            continue;
        }
        if (parts.length) flush(false);
        word = tok.word;
        // A word wider than the line is split between characters.
        while (run.width > avail(lines.length) + 0.01) {
            const chars = Array.from(text);
            let fit = 1;
            while (fit < chars.length - 1 && m.run(chars.slice(0, fit + 1).join(''), base, italic).width <= avail(lines.length)) fit++;
            const head = chars.slice(0, fit).join('');
            const headRun = m.run(head, base, italic);
            parts.push(head);
            width = headRun.width;
            italic = headRun.italic;
            flush(false);
            text = chars.slice(fit).join('');
            run = m.run(text, base, italic);
            if (!text) break;
        }
        if (!text) continue;
        parts.push(text);
        width = run.width;
        italic = run.italic;
    }
    if (parts.length) flush(true);
    return lines;
}

/** Index of the first page at or before a saved reading position. */
export function findPage(pages: Page[], pos: number) {
    let found = -1;
    pages.forEach((page, index) => {
        if (page.kind !== 'blank' && page.pos <= pos && (found < 0 || page.pos >= pages[found].pos)) found = index;
    });
    return Math.max(0, found);
}

const headingText = (label: string, title: string) => [label, title].filter(Boolean).join(' · ');

export function paginate(input: { flows: Flow[]; spreads: boolean; metrics: Metrics; title?: boolean; colophon?: boolean }): Paged {
    const { flows, spreads, metrics: mt } = input;
    const m = new Measurer(mt.measure);
    const W = mt.width;
    const H = mt.height;
    const L = mt.line;
    const indent = Math.round(mt.size * 1.25);
    const inset = Math.round(mt.size * 1.5);

    // Contents entries are known before layout; their page numbers are filled in afterwards.
    const entries: (Entry & { key: string })[] = [];
    flows.forEach((flow, f) => {
        if (flow.toc) entries.push({ text: flow.toc, level: 0, page: -1, folio: '', key: `${f}:open` });
        if (!flow.chapters) return;
        flow.blocks.forEach((block, b) => {
            if (block.type === 'heading' && block.level < 2) entries.push({ text: headingText(block.label, block.title), level: block.level === 0 ? 0 : 1, page: -1, folio: '', key: `${f}:${b}` });
        });
    });
    const hasParts = entries.some(entry => entry.level === 0 && !entry.key.endsWith(':open'));
    const entryIndex = new Map(entries.map((entry, index) => [entry.key, index]));

    const pages: Page[] = [];
    const firstPage: Record<string, number> = {};
    let page: Page | null = null;
    let y = 0;
    let head = '';
    let wantRecto = false;
    let flowId = '';

    const fixed = (kind: PageKind, pos: number) => {
        pages.push({ kind, rows: [], pos, flow: kind, head: '', opener: true, folio: '' });
        page = null;
    };
    const open = (pos: number) => {
        if (spreads && wantRecto && pages.length % 2 === 0) pages.push({ kind: 'blank', rows: [], pos: -1, flow: flowId, head: '', opener: true, folio: '' });
        wantRecto = false;
        const next: Page = { kind: 'text', rows: [], pos, flow: flowId, head, opener: false, folio: '' };
        pages.push(next);
        if (firstPage[flowId] === undefined) firstPage[flowId] = pages.length - 1;
        page = next;
        y = 0;
        return next;
    };

    const place = (items: Item[]) => {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.breakBefore && page && (page.rows.length || y > 0)) page = null;
            if (page) {
                let need = item.h;
                for (let k = 1; k <= (item.keep ?? 0) && i + k < items.length; k++) need += items[i + k].h;
                if (y + need > H + 0.5) page = null;
            }
            let current: Page | null = page;
            if (!current) {
                if (item.spacer) continue;
                current = open(item.pos);
            }
            if (item.head !== undefined) head = item.head;
            if (item.opener) current.opener = true;
            if (item.row) current.rows.push({ ...item.row, y });
            if (item.entry !== undefined) entries[item.entry].page = pages.length - 1;
            y += item.h;
            if (item.breakAfter) page = null;
        }
    };

    const opener = (label: string, title: string, level: 0 | 1, pos: number, runningHead: string, entry?: number): Item[] => {
        const labelLines = wrap(tokenize(label.toUpperCase()), () => W, 'label', m).map(line => line.text);
        const items: Item[] = [
            { h: Math.round(H * (level === 0 ? 0.24 : 0.08)), pos, breakBefore: true, opener: true, head: runningHead, entry },
            { row: { kind: 'label', x: 0, w: W, h: labelLines.length * mt.labelLine, lines: labelLines }, h: labelLines.length * mt.labelLine, pos },
        ];
        if (title) {
            const lines = wrap(tokenize(title), () => Math.round(W * 0.88), 'title', m).map(line => line.text);
            items.push({ h: Math.round(L * 0.5), pos });
            items.push({ row: { kind: 'title', x: 0, w: W, h: lines.length * mt.titleLine, lines }, h: lines.length * mt.titleLine, pos });
        }
        const orn = Math.round(L * 1.5);
        items.push({ row: { kind: 'orn', x: 0, w: W, h: orn }, h: orn, pos, breakAfter: level === 0 });
        if (level === 1) items.push({ h: Math.round(L * 0.5), pos });
        return items;
    };

    const para = (text: string, pos: number, opts: { quote?: boolean; first: boolean; drop: boolean; small: boolean }): Item[] => {
        const base: Base = opts.small ? 'small' : 'body';
        const lh = opts.small ? mt.smallLine : L;
        const x0 = opts.quote ? inset : 0;
        const w0 = W - (opts.quote ? inset * 2 : 0);
        let toks = tokenize(text);
        if (!toks.length) return [];
        const items: Item[] = [];
        let capWidth = 0;
        let capText = '';
        if (opts.drop && !opts.quote) {
            const first = toks[0];
            const match = /^((?:\u0001)*)([“"‘'(\[]*)([\p{L}\p{N}])/u.exec(first.text);
            if (match) {
                capText = match[2] + match[3];
                const rest = match[1] + first.text.slice(match[0].length);
                capWidth = Math.max(L * 2 - 2, Math.ceil(m.get(capText, 'cap')) + 12);
                if (rest.replaceAll(TOGGLE, '')) toks = [{ ...first, text: rest }, ...toks.slice(1)];
                else if (toks.length > 1) toks = [{ ...toks[1], text: rest + toks[1].text, glue: false }, ...toks.slice(2)];
                else toks = [];
            }
        }
        const gap = Math.round(mt.size * 0.4);
        const firstIndent = opts.first || capText ? 0 : indent;
        const avail = (line: number) => (capText && line < 2 ? w0 - capWidth - gap : w0 - (line === 0 ? firstIndent : 0));
        const lines = toks.length ? wrap(toks, avail, base, m) : [];
        const space = m.get(' ', base);
        if (capText) items.push({ row: { kind: 'cap', x: x0, w: capWidth, h: L * 2 - 2, text: capText }, h: 0, pos: pos + (toks[0]?.word ?? 0), keep: 2 });
        lines.forEach((line, index) => {
            const width = avail(index);
            const x = x0 + (capText && index < 2 ? capWidth + gap : index === 0 ? firstIndent : 0);
            const justify = !line.last && line.gaps > 0 && (width - line.width) / line.gaps <= space * 2.4;
            const item: Item = { row: { kind: 'line', x, w: width, h: lh, text: line.text, justify, small: opts.small || undefined }, h: lh, pos: pos + line.word };
            if (lines.length >= 4 && (index === 0 || index === lines.length - 2)) item.keep = 1;
            items.push(item);
        });
        // A drop cap is two lines tall even when its paragraph is shorter.
        if (capText && lines.length < 2) items.push({ h: L * (2 - lines.length), pos });
        return items;
    };

    const flowItems = (flow: Flow, f: number): Item[] => {
        const base = (f + 1) * FLOW;
        const items: Item[] = [];
        let drop = false;
        let first = true;
        const lh = flow.small ? mt.smallLine : L;
        if (flow.opener) {
            items.push(...opener(flow.opener.label, flow.opener.title ?? '', 1, base, flow.head, entryIndex.get(`${f}:open`)));
            first = true;
        } else {
            items.push({ h: 0, pos: base, head: flow.head, entry: entryIndex.get(`${f}:open`) });
        }
        if (flow.contents) {
            const folioWidth = Math.ceil(m.get('000', 'body')) + Math.round(mt.size * 0.8);
            entries.forEach((entry, e) => {
                const label = entry.level === 0;
                const style: Base = label ? 'label' : 'body';
                const lead = !label && hasParts ? indent : 0;
                const lineHeight = label ? Math.max(mt.labelLine, L) : L;
                const lines = wrap(tokenize(label ? entry.text.toUpperCase() : entry.text), () => W - lead - folioWidth, style, m).map(line => line.text);
                if (label && e > 0) items.push({ h: Math.round(L * 0.5), pos: base + e * BLOCK, spacer: true, keep: 1 });
                items.push({ row: { kind: 'toc', x: lead, w: W - lead, h: lines.length * lineHeight, lines, entry: e, level: entry.level }, h: lines.length * lineHeight, pos: base + e * BLOCK });
            });
            return items;
        }
        flow.blocks.forEach((block, b) => {
            const pos = base + b * BLOCK;
            switch (block.type) {
                case 'heading': {
                    if (flow.chapters && block.level < 2) {
                        items.push(...opener(block.label, block.title, block.level === 0 ? 0 : 1, pos, block.title || block.label, entryIndex.get(`${f}:${b}`)));
                        drop = block.level === 1;
                    } else {
                        const lines = wrap(tokenize(headingText(block.label, block.title)), () => Math.round(W * 0.88), 'title', m).map(line => line.text);
                        items.push({ h: L, pos, spacer: true, keep: 3 });
                        items.push({ row: { kind: 'title', x: 0, w: W, h: lines.length * mt.titleLine, lines }, h: lines.length * mt.titleLine, pos, keep: 2 });
                        items.push({ h: Math.round(L * 0.5), pos, spacer: true });
                        drop = false;
                    }
                    first = true;
                    return;
                }
                case 'para':
                    items.push(...para(block.text, pos, { quote: block.quote, first, drop, small: !!flow.small }));
                    break;
                case 'verse': {
                    items.push({ h: Math.round(lh * 0.5), pos, spacer: true });
                    const baseStyle: Base = flow.small ? 'small' : 'body';
                    const space = m.get(' ', baseStyle);
                    block.lines.forEach((verse, v) => {
                        const lead = inset + Math.min(verse.indent, 10) * space;
                        const hang = Math.round(mt.size * 1.2);
                        const toks = tokenize(verse.text);
                        if (!toks.length) return;
                        wrap(toks, line => W - lead - (line ? hang : 0), baseStyle, m).forEach((line, index) => {
                            items.push({ row: { kind: 'line', x: lead + (index ? hang : 0), w: W - lead - (index ? hang : 0), h: lh, text: line.text, small: flow.small || undefined }, h: lh, pos: pos + v * 100 + line.word });
                        });
                    });
                    items.push({ h: Math.round(lh * 0.5), pos, spacer: true });
                    break;
                }
                case 'break': {
                    const h = Math.round(L * 1.5);
                    items.push({ row: { kind: 'orn', x: 0, w: W, h }, h, pos });
                    break;
                }
                case 'art': {
                    const caption = block.caption.trim();
                    if (!caption) return;
                    const lines = wrap(tokenize(caption), () => Math.round(W * 0.8), 'small', m, true).map(line => line.text);
                    items.push({ h: Math.round(L * 0.5), pos, spacer: true, keep: 1 });
                    items.push({ row: { kind: 'caption', x: 0, w: W, h: lines.length * mt.smallLine, lines }, h: lines.length * mt.smallLine, pos });
                    items.push({ h: Math.round(L * 0.5), pos, spacer: true });
                    break;
                }
                case 'link': {
                    const lines = wrap(tokenize(block.text), () => W, 'small', m).map(line => line.text);
                    items.push({ row: { kind: 'link', x: 0, w: W, h: lines.length * mt.smallLine, lines, href: block.href }, h: lines.length * mt.smallLine + Math.round(mt.smallLine * 0.5), pos });
                    break;
                }
            }
            first = block.type !== 'para';
            drop = false;
        });
        return items;
    };

    if (spreads) fixed('endpaper', 0);
    if (input.title !== false) fixed('title', 1);
    if (input.colophon !== false) fixed('colophon', 2);
    flows.forEach((flow, f) => {
        page = null;
        flowId = flow.id;
        wantRecto = !!flow.recto;
        if (!flow.chapters && !flow.opener) head = flow.head;
        place(flowItems(flow, f));
        if (firstPage[flow.id] === undefined) firstPage[flow.id] = pages.length - 1;
    });

    const numbered = flows.findIndex(flow => flow.numbered);
    const start = numbered >= 0 ? firstPage[flows[numbered].id] : -1;
    if (start >= 0) {
        for (let p = start; p < pages.length; p++) if (pages[p].kind === 'text') pages[p].folio = String(p - start + 1);
    }
    for (const entry of entries) entry.folio = entry.page >= 0 ? pages[entry.page].folio : '';
    for (const p of pages) {
        for (const row of p.rows) {
            if (row.kind !== 'toc' || row.entry === undefined) continue;
            row.target = entries[row.entry].page;
            row.folio = entries[row.entry].folio;
        }
    }
    return { pages, entries: entries.map(({ key: _key, ...entry }) => entry), flows: firstPage };
}
