import { lanternProp } from '../art';
import type { RoamerSpec } from '../types';

const spec: RoamerSpec = {
    id: 'beacon-belle',
    name: 'Beacon Belle',
    look: { skin: 'clay', hair: 'ink', hairStyle: 'long', hat: 'gold', shirt: 'violet', pants: 'navy', shoes: 'gold' },
    prop: lanternProp('gold'),
    glow: 'yellow',
    ward: 'rays',
    every: [22, 30],
    stay: [35, 50],
    speed: 26,
    greet: ['Stay bright, friend!', 'HQ is that way!', 'All clear. Mostly.'],
    foil: ['Not on my watch!', 'Beacon says NO!', 'Drop it, gremlin!'],
    token: ['A token! Be careful!', 'Shiny. Suspiciously shiny.'],
};

export default spec;
