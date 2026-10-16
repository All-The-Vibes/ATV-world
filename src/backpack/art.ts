import { PixelCanvas } from '../game/kit/pixels';
import { miniText } from '../game/kit/font';
import type { ItemId } from './inventory';

export function itemArt(id: ItemId | 'backpack') {
    const p = new PixelCanvas(24, 24);
    switch (id) {
        case 'mac-mini':
            p.rect(4, 7, 16, 11, 'mist').rect(3, 8, 18, 8, 'cloud')
                .rect(5, 6, 14, 8, 'white').rect(5, 17, 14, 2, 'steel')
                .rect(6, 16, 3, 1, 'ink').rect(11, 16, 3, 1, 'ink').set(18, 16, 'lime')
                .rect(10, 9, 4, 3, 'mist').set(13, 8, 'mist').set(14, 9, 'white');
            break;
        case 'dgx-spark':
            p.rect(4, 6, 16, 13, 'wood').rect(3, 8, 18, 9, 'clay')
                .rect(5, 5, 14, 7, 'sand').rect(5, 5, 14, 1, 'cream')
                .rect(4, 12, 16, 6, 'bark').rect(6, 18, 12, 1, 'earth');
            for (let x = 5; x < 19; x += 2) p.rect(x, 13, 1, 4, 'clay');
            p.rect(9, 7, 6, 3, 'pine').rect(10, 8, 4, 1, 'lime').set(18, 16, 'lime');
            break;
        case 'codex-pro':
            p.rect(5, 3, 14, 18, 'violet').rect(6, 4, 12, 16, 'night')
                .rect(6, 4, 12, 1, 'pink').rect(7, 6, 10, 7, 'ink');
            miniText(p, 8, 7, '>_', 'cyan');
            miniText(p, 6, 15, 'PRO', 'yellow');
            p.set(19, 3, 'cream').rect(20, 1, 1, 5, 'gold').rect(18, 3, 5, 1, 'gold');
            break;
        case 'cloud-scout':
            p.rect(4, 3, 16, 18, 'blue').rect(5, 4, 14, 15, 'sky').rect(6, 4, 12, 1, 'cyan');
            p.rect(7, 9, 10, 5, 'white').rect(9, 6, 5, 8, 'white')
                .rect(14, 8, 3, 5, 'ice').rect(6, 11, 12, 3, 'ice')
                .rect(10, 12, 4, 5, 'navy').set(11, 12, 'gold').set(12, 13, 'yellow')
                .set(11, 14, 'gold').rect(9, 19, 6, 1, 'cyan');
            break;
        case 'backpack':
            p.rect(9, 2, 6, 4, 'wood').rect(10, 3, 4, 2, 'ink')
                .rect(3, 9, 3, 11, 'earth').rect(18, 9, 3, 11, 'earth')
                .rect(6, 5, 12, 16, 'clay').rect(7, 5, 10, 3, 'sand')
                .rect(7, 12, 10, 7, 'wood').rect(7, 12, 10, 2, 'gold')
                .rect(11, 8, 2, 3, 'yellow').rect(14, 14, 2, 2, 'cream')
                .rect(7, 20, 10, 1, 'earth');
            break;
    }
    return p.outline('ink');
}

const icons = new Map<string, string>();
export function itemIcon(id: ItemId | 'backpack') {
    if (!icons.has(id)) icons.set(id, itemArt(id).flush().toDataURL());
    return icons.get(id)!;
}
