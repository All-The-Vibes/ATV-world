import type { RoamerSpec } from '../types';

const spec: RoamerSpec = {
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
};

export default spec;
