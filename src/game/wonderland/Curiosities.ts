import Phaser from 'phaser';
import { FLYERS, GRANDFATHER, MIRROR, POST_CLOCK, SIGN_ARROWS } from './curios';
import { Speaker, pick, still, type Feature } from './talk';

/** Something you trigger by stepping up to it, once per visit (walk away to arm it again). */
class Trigger {
    private armed = true;

    constructor(private readonly inside: (x: number, y: number) => boolean, private readonly fire: () => void,
        private readonly away: (x: number, y: number) => boolean) {}

    check(x: number, y: number) {
        if (this.armed && this.inside(x, y)) {
            this.armed = false;
            this.fire();
        } else if (!this.armed && this.away(x, y)) {
            this.armed = true;
        }
    }
}

const near = (cx: number, cy: number, r: number) => (x: number, y: number) => Math.hypot(x - cx, y - cy) < r;
const far = (cx: number, cy: number, r: number) => (x: number, y: number) => Math.hypot(x - cx, y - cy) > r;

/** The "drink me" bottle and the "eat me" cake: step up to the table to shrink or grow. */
export class Potions implements Feature {
    private readonly triggers: Trigger[];

    constructor(scene: Phaser.Scene, drink: { x: number; y: number }, eat: { x: number; y: number }, hooks: { shrink: () => void; grow: () => void }) {
        for (const [p, key, tag] of [[drink, 'wl-drink', 'wl-tag-drink'], [eat, 'wl-cake', 'wl-tag-eat']] as const) {
            scene.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(p.y);
            scene.add.image(p.x, p.y - 32, tag).setOrigin(0.5, 1).setDepth(p.y);
        }
        this.triggers = [
            new Trigger(near(drink.x, drink.y + 4, 13), hooks.shrink, far(drink.x, drink.y, 40)),
            new Trigger(near(eat.x, eat.y + 4, 13), hooks.grow, far(eat.x, eat.y, 40)),
        ];
    }

    update(_dt: number, player: Phaser.GameObjects.Sprite) {
        this.triggers.forEach((t) => t.check(player.x, player.y));
    }
}

/** A fairy ring of purple toadstools. Step into the middle and the whole world turns upside down. */
export class FairyRing implements Feature {
    private readonly trigger: Trigger;

    constructor(scene: Phaser.Scene, x: number, y: number, topsy: () => void) {
        const glow = scene.add.ellipse(x, y, 64, 30, 0xb4e05a, 0.22).setDepth(-1e8 + 4);
        if (!still()) scene.tweens.add({ targets: glow, alpha: 0.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2;
            const mx = x + Math.cos(a) * 34, my = y + Math.sin(a) * 17;
            scene.add.image(mx, my + 4, 'wl-topsy').setOrigin(0.5, 1).setDepth(my + 4).setFlipX(i % 2 === 0);
        }
        scene.add.image(x, y - 26, 'wl-tag-topsy').setOrigin(0.5, 1).setDepth(y - 26);
        this.trigger = new Trigger((px, py) => ((px - x) / 18) ** 2 + ((py - y) / 9) ** 2 < 1, topsy, far(x, y, 50));
    }

    update(_dt: number, player: Phaser.GameObjects.Sprite) {
        this.trigger.check(player.x, player.y);
    }
}

/**
 * The looking-glass: walk up to it and your reflection appears, only it's the Looking-Glass you, so it walks the
 * other way, and now and then does a twirl you never asked for.
 */
export class LookingGlass implements Feature {
    private readonly reflection: Phaser.GameObjects.Sprite;
    private readonly glass: Phaser.Geom.Rectangle;
    private twirlIn = 4;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number) {
        scene.add.image(x, y, 'wl-mirror').setOrigin(0.5, 1).setDepth(y);
        scene.add.image(x + 46, y + 10, 'wl-tag-mirror').setOrigin(0.5, 1).setDepth(y + 10).setFlipX(true);
        const { glass } = MIRROR;
        this.glass = new Phaser.Geom.Rectangle(x - MIRROR.w / 2 + glass.x, y - MIRROR.h + glass.y, glass.w, glass.h);
        this.reflection = scene.add.sprite(x, this.glass.bottom - 2, 'preview-player', 'down-0').setOrigin(0.5, 1)
            .setDepth(y + 0.5).setTint(0xc8f1fb).setAlpha(0.85).setVisible(false);
    }

