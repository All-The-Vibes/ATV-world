import Phaser from 'phaser';
import { addPixels, characterSheet, ensurePixels, lookKey, randomLook, shadowTexture, speechArt, type ColorName } from '../kit';
import { FEET_Y, FIELD, FLAG, ROPE_H, ROPE_W, SIGN, fieldArt, flagArt, ropeArt, signArt } from './art';
import { QUIPS } from './quips';

interface Puller {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Image;
    /** Which way they pull: -1 for the left team, 1 for the right. */
    side: -1 | 1;
    /** Distance from the centre line when the rope is level. */
    home: number;
    phase: number;
    /** Seconds left on their speech bubble, and how wide it is. */
    talk: number;
    bubbleW: number;
}

const TEAM_SIZE = 4;
/** A wide gap between the front pullers keeps the sign behind them in view. */
const FRONT = 66;
const SPACING = 16;
const SHIRTS: Record<-1 | 1, ColorName> = { [-1]: 'red', 1: 'blue' };
const MAX_TALKERS = 2;
/** Speakers have to stand at least this far apart so their bubbles don't pile up. */
const TALK_GAP = 80;
const TALK_SECONDS = 3.4;

/**
 * Two teams hauling on a rope that never gets anywhere. The flag drifts back and forth over the mud
 * but never reaches either win line, and now and then someone shouts something about it.
 */
export class TugOfWar {
    private readonly pullers: Puller[] = [];
    private readonly field: Phaser.GameObjects.Image;
    private readonly sign: Phaser.GameObjects.Image;
    private readonly rope: Phaser.GameObjects.Image;
    private readonly flag: Phaser.GameObjects.Image;
    private readonly quips = Phaser.Utils.Array.Shuffle([...QUIPS]);
    private readonly still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    private nextQuip = 0;
    private clock = 0;
    private nextTalk = 1;
    private offset = 0;

    constructor(private readonly scene: Phaser.Scene, private readonly x: number, private readonly y: number) {
        ensurePixels(scene, 'tug-field', fieldArt);
        ensurePixels(scene, 'tug-rope', ropeArt);
        ensurePixels(scene, 'tug-flag', flagArt);
        ensurePixels(scene, 'tug-sign', signArt);
        const feet = y + FEET_Y;
        this.field = scene.add.image(x, y, 'tug-field').setOrigin(0, 0).setDepth(-1e7);
        this.sign = scene.add.image(x + FIELD.w / 2, y + SIGN.h, 'tug-sign').setOrigin(0.5, 1).setDepth(y + SIGN.h);
        this.rope = scene.add.image(0, 0, 'tug-rope').setDepth(feet + 0.5);
        this.flag = scene.add.image(0, 0, 'tug-flag').setOrigin(0.5, 0).setDepth(feet + 0.6);
        for (const side of [-1, 1] as const) {
            for (let i = 0; i < TEAM_SIZE; i++) this.addPuller(side, i);
        }
        this.update(0);
    }

    getBounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(this.x, this.y, FIELD.w, FIELD.h);
    }

    private addPuller(side: -1 | 1, i: number) {
        const scene = this.scene;
        const look = randomLook(`tug-${side}-${i}`, { shirt: SHIRTS[side] });
        const key = lookKey(look);
        const sheet = characterSheet(look);
        addPixels(scene, key, sheet.canvas, sheet.frames);
        const feet = this.y + FEET_Y;
        this.pullers.push({
            sprite: scene.add.sprite(0, feet, key, 'side-1').setOrigin(0.5, 1).setFlipX(side === 1).setDepth(feet + i * 0.01),
            shadow: scene.add.image(0, feet, shadowTexture(scene, 12)).setAlpha(0.25).setDepth(-1e7 + 1),
            bubble: scene.add.image(0, 0, 'tug-flag').setOrigin(0.5, 1).setDepth(1e5).setVisible(false),
            side,
            home: FRONT + i * SPACING,
            phase: Math.random(),
            talk: 0,
            bubbleW: 0,
        });
    }

    /** Where the flag is, relative to the centre line: always wandering, never past the win lines. */
    private flagOffset(t: number) {
        const swell = 0.8 + 0.2 * Math.sin(t * 0.13);
        return swell * (14 * Math.sin(t * 0.7) + 8 * Math.sin(t * 1.9 + 1.3) + 4 * Math.sin(t * 4.3 + 0.4));
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        if (!this.still) this.clock += dt;
        const t = this.clock;
        const previous = this.offset;
        this.offset = this.flagOffset(t);
        const velocity = dt > 0 ? (this.offset - previous) / dt : 0;

        const centre = this.x + FIELD.w / 2;
        const feet = this.y + FEET_Y;
        const shift = Math.round(this.offset);
        this.rope.setPosition(centre + shift, feet - 10 + ROPE_H / 2);
        this.flag.setPosition(centre + shift, feet - 8).setAngle(this.still ? 0 : Math.sin(t * 3) * 6);

        for (const p of this.pullers) {
            // The team the rope is moving toward leans a little harder.
            const gaining = Phaser.Math.Clamp(-p.side * velocity * 0.2, -3, 3);
            const lean = 9 + gaining + (this.still ? 0 : Math.sin(t * 2.2 + p.phase * 6.28) * 2);
            const heave = this.still ? 0 : Math.abs(Math.sin((t * 1.6 + p.phase) * Math.PI));
            const x = Math.round(centre + shift + p.side * p.home);
            p.sprite
                .setPosition(x, feet - Math.round(heave))
                .setAngle(p.side * lean)
                .setFrame((t * 5 + p.phase) % 1 < 0.5 ? 'side-1' : 'side-2');
            p.shadow.setPosition(x, feet);
            if (p.talk > 0) {
                p.talk -= dt;
                // Slide the bubble outward rather than let it cover the sign.
                const clear = SIGN.w / 2 + 3 + p.bubbleW / 2;
                const bx = centre + p.side * Math.max(Math.abs(x - centre), clear);
                p.bubble.setPosition(Math.round(bx), Math.round(p.sprite.y - 25));
            }
            p.bubble.setVisible(p.talk > 0);
        }

        this.nextTalk -= dt;
        if (this.nextTalk <= 0) {
            this.nextTalk = Phaser.Math.FloatBetween(0.8, 2);
            this.shout();
        }
    }

    private shout() {
        const talkers = this.pullers.filter((p) => p.talk > 0);
        if (talkers.length >= MAX_TALKERS) return;
        const free = this.pullers.filter((p) => p.talk <= 0 && talkers.every((o) => Math.abs(o.sprite.x - p.sprite.x) >= TALK_GAP));
        if (!free.length) return;
        const text = this.quips[this.nextQuip++ % this.quips.length];
        const key = `tug-quip-${text}`;
        ensurePixels(this.scene, key, () => speechArt(text, 18));
        const who = Phaser.Utils.Array.GetRandom(free);
        who.bubble.setTexture(key);
        who.bubbleW = who.bubble.width;
        who.talk = TALK_SECONDS;
    }
}
