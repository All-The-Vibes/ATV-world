import { lanternProp } from '../art';
import type { RoamerSpec } from '../types';

const spec: RoamerSpec = {
    id: 'mothbell',
    name: 'Mothbell',
    look: { skin: 'cream', hair: 'bark', hairStyle: 'cap', hat: 'forest', shirt: 'forest', pants: 'night', shoes: 'ink' },
    prop: lanternProp('orange'),
    glow: 'violet',
    ward: 'moths',
    every: [25, 40],
    stay: [30, 45],
    speed: 22,
    greet: ['Did you hear that?', 'Stay near the light.', 'Something moved...'],
    foil: ['Eep! Go away!', 'The light! It burns!', 'Shoo, shoo!'],
    token: ['Is it safe to pick up?', 'I will guard it. Nervously.'],
};

export default spec;
