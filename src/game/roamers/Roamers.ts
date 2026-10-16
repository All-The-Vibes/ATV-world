import Phaser from 'phaser';
import { addCreatorNametag, addPixels, characterSheet, ensurePixels, lookKey, randomLook, shadowTexture, speechArt, toHexNumber, type Color } from '../kit';
import type { Burnable } from '../dragon/Dragon';
import { ROAMERS } from './specs';
import type { RoamerHandle, RoamerSpec, RoamerWorld } from './types';

export type RoamersOptions = Omit<RoamerWorld, 'scene'>;

interface Roamer {
    spec: RoamerSpec;
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    anim: string;
    prop?: Phaser.GameObjects.Sprite;
    tag?: Phaser.GameObjects.Text;
    bubble?: Phaser.GameObjects.Image;
    bubbleLeft: number;
    state: 'wander' | 'pause' | 'leave';
    tx: number;
    ty: number;
    atToken: boolean;
    wait: number;
    life: number;
    /** Frozen for a moment (the dragon got them). */
    rest: number;
    foilCd: number;
    greetCd: number;
    fx: number;
    handle: RoamerHandle;
}

const SKY = 1e6;
const FOIL_RANGE = 64;
const GREET_RANGE = 36;
/** How many visitors can be in town at once, so the streets stay readable. */
const MAX_VISITORS = 5;

/**
 * Friendly characters that visit town now and then (one file each in ./characters): they wander
 * between spots and tokens, chat with the player, and scare gremlins into dropping what they stole.
 * A character can add its own behaviour through `hooks`. Call `update(dt)` from the scene's update.
 */
export class Roamers {
    private active = new Map<string, Roamer>();
    private timers = new Map<string, number>();
    private readonly world: RoamerWorld;

    constructor(private scene: Phaser.Scene, opts: RoamersOptions) {
        this.world = { scene, ...opts };
        ROAMERS.forEach((spec) => this.timers.set(spec.id, Phaser.Math.FloatBetween(6, 70)));
        ROAMERS.filter((spec) => spec.resident).forEach((spec) => this.invite(spec.id));
        scene.events.once('shutdown', () => this.destroy());
    }

    /** Bring one in right away (atv.game.scene.getScene('Preview').roamers.spawn('mothbell')). */
    spawn(id?: string) {
        const spec = ROAMERS.find((s) => s.id === id) ?? Phaser.Utils.Array.GetRandom(ROAMERS);
        if (this.active.has(spec.id)) return;
        this.add(spec);
    }

    /** Invite an absent visitor onto open ground near the player, without crowding the town. */
    invite(id: string): boolean {
        if (this.active.has(id)) return true;
        const spec = ROAMERS.find((s) => s.id === id);
        if (!spec) {
            console.warn(`Cannot invite unknown visitor: ${id}`);
            return false;
        }
        const anchor = this.world.player() ?? this.scene.cameras.main.midPoint;
        const bounds = this.world.bounds();
        const spots = [48, 80, 120, 180].flatMap((radius) =>
            Array.from({ length: 8 }, (_, i) => ({
                x: anchor.x + Math.cos(i * Math.PI / 4) * radius,
                y: anchor.y + Math.sin(i * Math.PI / 4) * radius,
            })));
        const spot = spots.find(({ x, y }) => bounds.contains(x, y) && this.world.open(x, y));
        if (!spot) {
            console.warn(`Cannot invite ${id}: no open ground near the player.`);
            return false;
        }
        const visitors = [...this.active.values()].filter((r) => !r.spec.resident);
        if (!spec.resident && visitors.length >= MAX_VISITORS) {
            this.remove(visitors.find((r) => r.state === 'leave') ?? visitors[0]);
        }
        const r = this.add(spec);
        r.sprite.setPosition(spot.x, spot.y);
        this.pickWaypoint(r);
        this.follow(r);
        return true;
    }

    /** Every visitor there is, in town or not (for the character search). */
    catalog() {
        return ROAMERS.map((s) => ({ id: s.id, name: s.name }));
    }

    /** A visitor's sprite while they're in town. */
    spriteOf(id: string): Phaser.GameObjects.Sprite | undefined {
        return this.active.get(id)?.sprite;
    }