    update(dt: number, player: Phaser.GameObjects.Sprite) {
        const dx = player.x - this.x, dy = player.y - this.y;
        const seen = Math.abs(dx) < 60 && dy > 0 && dy < 80;
        this.reflection.setVisible(seen);
        if (!seen) return;
        const [facing, step] = String(player.frame.name).split('-');
        const mirrored = facing === 'down' ? 'up' : facing === 'up' ? 'down' : 'side';
        this.reflection.setFrame(`${mirrored}-${step ?? 0}`).setFlipX(facing === 'side' ? !player.flipX : false);
        const scale = (0.95 - (dy / 80) * 0.35) * Math.abs(player.scaleX);
        // The Looking-Glass you goes the wrong way.
        this.reflection.setScale(Math.min(scale, 1.1)).setPosition(this.x - Phaser.Math.Clamp(dx * 0.12, -5, 5), this.glass.bottom - 3);
        if ((this.twirlIn -= dt) <= 0 && !still()) {
            this.twirlIn = Phaser.Math.FloatBetween(5, 9);
            this.scene.tweens.add({ targets: this.reflection, angle: 360, duration: 600, onComplete: () => this.reflection.setAngle(0) });
        }
    }
}

const CUCKOO = ["Tick-tock! Tock-tick!", "It's always six o'clock!", "I run backwards. It's very restful.", "Time for tea! It's ALWAYS time for tea."];

/** A grandfather clock and a cluster of little clocks, every one of them running backwards at its own pace. */
export class Clocks implements Feature {
    private readonly hands: { image: Phaser.GameObjects.Image; speed: number }[] = [];
    private readonly bells: Phaser.GameObjects.Image[] = [];
    private readonly speaker: Speaker;
    private chimeIn = 4;

