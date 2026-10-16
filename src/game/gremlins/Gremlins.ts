import Phaser from 'phaser';
import { shadowTexture } from '../kit';
import { tokenTexture } from '../tokens/art';
import { GREMLIN_H, gremlinTexture, lossTexture } from './art';

/** Someone a gremlin can rob. */
export interface Victim {
    sprite: Phaser.GameObjects.Sprite;
    /** The player only has something to steal while their token count is above zero. */
    player: boolean;
}

export interface GremlinsOptions {
    bounds: () => Phaser.Geom.Rectangle;
    victims: () => Victim[];
    /** Try to take a token from the player; returns whether there was one. */
    stealFromPlayer: () => boolean;
    /** Loot that gets dropped or recovered lands here. */
    spill: (x: number, y: number) => void;
}

interface Gremlin {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    loot?: Phaser.GameObjects.Sprite;
    fleeing: boolean;
    target?: Victim;
    fleeX: number;
    fleeY: number;
    age: number;
}

const SPEED = 62;
const FLEE_SPEED = 80;
const MAX_GREMLINS = 3;
const GRAB = 9;

/**
 * Gremlins sneak in from the edge of town, run up to a walker or the player, snatch a token,
 * and scurry off with it. Nobody minds much. Call `update(dt)` from the scene's update.
 */
export class Gremlins {
    private list: Gremlin[] = [];
    private next = 6;

    constructor(private scene: Phaser.Scene, private opts: GremlinsOptions) {
        gremlinTexture(scene);
        tokenTexture(scene);
        lossTexture(scene);
        if (!scene.anims.exists('gremlin-run')) {
            scene.anims.create({ key: 'gremlin-run', frames: [0, 1].map((frame) => ({ key: 'gremlin', frame })), frameRate: 10, repeat: -1 });
        }
        scene.events.once('shutdown', () => this.destroy());
    }

    /** How many gremlins are in town right now. */
    get count() {
        return this.list.length;
    }

