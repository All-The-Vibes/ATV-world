import { ensurePixels } from '../../kit';
import type { RoamerHandle, RoamerSpec } from '../types';
import { guitarProp, NOTE_H, NOTE_KEY, NOTE_W, noteArt } from '../props/riff-marlowe';

/** Float a note (tinted) up from a spot and fade it out. */
function note(r: RoamerHandle, x: number, y: number, tint = 0xffffff, orbit = false) {
    const s = r.world.scene;
    const key = ensurePixels(s, NOTE_KEY, noteArt);
    const n = s.add.image(x, y, key).setDepth(1e6).setTint(tint).setOrigin(0.5);
    const a = orbit ? Math.random() * Math.PI * 2 : 0;
    s.tweens.add({
        targets: n,
        x: x + (orbit ? Math.cos(a) * 9 : (Math.random() - 0.5) * 14),
        y: y - 14 - Math.random() * 8,
        alpha: 0,
        duration: 900,
        onComplete: () => n.destroy(),
    });
}

function ring(r: RoamerHandle, x: number, y: number, color: number) {
    const s = r.world.scene;
    const c = s.add.circle(x, y, 3).setStrokeStyle(2, color).setDepth(1e6);
    s.tweens.add({ targets: c, scale: 7, alpha: 0, duration: 450, onComplete: () => c.destroy() });
}

/** Short-lived scene timers owned by this visit, so leaving cancels them. */
function later(r: RoamerHandle, ms: number, fn: () => void) {
    const list = (r.data.timers ??= []) as Phaser.Time.TimerEvent[];
    list.push(r.world.scene.time.delayedCall(ms, fn));
}

const spec: RoamerSpec = {
    id: 'riff-marlowe',
    name: 'Riff Marlowe',
    look: { skin: 'sand', hair: 'bark', hairStyle: 'cap', hat: 'gold', shirt: 'violet', pants: 'forest', shoes: 'ink' },
    prop: guitarProp,
    glow: 'gold',
    ward: 'ring',
    every: [26, 38],
    stay: [38, 55],
    speed: 28,
    greet: ['Hit me with a beat!', 'One-man band, at your service!', 'Got a song for that.'],
    foil: ['Sharp chord, sharp exit!', 'Shoo! That is off-key!', 'Encore for nobody!'],
    token: ['That ring is in tune!', 'A coin! Cha-ching, in D minor.', 'Strummin\u2019 for tokens!'],
    hooks: {
        update(r, dt) {
            const d = r.data;
            d.noteCd = ((d.noteCd as number) ?? 0.5) - dt;
            if (d.noteCd as number <= 0) {
                d.noteCd = 0.5 + Math.random() * 0.4;
                note(r, r.sprite.x + (r.sprite.flipX ? -8 : 8), r.sprite.y - 14, 0xffffff, true);
            }
            d.jamCd = ((d.jamCd as number) ?? 8 + Math.random() * 4) - dt;
            if (d.jamCd as number <= 0) {
                d.jamCd = 8 + Math.random() * 4;
                r.pause(3);
                for (let i = 0; i < 4; i++) later(r, i * 700, () => note(r, r.sprite.x, r.sprite.y - 18, 0xc890ff));
            }
        },
        onFoil(r) {
            ring(r, r.sprite.x, r.sprite.y - 12, 0xffd34d);
            later(r, 120, () => ring(r, r.sprite.x, r.sprite.y - 12, 0xb070ff));
            for (let i = 0; i < 6; i++) note(r, r.sprite.x, r.sprite.y - 12, 0xffffff, true);
        },
        onGreet(r) {
            r.pause(2.6);
            const lines = ['Do!', 'Re!', 'Mi!', 'Your turn!'];
            lines.forEach((l, i) =>
                later(r, i * 500, () => {
                    r.say(l);
                    note(r, r.sprite.x, r.sprite.y - 24);
                    const p = r.world.player();
                    if (p) r.sparkle(i % 2 ? 'violet' : 'gold', p.x, p.y - 14);
                }),
            );
            later(r, 2100, () => {
                const p = r.world.player();
                if (!p) return;
                for (let i = 0; i < 3; i++) r.sparkle(i % 2 ? 'violet' : 'gold', p.x + (i - 1) * 6, p.y - 8 - i * 6);
            });
        },
        onToken(r) {
            r.pause(1.5);
            const s = r.world.scene;
            const x = r.sprite.x + (r.sprite.flipX ? -10 : 10);
            const coin = s.add.circle(x, r.sprite.y - 2, 2, 0xffd34d).setStrokeStyle(1, 0x7a5a10).setDepth(1e6);
            s.tweens.add({ targets: coin, y: r.sprite.y - 16, duration: 250, yoyo: true, ease: 'Quad.easeOut', onComplete: () => coin.destroy() });
            ring(r, x, r.sprite.y - 2, 0xffd34d);
            note(r, r.sprite.x, r.sprite.y - 18, 0xffd34d);
        },
        onBurn(r) {
            r.pause(2);
            const s = r.world.scene;
            for (let i = 0; i < 10; i++) {
                const p = s.add.rectangle(r.sprite.x + (r.sprite.flipX ? -8 : 8) + (Math.random() - 0.5) * 8, r.sprite.y - 9, 1, 1, 0xff3a2a).setDepth(1e6);
                s.tweens.add({ targets: p, x: p.x + (Math.random() - 0.5) * 16, y: p.y - 6 - Math.random() * 8, alpha: 0, duration: 500, onComplete: () => p.destroy() });
            }
            const base = r.sprite.y;
            s.tweens.add({ targets: r.sprite, angle: 12, y: base + 1, duration: 260, yoyo: true, hold: 300, onComplete: () => r.sprite.setAngle(0) });
            r.say('Thank you, thank you!');
        },
        onLeave(r) {
            for (const t of (r.data.timers ?? []) as Phaser.Time.TimerEvent[]) t.remove(false);
            r.sprite.setAngle(0);
        },
    },
};

export default spec;
