import { PixelCanvas, miniText } from '../kit';

export const WATER = { deep: 0x163f79, blue: 0x2467ae, teal: 0x159eaf, turquoise: 0x39cbbc, foam: 0xf4f4ef, ice: 0xc8f1fb };

export function breakerArt(frame = 0) {
    const p = new PixelCanvas(224, 144);
    for (let x = 0; x < 224; x++) {
        const top = 132 - 110 * Math.exp(-(((x - 129) / 67) ** 2)) + Math.sin(x / 18 + frame * Math.PI / 2) * 2;
        for (let y = Math.floor(top); y < 144; y++) {
            p.set(x, y, y < top + 9 ? WATER.turquoise : y < top + 23 ? WATER.teal : y < top + 48 ? 'blue' : 'navy');
        }
    }
    p.ellipse(148, 74, 43, 48, WATER.turquoise)
        .ellipse(151, 82, 32, 38, WATER.deep)
        .ellipse(153, 91, 25, 26, 'navy');
    for (let i = 0; i <= 70; i++) {
        const a = -Math.PI * 0.93 + i / 70 * Math.PI * 1.47 + frame * 0.015;
        const x = Math.round(146 + Math.cos(a) * 44);
        const y = Math.round(69 + Math.sin(a) * 46);
        p.rect(x - 4, y - 3, 10, 8, (i + frame * 2) % 7 < 3 ? 'white' : 'ice');
        if ((i + frame) % 5 === 0) p.rect(x - 7, y - 7, 6, 5, 'white');
    }
    for (let i = 0; i < 26; i++) {
        const x = (i * 29 + frame * 8) % 216;
        const y = 121 + i % 5 * 4;
        p.rect(x, y, 11 + i % 4, 3, i % 3 ? 'ice' : 'white');
    }
    for (let i = 0; i < 18; i++) p.rect(170 + i % 6 * 7 + frame * 2, 72 + Math.floor(i / 6) * 12 + (frame * 5 + i) % 9, 3 + i % 3, 4, 'white');
    for (let i = 0; i < 24; i++) {
        const x = 22 + i * 7;
        const y = 129 - 78 * Math.exp(-(((x - 116) / 60) ** 2)) + (frame * 6 + i * 13) % 24;
        p.rect(x, y, 3, 9, i % 3 ? WATER.teal : WATER.turquoise);
    }
    return p;
}

export function surferArt(pose: number) {
    const p = new PixelCanvas(48, 44);
    const lean = pose - 1;
    p.ellipse(24, 38, 22, 4, 'ink').ellipse(24, 37, 21, 3, 'pink')
        .rect(9, 36, 29, 2, 'gold').rect(19, 35, 13, 2, 'cyan');
    p.line(18, 34, 22 + lean, 28, 'ink').line(22 + lean, 28, 20 + lean, 23, 'ink')
        .line(31, 34, 28 + lean, 29, 'ink').line(28 + lean, 29, 24 + lean, 23, 'ink');
    p.rect(18 + lean, 22, 10, 5, 'violet')
        .rect(19 + lean, 13, 8, 10, 'orange')
        .rect(20 + lean, 14, 3, 8, 'gold')
        .rect(19 + lean, 4, 8, 8, 'peach')
        .rect(18 + lean, 3, 10, 3, 'gold')
        .rect(18 + lean, 5, 3, 5, 'earth')
        .set(25 + lean, 7, 'ink');
    for (let i = 0; i < 3; i++) {
        p.line(20 + lean, 14 + i, 8, 17 + lean + i, 'peach')
            .line(26 + lean, 14 + i, 39, 10 - lean + i, 'peach');
    }
    p.rect(14, 34, 7, 2, 'peach').rect(28, 34, 7, 2, 'peach');
    return p;
}

export function surfSign() {
    const p = new PixelCanvas(85, 17);
    p.rect(0, 0, 85, 17, 'navy').rect(1, 1, 83, 2, 'cyan').rect(1, 14, 83, 2, 'pink');
    miniText(p, 7, 6, "SURF'S UP!", 'white');
    return p;
}
