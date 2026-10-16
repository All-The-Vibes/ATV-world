import Phaser from 'phaser';
import { addPixels, toHexNumber, type Color } from '../../kit';
import { batFrame, capeProp } from '../props/velvet-vesper';
import type { RoamerHandle, RoamerSpec } from '../types';

const DEPTH = 1e6;

function pixel(r: RoamerHandle, x: number, y: number, color: Color, tx: number, ty: number, ms: number) {
    const { scene } = r.world;
    const p = scene.add.rectangle(x, y, 2, 2, toHexNumber(color)).setDepth(DEPTH);
    scene.tweens.add({ targets: p, x: tx, y: ty, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
}

function squash(r: RoamerHandle, hold = 0) {
    const sp = r.sprite;
    r.world.scene.tweens.add({ targets: sp, scaleY: 0.78, scaleX: 1.08, duration: 220, yoyo: true, hold, ease: 'Sine.easeInOut', onComplete: () => sp.setScale(1) });
}

function ensureBats(r: RoamerHandle) {
    const { scene } = r.world;
    for (const f of [0, 1]) if (!scene.textures.exists(`vesper-bat-${f}`)) addPixels(scene, `vesper-bat-${f}`, batFrame(f === 0));
}

/** Three tiny bats orbit a spot, then flutter up and away. */
function batFlight(r: RoamerHandle, x: number, y: number) {
    const { scene } = r.world;
    ensureBats(r);
    const bats = [0, 1, 2].map(() => scene.add.image(x, y, 'vesper-bat-0').setDepth(DEPTH));
    const flap = scene.time.addEvent({ delay: 110, loop: true, callback: () => bats.forEach((b, i) => b.setTexture(`vesper-bat-${(Math.floor(scene.time.now / 110) + i) % 2}`)) });
    const done = () => {
        flap.remove();
        bats.forEach((b) => b.destroy());
    };
    scene.tweens.addCounter({
        from: 0, to: 1, duration: 3000,
        onUpdate: (tw) => {
            const t = tw.getValue() ?? 0;
            const orbit = Math.min(1, t / 0.5);
            const away = Math.max(0, (t - 0.5) / 0.5);
            bats.forEach((b, i) => {
                const a = t * 14 + (i / 3) * Math.PI * 2;
                const rad = 10 * orbit * (1 + away * 3);
                b.setPosition(Math.round(x + Math.cos(a) * rad + away * (i - 1) * 40), Math.round(y - 16 - orbit * 4 + Math.sin(a) * rad * 0.45 - away * away * 120));
                b.setAlpha(1 - away * away);
            });
        },
        onComplete: done,
        onStop: done,
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
}

const spec: RoamerSpec = {
    id: 'velvet-vesper',
    name: 'Velvet Vesper',
    look: { skin: 'cream', hair: 'ink', hairStyle: 'bun', hat: 'violet', shirt: 'wine', pants: 'ink', shoes: 'gold' },
    prop: capeProp,
    glow: 'violet',
    ward: 'ring',
    every: [28, 42],
    stay: [30, 48],
    speed: 22,
    greet: ['Good evening. Do come in.', 'Charmed, truly.', 'What a splendid night!'],
    foil: ['Look into my eyes!', 'Begone, darling pest.', 'How terribly rude!'],
    token: ['Exquisite taste, this coin.', 'A tasteful trinket.'],
    hooks: {
        update(r, dt) {
            const t = ((r.data.inspect as number | undefined) ?? 15) - dt;
            if (t > 0) {
                r.data.inspect = t;
                return;
            }
            r.data.inspect = 15;
            r.pause(1.8);
            r.say('Exquisite.');
            r.sparkle('gold', r.sprite.x + (r.sprite.flipX ? -3 : 3), r.sprite.y - 17);
        },
        onGreet(r) {
            squash(r, 500);
            r.say('Good evening. Do come in.');
            const pl = r.world.player();
            if (pl) for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                pixel(r, pl.x, pl.y - 4, i % 2 ? 'violet' : 'white', pl.x + Math.cos(a) * 14, pl.y - 4 + Math.sin(a) * 6 - 14, 800);
            }
        },
        onFoil(r) {
            const { x, y } = r.sprite;
            for (let i = 0; i < 18; i++) {
                const a = i * 0.7;
                const d = 3 + i * 1.3;
                pixel(r, x, y - 18, i % 3 ? 'violet' : 'plum', x + Math.cos(a) * d, y - 18 + Math.sin(a) * d * 0.7, 700 + i * 20);
            }
            r.say('Look into my eyes...');
        },
        onBurn(r) {
            r.say('Marvelous flames!');
            const { x, y } = r.sprite;
            for (let i = 0; i < 10; i++) {
                pixel(r, x + Phaser.Math.Between(-5, 5), y - 10, i % 2 ? 'slate' : 'violet', x + Phaser.Math.Between(-26, 26), y - Phaser.Math.Between(22, 46), 1100);
            }
            squash(r, 300);
        },
        onLeave(r) {
            const { x, y } = r.sprite;
            r.sparkle('violet', x, y - 14);
            batFlight(r, x, y);
        },
    },
};

export default spec;
