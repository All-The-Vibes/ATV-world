import Phaser from 'phaser';
import {
    PixelCanvas, addCreatorNametag, addPixels, characterSheet, ensurePixels, lookKey, miniText, miniTextWidth, randomLook, shadowTexture, speechArt,
    type ColorName, type Facing,
} from '../kit';
import { BOARD, DECK, POOL_FRAMES, STEPS_X, TOWER, WATER, boardArt, piranhaArt, poolArt, rippleArt, splashArt, towerArt, wakeArt, wednesdayArt } from './art';
import { FLOP_QUIPS, QUIPS, WEDNESDAY_QUOTES } from './quips';

type Vec = { x: number; y: number };
type Mode = 'queue' | 'climb' | 'board' | 'bounce' | 'air' | 'swim';
type Style = 'dive' | 'flip' | 'cannonball' | 'bellyflop';

interface Swimmer {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    wake: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Image;
    key: string;
    mode: Mode;
    /** Waypoints to walk before taking their place in the queue. */
    path: Vec[];
    /** Seconds spent in the current mode (or waiting at the front of the queue). */
    t: number;
    /** Jump start and landing; while swimming, `from` is where they are on the water. */
    from: Vec;
    to: Vec;
    style: Style;
    /** Seconds left on their speech bubble. */
    talk: number;
}

// Spots around the pool, in pixels from the deck's top-left corner.
const LADDER = { x: 85, y: 66 };
const TOWER_LEFT = 74;
const PLATFORM_Y = LADDER.y - TOWER.h + 10;
const HINGE_X = 88;
const TIP_X = 126;
const EXIT = { x: STEPS_X, y: WATER.y + WATER.h - 6 };
const WALKWAY_Y = 90;

const SWIMMERS = 6;
const BOUNCE = 1.2;
const AIR = 0.95;
const SWIM_DEPTH = -1e7 + 2;
const SUITS: ColorName[] = ['red', 'pink', 'gold', 'violet', 'cyan', 'orange', 'leaf', 'blue', 'navy', 'wine'];
const STYLES: Style[] = ['dive', 'flip', 'cannonball', 'bellyflop'];

/**
 * A swimming pool with a high dive. Swimmers queue at the ladder, climb, bounce on the board, and jump
 * (a dive, a flip, a cannonball, or a belly flop). They say something when they hit the water, swim to
 * the steps, and join the back of the queue again.
 */
export class Pool {
    private readonly swimmers: Swimmer[] = [];
    private readonly queue: Swimmer[] = [];
    private readonly board: Phaser.GameObjects.Image;
    private readonly deck: Phaser.GameObjects.Image;
    private readonly tower: Phaser.GameObjects.Image;
    private readonly quips: string[];
    private readonly flops: string[];
    private nextQuip = 0;
    private nextFlop = 0;
    private clock = 0;
    private readonly wednesday: Phaser.GameObjects.Image;
    private readonly wednesdayBubble: Phaser.GameObjects.Image;
    private readonly wednesdayQuoteKeys: string[] = [];
    private wednesdayQuoteTimer = 1.5;
    private wednesdayTalkRemaining = 0;
    private lastWednesdayQuote = -1;
    private readonly piranhas: {
        sprite: Phaser.GameObjects.Sprite;
        wake: Phaser.GameObjects.Image;
        cx: number;
        cy: number;
        rx: number;
        ry: number;
        speed: number;
        phase: number;
    }[] = [];
    private piranhaClock = 0;