    constructor(private readonly scene: Phaser.Scene, x: number, y: number, posts: { x: number; y: number }[]) {
        scene.add.image(x, y, 'wl-grandfather').setOrigin(0.5, 1).setDepth(y);
        const pendulum = scene.add.image(x, y - GRANDFATHER.h + GRANDFATHER.pendulumY, 'wl-pendulum').setOrigin(0.5, 0).setDepth(y + 0.1);
        if (!still()) scene.tweens.add({ targets: pendulum, angle: { from: -16, to: 16 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.face(x, y - GRANDFATHER.h + GRANDFATHER.faceY, y + 0.2, -260, -22);
        this.speaker = new Speaker(scene, () => ({ x, y: y - GRANDFATHER.h - 2 }));
        const rims = ['wl-postclock-sky', 'wl-postclock-pink', 'wl-postclock-lime'];
        posts.forEach((p, i) => {
            this.bells.push(scene.add.image(p.x, p.y, rims[i % rims.length]).setOrigin(0.5, 1).setDepth(p.y));
            this.face(p.x, p.y - POST_CLOCK.h + POST_CLOCK.faceY, p.y + 0.2, -(120 + i * 170), i === 1 ? 300 : -(10 + i * 30));
        });
    }

    private face(x: number, y: number, depth: number, minute: number, hour: number) {
        this.hands.push({ image: this.scene.add.image(x, y, 'wl-hand-long').setOrigin(0.5, 1).setDepth(depth + 0.01).setAngle(Math.random() * 360), speed: minute });
        this.hands.push({ image: this.scene.add.image(x, y, 'wl-hand-short').setOrigin(0.5, 1).setDepth(depth + 0.02).setAngle(Math.random() * 360), speed: hour });
    }

    update(dt: number) {
        if (!still()) for (const h of this.hands) h.image.angle += h.speed * dt;
        if ((this.chimeIn -= dt) <= 0) {
            this.chimeIn = Phaser.Math.FloatBetween(9, 14);
            this.speaker.say(pick(CUCKOO), 2.6);
            if (!still()) this.bells.forEach((b) => this.scene.tweens.add({ targets: b, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 5, onComplete: () => b.setAngle(0) }));
        }
    }
}

/** A signpost whose arms can't make up their minds, and keep swinging round to point somewhere else. */
export class Signpost implements Feature {
    private readonly arms: Phaser.GameObjects.Image[];
    private swingIn = 1;

    constructor(private readonly scene: Phaser.Scene, x: number, y: number) {
        scene.add.image(x, y, 'wl-post').setOrigin(0.5, 1).setDepth(y);
        this.arms = [0, 1, 2, 3].map((i) => scene.add.image(x, y - 42 + i * 8, `wl-arrow-${(i * 2 + 1) % SIGN_ARROWS.length}`)
            .setOrigin(0.06, 0.5).setDepth(y + 0.1 + i * 0.01).setAngle([0, 180, -30, 150][i]));
    }

    update(dt: number) {
        if ((this.swingIn -= dt) > 0) return;
        this.swingIn = Phaser.Math.FloatBetween(1.8, 3.2);
        const arm = pick(this.arms);
        arm.setTexture(`wl-arrow-${Phaser.Math.Between(0, SIGN_ARROWS.length - 1)}`);
        if (still()) arm.setAngle(Phaser.Math.Between(-180, 180));
        else this.scene.tweens.add({ targets: arm, angle: arm.angle + Phaser.Math.Between(90, 300) * (Math.random() < 0.5 ? -1 : 1), duration: 700, ease: 'Back.easeOut' });
    }
}

const BICKER: [string, string][] = [
    ['Contrariwise!', 'Nohow!'],
    ['If it was so, it might be.', 'And if it were so, it would be.'],
    ["But as it isn't, it ain't.", "That's logic!"],
    ["Let's have a battle!", 'After lunch.'],
    ["You've begun wrong!", 'Shake hands first!'],
];

/** Tweedledum and Tweedledee, bickering in turn and bobbing about. */
export class Tweedles implements Feature {
    private readonly dum: Speaker;
    private readonly dee: Speaker;
    private next = 2;
    private line = 0;
    private greeted = 0;

    constructor(private readonly scene: Phaser.Scene, private readonly x: number, private readonly y: number) {
        const dum = scene.add.image(x - 14, y, 'wl-dum').setOrigin(0.5, 1).setDepth(y);
        const dee = scene.add.image(x + 14, y, 'wl-dee').setOrigin(0.5, 1).setDepth(y);
        if (!still()) {
            scene.tweens.add({ targets: dum, y: y - 3, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
            scene.tweens.add({ targets: dee, y: y - 3, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeOut', delay: 380 });
        }
        this.dum = new Speaker(scene, () => ({ x: dum.x, y: dum.y - 30 }));
        this.dee = new Speaker(scene, () => ({ x: dee.x, y: dee.y - 30 }));
    }

    update(dt: number, player: Phaser.GameObjects.Sprite) {
        if (Math.hypot(player.x - this.x, player.y - this.y) < 55 && this.scene.time.now > this.greeted) {
            this.greeted = this.scene.time.now + 15000;
            this.dum.say("If you think we're waxworks, you ought to pay!", 2.6);
            this.scene.time.delayedCall(2700, () => this.dee.say('Contrariwise, say how do you do!', 2.6));
            this.next = 7;
            return;
        }
        if ((this.next -= dt) > 0) return;
        this.next = 6;
        const [a, b] = BICKER[this.line++ % BICKER.length];
        this.dum.say(a, 2.2);
        this.scene.time.delayedCall(2300, () => this.dee.say(b, 2.2));
    }
}

/** Odds and ends from the rabbit hole (clocks, teacups, cards, keys, books, marmalade) drifting the wrong way: up. */
export class FallingUp implements Feature {
    private readonly things: { image: Phaser.GameObjects.Image; rise: number; spin: number; sway: number }[] = [];
    private t = 0;

    constructor(scene: Phaser.Scene, private readonly area: Phaser.Geom.Rectangle) {
        if (still()) return;
        for (let i = 0; i < 16; i++) {
            const image = scene.add.image(Phaser.Math.Between(area.left, area.right), Phaser.Math.Between(area.top, area.bottom), pick(FLYERS))
                .setDepth(1e5 - 1).setAlpha(0.9).setAngle(Math.random() * 360);
            this.things.push({ image, rise: Phaser.Math.Between(12, 28), spin: Phaser.Math.Between(-70, 70), sway: Math.random() * 10 });
        }
    }

    update(dt: number) {
        this.t += dt;
        for (const th of this.things) {
            th.image.y -= th.rise * dt;
            th.image.x += Math.sin(this.t + th.sway) * 6 * dt;
            th.image.angle += th.spin * dt;
            if (th.image.y < this.area.top - 20) {
                th.image.setPosition(Phaser.Math.Between(this.area.left, this.area.right), this.area.bottom + 20).setTexture(pick(FLYERS));
            }
        }
    }
}
