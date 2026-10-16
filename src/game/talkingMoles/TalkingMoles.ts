import type Phaser from 'phaser';
import { addCreatorNametag, ensurePixels, speechArt } from '../kit';
import { burrowArt, MOLE_HEIGHT, moleSheet } from './art';
import { sp } from '../spread';

const QUIPS = [
    'My AI agent dug this. It also deleted production.',
    'I tried vibe digging. Now my tunnel needs a subscription.',
    'One million tokens and it still thinks I am a mouse.',
    'I live underground. My context window has a basement.',
    'My agent hired six agents. None of them brought a shovel.',
    'Not a hallucination. I really did eat your GPU budget.',
    'They said AI needs grounding. You are welcome.',
    'Thinking deeply... actually, just stuck in the dirt.',
];
const PERIOD = 27;
const RISE = 0.8;
const TALK_START = 1.5;
const TALK_END = 7;
const HIDE = 7.8;
const CLEAR = 8.4;

type Burrow = {
    hole: Phaser.GameObjects.Image;
    mole: Phaser.GameObjects.Image;
    rim: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Image;
};

/** Staggered lawn visitors: dig up, deliver a joke, then tuck back below the soil. */
export class TalkingMoles {
    private readonly burrows: Burrow[];
    private clock = 0;

    constructor(scene: Phaser.Scene) {
        ensurePixels(scene, 'talking-mole', moleSheet);
        ensurePixels(scene, 'talking-mole-hole', () => burrowArt());
        ensurePixels(scene, 'talking-mole-rim', () => burrowArt(true));
        QUIPS.forEach((line, i) => ensurePixels(scene, `talking-mole-quip-${i}`, () => speechArt(line, 24)));
        this.burrows = [[-285, 82], [-35, 195], [165, 65]].map(([x, y]) => [sp(x), sp(y)]).map(([x, y]) => ({
            hole: scene.add.image(x, y, 'talking-mole-hole').setDepth(y - 2),
            mole: scene.add.image(x, y + 1, 'talking-mole', 0).setOrigin(0.5, 1).setDepth(y),
            rim: scene.add.image(x, y, 'talking-mole-rim').setDepth(y + 1),
            bubble: scene.add.image(x, y - 29, 'talking-mole-quip-0').setOrigin(0.5, 1).setDepth(1e5),
        }));
        this.burrows.forEach(({ mole, bubble }) =>
            addCreatorNametag(mole, { githubUsername: 'markbriggs-ms' }, { speech: () => bubble }));
        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    update(dt: number) {
        this.clock += Math.min(dt, 0.1);
        this.burrows.forEach(({ hole, mole, rim, bubble }, i) => {
            const elapsed = this.clock - i * 9;
            const phase = elapsed < 0 ? PERIOD : elapsed % PERIOD;
            const aboveGround = phase < HIDE;
            const lift = phase < RISE ? phase / RISE
                : phase < TALK_END ? 1 : Math.max(0, (HIDE - phase) / (HIDE - TALK_END));
            mole.setVisible(aboveGround).setFrame(Math.round(lift * MOLE_HEIGHT));
            const dirtAlpha = phase < RISE ? Math.min(1, phase / 0.2)
                : phase < HIDE ? 1 : Math.max(0, (CLEAR - phase) / (CLEAR - HIDE));
            hole.setVisible(phase < CLEAR).setAlpha(dirtAlpha);
            rim.setVisible(phase < CLEAR).setAlpha(dirtAlpha);
            bubble.setPosition(mole.x, mole.y - 30);
            bubble.setVisible(phase >= TALK_START && phase < TALK_END);
            if (bubble.visible) {
                const cycle = Math.floor(elapsed / PERIOD);
                bubble.setTexture(`talking-mole-quip-${(cycle * this.burrows.length + i) % QUIPS.length}`);
            }
        });
    }

    destroy() {
        for (const { hole, mole, rim, bubble } of this.burrows) {
            hole.destroy();
            mole.destroy();
            rim.destroy();
            bubble.destroy();
        }
    }
}
