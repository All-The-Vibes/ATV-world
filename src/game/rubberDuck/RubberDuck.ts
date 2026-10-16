import type Phaser from 'phaser';
import { addCreatorNametag, addPixels, ensurePixels, shadowTexture, speechArt } from '../kit';
import { DUCK_HEIGHT, rubberDuckSheet } from './art';

/** Polite offers to review things; the first is the introduction. */
const REVIEW_LINES = [
    "Hi I'm Rubber Duck",
    'May I review your code, please?',
    'Would you kindly walk me through your idea?',
    'May we check the edge cases together?',
    'If you like, I would be delighted to review your tests.',
    'Thank you for sharing. Take your time; I am happy to listen.',
    'Excuse me, may I glance at your function names? I promise to be kind.',
    'Please forgive the interruption. Might I read your error message aloud?',
    'It would be my honour to review your commit message. Thank you kindly.',
    'May I suggest a tiny refactor? Only if it is convenient, of course.',
    'Pardon me, have you tried explaining it to a duck? I am available.',
    'Might I gently review that variable name? I am sure it has feelings.',
];

/** Every third comment shows the duck can do more than review code. */
const MORE_LINES = [
    'On my days off I play tennis. My serve is very well reviewed.',
    'I do more than review code, you know. I also paint. Mostly yellow. Critics call it a bold period.',
    'If I may, I am also a fine salsa dancer. The webbed feet are cheating, frankly.',
    'I bake sourdough at the weekend. It always rises, unlike certain test coverage.',
    'Between reviews I do karaoke. Quack Me Maybe is my signature song.',
    'I also do stand-up, if you will pardon me. Mostly sit-down. Short legs.',
    'I have a side career in pond diplomacy. Very delicate work, thank you for asking.',
];

const kindOf = (comment: number) => (comment % 3 === 2 ? 'more' : 'review');
const lineFor = (comment: number) => kindOf(comment) === 'more'
    ? { kind: 'more', index: Math.floor(comment / 3) % MORE_LINES.length }
    : { kind: 'review', index: (comment - Math.floor(comment / 3)) % REVIEW_LINES.length };

/** Seconds between lightning strikes, and how long the duck sizzles before it teleports. */
const STRIKE_EVERY = 8;
const SIZZLE = 0.22;
/** The little oval the duck waddles round, and the box that must be quiet around it. */
const ORBIT = { x: 70, y: 16 };
const ROOM = { halfWidth: 80, above: 80, below: 20 };
const SPEED = 0.5;

interface Box { x: number; y: number; width: number; height: number }

export interface RubberDuckOptions {
    bounds: () => Phaser.Geom.Rectangle;
    /** False where the duck can't stand (buildings, water, HQ). */
    open: (x: number, y: number) => boolean;
}

export class RubberDuck {
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly bubble: Phaser.GameObjects.Image;
    private readonly effects: { g: Phaser.GameObjects.Graphics; age: number; life: number }[] = [];
    private clock = 0;
    private lineTime = 0;
    /** How many comments the duck has made so far, counting from the introduction. */
    private comment = 0;
    private strikeClock = 0;
    /** The centre of the oval the duck patrols; a strike moves it. */
    private home = { x: 0, y: 106 };
    /** Set while the duck is hit by lightning and about to teleport to `to`. */
    private zap: { age: number; to?: { x: number; y: number } } | null = null;