    constructor(private readonly scene: Phaser.Scene, private readonly x: number, private readonly y: number) {
        ensurePixels(scene, 'pool', poolArt);
        ensurePixels(scene, 'pool-tower', towerArt);
        ensurePixels(scene, 'pool-board', boardArt);
        ensurePixels(scene, 'pool-splash', splashArt);
        ensurePixels(scene, 'pool-ripple', rippleArt);
        ensurePixels(scene, 'pool-wake', wakeArt);
        ensurePixels(scene, 'pool-wednesday', wednesdayArt);
        ensurePixels(scene, 'pool-piranha', piranhaArt);
        for (const [key, frames, frameRate] of [['pool', 3, 4], ['pool-splash', 5, 14], ['pool-piranha', 2, 7]] as const) {
            if (!scene.anims.exists(key)) {
                scene.anims.create({ key, frames: Array.from({ length: frames }, (_, frame) => ({ key, frame })), frameRate, repeat: key === 'pool-splash' ? 0 : -1 });
            }
        }
        this.quips = Phaser.Utils.Array.Shuffle([...QUIPS]);
        this.flops = Phaser.Utils.Array.Shuffle([...FLOP_QUIPS]);

        // A plain image (not a sprite), so the terrain treats it like a building and keeps grass and rocks off it.
        this.deck = scene.add.image(x, y, 'pool', 0).setOrigin(0, 0).setDepth(-1e7);
        this.tower = scene.add.image(x + TOWER_LEFT, y + LADDER.y, 'pool-tower').setOrigin(0, 1).setDepth(y + LADDER.y);
        this.board = scene.add.image(x + HINGE_X, y + PLATFORM_Y + 1.5, 'pool-board')
            .setOrigin(0, 0.5)
            .setDepth(y + LADDER.y + 0.5);
        for (let i = 0; i < SWIMMERS; i++) this.addSwimmer(i);

        // Wednesday Addams standing on the pool edge overlooking the piranha-filled water.
        const wx = x + WATER.x + WATER.w - 22;
        const wy = y + WATER.y + 2;
        scene.add.image(wx, wy, shadowTexture(scene, 10)).setAlpha(0.3).setDepth(-1e7 + 1);
        this.wednesday = scene.add.image(wx, wy, 'pool-wednesday').setOrigin(0.5, 1).setDepth(wy + 2);
        this.wednesday.setName('Wednesday');

        const labelKey = 'pool-wednesday-label';
        const labelCanvas = new PixelCanvas(miniTextWidth('WEDNESDAY') + 6, 9);
        labelCanvas.rect(0, 0, labelCanvas.width, 9, 'ink').rect(0, 0, labelCanvas.width, 1, 'plum');
        miniText(labelCanvas, 3, 2, 'WEDNESDAY', 'white');
        addPixels(scene, labelKey, labelCanvas);
        scene.add.image(wx, wy - 25, labelKey).setOrigin(0.5, 1).setDepth(wy + 3);

        WEDNESDAY_QUOTES.forEach((quote, idx) => {
            const k = `pool-wednesday-quote-${idx}`;
            ensurePixels(scene, k, () => speechArt(quote, 26));
            this.wednesdayQuoteKeys.push(k);
        });
        this.wednesdayBubble = scene.add.image(wx, wy - 36, this.wednesdayQuoteKeys[0])
            .setOrigin(0.5, 1)
            .setDepth(1e5 + 2)
            .setVisible(false);
        addCreatorNametag(this.wednesday, { githubUsername: 'ShahabName' }, { gap: 16, speech: () => this.wednesdayBubble });

        // School of snapping piranhas swimming in the pool water around Wednesday.
        const piranhaSpots = [
            { cx: x + WATER.x + 34, cy: y + WATER.y + 20, rx: 18, ry: 7, speed: 1.7, phase: 0 },
            { cx: x + WATER.x + 68, cy: y + WATER.y + 34, rx: 22, ry: 8, speed: 2.1, phase: 1.4 },
            { cx: x + WATER.x + 98, cy: y + WATER.y + 22, rx: 19, ry: 6, speed: 1.9, phase: 2.8 },
            { cx: x + WATER.x + 84, cy: y + WATER.y + 46, rx: 20, ry: 7, speed: 2.3, phase: 4.1 },
            { cx: x + WATER.x + 112, cy: y + WATER.y + 38, rx: 14, ry: 6, speed: 2.5, phase: 5.2 },
        ];
        for (const spot of piranhaSpots) {
            const wake = scene.add.image(spot.cx, spot.cy + 2, 'pool-wake').setScale(0.75).setAlpha(0.7).setDepth(SWIM_DEPTH);
            const sprite = scene.add.sprite(spot.cx, spot.cy, 'pool-piranha', 0)
                .setOrigin(0.5, 0.5)
                .setDepth(SWIM_DEPTH + 1.5)
                .play('pool-piranha');
            this.piranhas.push({ sprite, wake, ...spot });
        }
    }

