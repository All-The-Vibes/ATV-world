import type Phaser from 'phaser';
import {
    PixelCanvas, addPixels, characterSheet, miniText, miniTextWidth, stripFrames,
    type Color, type FullLook,
} from '../kit';
import { DECK, type Outcome, type TarotCard } from './deck';

function star(pc: PixelCanvas, x: number, y: number, color: Color) {
    pc.line(x - 7, y, x + 7, y, color).line(x, y - 9, x, y + 9, color)
        .line(x - 4, y - 4, x + 4, y + 4, color).line(x - 4, y + 4, x + 4, y - 4, color)
        .rect(x - 2, y - 2, 5, 5, color);
}

function symbol(pc: PixelCanvas, card: TarotCard) {
    switch (card.symbol) {
        case 'sun':
            star(pc, 22, 20, 'gold');
            pc.ellipse(22, 20, 5, 5, 'yellow').set(20, 19, 'ink').set(24, 19, 'ink').rect(21, 22, 3, 1, 'orange');
            break;
        case 'star':
            star(pc, 22, 20, 'cyan');
            pc.rect(21, 19, 3, 3, 'white').set(12, 10, 'gold').set(32, 29, 'gold');
            break;
        case 'heart':
            pc.ellipse(18, 17, 5, 5, 'pink').ellipse(26, 17, 5, 5, 'pink');
            for (let i = 0; i < 10; i++) pc.rect(13 + i, 20 + i, 19 - i * 2, 1, 'pink');
            pc.rect(16, 14, 3, 2, 'cream');
            break;
        case 'moon':
            pc.ellipse(22, 19, 9, 10, 'gold').ellipse(26, 16, 8, 9, 'night');
            pc.set(12, 10, 'white').set(32, 29, 'cyan');
            break;
        case 'eye':
            pc.ellipse(22, 20, 12, 6, 'cloud').ellipse(22, 20, 5, 6, 'cyan')
                .ellipse(22, 20, 2, 4, 'ink').set(21, 18, 'white');
            pc.line(12, 12, 14, 15, 'gold').line(22, 9, 22, 13, 'gold').line(32, 12, 30, 15, 'gold');
            break;
        case 'tower':
            pc.rect(17, 15, 12, 17, 'steel').rect(16, 12, 4, 5, 'cloud')
                .rect(22, 12, 3, 5, 'cloud').rect(27, 12, 3, 5, 'cloud')
                .rect(21, 22, 4, 9, 'ink').line(15, 6, 12, 14, 'yellow')
                .line(12, 14, 18, 12, 'yellow').line(18, 12, 14, 21, 'yellow');
            break;
        case 'thorn':
            pc.line(14, 31, 28, 11, 'leaf').line(20, 23, 12, 21, 'lime')
                .line(24, 17, 31, 19, 'lime').line(17, 27, 16, 19, 'gold')
                .line(26, 14, 24, 8, 'gold').ellipse(28, 10, 3, 3, 'red');
            break;
        case 'skull':
            pc.ellipse(22, 18, 9, 8, 'cloud').rect(17, 22, 10, 7, 'cloud')
                .rect(16, 16, 4, 4, 'ink').rect(24, 16, 4, 4, 'ink')
                .set(22, 22, 'ink').line(19, 26, 19, 28, 'ink').line(23, 26, 23, 28, 'ink');
            break;
    }
}

function cardArt(card?: TarotCard) {
    const pc = new PixelCanvas(62, 68);
    pc.rect(1, 1, 60, 66, 'gold').rect(3, 3, 56, 62, card ? 'cream' : 'violet')
        .rect(5, 5, 52, 43, 'night');
    const emblem = new PixelCanvas(44, 36);
    if (card) {
        symbol(emblem, card);
        miniText(pc, Math.floor((62 - miniTextWidth(card.name)) / 2), 55, card.name, 'ink');
    } else {
        star(emblem, 22, 20, 'pink');
        miniText(pc, 23, 55, 'FATE', 'gold');
    }
    pc.blit(emblem, 9, 6);
    return pc;
}

