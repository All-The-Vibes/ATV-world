import Phaser from 'phaser';
import { ensurePixels, shadowTexture } from '../kit';
import { itemArt } from '../../backpack/art';
import { ITEMS, type ItemId, type Loot } from '../../backpack/inventory';
import { tokenCount } from '../commands';
import { addTokenCounter } from './counter';
import { CAR_H, CAR_W, bannerTexture, carTexture, popTexture, tokenTexture } from './art';

/** Someone who can pick tokens up: the player or a passer-by. */
export interface Collector {
    sprite: Phaser.GameObjects.Sprite;
    player: boolean;
}

export interface TokensOptions {
    /** The world's current bounds; cars cross it and tokens land inside it. */
    bounds: () => Phaser.Geom.Rectangle;
    /** Whether a token may land here (not inside a building, where nobody could reach it). */
    open: (x: number, y: number) => boolean;
    /** Someone picked a token up. */
    onCollect?: (by: Collector, kind: Loot) => void;
}

interface Car {
    car: Phaser.GameObjects.Sprite;
    banner: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    dir: 1 | -1;
    ground: number;
    drops: number[];
    item?: ItemId;
    age: number;
}

interface Token {
    kind: Loot;
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    landed: boolean;
    age: number;
    blinking: boolean;
}

const ALTITUDE = 74;
const SPEED = 78;
const SKY = 1e6;
const MAX_TOKENS = 14;
const LIFETIME = 45;
/** Pick-up reach from a character's feet, in world px. */
const REACH_X = 10;
const REACH_Y = 8;

/**
 * Flying electric cars that cross the sky every so often towing a FREE TOKENS! banner and dropping
 * gold tokens. Tokens bounce onto open ground; anyone who walks over one picks it up.
 */
export class Tokens {
    private cars: Car[] = [];
    private tokens: Token[] = [];
    private nextCar = 3;
    private nextItem = 0;
    private counted = new WeakSet<Phaser.GameObjects.Sprite>();

    constructor(private scene: Phaser.Scene, private opts: TokensOptions) {
        const key = carTexture(scene);
        tokenTexture(scene);
        popTexture(scene);
        for (const item of ITEMS) {
            ensurePixels(scene, `loot-${item.id}`, () => itemArt(item.id));
            popTexture(scene, item.id);
        }
        const anim = (name: string, tex: string, frames: number[], frameRate: number) => {
            if (!scene.anims.exists(name)) {
                scene.anims.create({ key: name, frames: frames.map((frame) => ({ key: tex, frame })), frameRate, repeat: -1 });
            }
        };
        anim('tokens-car-fly', key, [0, 1], 14);
        anim('tokens-banner-r-wave', bannerTexture(scene, true), [0, 1], 5);
        anim('tokens-banner-l-wave', bannerTexture(scene, false), [0, 1], 5);
        anim('tokens-token-spin', 'tokens-token', [0, 1, 2, 3], 8);
    }

    /** How many tokens are lying around right now. */
    get count() {
        return this.tokens.length;
    }

    /** Landed coins are toys too; looking never collects or moves the player's tokens. */
    playthings(): readonly { x: number; y: number }[] {
        return this.tokens.filter((token) => token.landed).map(({ sprite }) => ({ x: sprite.x, y: sprite.y }));
    }

    /** Put a token back on the ground near here (a gremlin's loot, recovered). */
    spill(x: number, y: number) {
        this.drop(x, y - 20, y);
    }

    /** Send a car over right away (handy from the console: atv.game.scene.getScene('Preview').tokens.flyOver()). */
    flyOver() {
        const b = this.opts.bounds();
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        const ground = Phaser.Math.Between(Math.round(b.top + 70), Math.round(b.bottom - 30));
        const x = dir > 0 ? b.left - CAR_W : b.right + CAR_W;
        const y = ground - ALTITUDE;
        const side = dir > 0 ? 'r' : 'l';
        const car = this.scene.add.sprite(x, y, 'tokens-car', 0).setOrigin(0.5, 1).setFlipX(dir < 0).setDepth(SKY + 1).play('tokens-car-fly');
        const banner = this.scene.add.sprite(x, y, `tokens-banner-${side}`, 0)
            .setOrigin(dir > 0 ? 1 : 0, 0.5)
            .setDepth(SKY)
            .play(`tokens-banner-${side}-wave`);
        const shadow = this.scene.add.image(x, ground, shadowTexture(this.scene, 34)).setAlpha(0.18).setDepth(-1e8 + 1);
        const room = Math.max(0, MAX_TOKENS - this.tokens.length);
        const drops = Array.from({ length: Math.min(room, Phaser.Math.Between(4, 6)) }, () =>
            Phaser.Math.FloatBetween(b.left + 40, b.right - 40)).sort((a, c) => (a - c) * dir);
        const item = ITEMS[this.nextItem++ % ITEMS.length].id;
        this.cars.push({ car, banner, shadow, dir, ground, drops, item, age: 0 });
    }