    /** Visitors who could be pulled into a group activity (a workout class) right now. */
    people() {
        return [...this.active.values()]
            .filter((r) => r.state !== 'leave' && r.life > 25 && r.rest <= 0)
            .map((r) => ({
                sprite: r.sprite,
                shadow: r.shadow,
                hold: (seconds: number) => { r.rest = Math.max(r.rest, seconds); },
            }));
    }

    /** Who the dragon can toast. */
    burnables(): Burnable[] {
        return [...this.active.values()].map((r) => ({
            sprite: r.sprite,
            headroom: Math.max(38, r.sprite.displayHeight + 12),
            nametag: r.tag,
            quip: r.spec.burnReply,
            hold: (seconds: number) => {
                if (r.rest <= 0) r.spec.hooks?.onBurn?.(r.handle);
                r.rest = Math.max(r.rest, seconds);
            },
        }));
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        for (const spec of ROAMERS) {
            if (this.active.has(spec.id)) continue;
            const left = (this.timers.get(spec.id) ?? 0) - dt;
            if (left > 0) {
                this.timers.set(spec.id, left);
            } else if (spec.resident) {
                this.timers.set(spec.id, Phaser.Math.FloatBetween(...spec.every));
                this.invite(spec.id);
            } else if ([...this.active.values()].filter((r) => !r.spec.resident).length < MAX_VISITORS) {
                this.timers.set(spec.id, Phaser.Math.FloatBetween(...spec.every));
                this.add(spec);
            }
        }
        for (const r of [...this.active.values()]) this.step(r, dt);
    }

    private add(spec: RoamerSpec) {
        const look = randomLook(spec.id, spec.look);
        const key = spec.sheet ? `roamer-${spec.id}` : lookKey(look);
        const sheet = spec.sheet ? spec.sheet() : characterSheet(look);
        addPixels(this.scene, key, sheet.canvas, sheet.frames);
        const anim = `${key}-roam`;
        if (!this.scene.anims.exists(anim)) {
            this.scene.anims.create({ key: anim, frames: ['side-1', 'side-0', 'side-2', 'side-0'].map((frame) => ({ key, frame })), frameRate: 8, repeat: -1 });
        }
        const b = this.world.bounds();
        const x = Math.random() < 0.5 ? b.left - 12 : b.right + 12;
        const y = Phaser.Math.Between(Math.round(b.top + 80), Math.round(b.bottom - 40));
        const shadow = this.scene.add.image(x, y, shadowTexture(this.scene, 10)).setAlpha(0.25).setDepth(-1e8 + 1);
        const sprite = this.scene.add.sprite(x, y, key, 'side-0').setOrigin(0.5, 1).setDepth(y).play(anim);
        const r = {
            spec, sprite, shadow, anim, bubbleLeft: 0, state: 'wander', tx: x, ty: y, atToken: false, wait: 0,
            life: spec.resident ? Infinity : Phaser.Math.FloatBetween(...spec.stay), rest: 0, foilCd: 2, greetCd: 3, fx: 0.5,
        } as Roamer;
        r.handle = this.handleFor(r);
        addCreatorNametag(sprite, look, { speech: () => r.bubble });
        if (spec.showName) {
            r.tag = this.scene.add.text(x, y, spec.name, {
                fontFamily: 'VT323, monospace', fontSize: '16px', color: '#9ffff7',
                backgroundColor: '#101629', padding: { x: 3, y: 1 }, resolution: 2,
            }).setOrigin(0.5, 1).setName(`roamer-name-${spec.id}`).setData('gap', 2);
            const syncName = () => this.followName(r);
            this.scene.events.on('postupdate', syncName);
            sprite.once('destroy', () => this.scene.events.off('postupdate', syncName));
        }
        const prop = spec.prop;
        if (prop) {
            const tex = ensurePixels(this.scene, prop.key, prop.make);
            if (prop.frames > 1) {
                const flicker = `${tex}-roam`;
                if (!this.scene.anims.exists(flicker)) {
                    this.scene.anims.create({
                        key: flicker,
                        frames: Array.from({ length: prop.frames }, (_, frame) => ({ key: tex, frame })),
                        frameRate: prop.frameRate ?? 5,
                        repeat: -1,
                    });
                }
                r.prop = this.scene.add.sprite(x, y, tex, 0).play(flicker);
            } else {
                r.prop = this.scene.add.sprite(x, y, tex);
            }
        }
        this.pickWaypoint(r);
        this.active.set(spec.id, r);
        spec.hooks?.onSpawn?.(r.handle);
        this.follow(r);
        return r;
    }

