import { DARKER, LIGHTER, PALETTE, type ColorName } from '../game/kit/palette.ts';
import { hashString } from '../game/kit/noise.ts';

/** Page paper and index-card stock. */
export const PAPER = '#f1e4c3';
export const CARD = '#f6ecd0';

const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a #rrggbb color. */
export function luminance(hex: string) {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrast(a: string, b: string) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Chapter labels and ornaments on the page: the cloth when it reads well, else a darker step, else the lettering. */
export function accentOn(cloth: ColorName, ink: ColorName, background = PAPER): ColorName {
    for (const color of [cloth, DARKER[cloth], ink]) if (contrast(PALETTE[color], background) >= 4.5) return color;
    return 'ink';
}

/** Leather title label on a spine: a step darker than the cloth under light lettering, a step lighter under dark. */
export function labelFor(cloth: ColorName, ink: ColorName): ColorName {
    return luminance(PALETTE[ink]) > luminance(PALETTE[cloth]) ? DARKER[cloth] : LIGHTER[cloth];
}

/** Cloth and lettering for catalog books; every pair passes WCAG AA. */
export const BINDINGS: readonly (readonly [ColorName, ColorName])[] = [
    ['wine', 'gold'], ['forest', 'cream'], ['navy', 'ice'], ['plum', 'peach'], ['earth', 'sand'],
    ['pine', 'lime'], ['slate', 'cream'], ['red', 'white'], ['blue', 'yellow'],
];

/** A stable binding for any catalog key, so the same book always looks the same. */
export function bindingFor(key: string): { cloth: ColorName; ink: ColorName } {
    const [cloth, ink] = BINDINGS[hashString(key) % BINDINGS.length];
    return { cloth, ink };
}
