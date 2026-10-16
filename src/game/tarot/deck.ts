export type Score = -1 | 0 | 1;
export type Outcome = 'angel' | 'zombie';
export type Symbol = 'sun' | 'star' | 'heart' | 'moon' | 'eye' | 'tower' | 'thorn' | 'skull';

export interface TarotCard {
    readonly name: string;
    readonly symbol: Symbol;
    readonly reading: string;
    readonly score: Score;
}

export const DECK = [
    { name: 'SUN', symbol: 'sun', reading: 'Joy lights your path.', score: 1 },
    { name: 'STAR', symbol: 'star', reading: 'Hope guides you home.', score: 1 },
    { name: 'HEART', symbol: 'heart', reading: 'Kindness takes flight.', score: 1 },
    { name: 'MOON', symbol: 'moon', reading: 'A secret awaits.', score: 0 },
    { name: 'EYE', symbol: 'eye', reading: 'Pause and look within.', score: 0 },
    { name: 'TOWER', symbol: 'tower', reading: 'Your plans may crumble.', score: -1 },
    { name: 'THORN', symbol: 'thorn', reading: 'Trouble takes root.', score: -1 },
    { name: 'SKULL', symbol: 'skull', reading: 'A cold road lies ahead.', score: -1 },
] as const satisfies readonly TarotCard[];

export type Spread = readonly [TarotCard, TarotCard, TarotCard];

export function drawThree(random: () => number = Math.random): Spread {
    const remaining: TarotCard[] = [...DECK];
    const draw = () => remaining.splice(Math.floor(random() * remaining.length), 1)[0];
    return [draw(), draw(), draw()];
}

export function resolveReading(cards: Spread, random: () => number = Math.random): Outcome {
    const total = cards.reduce((sum, card) => sum + card.score, 0);
    const decidingScore = total || cards[2].score;
    return decidingScore > 0 ? 'angel' : decidingScore < 0 ? 'zombie' : random() < 0.5 ? 'angel' : 'zombie';
}