    /** Send one in right now (atv.game.scene.getScene('Preview').gremlins.spawn()). */
    spawn() {
        const b = this.opts.bounds();
        const left = Math.random() < 0.5;
        const x = left ? b.left - 10 : b.right + 10;
        const y = Phaser.Math.Between(Math.round(b.top + 60), Math.round(b.bottom - 20));
        const sprite = this.scene.add.sprite(x, y, 'gremlin', 0).setOrigin(0.5, 1).play('gremlin-run');
        const shadow = this.scene.add.image(x, y, shadowTexture(this.scene, 10)).setAlpha(0.25).setDepth(-1e8 + 1);
        this.list.push({ sprite, shadow, fleeX: x, fleeY: y, fleeing: false, age: 0 });
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        this.next -= dt;
        if (this.next <= 0) {
            this.next = Phaser.Math.FloatBetween(9, 16);
            if (this.list.length < MAX_GREMLINS) this.spawn();
        }
        const b = this.opts.bounds();
        const victims = this.opts.victims();
        for (const g of this.list) {
            g.age += dt;
            const s = g.sprite;
            if (!g.fleeing && (!g.target || !victims.some((v) => v.sprite === g.target!.sprite))) g.target = this.pick(victims);
            if (!g.fleeing && !g.target && g.age > 20) this.startFlee(g, b);
            let tx = g.fleeX;
            let ty = g.fleeY;
            let speed = FLEE_SPEED;
            if (!g.fleeing && g.target) {
                tx = g.target.sprite.x;
                ty = g.target.sprite.y;
                speed = SPEED;
                if (Math.abs(tx - s.x) < GRAB && Math.abs(ty - s.y) < GRAB) {
                    this.steal(g, b);
                    continue;
                }
            }
            const dx = tx - s.x;
            const dy = ty - s.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 1) {
                s.x += (dx / d) * speed * dt;
                s.y += (dy / d) * speed * dt;
                if (Math.abs(dx) > 1) s.setFlipX(dx < 0);
            }
            s.setDepth(s.y);
            g.shadow.setPosition(s.x, s.y);
            g.loot?.setPosition(Math.round(s.x), Math.round(s.y - GREMLIN_H - 1)).setDepth(s.y + 1);
        }
        this.list = this.list.filter((g) => {
            const gone = g.fleeing && (g.sprite.x < b.left - 20 || g.sprite.x > b.right + 20 || g.sprite.y < b.top - 20 || g.sprite.y > b.bottom + 20);
            if (gone) this.destroyOne(g);
            return !gone;
        });
    }

    /** The closest gremlin within `range`; with `threatOnly`, one that is on the prowl or carrying loot. */
    nearest(x: number, y: number, range: number, threatOnly = false): Phaser.GameObjects.Sprite | undefined {
        let best: Gremlin | undefined;
        let bestD = range;
        for (const g of this.list) {
            if (threatOnly && g.fleeing && !g.loot) continue;
            const d = Math.hypot(g.sprite.x - x, g.sprite.y - y);
            if (d <= bestD) { best = g; bestD = d; }
        }
        return best?.sprite;
    }

    /** Scare a gremlin off: it drops any loot where it stands and runs for the edge. Returns whether it had loot. */
    foil(sprite: Phaser.GameObjects.Sprite): boolean {
        const g = this.list.find((o) => o.sprite === sprite);
        if (!g) return false;
        const had = this.dropLoot(g);
        this.startFlee(g, this.opts.bounds());
        return had;
    }

    /** Take a gremlin out of town for good (a catcher's net). Its loot falls where it was caught. Returns whether it had loot. */
    capture(sprite: Phaser.GameObjects.Sprite): boolean {
        const g = this.list.find((o) => o.sprite === sprite);
        if (!g) return false;
        const had = this.dropLoot(g);
        this.list = this.list.filter((o) => o !== g);
        this.destroyOne(g);
        return had;
    }

    private dropLoot(g: Gremlin): boolean {
        if (!g.loot) return false;
        g.loot.destroy();
        g.loot = undefined;
        this.opts.spill(g.sprite.x, g.sprite.y);
        return true;
    }

    private pick(victims: Victim[]): Victim | undefined {
        const taken = new Set(this.list.map((g) => g.target?.sprite));
        const pool = victims.filter((v) => !taken.has(v.sprite) && v.sprite.visible);
        return pool.length ? Phaser.Utils.Array.GetRandom(pool) : undefined;
    }

    private steal(g: Gremlin, b: Phaser.Geom.Rectangle) {
        const v = g.target!;
        g.target = undefined;
        if (v.player && !this.opts.stealFromPlayer()) {
            this.startFlee(g, b);
            return;
        }
        const x = v.sprite.x;
        const y = v.sprite.y - 32;
        const loss = this.scene.add.image(x, y, 'gremlin-loss').setOrigin(0.5, 1).setDepth(1e6 + 2);
        this.scene.tweens.add({ targets: loss, y: y - 14, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => loss.destroy() });
        g.loot = this.scene.add.sprite(g.sprite.x, g.sprite.y - GREMLIN_H - 1, 'tokens-token', 0).setOrigin(0.5, 1).play('tokens-token-spin');
        this.startFlee(g, b);
    }

    /** Run for the nearest edge of town. */
    private startFlee(g: Gremlin, b: Phaser.Geom.Rectangle) {
        const s = g.sprite;
        const toLeft = s.x - b.left < b.right - s.x;
        g.fleeX = toLeft ? b.left - 40 : b.right + 40;
        g.fleeY = s.y;
        g.fleeing = true;
        g.target = undefined;
    }

    private destroyOne(g: Gremlin) {
        g.sprite.destroy();
        g.shadow.destroy();
        g.loot?.destroy();
    }

    destroy() {
        for (const g of this.list) this.destroyOne(g);
        this.list = [];
    }
}
