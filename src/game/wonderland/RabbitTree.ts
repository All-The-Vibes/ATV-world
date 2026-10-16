import Phaser from 'phaser';
import { ensurePixels, shadowTexture, speechArt } from '../kit';
import { PORTAL, TREE, rabbitTreeTextures } from './art';

const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const RABBIT_LINES = [
    "I'm late! I'm late!",
    'For a very important date!',
    'No time to say hello!',
    'Oh my ears and whiskers!',
    'The Duchess will be savage!',
    "Oh dear! I shall be too late!",
    'Goodbye! Hello! Late!',
];

/** The White Rabbit: hops wherever he's sent, checks his pocket watch, and frets out loud. */
export class WhiteRabbit {
    readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private bubble?: Phaser.GameObjects.Image;
    private bubbleFor = 0;
    private target?: { x: number; y: number; done?: () => void };
    private hop = 0;
    private watchFor = 0;
    private nextLine = 1.5;
    /** Draw him at least this deep (so he shows in front of the tree as he dives into its hollow). */
    depthAtLeast = -Infinity;
    /** Where he stands on the ground (the sprite bobs above it while hopping). */
    x: number;
    y: number;

    constructor(private readonly scene: Phaser.Scene, x: number, y: number, readonly speed = 88) {
        rabbitTreeTextures(scene);
        this.x = x;
        this.y = y;
        this.shadow = scene.add.image(x, y, shadowTexture(scene, 12)).setAlpha(0.3);
        this.sprite = scene.add.sprite(x, y, 'wl-rabbit', 0).setOrigin(0.5, 1);
        this.sprite.name = 'White Rabbit';
        this.place();
    }

    get running() {
        return !!this.target;
    }

    setVisible(on: boolean) {
        this.sprite.setVisible(on);
        this.shadow.setVisible(on);
        if (!on) this.hush();
        return this;
    }

    teleport(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.target = undefined;
        this.sprite.setScale(1).setAlpha(1);
        this.place();
    }

    runTo(x: number, y: number, done?: () => void) {
        this.watchFor = 0;
        this.target = { x, y, done };
    }

    /** Stop and stare at the pocket watch for a moment. */
    checkWatch(seconds: number) {
        this.target = undefined;
        this.watchFor = seconds;
        this.say(Phaser.Utils.Array.GetRandom(RABBIT_LINES.slice(0, 3)));
    }

    say(text: string, seconds = 2.2) {
        const key = ensurePixels(this.scene, `wl-say-${text}`, () => speechArt(text, 16));
        this.bubble ??= this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
        this.bubble.setTexture(key).setVisible(this.sprite.visible);
        this.bubbleFor = seconds;
        this.place();
    }

    hush() {
        this.bubble?.setVisible(false);
        this.bubbleFor = 0;
    }

    update(dt: number) {
        const s = Math.min(dt, 0.05);
        if (this.bubbleFor > 0 && (this.bubbleFor -= s) <= 0) this.hush();
        const t = this.target;
        if (t) {
            const dx = t.x - this.x, dy = t.y - this.y;
            const d = Math.hypot(dx, dy), step = this.speed * s;
            if (d <= step) {
                this.x = t.x;
                this.y = t.y;
                this.target = undefined;
                this.sprite.stop().setFrame(0);
                t.done?.();
            } else {
                this.x += (dx / d) * step;
                this.y += (dy / d) * step;
                if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx < 0);
                if (!this.sprite.anims.isPlaying) this.sprite.play('wl-rabbit-run');
                this.hop += s * 9;
                if ((this.nextLine -= s) <= 0) {
                    this.nextLine = Phaser.Math.FloatBetween(3, 5.5);
                    this.say(Phaser.Utils.Array.GetRandom(RABBIT_LINES));
                }
            }
        } else {
            this.hop = 0;
            if (this.watchFor > 0) {
                this.watchFor -= s;
                this.sprite.stop().setFrame(3);
            } else if (this.sprite.anims.isPlaying) {
                this.sprite.stop().setFrame(0);
            }
        }
        this.place();
    }

    private place() {
        const lift = this.target && !still() ? Math.abs(Math.sin(this.hop)) * 3 : 0;
        this.sprite.setPosition(Math.round(this.x), Math.round(this.y - lift)).setDepth(Math.max(this.y, this.depthAtLeast));
        this.shadow.setPosition(this.x, this.y).setDepth(this.y - 0.5).setScale(1 - lift * 0.06);
        this.bubble?.setPosition(Math.round(this.x), Math.round(this.y - lift - 24)).setDepth(1e5);
    }

    destroy() {
        this.sprite.destroy();
        this.shadow.destroy();
        this.bubble?.destroy();
    }
}

/**
 * A huge old tree off to the side of the world, with a swirling portal to Wonderland in the hollow of its trunk.
 * The White Rabbit keeps turning up somewhere in town and dashing across to it, fretting about the time, and
 * diving in. Walking into the hollow follows him down (see Preview's `enterWonderland`).
 */
