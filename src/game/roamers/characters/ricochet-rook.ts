import type Phaser from 'phaser';
import type { RoamerHandle, RoamerSpec } from '../types';
import { capeProp } from '../props/ricochet-rook';

const FOIL_POSES = ['I work alone.', 'The town needs me.', 'Justice. Mostly.'];
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Two fading violet copies of the sprite's current frame. */
function afterimages(r: RoamerHandle) {
    const s = r.sprite;
    const scene = r.world.scene;
    for (let i = 1; i <= 2; i++) {
        const ghost = scene.add
            .sprite(s.x, s.y, s.texture.key, s.frame.name)
            .setOrigin(s.originX, s.originY)
            .setFlipX(s.flipX)
            .setDepth(s.depth - 0.1)
            .setAlpha(0.4)
            .setTint(0x7d4bb5);
        scene.tweens.add({ targets: ghost, alpha: 0, duration: 260 + i * 90, onComplete: () => ghost.destroy() });
    }
}

function skyPoint(scene: Phaser.Scene): { x: number; y: number } | undefined {
    const ufo = Reflect.get(scene, 'ufo') as { sprite?: { x: number; y: number }; x?: number; y?: number } | undefined;
    const p = ufo?.sprite ?? ufo;
    return p && typeof p.x === 'number' && typeof p.y === 'number' ? { x: p.x, y: p.y } : undefined;
}

const spec: RoamerSpec = {
    id: 'ricochet-rook',
    name: 'Ricochet Rook',
    look: { skin: 'peach', hair: 'ink', hairStyle: 'cap', hat: 'ink', shirt: 'red', pants: 'night', shoes: 'ink' },
    prop: capeProp,
    glow: 'violet',
    ward: 'rays',
    every: [26, 38],
    stay: [30, 50],
    speed: 30,
    greet: ['I was never here.', 'The night is my office.', 'Citizen. Stay sharp.'],
    foil: ['Justice has a cape.', 'Crime never rests. I do.', 'Ricochet, thief!'],
    token: ['Evidence secured.', 'A clue, in gold.', 'Case closed. Shiny.'],
    hooks: {
        update(r, dt) {
            const g = r.world.gremlins();
            const d = r.data;
            d.t = ((d.t as number) ?? 0) + dt;
            d.look = ((d.look as number) ?? 0) - dt;
            if (d.dashing) {
                d.trail = ((d.trail as number) ?? 0) - dt;
                if ((d.trail as number) <= 0) {
                    d.trail = 0.12;
                    afterimages(r);
                }
                if ((d.t as number) - (d.dashAt as number) > 2.5) d.dashing = false;
            }
            if (g && (d.t as number) > ((d.nextDash as number) ?? 0)) {
                const bad = g.nearest(r.sprite.x, r.sprite.y, 160, true);
                if (bad && (bad as { active?: boolean }).active !== false) {
                    d.nextDash = (d.t as number) + 6;
                    d.dashing = true;
                    d.dashAt = d.t;
                    r.say('Looting. Not on my watch.');
                    r.goTo(bad.x, bad.y);
                }
            }
            if ((d.look as number) <= 0 && !d.dashing) {
                d.look = 8;
                const u = skyPoint(r.world.scene);
                if (u && Math.hypot(u.x - r.sprite.x, u.y - r.sprite.y) < 400 && !d.sawUfo) {
                    d.sawUfo = true;
                    r.pause(1.5);
                    r.sprite.setFlipX(u.x < r.sprite.x);
                    r.say('Unidentified. Suspicious.');
                    r.sparkle('silver', r.sprite.x, r.sprite.y - 22);
                    r.world.scene.time.delayedCall(20000, () => (d.sawUfo = false));
                }
            }
        },
        onFoil(r) {
            r.pause(2);
            r.say(pick(FOIL_POSES));
            r.sparkle('violet');
            r.ward();
        },
        onGreet(r) {
            const p = r.world.player();
            const px = p?.x ?? r.sprite.x;
            const py = p?.y ?? r.sprite.y;
            const g = r.world.gremlins()?.nearest(px, py, 260, true);
            const tok = r.world.tokens()?.playthings() ?? [];
            let target: { x: number; y: number } | undefined = g;
            let what = 'a gremlin';
            if (!target && tok.length) {
                target = tok.reduce((a, b) => (Math.hypot(a.x - px, a.y - py) < Math.hypot(b.x - px, b.y - py) ? a : b));
                what = 'a token';
            }
            if (!target) return;
            r.pause(1.5);
            r.sprite.setFlipX(target.x < r.sprite.x);
            r.say(`Case file: ${what}. Over there.`);
            r.sparkle('red', r.sprite.x + (target.x < r.sprite.x ? -8 : 8), r.sprite.y - 14);
        },
        onBurn(r) {
            r.pause(2.5);
            r.say('Even heroes get toasted.');
            const scene = r.world.scene;
            for (let i = 0; i < 3; i++) {
                const puff = scene.add
                    .circle(r.sprite.x - (r.sprite.flipX ? -5 : 5) + (i - 1) * 3, r.sprite.y - 10, 3, 0x2a2445, 0.7)
                    .setDepth(r.sprite.depth + 1);
                scene.tweens.add({
                    targets: puff,
                    y: puff.y - 16 - i * 4,
                    scale: 2,
                    alpha: 0,
                    duration: 900,
                    delay: i * 150,
                    onComplete: () => puff.destroy(),
                });
            }
        },
    },
};

export default spec;