    constructor(private readonly scene: Phaser.Scene, private readonly opts: RubberDuckOptions) {
        ensurePixels(scene, 'rubber-duck', rubberDuckSheet);
        REVIEW_LINES.forEach((line, index) => addPixels(scene, `rubber-duck-review-${index}`, speechArt(line, 26)));
        MORE_LINES.forEach((line, index) => addPixels(scene, `rubber-duck-more-${index}`, speechArt(line, 26)));
        if (!scene.anims.exists('rubber-duck-waddle')) {
            scene.anims.create({
                key: 'rubber-duck-waddle',
                frames: Array.from({ length: 4 }, (_, frame) => ({ key: 'rubber-duck', frame })),
                frameRate: 6,
                repeat: -1,
            });
        }
        this.shadow = scene.add.image(0, 0, shadowTexture(scene, 52))
            .setName('Rubber Duck-shadow').setAlpha(0.25).setDepth(-1e8);
        this.sprite = scene.add.sprite(0, 0, 'rubber-duck')
            .setName('Rubber Duck').setOrigin(0.5, 1).play('rubber-duck-waddle')
            .setInteractive({ useHandCursor: true });
        this.bubble = scene.add.image(0, 0, 'rubber-duck-review-0')
            .setName('Rubber Duck-speech').setOrigin(0.5, 1).setDepth(1e5);
        addCreatorNametag(this.sprite, { githubUsername: 'markbriggs-ms' }, { speech: () => this.bubble });
        this.sprite.on('pointerdown', () => this.nextLine());
        this.showLine();
        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    update(dt: number) {
        const step = Math.min(dt, 0.1);
        this.lineTime += step;
        if (this.lineTime >= 8) this.nextLine();

        if (this.zap) {
            this.zap.age += step;
            this.sprite.setAlpha(Math.floor(this.zap.age * 40) % 2 ? 0.4 : 1);
            if (this.zap.age >= SIZZLE) this.teleport();
        } else {
            this.clock += step;
            this.strikeClock += step;
            if (this.strikeClock >= STRIKE_EVERY) this.strike();
        }

        const { x, y, facing } = this.stance();
        this.sprite.setPosition(x, y).setDepth(y).setFlipX(facing);
        this.shadow.setPosition(x, y);
        this.bubble.setPosition(x, y - DUCK_HEIGHT - 3).setVisible(this.lineTime < 6.5);
        this.fadeEffects(step);
    }

    private stance(home = this.home) {
        const angle = Math.PI / 2 + this.clock * SPEED;
        return {
            x: Math.round(home.x + Math.cos(angle) * ORBIT.x),
            y: Math.round(home.y + Math.sin(angle) * ORBIT.y),
            facing: Math.sin(angle) > 0,
        };
    }

    private strike() {
        this.strikeClock = 0;
        this.zap = { age: 0, to: this.quietSpot() ?? undefined };
        this.bolt(this.sprite.x, this.sprite.y, 340);
    }

    private teleport() {
        const to = this.zap?.to;
        this.zap = null;
        this.sprite.setAlpha(1);
        if (!to) return;
        this.home = to;
        const { x, y } = this.stance();
        this.bolt(x, y, 150);
    }

    /** Pixel-art lightning from the sky down to (x, y), with a glow where it lands. */
    private bolt(x: number, y: number, height: number) {
        const g = this.scene.add.graphics().setDepth(1e6);
        const rand = (n: number) => Math.round((Math.random() * 2 - 1) * n);
        const points = [{ x: x + rand(20), y: y - height }];
        for (let i = 1; i < 7; i++) points.push({ x: x + rand(16), y: y - height + Math.round((i * (height - 6)) / 7) });
        points.push({ x, y: y - 6 });
        g.fillStyle(0xfbe46f, 0.3).fillCircle(x, y - 12, 44);
        g.fillStyle(0xffffff, 0.6).fillCircle(x, y - 12, 24);
        for (const [width, color, alpha] of [[8, 0xfbe46f, 0.4], [4, 0xfbe46f, 1], [2, 0xffffff, 1]] as const) {
            g.lineStyle(width, color, alpha).beginPath().moveTo(points[0].x, points[0].y);
            for (const p of points.slice(1)) g.lineTo(p.x, p.y);
            g.strokePath();
        }
        this.effects.push({ g, age: 0, life: 0.35 });
    }

    private fadeEffects(step: number) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const fx = this.effects[i];
            fx.age += step;
            if (fx.age >= fx.life) {
                fx.g.destroy();
                this.effects.splice(i, 1);
            } else {
                fx.g.setAlpha((1 - fx.age / fx.life) * (Math.floor(fx.age * 30) % 2 ? 0.7 : 1));
            }
        }
    }

    /** Everything on the ground that would crowd the duck: people, props, and small buildings. */
    private crowd(): Box[] {
        const boxes: Box[] = [];
        for (const object of this.scene.children.list) {
            if (object === this.sprite || object === this.shadow || object === this.bubble) continue;
            const item = object as unknown as Partial<{
                depth: number; visible: boolean; getBounds: () => Box;
            }>;
            if (!item.getBounds || !item.visible || item.depth === undefined || item.depth < -1e6 || item.depth > 5e4) continue;
            const box = item.getBounds();
            if (box.width < 300 && box.height < 300) boxes.push({ x: box.x, y: box.y, width: box.width, height: box.height });
        }
        return boxes;
    }

    /** How many things overlap the room the duck needs if it patrols around (x, y). */
    busyAt(x: number, y: number, boxes = this.crowd()) {
        const left = x - ROOM.halfWidth, right = x + ROOM.halfWidth, top = y - ROOM.above, bottom = y + ROOM.below;
        return boxes.filter((b) => b.x < right && b.x + b.width > left && b.y < bottom && b.y + b.height > top).length;
    }

    /** The quietest open patch near the middle of the map, away from where the duck is now. */
    private quietSpot() {
        const bounds = this.opts.bounds();
        const boxes = this.crowd();
        const { open } = this.opts;
        let best: { x: number; y: number } | null = null;
        let bestCost = Infinity;
        for (let row = -4; row <= 4; row++) {
            for (let col = -5; col <= 5; col++) {
                const home = { x: Math.round(bounds.centerX + col * 26), y: Math.round(bounds.centerY + row * 22) };
                if (home.x < bounds.left + 100 || home.x > bounds.right - 100
                    || home.y < bounds.top + 80 || home.y > bounds.bottom - 40) continue;
                const land = this.stance(home);
                if (!open(land.x, land.y) || Math.hypot(land.x - this.sprite.x, land.y - this.sprite.y) < 90) continue;
                const blocked = [[-ORBIT.x, 0], [ORBIT.x, 0], [0, -ORBIT.y], [0, ORBIT.y]]
                    .filter(([dx, dy]) => !open(home.x + dx, home.y + dy)).length;
                const cost = this.busyAt(home.x, home.y, boxes) * 2 + blocked * 8
                    + Math.hypot(home.x - bounds.centerX, home.y - bounds.centerY) * 0.04 + Math.random() * 0.5;
                if (cost < bestCost) {
                    bestCost = cost;
                    best = home;
                }
            }
        }
        return best;
    }

    private nextLine() {
        this.comment++;
        this.lineTime = 0;
        this.showLine();
    }

    private showLine() {
        const { kind, index } = lineFor(this.comment);
        const text = kind === 'more' ? MORE_LINES[index] : REVIEW_LINES[index];
        this.bubble.setTexture(`rubber-duck-${kind}-${index}`)
            .setData('text', text).setData('kind', kind).setVisible(true);
    }

    destroy() {
        this.effects.forEach(({ g }) => g.destroy());
        this.effects.length = 0;
        this.sprite.destroy();
        this.shadow.destroy();
        this.bubble.destroy();
    }
}
