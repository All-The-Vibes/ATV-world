import Phaser from 'phaser';
import {
    DRAGON_CREATOR, DRAGON_FRAMES, DRAGON_H, DRAGON_MOUTH, DRAGON_W, addCreatorNametag, addPixels, dragonSheet, ensurePixels, flameArt, hairFlameArt,
    shadowTexture, smokeArt, speechArt,
} from '../kit';
import { QUIPS } from './quips';

/** Someone the dragon can set alight. They never get hurt, just singed and sarcastic. */
export interface Burnable {
    sprite: Phaser.GameObjects.Sprite;
    /** How far above their feet the speech bubble goes. */
    headroom: number;
    nametag?: Phaser.GameObjects.Text;
    /** Stop walking for a moment to complain. */
    hold?(seconds: number): void;
}

export interface DragonOptions {
    bounds: () => Phaser.Geom.Rectangle;
    targets: () => Burnable[];
}

type Mode = 'cruise' | 'swoop' | 'breathe' | 'climb';

interface Burn {
    sprite: Phaser.GameObjects.Sprite;
    headroom: number;
    nametag?: Phaser.GameObjects.Text;
    hair: Phaser.GameObjects.Sprite;
    bubble: Phaser.GameObjects.Image;
    age: number;
    puff: number;
}

/** Everything in the sky draws over the town. */
const SKY = 1e6;
const BURN_LIFE = 4.4;
const HAIR_LIFE = 1.5;
const BREATH = 1.1;
/** They wait for the dragon to pull away before saying anything. */
const TALK_AT = 1.1;
const CRUISE_ALT = 74;
const ATTACK_ALT = 28;

/**
 * A fire-breathing dragon that circles the town, picks someone (walkers or the player), swoops down,
 * and toasts them. Nobody gets hurt: they go sooty, their hair catches for a second, and they say
 * something sarcastic (./quips.ts). Call `update(dt)` from the scene's update.
 */
export class Dragon {
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    /** Ground position (the shadow); the dragon is drawn `alt` pixels above it. */
    private x: number;
    private y: number;
    private alt = CRUISE_ALT;
    private vx = 0;
    private vy = 0;
    private facing = 1;
    private mode: Mode = 'cruise';
    private timer = 4;
    private clock = 0;
    private flameClock = 0;
    private fired = false;
    private waypoint = new Phaser.Math.Vector2();
    private target?: Burnable;
    private side = 1;
    private readonly burns = new Map<Phaser.GameObjects.Sprite, Burn>();
    private quips: string[] = [];
    private lastQuip = '';

    constructor(private readonly scene: Phaser.Scene, private readonly opts: DragonOptions) {
        const sheet = dragonSheet();
        addPixels(scene, 'dragon', sheet.canvas, sheet.frames);
        const flame = flameArt();
        addPixels(scene, 'dragon-flame', flame.canvas, flame.frames);
        const hair = hairFlameArt();
        addPixels(scene, 'dragon-hair-flame', hair.canvas, hair.frames);
        ensurePixels(scene, 'dragon-smoke', smokeArt);
        const anim = (key: string, frames: number, frameRate: number, repeat: number) => {
            if (!scene.anims.exists(key)) {
                scene.anims.create({ key, frames: Array.from({ length: frames }, (_, frame) => ({ key, frame })), frameRate, repeat });
            }
        };
        anim('dragon', DRAGON_FRAMES, 8, -1);
        anim('dragon-flame', 4, 14, 0);
        anim('dragon-hair-flame', 2, 10, -1);

        const b = opts.bounds();
        this.x = b.left - DRAGON_W;
        this.y = b.centerY;
        this.pickWaypoint();
        this.shadow = scene.add.image(this.x, this.y, shadowTexture(scene, 30)).setAlpha(0.18).setDepth(-1e8 + 1);
        this.sprite = scene.add.sprite(this.x, this.y - this.alt, 'dragon', 0).setOrigin(0.5, 1).setDepth(SKY).play('dragon');
        addCreatorNametag(this.sprite, DRAGON_CREATOR, { headOffsetX: 14 });
        scene.events.once('shutdown', () => this.destroy());
    }

