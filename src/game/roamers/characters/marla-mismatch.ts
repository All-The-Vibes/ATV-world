import { bannerCanvas, BANNER_KEY, clipboardProp } from '../props/marla-mismatch';
import type { RoamerHandle, RoamerSpec } from '../types';

const URGENT = ['Emergency! A leaf fell!', 'Crisis! Someone moved a bench!', 'Alert! A pigeon looked at me!'];
const PAPER = [0xf2c14e, 0x7d4bb5, 0xf2c14e];

function newspaper(r: RoamerHandle) {
    const scene = r.world.scene;
    PAPER.forEach((color, i) => {
        const dot = scene.add.rectangle(r.sprite.x, r.sprite.y - 24, 2, 2, color).setDepth(r.sprite.depth + 2);
        const a0 = (i / PAPER.length) * Math.PI * 2;
        scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 1400,
            onUpdate: (t) => {
                const p = t.getValue() ?? 0;
                const a = a0 + p * Math.PI * 3;
                dot.setPosition(r.sprite.x + Math.cos(a) * 9 * (1 - p * 0.4), r.sprite.y - 24 - p * 22 + Math.sin(a) * 3);
                dot.setAlpha(1 - p * 0.6);
            },
            onComplete: () => dot.destroy(),
        });
    });
}

function breakingNews(r: RoamerHandle) {
    const scene = r.world.scene;
    if (!scene.textures.exists(BANNER_KEY)) scene.textures.addCanvas(BANNER_KEY, bannerCanvas().flush());
    const banner = scene.add.image(r.sprite.x, r.sprite.y - 46, BANNER_KEY).setDepth(r.sprite.depth + 2);
    const follow = () => banner.setPosition(r.sprite.x, r.sprite.y - 46);
    scene.events.on('update', follow);
    scene.time.delayedCall(2000, () => {
        scene.events.off('update', follow);
        banner.destroy();
    });
    newspaper(r);
}

function later(r: RoamerHandle, ms: number, fn: () => void) {
    r.world.scene.time.delayedCall(ms, () => {
        if (r.sprite.active) fn();
    });
}

const spec: RoamerSpec = {
    id: 'marla-mismatch',
    name: 'Marla Mismatch',
    look: { skin: 'peach', hair: 'cream', hairStyle: 'bun', hat: 'gold', shirt: 'violet', pants: 'forest', shoes: 'cream' },
    prop: clipboardProp,
    glow: 'gold',
    ward: 'ring',
    every: [26, 36],
    stay: [30, 45],
    speed: 24,
    greet: ['Have you HEARD the news?', 'Town emergency! Hello, by the way.', 'I saw everything. Everything!'],
    foil: ['SCANDAL!', 'Gremlin scandal!', 'Print the headline!'],
    token: ['A token! Is it legal?', 'Evidence! Shiny evidence.', 'Eyewitness to a token!'],
    hooks: {
        onFoil(r) {
            r.say('SCANDAL!');
            breakingNews(r);
        },
        onGreet(r) {
            r.say(URGENT[Math.floor(Math.random() * URGENT.length)]);
            r.data.escort = 4;
            r.data.tick = 0;
        },
        onBurn(r) {
            r.pause(3);
            later(r, 1200, () => r.say('Any comment, dragon?'));
        },
        update(r, dt) {
            const p = r.world.player();
            let escort = (r.data.escort as number | undefined) ?? 0;
            if (escort > 0) {
                escort -= dt;
                r.data.escort = escort;
                const tick = ((r.data.tick as number | undefined) ?? 0) - dt;
                r.data.tick = tick;
                if (p && tick <= 0) {
                    r.data.tick = 0.5;
                    r.goTo(p.x, p.y);
                }
                return;
            }
            const next = ((r.data.report as number | undefined) ?? 12 + Math.random() * 10) - dt;
            r.data.report = next;
            if (next > 0) return;
            r.data.report = 22 + Math.random() * 12;
            const walkers = r.world.walkers();
            const w = walkers[Math.floor(Math.random() * walkers.length)];
            if (!w) return;
            r.goTo(w.x + 10, w.y);
            later(r, 4000, () => {
                r.pause(2);
                r.say('Breaking news: they walked!');
                r.sparkle('gold', w.x, w.y - 16);
            });
        },
    },
};

export default spec;
