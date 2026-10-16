/** Type and page geometry for the paged reader. Canvas measurement uses the same font strings as the page CSS. */
import type { Metrics, Style } from './paginate';

export type Face = 'pixel' | 'book';
export type TypeSettings = { size: 0 | 1 | 2; face: Face };

const KEY = 'atv-library:type';
const FACES = {
    pixel: { family: '"VT323", monospace', sizes: [18, 20, 23], line: 1.25, title: 1.5, titleLine: 1.1, fine: '16px "VT323", monospace' },
    book: { family: 'Georgia, "Times New Roman", serif', sizes: [14, 15.5, 17], line: 1.5, title: 1.35, titleLine: 1.25, fine: '12px Georgia, "Times New Roman", serif' },
} as const;
const LABEL = '"Press Start 2P", monospace';

export const SIZE_NAMES = ['Small', 'Medium', 'Large'] as const;
export const FACE_NAMES: Record<Face, string> = { pixel: 'Pixel', book: 'Book' };

export function loadType(): TypeSettings {
    try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
        if ([0, 1, 2].includes(value?.size) && (value.face === 'pixel' || value.face === 'book')) return { size: value.size, face: value.face };
    } catch {
        // Storage can be unavailable or hold an old value; fall back to the default.
    }
    return { size: 1, face: 'pixel' };
}

export function saveType(settings: TypeSettings) {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
        // Settings still apply for this visit.
    }
}

export type Type = {
    face: Face;
    family: string;
    size: number;
    line: number;
    small: number;
    smallLine: number;
    title: number;
    titleLine: number;
    label: number;
    labelLine: number;
    cap: number;
    /** Fixed small type for the colophon. */
    fine: string;
    fonts: Record<Style, string>;
};

export function typeFor(settings: TypeSettings): Type {
    const face = FACES[settings.face];
    const size = face.sizes[settings.size];
    const line = Math.round(size * face.line);
    const small = Math.round(size * 0.86);
    const title = Math.round(size * face.title);
    const label = Math.max(8, Math.round(size * 0.5));
    const cap = Math.round(line * 1.1);
    const font = (px: number, italic = false, family: string = face.family) => `${italic ? 'italic ' : ''}${px}px ${family}`;
    return {
        face: settings.face,
        family: face.family,
        size,
        line,
        small,
        smallLine: Math.round(line * 0.86),
        title,
        titleLine: Math.round(title * face.titleLine),
        label,
        labelLine: Math.round(label * 1.9),
        cap,
        fine: face.fine,
        fonts: {
            body: font(size),
            italic: font(size, true),
            small: font(small),
            smallItalic: font(small, true),
            title: font(title),
            titleItalic: font(title, true),
            label: font(label, false, LABEL),
            cap: font(cap, false, LABEL),
        },
    };
}

/** Text width measured on a canvas with the page's own fonts. */
export function measurer(type: Type): Metrics['measure'] {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return text => text.length * type.size * 0.5;
    ctx.fontKerning = 'normal';
    let current = '';
    return (text, style) => {
        const font = type.fonts[style];
        if (font !== current) {
            ctx.font = font;
            current = font;
        }
        return ctx.measureText(text).width;
    };
}

let ready: Promise<unknown> | undefined;
/** Resolves once the reader's web fonts are loaded, so measurements match what the page draws. */
export const fontsReady = () => (ready ??= Promise.all(
    ['20px "VT323"', '10px "Press Start 2P"', '15px Georgia', 'italic 15px Georgia'].map(font => document.fonts.load(font)),
).catch(() => undefined));

export type Geometry = {
    page: { w: number; h: number };
    box: { w: number; h: number };
    top: number;
    /** Text box left edge on left-hand and right-hand pages. */
    left: { verso: number; recto: number };
};

/** Two pages side by side on wide screens; one page at a time on narrow ones. */
export const SPREAD: Geometry = { page: { w: 440, h: 620 }, box: { w: 356, h: 500 }, top: 58, left: { verso: 38, recto: 46 } };
export const SINGLE: Geometry = { page: { w: 384, h: 600 }, box: { w: 320, h: 480 }, top: 56, left: { verso: 32, recto: 32 } };
/** How far the boards reach past the pages. */
export const OVERHANG = 12;
export const SPREAD_MIN_WIDTH = 760;