    /** The deck plus the tower, for fitting the world around it. */
    getBounds(): Phaser.Geom.Rectangle {
        return Phaser.Geom.Rectangle.Union(this.deck.getBounds(), this.tower.getBounds());
    }

    /** Just the deck and water (where nothing should be dropped). */
    deckBounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(this.x, this.y, DECK.w, DECK.h);
    }

    private at(lx: number, ly: number): Vec {
        return { x: this.x + lx, y: this.y + ly };
    }

    private addSwimmer(i: number) {
        const scene = this.scene;
        const base = randomLook(`pool-${i}`, { githubUsername: 'markbriggs-ms' });
        const suit = SUITS[(i * 3) % SUITS.length];
        // Most go shirtless in trunks; some wear a one-piece. Everyone's barefoot.
        const look = { ...base, shirt: i % 3 === 1 ? suit : base.skin, pants: suit, shoes: base.skin };
        const key = lookKey(look);
        const sheet = characterSheet(look);
        addPixels(scene, key, sheet.canvas, sheet.frames);
        for (const facing of ['down', 'up', 'side'] as const) {
            const anim = `${key}-${facing}-walk`;
            if (!scene.anims.exists(anim)) {
                scene.anims.create({ key: anim, frames: [1, 0, 2, 0].map((n) => ({ key, frame: `${facing}-${n}` })), frameRate: 8, repeat: -1 });
            }
        }
        if (!scene.anims.exists(`${key}-climb`)) {
            scene.anims.create({ key: `${key}-climb`, frames: ['up-1', 'up-2'].map((frame) => ({ key, frame })), frameRate: 6, repeat: -1 });
        }
        const at = this.slot(i);
        const s: Swimmer = {
            sprite: scene.add.sprite(at.x, at.y, key, 'side-0').setOrigin(0.5, 1),
            shadow: scene.add.image(at.x, at.y, shadowTexture(scene, 10)).setAlpha(0.25).setDepth(-1e7 + 1),
            wake: scene.add.image(0, 0, 'pool-wake').setDepth(SWIM_DEPTH + 1).setVisible(false),
            bubble: scene.add.image(0, 0, 'pool-wake').setOrigin(0.5, 1).setDepth(1e5).setVisible(false),
            key,
            mode: 'queue',
            path: [],
            t: 0,
            from: at,
            to: at,
            style: 'dive',
            talk: 0,
        };
        addCreatorNametag(s.sprite, look, { speech: () => s.bubble });
        this.swimmers.push(s);
        this.queue.push(s);
    }

    /** Where the i-th person in the queue stands: at the foot of the ladder, then lined up to its left. */
    private slot(i: number): Vec {
        return i === 0 ? this.at(LADDER.x, LADDER.y) : this.at(LADDER.x - 14 - (i - 1) * 12, LADDER.y);
    }

    private towerBusy() {
        return this.swimmers.some((s) => s.mode === 'climb' || s.mode === 'board' || s.mode === 'bounce');
    }

    private play(s: Swimmer, anim: string) {
        if (s.sprite.anims.currentAnim?.key !== anim || !s.sprite.anims.isPlaying) s.sprite.play(anim);
    }

    private stand(s: Swimmer, facing: Facing, flip = false) {
        s.sprite.stop().setFrame(`${facing}-0`).setFlipX(flip);
    }

    /** Step toward `to`; true once there. */
    private walk(s: Swimmer, to: Vec, speed: number, dt: number): boolean {
        const p = s.sprite;
        const dx = to.x - p.x;
        const dy = to.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.5) return true;
        const step = Math.min(d, speed * dt);
        p.setPosition(p.x + dx / d * step, p.y + dy / d * step);
        const facing: Facing = Math.abs(dx) >= Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
        p.setFlipX(facing === 'side' && dx < 0);
        this.play(s, `${s.key}-${facing}-walk`);
        return step >= d;
    }

    /** Where the board's tip is, as it flexes. */
    private tipY() {
        return this.y + PLATFORM_Y + Math.sin(Phaser.Math.DegToRad(this.board.angle)) * (TIP_X - HINGE_X);
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        this.clock += dt;
        const frame = Math.floor(this.clock * 4) % POOL_FRAMES;
        if (this.deck.frame.name !== String(frame)) this.deck.setFrame(frame);
        for (const s of this.swimmers) {
            s.t += dt;
            const p = s.sprite;
            const groundY = this.y + LADDER.y;
            switch (s.mode) {
                case 'queue': {
                    const i = this.queue.indexOf(s);
                    if (!this.walk(s, s.path[0] ?? this.slot(i), 34, dt)) {
                        s.t = 0;
                    } else if (s.path.length) {
                        s.path.shift();
                    } else {
                        if (p.anims.isPlaying) this.stand(s, i === 0 ? 'up' : 'side');
                        if (i === 0 && s.t > 0.8 && !this.towerBusy()) {
                            this.queue.shift();
                            s.mode = 'climb';
                            s.t = 0;
                        }
                    }
                    p.setDepth(p.y + 0.5);
                    s.shadow.setPosition(p.x, p.y);
                    break;
                }
                case 'climb':
                    p.y -= 30 * dt;
                    this.play(s, `${s.key}-climb`);
                    p.setDepth(groundY + 1);
                    s.shadow.setPosition(p.x, groundY);
                    if (p.y <= this.y + PLATFORM_Y) {
                        p.y = this.y + PLATFORM_Y;
                        s.mode = 'board';
                    }
                    break;
                case 'board':
                    p.setDepth(groundY + 1);
                    s.shadow.setPosition(p.x, groundY);
                    if (this.walk(s, this.at(TIP_X, PLATFORM_Y), 24, dt)) {
                        s.mode = 'bounce';
                        s.t = 0;
                        s.style = Phaser.Utils.Array.GetRandom(STYLES);
                        this.stand(s, 'side');
                    }
                    break;
                case 'bounce': {
                    // Three hops; the board dips each time they come down on it.
                    const hop = Math.abs(Math.sin(s.t / BOUNCE * 3 * Math.PI)) * 6;
                    this.board.setAngle((1 - hop / 6) ** 3 * 5);
                    p.y = this.tipY() - hop;
                    if (s.t >= BOUNCE) this.launch(s);
                    break;
                }
                case 'air':
                    this.fly(s);
                    s.shadow.setPosition(p.x, groundY);
                    break;
                case 'swim': {
                    const to = this.at(EXIT.x, EXIT.y);
                    const dx = to.x - s.from.x;
                    const dy = to.y - s.from.y;
                    const d = Math.hypot(dx, dy);
                    // Bob for a moment after surfacing, then paddle to the steps.
                    if (s.t > 0.9 && d > 0.5) {
                        const step = Math.min(d, 20 * dt);
                        s.from = { x: s.from.x + dx / d * step, y: s.from.y + dy / d * step };
                        p.setFlipX(dx < 0);
                        this.play(s, `${s.key}-side-walk`);
                    }
                    p.setPosition(s.from.x, s.from.y + 10 + Math.round(Math.sin(s.t * 5)));
                    s.wake.setPosition(Math.round(s.from.x), Math.round(s.from.y) + 1);
                    if (d <= 0.5) this.climbOut(s);
                    break;
                }
            }
            if (s.talk > 0) {
                s.talk -= dt;
                s.bubble.setPosition(Math.round(p.x), Math.round(p.y - 23));
            }
            s.bubble.setVisible(s.talk > 0);
        }

        // Update circling piranhas in the pool water.
        this.piranhaClock += dt;
        for (const f of this.piranhas) {
            const angle = this.piranhaClock * f.speed + f.phase;
            const px = Math.round(f.cx + Math.cos(angle) * f.rx);
            const py = Math.round(f.cy + Math.sin(angle * 1.3) * f.ry);
            const vx = -Math.sin(angle) * f.rx * f.speed;
            f.sprite.setPosition(px, py).setFlipX(vx < 0);
            f.wake.setPosition(px, py + 2);
        }

        // Wednesday says a random quote from the series with a 10-second pause between quotes.
        if (this.wednesdayTalkRemaining > 0) {
            this.wednesdayTalkRemaining -= dt;
            if (this.wednesdayTalkRemaining <= 0) {
                this.wednesdayBubble.setVisible(false);
                this.wednesdayQuoteTimer = 10;
            }
        } else {
            this.wednesdayQuoteTimer -= dt;
            if (this.wednesdayQuoteTimer <= 0 && this.wednesdayQuoteKeys.length > 0) {
                const count = this.wednesdayQuoteKeys.length;
                const next = count > 1
                    ? (this.lastWednesdayQuote + Phaser.Math.Between(1, count - 1)) % count
                    : 0;
                this.lastWednesdayQuote = next;
                this.wednesdayBubble
                    .setTexture(this.wednesdayQuoteKeys[next])
                    .setPosition(Math.round(this.wednesday.x), Math.round(this.wednesday.y - 36))
                    .setVisible(true);
                this.wednesdayTalkRemaining = 4.5;
            }
        }
    }

    private launch(s: Swimmer) {
        const p = s.sprite;
        s.mode = 'air';
        s.t = 0;
        s.from = { x: p.x, y: p.y };
        s.to = this.at(Phaser.Math.Between(148, 178), Phaser.Math.Between(54, 66));
        if (s.style === 'cannonball') p.setFrame('down-0').setScale(0.9, 0.8);
        p.setOrigin(0.5, 0.5);
        this.scene.tweens.add({ targets: this.board, angle: { from: -7, to: 0 }, duration: 800, ease: 'Elastic.easeOut' });
    }

    /** One frame of the jump: up off the board, then down into the water, spinning to suit the style. */
    private fly(s: Swimmer) {
        const p = s.sprite;
        const k = Math.min(1, s.t / AIR);
        // A parabola that rises `rise` pixels before dropping to the landing spot.
        const rise = 14;
        const drop = s.to.y - s.from.y;
        const a = (Math.sqrt(rise) + Math.sqrt(rise + drop)) ** 2;
        const b = drop - a;
        const x = Phaser.Math.Linear(s.from.x, s.to.x, k);
        const y = s.from.y + a * k * k + b * k;
        const spin = { dive: 175 * k * k, flip: 540 * k, cannonball: 300 * k, bellyflop: 90 * Phaser.Math.Easing.Sine.InOut(k) }[s.style];
        p.setPosition(x, y - 11).setAngle(spin).setDepth(this.y + LADDER.y + 2);
        if (k >= 1) this.splashDown(s);
    }

    private splashDown(s: Swimmer) {
        const p = s.sprite;
        const { x, y } = s.to;
        const big = s.style === 'bellyflop' || s.style === 'cannonball';
        const splash = this.scene.add.sprite(x, y + 4, 'pool-splash', 0)
            .setOrigin(0.5, 1)
            .setScale(big ? 1.35 : 0.9)
            .setDepth(this.y + LADDER.y + 3)
            .play('pool-splash');
        splash.once('animationcomplete', () => splash.destroy());
        for (let i = 0; i < (big ? 3 : 2); i++) {
            const ring = this.scene.add.image(x, y + 1, 'pool-ripple').setScale(0.3).setAlpha(0.9).setDepth(SWIM_DEPTH - 1);
            this.scene.tweens.add({
                targets: ring,
                scale: big ? 2 : 1.5,
                alpha: 0,
                delay: i * 220,
                duration: 900,
                ease: 'Quad.easeOut',
                onComplete: () => ring.destroy(),
            });
        }

        s.mode = 'swim';
        s.t = 0;
        s.from = { x, y };
        p.setAngle(0).setScale(1).setOrigin(0.5, 1).setFrame('side-0').setCrop(0, 0, 16, 12).setDepth(SWIM_DEPTH);
        s.shadow.setVisible(false);
        s.wake.setVisible(true);

        const text = s.style === 'bellyflop' && Math.random() < 0.7
            ? this.flops[this.nextFlop++ % this.flops.length]
            : this.quips[this.nextQuip++ % this.quips.length];
        const key = `pool-quip-${text}`;
        ensurePixels(this.scene, key, () => speechArt(text));
        s.bubble.setTexture(key);
        s.talk = 3.2;
    }

    /** Up the steps onto the walkway, then back around to the end of the queue. */
    private climbOut(s: Swimmer) {
        const p = s.sprite;
        p.setCrop().setPosition(this.x + EXIT.x, this.y + WATER.y + WATER.h + 6);
        s.wake.setVisible(false);
        s.shadow.setVisible(true);
        s.mode = 'queue';
        s.t = 0;
        s.path = [this.at(EXIT.x, WALKWAY_Y), this.at(LADDER.x - 20, WALKWAY_Y)];
        this.queue.push(s);
    }
}