    update(dt: number, collectors: Collector[]) {
        this.nextCar -= dt;
        if (this.nextCar <= 0) {
            this.nextCar = Phaser.Math.FloatBetween(10, 18);
            this.flyOver();
        }

        const b = this.opts.bounds();
        for (const c of this.cars) {
            c.age += dt;
            const x = c.car.x + c.dir * SPEED * dt;
            const y = c.ground - ALTITUDE + Math.round(Math.sin(c.age * 3) * 2);
            c.car.setPosition(x, y);
            c.banner.setPosition(x - c.dir * (CAR_W / 2 - 3), y - CAR_H + 9);
            c.shadow.setPosition(x, c.ground);
            while (c.drops.length && (x - c.drops[0]) * c.dir >= 0) {
                c.drops.shift();
                const dropped = this.drop(x, y - CAR_H / 2, c.ground, c.item);
                if (dropped) c.item = undefined;
            }
        }
        this.cars = this.cars.filter((c) => {
            const gone = c.dir > 0 ? c.car.x > b.right + CAR_W * 3 : c.car.x < b.left - CAR_W * 3;
            if (gone) [c.car, c.banner, c.shadow].forEach((o) => o.destroy());
            return !gone;
        });

        for (const t of this.tokens) {
            t.age += dt;
            if (!t.blinking && t.age > LIFETIME - 8) {
                t.blinking = true;
                this.scene.tweens.add({ targets: t.sprite, alpha: 0.25, duration: 220, yoyo: true, repeat: -1 });
            }
        }
        this.tokens = this.tokens.filter((t) => {
            if (t.age < LIFETIME) return true;
            this.remove(t);
            return false;
        });

        for (const who of collectors) {
            const s = who.sprite;
            if (!this.counted.has(s)) {
                this.counted.add(s);
                addTokenCounter(s, who.player ? tokenCount : () => s.getData('tokenCount') ?? 0, who.player ? 34 : 2);
            }
            if (!s.visible) continue;
            const t = this.tokens.find((t) => t.landed && (who.player || t.kind === 'token') &&
                Math.abs(t.sprite.x - s.x) <= REACH_X && Math.abs(t.sprite.y - s.y) <= REACH_Y);
            if (!t) continue;
            this.tokens.splice(this.tokens.indexOf(t), 1);
            this.remove(t);
            if (t.kind === 'token' && !who.player) s.setData('tokenCount', (s.getData('tokenCount') ?? 0) + 1);
            this.pop(s.x, s.y - 32, t.kind);
            this.opts.onCollect?.(who, t.kind);
        }
    }

    /** Drop from a car or seed the plaza; never put loot inside a building or exceed the ground limit. */
    drop(fromX: number, fromY: number, ground: number, kind: Loot = 'token'): boolean {
        if (this.tokens.length >= MAX_TOKENS) return false;
        const b = this.opts.bounds();
        let spot: { x: number; y: number } | undefined;
        for (let i = 0; i < 8 && !spot; i++) {
            const x = Phaser.Math.Clamp(fromX + Phaser.Math.Between(-24, 24), b.left + 16, b.right - 16);
            const y = Phaser.Math.Clamp(ground + Phaser.Math.Between(-44, 44), b.top + 20, b.bottom - 14);
            if (this.opts.open(x, y)) spot = { x, y };
        }
        if (!spot) return false;

        const sprite = this.scene.add.sprite(fromX, fromY, kind === 'token' ? 'tokens-token' : `loot-${kind}`)
            .setOrigin(0.5, 1).setDepth(SKY - 1);
        if (kind === 'token') sprite.play('tokens-token-spin');
        const shadow = this.scene.add.image(spot.x, spot.y, shadowTexture(this.scene, kind === 'token' ? 8 : 18)).setAlpha(0).setScale(0.4).setDepth(-1e8 + 1);
        const token: Token = { kind, sprite, shadow, landed: false, age: 0, blinking: false };
        this.tokens.push(token);
        const duration = 1100;
        this.scene.tweens.add({ targets: sprite, x: spot.x, duration, ease: 'Linear' });
        this.scene.tweens.add({
            targets: sprite,
            y: spot.y,
            duration,
            ease: 'Bounce.easeOut',
            onComplete: () => {
                token.landed = true;
                sprite.setDepth(spot.y);
            },
        });
        this.scene.tweens.add({ targets: shadow, alpha: 0.3, scale: 1, duration, ease: 'Quad.easeIn' });
        return true;
    }

    private remove(t: Token) {
        this.scene.tweens.killTweensOf([t.sprite, t.shadow]);
        t.sprite.destroy();
        t.shadow.destroy();
    }

    private pop(x: number, y: number, kind: Loot) {
        const pop = this.scene.add.image(x, y, `tokens-pop-${kind}`).setOrigin(0.5, 1).setDepth(SKY + 2);
        this.scene.tweens.add({ targets: pop, y: y - 14, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => pop.destroy() });
    }

    destroy() {
        for (const c of this.cars) [c.car, c.banner, c.shadow].forEach((o) => o.destroy());
        for (const t of this.tokens) this.remove(t);
        this.cars = [];
        this.tokens = [];
    }
}