    /** Ground position of the visible dragon, for curious kittens (not burn targets). */
    plaything(): { x: number; y: number } | undefined {
        return this.sprite.active && this.sprite.visible ? { x: this.x, y: this.y } : undefined;
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        this.clock += dt;
        this.timer -= dt;
        const t = this.target;
        if (t && this.mode !== 'cruise' && this.mode !== 'climb' && !this.canBurn(t, true)) this.retreat();

        switch (this.mode) {
            case 'cruise': {
                if (this.steer(this.waypoint.x, this.waypoint.y, 70, dt) < 16) this.pickWaypoint();
                if (this.timer <= 0) {
                    this.target = this.pickTarget();
                    if (this.target) {
                        this.side = this.x < this.target.sprite.x ? 1 : -1;
                        this.mode = 'swoop';
                        this.timer = 7;
                    } else {
                        this.timer = 3;
                    }
                }
                this.climbTo(CRUISE_ALT, dt);
                break;
            }
            case 'swoop': {
                const s = this.target!.sprite;
                const d = this.steer(s.x - this.side * 40, s.y + 2, 150, dt);
                this.climbTo(ATTACK_ALT, dt);
                if (d < 6) {
                    this.mode = 'breathe';
                    this.timer = BREATH;
                    this.fired = false;
                    this.flameClock = 0;
                } else if (this.timer <= 0) {
                    this.retreat();
                }
                break;
            }
            case 'breathe': {
                const target = this.target!;
                const s = target.sprite;
                this.side = this.x < s.x ? 1 : -1;
                this.steer(s.x - this.side * 40, s.y + 2, 50, dt);
                this.climbTo(ATTACK_ALT, dt);
                this.flameClock -= dt;
                while (this.flameClock <= 0) {
                    this.flameClock += 0.04;
                    this.flame(s);
                }
                if (!this.fired && this.timer < BREATH - 0.3) {
                    this.fired = true;
                    this.burn(target);
                }
                if (this.timer <= 0) this.retreat();
                break;
            }
            case 'climb': {
                this.steer(this.waypoint.x, this.waypoint.y, 90, dt);
                this.climbTo(CRUISE_ALT + 10, dt);
                if (this.timer <= 0) {
                    this.mode = 'cruise';
                    this.timer = Phaser.Math.FloatBetween(3, 5);
                }
                break;
            }
        }

        if (this.mode === 'breathe') this.facing = this.side;
        else if (Math.abs(this.vx) > 4) this.facing = Math.sign(this.vx);

        const bob = Math.sin(this.clock * 5) * (this.mode === 'breathe' ? 1 : 2);
        this.sprite.setPosition(Math.round(this.x), Math.round(this.y - this.alt + bob)).setFlipX(this.facing < 0);
        this.shadow.setPosition(Math.round(this.x), Math.round(this.y)).setScale(1 - this.alt / 300);

        for (const burn of this.burns.values()) this.tickBurn(burn, dt);
    }

    destroy() {
        for (const burn of this.burns.values()) this.endBurn(burn);
        this.sprite.destroy();
        this.shadow.destroy();
    }

