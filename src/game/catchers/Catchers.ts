import Phaser from 'phaser';
import { addPixels, characterSheet, lookKey, randomLook, shadowTexture, speechArt, toHexNumber } from '../kit';
import type { Burnable } from '../dragon/Dragon';
import type { Gremlins } from '../gremlins/Gremlins';
import { BAG_H, BAG_HAND, BAG_W, NET_H, NET_HAND, NET_W, bagTexture, netTexture } from './art';

export interface CatchersOptions {
    bounds: () => Phaser.Geom.Rectangle;
    gremlins: () => Gremlins | undefined;
}

interface Catcher {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    net: Phaser.GameObjects.Sprite;
    bag?: Phaser.GameObjects.Sprite;
    bubble?: Phaser.GameObjects.Image;
    bubbleLeft: number;
    state: 'hunt' | 'swing' | 'carry';
    target?: Phaser.GameObjects.Sprite;
    swingT: number;
    caught: boolean;
    got: boolean;
    idle: number;
    exitX: number;
    rest: number;
}

const SKY = 1e6;
const MAX_CATCHERS = 2;
const RUN_SPEED = 92;
const CARRY_SPEED = 34;
const SWING_REACH = 16;
const SWING_TIME = 0.4;
const IMPACT_AT = 0.28;
const LOOK = randomLook('catcher', { skin: 'sand', hair: 'earth', hairStyle: 'cap', hat: 'cream', shirt: 'leaf', pants: 'earth', shoes: 'bark' });

/**
 * Gremlin catchers: scouts with bug nets who run down gremlins, swing, bag one, and walk it
 * out of town in the net. Call `update(dt)` from the scene's update.
 */
export class Catchers {
    private list: Catcher[] = [];
    private next = 10;
    private anim: string;

    constructor(private scene: Phaser.Scene, private opts: CatchersOptions) {
        const key = lookKey(LOOK);
        const sheet = characterSheet(LOOK);
        addPixels(scene, key, sheet.canvas, sheet.frames);
        this.anim = `${key}-catch`;
        if (!scene.anims.exists(this.anim)) {
            scene.anims.create({ key: this.anim, frames: ['side-1', 'side-0', 'side-2', 'side-0'].map((frame) => ({ key, frame })), frameRate: 12, repeat: -1 });
        }
        netTexture(scene);
        const bag = bagTexture(scene);
        if (!scene.anims.exists('catcher-bag-wriggle')) {
            scene.anims.create({ key: 'catcher-bag-wriggle', frames: [0, 1].map((frame) => ({ key: bag, frame })), frameRate: 8, repeat: -1 });
        }
        scene.events.once('shutdown', () => this.destroy());
    }

    /** Send one in right away (atv.game.scene.getScene('Preview').catchers.spawn()). */
    spawn() {
        const b = this.opts.bounds();
        const x = Math.random() < 0.5 ? b.left - 12 : b.right + 12;
        const y = Phaser.Math.Between(Math.round(b.top + 80), Math.round(b.bottom - 30));
        const key = lookKey(LOOK);
        const shadow = this.scene.add.image(x, y, shadowTexture(this.scene, 11)).setAlpha(0.25).setDepth(-1e8 + 1);
        const sprite = this.scene.add.sprite(x, y, key, 'side-0').setOrigin(0.5, 1).setDepth(y);
        const net = this.scene.add.sprite(x, y, 'catcher-net').setOrigin(NET_HAND.x / NET_W, NET_HAND.y / NET_H);
        this.list.push({ sprite, shadow, net, bubbleLeft: 0, state: 'hunt', swingT: 0, caught: false, got: false, idle: 0, exitX: x, rest: 0 });
    }

    /** Who the dragon can toast. */
    burnables(): Burnable[] {
        return this.list.map((c) => ({
            sprite: c.sprite,
            headroom: 38,
            hold: (seconds: number) => { c.rest = Math.max(c.rest, seconds); },
        }));
    }

    /** One catcher to point at (the character search), if any are out. */
    first(): Phaser.GameObjects.Sprite | undefined {
        return this.list[0]?.sprite;
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        const gremlins = this.opts.gremlins();
        this.next -= dt;
        if (this.next <= 0 && gremlins && gremlins.count > 0 && this.list.length < MAX_CATCHERS) {
            this.next = Phaser.Math.FloatBetween(16, 26);
            this.spawn();
        }
        const b = this.opts.bounds();
        for (const c of [...this.list]) this.step(c, dt, b, gremlins);
    }