function tableArt() {
    const pc = new PixelCanvas(250, 88);
    pc.rect(24, 60, 9, 27, 'earth').rect(217, 60, 9, 27, 'earth')
        .rect(10, 6, 230, 58, 'wood').rect(10, 6, 230, 4, 'gold')
        .rect(12, 11, 226, 53, 'plum').rect(16, 13, 218, 40, 'violet');
    for (let x = 17; x < 233; x += 8) pc.line(x, 62, x + 3, 67, 'gold');
    for (const x of [4, 241]) {
        pc.rect(x, 30, 5, 27, 'gold').rect(x - 2, 56, 9, 3, 'earth')
            .ellipse(x + 2, 25, 3, 6, 'orange').ellipse(x + 2, 24, 1, 3, 'yellow');
    }
    return pc.outline('ink');
}

function formArt(form: Outcome, look: FullLook) {
    const pc = new PixelCanvas(40 * 3, 38);
    const body = characterSheet(form === 'angel' ? look : { ...look, skin: 'grass' });
    for (let frame = 0; frame < 3; frame++) {
        const ox = frame * 40;
        if (form === 'angel') {
            for (const side of [-1, 1]) {
                for (let feather = 0; feather < 4; feather++) {
                    pc.line(ox + 20 + side * 6, 28 - feather, ox + 20 + side * (17 - feather * 2), 14 + feather * 3, 'cloud');
                    pc.line(ox + 20 + side * 7, 27 - feather, ox + 20 + side * (16 - feather * 2), 13 + feather * 3, 'white');
                }
            }
            pc.ellipse(ox + 20, 6, 7, 3, 'gold').ellipse(ox + 20, 6, 4, 1, null);
        }
        const source = body.frames[6 + frame];
        for (let y = 0; y < source.h; y++) for (let x = 0; x < source.w; x++) {
            const pixel = body.canvas.raw(source.x + x, source.y + y);
            if (pixel >>> 24) pc.px[(y + 16) * pc.width + ox + 12 + x] = pixel;
        }
        if (form === 'zombie') {
            pc.rect(ox + 23, 28, 10, 3, look.shirt).rect(ox + 32, 28, 4, 2, 'grass')
                .set(ox + 24, 21, 'red').rect(ox + 17, 30, 3, 2, 'grass')
                .rect(ox + 21, 25, 3, 1, 'ink').set(ox + 22, 25, 'cream')
                .line(ox + 22, 29, ox + 24, 31, 'ink').rect(ox + 22, 34, 2, 2, 'grass');
        }
    }
    return pc;
}

export function tarotTextures(scene: Phaser.Scene) {
    addPixels(scene, 'tarot-table', tableArt());
    addPixels(scene, 'tarot-back', cardArt());
    DECK.forEach((card) => addPixels(scene, `tarot-card-${card.symbol}`, cardArt(card)));
}

export function visitorTextures(scene: Phaser.Scene, index: number, look: FullLook) {
    const normal = characterSheet(look);
    addPixels(scene, `tarot-visitor-${index}`, normal.canvas, normal.frames);
    for (const form of ['angel', 'zombie'] as const) {
        const key = `tarot-${form}-${index}`;
        addPixels(scene, key, formArt(form, look), stripFrames(3, 40, 38));
        if (!scene.anims.exists(`${key}-walk`)) {
            scene.anims.create({
                key: `${key}-walk`,
                frames: [1, 0, 2, 0].map((frame) => ({ key, frame })),
                frameRate: form === 'angel' ? 8 : 4,
                repeat: -1,
            });
        }
    }
}

export function panelArt(lines: readonly string[], color: Color = 'cream') {
    const pc = new PixelCanvas(286, 44);
    pc.rect(0, 0, 286, 44, 'gold').rect(2, 2, 282, 40, 'night');
    lines.forEach((line, i) => miniText(pc, Math.floor((286 - miniTextWidth(line)) / 2), 6 + i * 9, line, color));
    return pc;
}
