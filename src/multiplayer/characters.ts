import { PLAYER_LOOK, randomLook, type CharacterLook, type FullLook } from '../game/kit';
import { myCharacter } from './identity';

/** The characters anyone can pick to play. Add more at the end (indexes are saved in people's browsers and sent to others). */
export const PRESETS: { label: string; look: CharacterLook }[] = [
    { label: 'Blue Cap', look: { skin: 'peach', hair: 'earth', hairStyle: 'cap', hat: 'gold', shirt: 'blue', pants: 'navy', shoes: 'white' } },
    { label: 'Red Spiky', look: { skin: 'sand', hair: 'ink', hairStyle: 'spiky', shirt: 'red', pants: 'night', shoes: 'ink' } },
    { label: 'Violet Long', look: { skin: 'cream', hair: 'violet', hairStyle: 'long', shirt: 'violet', pants: 'slate', shoes: 'white' } },
    { label: 'Green Bun', look: { skin: 'clay', hair: 'bark', hairStyle: 'bun', shirt: 'leaf', pants: 'forest', shoes: 'earth' } },
    { label: 'Pink Long', look: { skin: 'peach', hair: 'pink', hairStyle: 'long', shirt: 'pink', pants: 'plum', shoes: 'red' } },
    { label: 'Gold Bald', look: { skin: 'earth', hair: 'ink', hairStyle: 'bald', shirt: 'gold', pants: 'slate', shoes: 'ink' } },
    { label: 'Cyan Short', look: { skin: 'wood', hair: 'white', hairStyle: 'short', shirt: 'cyan', pants: 'navy', shoes: 'white' } },
    { label: 'Orange Cap', look: { skin: 'sand', hair: 'red', hairStyle: 'cap', hat: 'orange', shirt: 'orange', pants: 'bark', shoes: 'earth' } },
    { label: 'Wine Short', look: { skin: 'cream', hair: 'gold', hairStyle: 'short', shirt: 'wine', pants: 'night', shoes: 'ink' } },
    { label: 'Blue Spiky', look: { skin: 'peach', hair: 'blue', hairStyle: 'spiky', shirt: 'white', pants: 'steel', shoes: 'red' } },
    { label: 'Mint Bun', look: { skin: 'clay', hair: 'cyan', hairStyle: 'bun', shirt: 'forest', pants: 'bark', shoes: 'white' } },
    { label: 'Plum Short', look: { skin: 'wood', hair: 'mist', hairStyle: 'short', shirt: 'plum', pants: 'night', shoes: 'white' } },
];

/** The full look for a preset index; anything unknown falls back to the first character. */
export function presetLook(index: number | null | undefined): FullLook {
    const i = index !== null && index !== undefined && PRESETS[index] ? index : 0;
    return randomLook(`preset-${i}`, PRESETS[i].look);
}

/** The look you play with: your pick, or the classic blue-cap character if you haven't picked. */
export function myLook(): FullLook {
    const i = myCharacter();
    return i === null ? { ...PLAYER_LOOK, githubUsername: undefined } : presetLook(i);
}