    private step(c: Catcher, dt: number, b: Phaser.Geom.Rectangle, gremlins?: Gremlins) {
        const s = c.sprite;
        if (c.bubble) {
            c.bubbleLeft -= dt;
            if (c.bubbleLeft <= 0) {
                c.bubble.destroy();
                c.bubble = undefined;
            }
        }
        if (c.rest > 0) {
            c.rest -= dt;
            if (s.anims.isPlaying) s.stop().setFrame('side-0');
            if (c.bag?.anims.isPlaying) c.bag.anims.pause();
            this.follow(c);
            return;
        }
        c.bag?.anims.resume();

        if (c.state === 'hunt') {
            if (!c.target?.active) c.target = gremlins?.nearest(s.x, s.y, 1e5);
            if (!c.target) {
                c.idle += dt;
                if (s.anims.isPlaying) s.stop().setFrame('side-0');
                if (c.idle > 9) this.carryOff(c, b, false);
            } else {
                c.idle = 0;
                const dx = c.target.x - s.x;
                const dy = c.target.y - s.y;
                const d = Math.hypot(dx, dy);
                if (d <= SWING_REACH) {
                    c.state = 'swing';
                    c.swingT = 0;
                    c.caught = false;
                    c.got = false;
                    s.setFlipX(dx < 0).stop().setFrame('side-0');
                } else {
                    s.x += (dx / d) * RUN_SPEED * dt;
                    s.y += (dy / d) * RUN_SPEED * dt;
                    s.setFlipX(dx < 0);
                    if (!s.anims.isPlaying) s.play(this.anim);
                }
            }
        } else if (c.state === 'swing') {
            c.swingT += dt;
            const dir = s.flipX ? -1 : 1;
            const t = Phaser.Math.Clamp(c.swingT / SWING_TIME, 0, 1);
            c.net.setRotation(dir * Phaser.Math.Linear(-0.5, 1.2, t * t));
            if (!c.caught && c.swingT >= IMPACT_AT) {
                c.caught = true;
                const target = c.target;
                if (target?.active && gremlins) {
                    const { x, y } = target;
                    gremlins.capture(target);
                    this.puff(x, y - 8);
                    c.target = undefined;
                    this.say(c, 'GOTCHA!');
                    c.got = true;
                }
            }
            if (c.swingT >= SWING_TIME) {
                c.net.setRotation(0);
                if (c.got) {
                    this.carryOff(c, b, true);
                } else {
                    c.state = 'hunt';
                }
            }
        } else {
            const dx = c.exitX - s.x;
            if (Math.abs(dx) < 3 || s.x < b.left - 30 || s.x > b.right + 30) {
                this.remove(c);
                return;
            }
            s.x += Math.sign(dx) * CARRY_SPEED * dt;
            s.setFlipX(dx < 0);
            if (!s.anims.isPlaying) s.play(this.anim);
        }
        this.follow(c);
    }

    private carryOff(c: Catcher, b: Phaser.Geom.Rectangle, bagged: boolean) {
        const s = c.sprite;
        c.state = 'carry';
        c.exitX = s.x - b.left < b.right - s.x ? b.left - 40 : b.right + 40;
        if (bagged) {
            c.net.setVisible(false);
            c.bag = this.scene.add.sprite(s.x, s.y, 'catcher-bag', 0)
                .setOrigin(BAG_HAND.x / BAG_W, BAG_HAND.y / BAG_H)
                .play('catcher-bag-wriggle');
        }
    }

    private follow(c: Catcher) {
        const s = c.sprite;
        c.shadow.setPosition(s.x, s.y);
        s.setDepth(s.y);
        const dir = s.flipX ? -1 : 1;
        const hand = { x: Math.round(s.x + dir * 4), y: Math.round(s.y - 9) };
        c.net.setPosition(hand.x, hand.y).setScale(dir, 1).setDepth(s.y + 1);
        c.bag?.setPosition(hand.x, hand.y).setScale(dir, 1).setDepth(s.y + 1);
        c.bubble?.setPosition(Math.round(s.x), Math.round(s.y - 30)).setDepth(SKY + 2);
    }

    private say(c: Catcher, text: string) {
        const key = `catcher-say-${text}`;
        addPixels(this.scene, key, speechArt(text, 18));
        c.bubble?.destroy();
        c.bubble = this.scene.add.image(c.sprite.x, c.sprite.y - 30, key).setOrigin(0.5, 1).setDepth(SKY + 2);
        c.bubbleLeft = 2.2;
    }

    /** A little green puff where the gremlin was bagged. */
    private puff(x: number, y: number) {
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const p = this.scene.add.rectangle(x, y, 2, 2, toHexNumber(i % 2 ? 'lime' : 'white')).setDepth(SKY + 1);
            this.scene.tweens.add({ targets: p, x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 10, alpha: 0, duration: 500, onComplete: () => p.destroy() });
        }
    }

    private remove(c: Catcher) {
        c.sprite.destroy();
        c.shadow.destroy();
        c.net.destroy();
        c.bag?.destroy();
        c.bubble?.destroy();
        this.list = this.list.filter((o) => o !== c);
    }

    destroy() {
        for (const c of [...this.list]) this.remove(c);
    }
}