    private handleFor(r: Roamer): RoamerHandle {
        return {
            spec: r.spec,
            sprite: r.sprite,
            world: this.world,
            age: 0,
            data: {},
            say: (text) => this.say(r, text),
            sparkle: (color, x, y) => this.sparkle(x ?? r.sprite.x, y ?? r.sprite.y - 14, color ?? r.spec.glow),
            ward: () => this.ward(r),
            pause: (seconds) => {
                r.state = 'pause';
                r.wait = Math.max(r.wait, seconds);
            },
            goTo: (x, y) => {
                r.state = 'wander';
                r.tx = x;
                r.ty = y;
                r.atToken = false;
            },
        };
    }

    private step(r: Roamer, dt: number) {
        const s = r.sprite;
        const spec = r.spec;
        r.handle.age += dt;
        r.foilCd -= dt;
        r.greetCd -= dt;
        r.life -= dt;
        if (r.bubble) {
            r.bubbleLeft -= dt;
            if (r.bubbleLeft <= 0) {
                r.bubble.destroy();
                r.bubble = undefined;
            }
        }
        r.fx -= dt;
        if (r.fx <= 0) {
            r.fx = 0.5;
            const px = s.x + Phaser.Math.Between(-6, 6);
            this.pixel(px, s.y - 18, spec.glow, px + Phaser.Math.Between(-3, 3), s.y - 34, 900);
        }

        if (r.rest > 0) {
            r.rest -= dt;
            this.halt(r);
            this.follow(r);
            return;
        }

        const gremlins = this.world.gremlins();
        if (gremlins && r.foilCd <= 0) {
            const g = gremlins.nearest(s.x, s.y, FOIL_RANGE, true);
            if (g) {
                gremlins.foil(g);
                this.ward(r);
                this.say(r, Phaser.Utils.Array.GetRandom(spec.foil));
                r.foilCd = 7;
                spec.hooks?.onFoil?.(r.handle);
            }
        }

        const p = this.world.player();
        if (p && r.greetCd <= 0 && Math.hypot(p.x - s.x, p.y - s.y) < GREET_RANGE) {
            r.greetCd = 14;
            r.state = 'pause';
            r.wait = 2.4;
            s.setFlipX(p.x < s.x);
            this.say(r, Phaser.Utils.Array.GetRandom(spec.greet));
            this.sparkle(p.x, p.y - 34, spec.glow);
            spec.hooks?.onGreet?.(r.handle);
        }

        if (r.life <= 0 && r.state !== 'leave') {
            const b = this.world.bounds();
            r.state = 'leave';
            r.atToken = false;
            r.tx = s.x - b.left < b.right - s.x ? b.left - 40 : b.right + 40;
            r.ty = s.y;
        }

        spec.hooks?.update?.(r.handle, dt);

        if (r.state === 'pause') {
            this.halt(r);
            r.wait -= dt;
            if (r.wait <= 0) {
                r.state = 'wander';
                this.pickWaypoint(r);
            }
        } else {
            const dx = r.tx - s.x;
            const dy = r.ty - s.y;
            const d = Math.hypot(dx, dy);
            if (d < 3) {
                if (r.state === 'leave') {
                    this.remove(r);
                    return;
                }
                if (r.atToken) {
                    this.sparkle(s.x, s.y - 14, spec.glow);
                    this.say(r, Phaser.Utils.Array.GetRandom(spec.token));
                    spec.hooks?.onToken?.(r.handle);
                }
                r.state = 'pause';
                r.wait = Math.max(r.wait, Phaser.Math.FloatBetween(2, 4));
            } else {
                const step = Math.min(d, spec.speed * dt);
                s.x += (dx / d) * step;
                s.y += (dy / d) * step;
                if (Math.abs(dx) > 1) s.setFlipX(dx < 0);
                if (!s.anims.isPlaying) s.play(r.anim);
            }
        }
        this.follow(r);
    }

    private halt(r: Roamer) {
        if (r.sprite.anims.isPlaying) r.sprite.stop().setFrame('side-0');
    }

