import type Phaser from 'phaser';
import type { RoamerHandle, RoamerSpec } from '../types';
import { trailingScarf } from '../props/moxie-spin';

const n = (r: RoamerHandle, k: string) => (r.data[k] as number | undefined) ?? 0;

function spin(r: RoamerHandle, ms = 400) {
    const s = r.sprite;
    r.world.scene.tweens.add({ targets: s, angle: 360, duration: ms, onComplete: () => (s.angle = 0) });
}

function arcs(r: RoamerHandle) {
    const s = r.sprite;
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        r.sparkle('orange', s.x + Math.cos(a) * 10, s.y - 12 + Math.sin(a) * 8);
    }
}

function hearts(r: RoamerHandle) {
    const s = r.sprite;
    const scene = r.world.scene;
    for (let i = 0; i < 4; i++) {
        const px = scene.add.rectangle(Math.round(s.x + (i - 1.5) * 4), Math.round(s.y - 20), 2, 2, 0xff7ab8).setDepth(s.y + 40);
        scene.tweens.add({ targets: px, y: px.y - 20 - i * 3, alpha: 0, duration: 900 + i * 120, delay: i * 90, onComplete: () => px.destroy() });
    }
}

const spec: RoamerSpec = {
    id: 'moxie-spin',
    name: 'Moxie Spin',
    look: { skin: 'clay', hair: 'pink', hairStyle: 'bun', shirt: 'sky', pants: 'violet', shoes: 'orange' },
    prop: trailingScarf,
    glow: 'orange',
    ward: 'rays',
    every: [24, 36],
    stay: [30, 50],
    speed: 34,
    greet: ['Spin with me!', 'Care for a friendly bout?', 'Style points incoming!'],
    foil: ['Whirlwind kick!', 'Too slow, gremlin!', 'Ta-da! Gone!'],
    token: ['Combo bonus!', 'Caught it mid-spin!'],
    hooks: {
        update(r, dt) {
            const s = r.sprite;
            const scene = r.world.scene;
            r.data.combo = n(r, 'combo') + dt;
            if (n(r, 'combo') > 12) {
                r.data.combo = 0;
                spin(r, 450);
                arcs(r);
                r.say('FLASHY COMBO!');
            }

            // Sparring: keep pace beside a walker for a few seconds.
            const target = r.data.sparTarget as Phaser.GameObjects.Sprite | undefined;
            if (target) {
                r.data.sparLeft = n(r, 'sparLeft') - dt;
                if (r.data.sparLeft as number <= 0 || !target.active) {
                    r.data.sparTarget = undefined;
                    r.data.sparCool = 14;
                } else {
                    r.goTo(target.x + 14, target.y);
                    s.setFlipX(target.flipX);
                    r.data.sparBeat = n(r, 'sparBeat') + dt;
                    if (n(r, 'sparBeat') > 1) {
                        r.data.sparBeat = 0;
                        r.sparkle('pink');
                    }
                }
            } else {
                r.data.sparCool = n(r, 'sparCool') - dt;
                if (n(r, 'sparCool') <= 0) {
                    const w = r.world.walkers().find((q) => q.active && Math.hypot(q.x - s.x, q.y - s.y) < 70);
                    if (w) {
                        r.data.sparTarget = w;
                        r.data.sparLeft = 3;
                        r.say('Let us spar!');
                    } else r.data.sparCool = 3;
                }
            }

            // Player moves nearby: a three-step combo, then a rest.
            const p = r.world.player();
            r.data.nice = n(r, 'nice') - dt;
            if (p && n(r, 'nice') <= 0) {
                const px = r.data.px as number | undefined;
                const py = r.data.py as number | undefined;
                const moved = px !== undefined && py !== undefined && Math.hypot(p.x - px, p.y - py) > 0.4;
                r.data.px = p.x;
                r.data.py = p.y;
                if (moved && Math.hypot(p.x - s.x, p.y - s.y) < 50) {
                    r.data.nice = 9;
                    for (let i = 0; i < 3; i++) {
                        scene.time.delayedCall(i * 180, () => {
                            if (s.active) r.sparkle(i === 1 ? 'pink' : 'sky');
                        });
                    }
                    scene.time.delayedCall(560, () => s.active && r.say('NICE FORM!'));
                }
            }
        },
        onFoil(r) {
            spin(r);
            r.sparkle('yellow');
            arcs(r);
            r.ward();
        },
        onBurn(r) {
            const s = r.sprite;
            r.pause(1.5);
            s.setFlipX(!s.flipX);
            r.say('Dramatic pose!');
            hearts(r);
        },
    },
};

export default spec;
