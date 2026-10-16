import type { CharacterLook, ColorName } from '../kit';

/** How a roaming character looks, moves, and what it says. Add one to ROAMERS and it joins the town. */
export interface RoamerSpec {
    id: string;
    name: string;
    look: CharacterLook;
    /** Carries a hand lantern with this glow. */
    lantern?: ColorName;
    /** Colour of its sparkles and its ward. */
    glow: ColorName;
    /** What it does when it scares a gremlin: rays of light, a rune ring, or a flutter of moths. */
    ward: 'rays' | 'ring' | 'moths';
    /** Seconds between visits, and how long a visit lasts. */
    every: [number, number];
    stay: [number, number];
    speed: number;
    greet: string[];
    foil: string[];
    token: string[];
}

export const ROAMERS: RoamerSpec[] = [
    {
        id: 'beacon-belle',
        name: 'Beacon Belle',
        look: { skin: 'clay', hair: 'ink', hairStyle: 'long', hat: 'gold', shirt: 'violet', pants: 'navy', shoes: 'gold' },
        lantern: 'gold',
        glow: 'yellow',
        ward: 'rays',
        every: [22, 30],
        stay: [35, 50],
        speed: 26,
        greet: ['Stay bright, friend!', 'HQ is that way!', 'All clear. Mostly.'],
        foil: ['Not on my watch!', 'Beacon says NO!', 'Drop it, gremlin!'],
        token: ['A token! Be careful!', 'Shiny. Suspiciously shiny.'],
    },
    {
        id: 'mothbell',
        name: 'Mothbell',
        look: { skin: 'cream', hair: 'bark', hairStyle: 'cap', hat: 'forest', shirt: 'forest', pants: 'night', shoes: 'ink' },
        lantern: 'orange',
        glow: 'violet',
        ward: 'moths',
        every: [25, 40],
        stay: [30, 45],
        speed: 22,
        greet: ['Did you hear that?', 'Stay near the light.', 'Something moved...'],
        foil: ['Eep! Go away!', 'The light! It burns!', 'Shoo, shoo!'],
        token: ['Is it safe to pick up?', 'I will guard it. Nervously.'],
    },
    {
        id: 'brindle',
        name: 'Brindle Quillroot',
        look: { skin: 'peach', hair: 'white', hairStyle: 'cap', hat: 'violet', shirt: 'forest', pants: 'bark', shoes: 'earth' },
        glow: 'violet',
        ward: 'ring',
        every: [24, 34],
        stay: [35, 55],
        speed: 24,
        greet: ['Special delivery!', 'A letter for you. Probably.', 'Quest accepted?'],
        foil: ['Ward of returning!', 'Not today, thief!', 'Sealed with a rune!'],
        token: ['A coin for my map!', 'Marked on the quest log.'],
    },
];