export class RabbitTree {
    readonly tree: Phaser.GameObjects.Image;
    readonly portal: Phaser.GameObjects.Sprite;
    readonly sign: Phaser.GameObjects.Image;
    readonly rabbit: WhiteRabbit;
    /** Everything that should count toward the world's size. */
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[];
    /** The trunk and roots, where dropped tokens would be out of reach. */
    readonly area: Phaser.Geom.Rectangle;
    /** Where the player steps out when they come back from Wonderland. */
    readonly exit: { x: number; y: number };
    private away = 1.5;
    private diving = false;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number,
        private readonly bounds: () => Phaser.Geom.Rectangle) {
        rabbitTreeTextures(scene);
        scene.add.image(x, y - 2, shadowTexture(scene, 110)).setAlpha(0.28).setDepth(-1e8);
        this.tree = scene.add.image(x, y, 'wl-tree-big').setOrigin(0.5, 1).setDepth(y);
        this.portal = scene.add.sprite(x, y - TREE.hollowBottom, 'wl-portal', 0).setOrigin(0.5, 1).setDepth(y + 0.1);
        if (still()) this.portal.setFrame(0);
        else this.portal.play('wl-portal');
        this.glow();
        this.sign = scene.add.image(x + 58, y + 24, 'wl-sign').setOrigin(0.5, 1).setDepth(y + 24);
        this.rabbit = new WhiteRabbit(scene, x, y + 8).setVisible(false);
        this.parts = [this.tree, this.sign];
        this.area = new Phaser.Geom.Rectangle(x - 60, y - 70, 120, 74);
        this.exit = { x, y: y + 16 };
    }

    /** The mouth of the hollow: walking into it goes down the rabbit hole. */
    foot(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(this.x - PORTAL.w / 2 + 2, this.y - TREE.hollowBottom - 12, PORTAL.w - 4, 12);
    }

    enters(x: number, y: number) {
        return this.foot().contains(x, y);
    }

    update(dt: number) {
        const r = this.rabbit;
        if (!r.sprite.visible) {
            if (this.diving || (this.away -= Math.min(dt, 0.05)) > 0) return;
            this.appear();
        }
        r.update(dt);
    }

    /** The rabbit pops up somewhere in town and zigzags over to the tree, stopping once to check his watch. */
    private appear() {
        const r = this.rabbit;
        const b = this.bounds();
        let from = { x: this.x - 320, y: this.y + 40 };
        for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2, d = Phaser.Math.Between(240, 560);
            const p = { x: this.x + Math.cos(a) * d, y: this.y + 20 + Math.sin(a) * d * 0.6 };
            if (p.x > b.left + 24 && p.x < b.right - 24 && p.y > b.top + 30 && p.y < b.bottom - 16) {
                from = p;
                break;
            }
        }
        r.depthAtLeast = -Infinity;
        r.teleport(from.x, from.y);
        r.setVisible(true);
        const door = { x: this.x, y: this.y - TREE.hollowBottom + 1 };
        // Two wiggly waypoints on the way, then the hollow.
        const via = [0.35, 0.7].map((t) => {
            const side = (Math.random() - 0.5) * 120;
            const nx = -(door.y - from.y), ny = door.x - from.x, len = Math.hypot(nx, ny) || 1;
            return { x: from.x + (door.x - from.x) * t + (nx / len) * side, y: from.y + (door.y - from.y) * t + (ny / len) * side * 0.6 };
        });
        r.say("I'm late! I'm late!");
        const intoHollow = () => {
            r.depthAtLeast = this.y + 0.2;
            r.runTo(door.x, door.y, () => this.dive());
        };
        const onward = () => r.runTo(via[1].x, via[1].y, () => r.runTo(door.x, door.y + 10, intoHollow));
        r.runTo(via[0].x, via[0].y, () => {
            r.checkWatch(1.2);
            this.scene.time.delayedCall(1200, onward);
        });
    }

    /** Down the rabbit hole: he shrinks into the swirl and is gone, for a while. */
    private dive() {
        const r = this.rabbit;
        this.diving = true;
        r.say('Down I go!', 1);
        this.scene.tweens.add({
            targets: r.sprite,
            scale: 0.1,
            alpha: 0,
            y: r.sprite.y - 14,
            angle: still() ? 0 : 360,
            duration: 450,
            ease: 'Quad.easeIn',
            onComplete: () => {
                r.sprite.setAngle(0);
                r.setVisible(false);
                this.away = Phaser.Math.FloatBetween(3, 7);
                this.diving = false;
            },
        });
    }

    /** A soft pulsing glow around the hollow. */
    private glow() {
        const halo = this.scene.add.ellipse(this.x, this.y - TREE.hollowBottom - PORTAL.h / 2, PORTAL.w + 18, PORTAL.h + 14, 0xe26fa6, 0.18)
            .setDepth(this.y + 0.05)
            .setBlendMode(Phaser.BlendModes.ADD);
        if (!still()) this.scene.tweens.add({ targets: halo, alpha: 0.05, scale: 1.12, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
}
