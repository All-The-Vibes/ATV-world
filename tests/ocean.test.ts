import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SurfClock } from '../src/game/ocean/cycle.ts';
import { Riders, type Rider } from '../src/game/ocean/riders.ts';

function advance(clock: SurfClock, ms: number) {
    for (; ms > 0; ms -= 100) clock.update(Math.min(ms, 100));
}

test('first wave at 120s; 20s duration; starts remain 120s apart', () => {
    const clock = new SurfClock();
    advance(clock, 119_900);
    assert.equal(clock.active, false);
    clock.update(100);
    assert.equal(clock.active, true);
    assert.equal(clock.age, 0);
    advance(clock, 19_900);
    assert.equal(clock.active, true);
    clock.update(100);
    assert.equal(clock.active, false);
    advance(clock, 99_900);
    assert.equal(clock.active, false);
    clock.update(100);
    assert.equal(clock.active, true);
    assert.equal(clock.age, 0);
});

test('no overlap, background catch-up, or replay after cancel/sleep', () => {
    const clock = new SurfClock();
    advance(clock, 119_000);
    clock.update(600_000);
    assert.equal(clock.active, false);
    advance(clock, 1000);
    assert.equal(clock.active, true);
    assert.equal(clock.start(), false);
    advance(clock, 4000);
    clock.cancel();
    assert.equal(clock.active, false);
    advance(clock, 115_900);
    assert.equal(clock.active, false);
    clock.update(100);
    assert.equal(clock.active, true);
});

test('an immediate development start resets cadence without overlapping', () => {
    const clock = new SurfClock();
    advance(clock, 3000);
    assert.equal(clock.start(), true);
    assert.equal(clock.start(), false);
    advance(clock, 120_000);
    assert.equal(clock.active, true);
    assert.equal(clock.age, 0);
});

// Sprite state at the boundary owned by the effect; browser tests exercise real Phaser sprites.
function actor(x = 4, y = 7, visible = true) {
    return {
        x, y, depth: 12, visible, alpha: 0.7, active: true, scene: {},
        anims: {
            isPlaying: true, isPaused: false,
            pause() { this.isPaused = true; },
            resume() { this.isPaused = false; },
        },
    };
}
const rider = (sprite: ReturnType<typeof actor>, extra = {}) => ({ sprite, ...extra }) as unknown as Rider;

test('restores exact indoor visibility, positions, accessories, and animation pause state', () => {
    const cast = new Riders();
    const player = actor(10, 20, false);
    const shadow = actor(10, 20);
    const plate = actor(12, 9);
    const alreadyPaused = actor();
    alreadyPaused.anims.isPaused = true;
    const original = [player, shadow, plate].map(o => ({ x: o.x, y: o.y, depth: o.depth, visible: o.visible, alpha: o.alpha }));
    cast.sync([rider(player, { hide: [shadow], carry: [plate] }), rider(alreadyPaused)]);
    cast.pose((x, y) => ({ x: x + 80, y: y - 60 }));
    assert.equal(player.visible, true);
    assert.equal(player.anims.isPaused, true);
    assert.equal(shadow.visible, false);
    assert.equal(plate.x, 92);
    assert.equal(plate.y, -51);
    cast.restore();
    [player, shadow, plate].forEach((o, i) => {
        for (const key of ['x', 'y', 'depth', 'visible', 'alpha'] as const) assert.equal(o[key], original[i][key]);
    });
    assert.equal(player.anims.isPaused, false);
    assert.equal(alreadyPaused.anims.isPaused, true);
    cast.restore(); // Idempotent shutdown/destroy.
    assert.equal(player.x, 10);
});

test('joins ride immediately, departed/destroyed avatars are never resurrected', () => {
    const cast = new Riders();
    const leaver = actor();
    const joiner = actor(42, 84);
    cast.sync([rider(leaver)]);
    cast.pose(() => ({ x: 100, y: 200 }));
    leaver.active = false;
    cast.sync([rider(joiner)]);
    cast.pose(() => ({ x: 120, y: 220 }));
    assert.equal(leaver.x, 100, 'destroyed sprite is not restored or repositioned');
    assert.equal(joiner.x, 120);
    cast.restore();
    assert.equal(joiner.x, 42);
    assert.equal(joiner.y, 84);
    assert.equal(leaver.active, false);
});
