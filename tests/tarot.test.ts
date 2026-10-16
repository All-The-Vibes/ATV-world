import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DECK, drawThree, resolveReading, type Spread } from '../src/game/tarot/deck.ts';

test('each tarot card has a unique name, symbol, reading, and valid score', () => {
    for (const field of ['name', 'symbol', 'reading'] as const) {
        assert.equal(new Set(DECK.map((card) => card[field])).size, DECK.length);
        assert.ok(DECK.every((card) => card[field].length > 0));
    }
    assert.ok(DECK.every((card) => [-1, 0, 1].includes(card.score)));
});

test('all 336 possible ordered draws contain three different deck cards', () => {
    const draws = new Set<string>();
    for (let a = 0; a < 8; a++) for (let b = 0; b < 7; b++) for (let c = 0; c < 6; c++) {
        const rolls = [(a + 0.5) / 8, (b + 0.5) / 7, (c + 0.5) / 6];
        const cards = drawThree(() => rolls.shift()!);
        assert.equal(cards.length, 3);
        assert.equal(new Set(cards).size, 3);
        assert.ok(cards.every((card) => DECK.some((entry) => entry === card)));
        draws.add(cards.map((card) => card.name).join(','));
    }
    assert.equal(draws.size, 336);
    assert.equal(new Set(drawThree(() => 0)).size, 3);
    assert.equal(new Set(drawThree(() => 1 - Number.EPSILON)).size, 3);
});

test('every unique spread follows total, third-card, then random tie-breaking rules', () => {
    let neutralTies = 0;
    for (const a of DECK) for (const b of DECK) for (const c of DECK) {
        if (a === b || a === c || b === c) continue;
        const spread: Spread = [a, b, c];
        const deciding = a.score + b.score + c.score || c.score;
        let calls = 0;
        const result = resolveReading(spread, () => { calls++; return 0.25; });
        assert.equal(result, deciding < 0 ? 'zombie' : 'angel');
        assert.equal(calls, deciding === 0 ? 1 : 0, 'Only fully neutral ties use randomness');
        if (deciding === 0) {
            neutralTies++;
            assert.equal(resolveReading(spread, () => 0.5), 'zombie');
            assert.equal(resolveReading(spread, () => 0), 'angel');
        }
    }
    assert.ok(neutralTies > 0);
});