    private follow(r: Roamer) {
        const s = r.sprite;
        r.shadow.setPosition(s.x, s.y);
        s.setDepth(s.y);
        const dir = s.flipX ? -1 : 1;
        const off = r.spec.prop?.offset;
        if (off) r.prop?.setPosition(Math.round(s.x + dir * off[0]), Math.round(s.y + off[1])).setFlipX(s.flipX).setDepth(s.y + 1);
        this.followName(r);
    }

    private followName(r: Roamer) {
        const s = r.sprite;
        const creator: Phaser.GameObjects.Text | undefined = s.getData('creatorNametag');
        if (r.tag) {
            const zoom = this.scene.cameras.main.zoom;
            const head = s.getTopCenter();
            const gap = creator?.visible ? creator.height / zoom + 6 : 2;
            r.tag.setPosition(head.x, head.y - gap).setScale(1 / zoom).setDepth(s.depth + 0.2)
                .setVisible(s.visible && s.active).setAlpha(s.alpha);
        }
        const bubbleY = r.tag
            ? r.tag.y - r.tag.displayHeight - 4
            : s.y - Math.max(30, s.displayHeight + 8);
        r.bubble?.setPosition(Math.round(s.x), Math.round(bubbleY)).setDepth(SKY + 2);
    }

    private pickWaypoint(r: Roamer) {
        const b = this.world.bounds();
        const coins = this.world.tokens()?.playthings() ?? [];
        if (coins.length && Math.random() < 0.4) {
            const c = Phaser.Utils.Array.GetRandom([...coins]);
            r.tx = c.x;
            r.ty = c.y;
            r.atToken = true;
            return;
        }
        r.atToken = false;
        for (let i = 0; i < 10; i++) {
            const x = Phaser.Math.Between(Math.round(b.left + 30), Math.round(b.right - 30));
            const y = Phaser.Math.Between(Math.round(b.top + 70), Math.round(b.bottom - 30));
            r.tx = x;
            r.ty = y;
            if (this.world.open(x, y)) return;
        }
    }

    private say(r: Roamer, text: string) {
        const key = `roamer-say-${text}`;
        addPixels(this.scene, key, speechArt(text, 18));
        r.bubble?.destroy();
        r.bubble = this.scene.add.image(r.sprite.x, r.sprite.y - 30, key).setOrigin(0.5, 1).setDepth(SKY + 2);
        r.bubbleLeft = 2.8;
    }

    /** A tiny square that drifts to a spot and fades. */
    private pixel(x: number, y: number, color: Color, tx: number, ty: number, duration: number) {
        const p = this.scene.add.rectangle(x, y, 2, 2, toHexNumber(color)).setDepth(SKY + 1);
        this.scene.tweens.add({ targets: p, x: tx, y: ty, alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
    }

    private sparkle(x: number, y: number, color: Color) {
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            this.pixel(x, y, color, x + Math.cos(a) * 12, y + Math.sin(a) * 8 - 6, 650);
        }
    }

    /** The show a roamer puts on when it scares a gremlin. */
    private ward(r: Roamer) {
        const { x, y } = r.sprite;
        const glow = r.spec.glow;
        if (r.spec.ward === 'rays') {
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                for (const d of [8, 14]) this.pixel(x + Math.cos(a) * d, y - 14 + Math.sin(a) * d, i % 2 ? glow : 'white', x + Math.cos(a) * 34, y - 14 + Math.sin(a) * 34, 600);
            }
        } else if (r.spec.ward === 'ring') {
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                this.pixel(x + Math.cos(a) * 6, y + Math.sin(a) * 2, i % 2 ? glow : 'gold', x + Math.cos(a) * 30, y + Math.sin(a) * 11, 700);
            }
        } else {
            for (let i = 0; i < 8; i++) {
                this.pixel(x + Phaser.Math.Between(-6, 6), y - 18, i % 2 ? glow : 'cream', x + Phaser.Math.Between(-28, 28), y - Phaser.Math.Between(22, 44), 900);
            }
        }
    }

    private remove(r: Roamer) {
        r.spec.hooks?.onLeave?.(r.handle);
        r.sprite.destroy();
        r.shadow.destroy();
        r.prop?.destroy();
        r.tag?.destroy();
        r.bubble?.destroy();
        this.active.delete(r.spec.id);
    }

    destroy() {
        for (const r of [...this.active.values()]) this.remove(r);
    }
}