    /** Ease towards a ground point; returns the distance left. */
    private steer(tx: number, ty: number, speed: number, dt: number): number {
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.hypot(dx, dy);
        const slow = Math.min(1, d / 30);
        const wx = d > 0.5 ? (dx / d) * speed * slow : 0;
        const wy = d > 0.5 ? (dy / d) * speed * slow : 0;
        const k = 1 - Math.exp(-dt * 3);
        this.vx += (wx - this.vx) * k;
        this.vy += (wy - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        return d;
    }

    private climbTo(alt: number, dt: number) {
        this.alt += (alt - this.alt) * (1 - Math.exp(-dt * 2.5));
    }

    private retreat() {
        this.target = undefined;
        this.mode = 'climb';
        this.timer = 1.5;
        this.pickWaypoint();
    }

    /** Somewhere to fly next, usually where the camera can see it. */
    private pickWaypoint() {
        const b = this.opts.bounds();
        const view = this.scene.cameras.main.worldView;
        const area = Math.random() < 0.7 && view.width > 0 ? Phaser.Geom.Rectangle.Intersection(b, view) : b;
        const r = area.width > 40 && area.height > 40 ? area : b;
        this.waypoint.set(Phaser.Math.FloatBetween(r.left + 20, r.right - 20), Phaser.Math.FloatBetween(r.top + 40, r.bottom - 10));
    }

    private canBurn(t: Burnable, current = false): boolean {
        const s = t.sprite;
        return s.active && s.visible && (current || !this.burns.has(s));
    }

    /** Someone to toast, preferring people on screen. */
    private pickTarget(): Burnable | undefined {
        const view = this.scene.cameras.main.worldView;
        const all = this.opts.targets().filter((t) => this.canBurn(t));
        const seen = all.filter((t) => view.contains(t.sprite.x, t.sprite.y));
        const pool = seen.length ? seen : all;
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
    }

    private mouth() {
        const mx = (DRAGON_MOUTH.x - DRAGON_W / 2) * this.facing;
        return { x: this.sprite.x + mx, y: this.sprite.y - DRAGON_H + DRAGON_MOUTH.y };
    }

    /** One fireball from the mouth to the target, burning out into smoke. */
    private flame(s: Phaser.GameObjects.Sprite) {
        const from = this.mouth();
        const to = { x: s.x + Phaser.Math.Between(-5, 5), y: s.y - 10 + Phaser.Math.Between(-6, 5) };
        const f = this.scene.add.sprite(from.x, from.y, 'dragon-flame', 0)
            .setDepth(SKY + 1)
            .setScale(0.5)
            .setAngle(Phaser.Math.Between(0, 3) * 90)
            .play('dragon-flame');
        this.scene.tweens.chain({
            targets: f,
            tweens: [
                { x: to.x, y: to.y, scale: 1.3, duration: 280, ease: 'Quad.easeIn' },
                { y: to.y - 8, scale: 1.6, alpha: 0, duration: 220 },
            ],
            onComplete: () => f.destroy(),
        });
    }

    private nextQuip(): string {
        if (!this.quips.length) this.quips = Phaser.Utils.Array.Shuffle([...QUIPS]);
        let q = this.quips.pop()!;
        if (q === this.lastQuip && this.quips.length) q = this.quips.pop()!;
        this.lastQuip = q;
        return q;
    }

    /** Toasted: sooty, hair alight, and a few words about it. */
    private burn(t: Burnable) {
        const s = t.sprite;
        const old = this.burns.get(s);
        if (old) this.endBurn(old);
        t.hold?.(BURN_LIFE - 0.6);
        s.setTint(0x3a3a3a);
        const quip = this.nextQuip();
        const key = `dragon-quip-${quip}`;
        addPixels(this.scene, key, speechArt(quip));
        const burn: Burn = {
            sprite: s,
            headroom: t.headroom,
            nametag: t.nametag ?? s.getData('creatorNametag'),
            hair: this.scene.add.sprite(s.x, s.y - s.displayHeight + 3, 'dragon-hair-flame', 0).setOrigin(0.5, 1).setDepth(SKY + 1).play('dragon-hair-flame'),
            bubble: this.scene.add.image(s.x, s.y - t.headroom, key).setOrigin(0.5, 1).setDepth(SKY + 2).setAlpha(0),
            age: 0,
            puff: 0,
        };
        this.burns.set(s, burn);
        this.tickBurn(burn, 0);
    }

    private tickBurn(b: Burn, dt: number) {
        const s = b.sprite;
        b.age += dt;
        if (!s.active || !s.visible || b.age >= BURN_LIFE) {
            this.endBurn(b);
            return;
        }
        // Soot wears off after the first second or so.
        const clean = Phaser.Math.Clamp((b.age - 1.2) / 1.8, 0, 1);
        const c = Math.round(0x3a + (0xff - 0x3a) * clean);
        s.setTint((c << 16) | (c << 8) | c);

        if (b.hair.active) {
            if (b.age > HAIR_LIFE) b.hair.destroy();
            else b.hair.setPosition(s.x, s.y - s.displayHeight + 3).setFlipX(s.flipX);
        }
        b.puff -= dt;
        if (b.age < 2.2 && b.puff <= 0) {
            b.puff = 0.3;
            this.smoke(s.x + Phaser.Math.Between(-4, 4), s.y - Phaser.Math.Between(8, 16));
        }

        // Speak up once the dragon's out of their face, then fade away at the end.
        const talk = b.age - TALK_AT;
        b.bubble.setAlpha(Phaser.Math.Clamp(Math.min(talk / 0.15, (BURN_LIFE - b.age) / 0.35), 0, 1));
        const rise = talk < 0.15 ? Math.max(0, 3 * (1 - talk / 0.15)) : 0;
        const headroom = b.nametag?.visible
            ? Math.max(b.headroom, s.y - s.getTopCenter().y + b.nametag.getData('gap') + b.nametag.height / this.scene.cameras.main.zoom + 6)
            : b.headroom;
        b.bubble.setPosition(Math.round(s.x), Math.round(s.y - headroom + rise));
    }

    private endBurn(b: Burn) {
        if (b.sprite.active) b.sprite.clearTint();
        b.hair.destroy();
        b.bubble.destroy();
        this.burns.delete(b.sprite);
    }

    private smoke(x: number, y: number) {
        const puff = this.scene.add.image(x, y, 'dragon-smoke').setDepth(SKY + 1).setAlpha(0.5).setScale(0.6);
        this.scene.tweens.add({
            targets: puff,
            y: y - 14,
            x: x + Phaser.Math.Between(-3, 3),
            scale: 1.3,
            alpha: 0,
            duration: 700,
            onComplete: () => puff.destroy(),
        });
    }
}
