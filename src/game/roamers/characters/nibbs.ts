import Phaser from 'phaser';
import { ensurePixels } from '../../kit';
import { BOX_KEY, boxArt } from '../props/nibbs';
import type { RoamerHandle, RoamerSpec } from '../types';

const HIDE_FOR = 6.5;

interface Box {
    sprite: Phaser.GameObjects.Sprite;
}

function boxOf(r: RoamerHandle): Box | undefined {
    return r.data.box as Box | undefined;
}

function confetti(r: RoamerHandle, x: number, y: number) {
    for (let i = 0; i < 10; i++) r.sparkle(i % 2 ? 'wood' : 'sand', x, y);
}

function dropBox(r: RoamerHandle, puff: boolean) {
    const box = boxOf(r);
    if (!box) return;
    if (puff) confetti(r, box.sprite.x, box.sprite.y - 6);
    box.sprite.destroy();
    r.data.box = undefined;
}

function reveal(r: RoamerHandle) {
    if (!boxOf(r)) return;
    const { x, y } = r.sprite;
    dropBox(r, true);
    r.sprite.setAlpha(1);
    r.data.revealed = true;
    r.sparkle('red', x, y - 22);
    const mark = r.world.scene.add.text(x, y - 28, '!', { fontFamily: 'monospace', fontSize: '8px', color: '#c4314b' })
        .setOrigin(0.5, 1).setDepth(1e7);
    r.world.scene.tweens.add({ targets: mark, y: y - 38, alpha: 0, duration: 600, onComplete: () => mark.destroy() });
}

function hop(r: RoamerHandle) {
    const s = r.sprite;
    r.world.scene.tweens.add({ targets: s, y: s.y - 5, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
}

const spec: RoamerSpec = {
    id: 'nibbs',
    name: 'Nibbs the Cardboard Cryptid',
    look: { skin: 'sand', hair: 'bark', hairStyle: 'cap', hat: 'wood', shirt: 'wood', pants: 'bark', shoes: 'night' },
    glow: 'red',
    ward: 'ring',
    every: [22, 32],
    stay: [32, 48],
    speed: 24,
    greet: ['Hi! Was that box moving?', 'Boo! ...Hello!', 'I live in boxes. Cozy.'],
    foil: ['Boo!', 'Gotcha, box-style!', 'Mimic says shoo!'],
    token: ['Tokens! For my box fort!', 'Shiny. Mine now. Sorry.'],
    hooks: {
        update(r, dt) {
            const d = r.data;
            if (d.revealed) return;
            if (!d.started) {
                d.started = true;
                const { scene } = r.world;
                ensurePixels(scene, BOX_KEY, boxArt);
                const s = r.sprite;
                d.box = { sprite: scene.add.sprite(s.x, s.y, BOX_KEY, 0).setOrigin(0.5, 1).setDepth(s.y) } satisfies Box;
                s.setAlpha(0);
            }
            const box = boxOf(r);
            if (!box) return;
            r.pause(1);
            r.sprite.setAlpha(0);
            const p = r.world.player();
            const near = !!p && Phaser.Math.Distance.Between(p.x, p.y, box.sprite.x, box.sprite.y) < 36;
            d.shiver = ((d.shiver as number) ?? 0) + dt;
            const on = near ? Math.floor((d.shiver as number) * 14) % 2 : Math.floor((d.shiver as number) * 2) % 8 === 0 ? 1 : 0;
            box.sprite.setFrame(on).setDepth(r.sprite.y);
            if (r.age >= HIDE_FOR) reveal(r);
        },
        onGreet(r) {
            if (boxOf(r)) reveal(r);
            else r.sparkle('red');
        },
        onFoil(r) {
            hop(r);
            r.world.scene.time.delayedCall(260, () => hop(r));
            r.say('Boo!');
        },
        onBurn(r) {
            const s = r.sprite;
            dropBox(r, false);
            r.data.revealed = true;
            s.setAlpha(1);
            r.say('Flat. Fine.');
            r.world.scene.tweens.add({
                targets: s,
                scaleY: 0.3,
                duration: 200,
                yoyo: true,
                hold: 700,
                onComplete: () => s.setScale(1),
            });
        },
        onLeave(r) {
            const { x, y } = r.sprite;
            dropBox(r, false);
            confetti(r, x, y - 12);
        },
    },
};

export default spec;
