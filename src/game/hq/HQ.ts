import Phaser from 'phaser';
import { call, type Caller } from '../../call';
import { addCreatorNametag, addPixels, characterSheet, hashString, shadowTexture, type Facing } from '../kit';
import {
    BAYS, DESK_W, HQ_SPOTS, HQ_W, beaconArt, bubbleArt, callerLook, coderSheet, deskDarkArt, deskSpot, hqBodyHeight,
    hqFacade, hqGlass, hqHeight, plateArt, plateText, signArt, tickerArt,
} from './art';

interface Desk {
    index: number;
    caller: Caller | null;
    /** Whoever just left, while their goodbye plays: the desk isn't free until it's done. */
    leaving: Caller | null;
    /** Set while they're walking in from the street. Calling it sends them home. */
    walking?: () => void;
    /** Bumped on every arrival and departure, so a stale animation's callback knows to do nothing. */
    gen: number;
    /** Lights-off overlay. */
    dark: Phaser.GameObjects.Image;
    coder?: Phaser.GameObjects.Sprite;
    nametag?: Phaser.GameObjects.Text;
    plate?: Phaser.GameObjects.Image;
    /** The leaver's coder and plate, fading out. */
    fading?: Phaser.GameObjects.GameObject[];
}

/** HQ's layers, stacked just above the building's own depth. */
const LAYER = { coder: 0.01, sign: 0.01, dark: 0.02, plate: 0.02, ticker: 0.02, beacon: 0.02, glass: 0.03, bubble: 0.05 };

/** Joins right after connecting (everyone already on the call) skip the walk and the hellos. */
const SETTLE_MS = 2500;
const WALK_SPEED = 72;
/** The ticker's text becomes one texture: keep it well under GPU texture limits on a 50-person call. */
const TICKER_CHARS = 420;

/** "ON THE CALL (48): STEPH * NEMO * ... * +12 MORE" */
function tickerText(people: readonly Caller[]): string {
    let text = `ON THE CALL (${people.length}): `;
    for (let i = 0; i < people.length; i++) {
        const name = (i ? '  *  ' : '') + people[i].name;
        if (text.length + name.length > TICKER_CHARS) return `${text}  *  +${people.length - i} MORE`;
        text += name;
    }
    return text;
}

/**
 * ATV HQ: everyone on the call (see src/call) gets a desk with a random avatar, coding away. Desks fill
 * eight to a floor, lowest free desk first, and the building grows a floor when it runs out. Newcomers
 * walk in the front door and their lights flick on; leavers' lights go off as they head home.
 */
export class HQ {
    private floors = 0;
    private desks: Desk[] = [];
    private byId = new Map<string, Desk>();
    private facade: Phaser.GameObjects.Image;
    private glass: Phaser.GameObjects.Image;
    private sign: Phaser.GameObjects.Sprite;
    private beacon: Phaser.GameObjects.Image;
    private ticker: Phaser.GameObjects.TileSprite;
    private tickerText = '';
    private tickerScroll = 0;
    private textures = 0;
    private signLit = false;
    private settled: number;
    private statusKind = call.status.kind;
    /** How many sprites use each coder and walker sheet (see track). */
    private uses = new Map<string, number>();
    private readonly unsubscribe: () => void;
    /** Called after the building gains or loses a floor. */
    onResize?: () => void;
    /** Called when someone clicks (or taps) the building. */
    onClick?: () => void;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly bottom: number) {
        addPixels(scene, 'hq-dark', deskDarkArt());
        addPixels(scene, 'hq-beacon', beaconArt());
        const on = signArt(true), off = signArt(false);
        addPixels(scene, 'hq-sign-on', on.canvas, on.frames);
        addPixels(scene, 'hq-sign-off', off.canvas, off.frames);
        if (!scene.anims.exists('hq-sign-chase')) {
            scene.anims.create({ key: 'hq-sign-chase', frames: on.frames.map((f) => ({ key: 'hq-sign-on', frame: f.name })), frameRate: 3, repeat: -1 });
        }
        addPixels(scene, 'hq-blank', tickerArt(''));

        this.facade = scene.add.image(x, bottom, 'hq-blank').setOrigin(0.5, 1).setDepth(bottom);
        this.glass = scene.add.image(x, bottom, 'hq-blank').setOrigin(0.5, 1).setDepth(bottom + LAYER.glass);
        this.sign = scene.add.sprite(0, 0, 'hq-sign-off', 0).setOrigin(0, 0).setDepth(bottom + LAYER.sign);
        this.beacon = scene.add.image(0, 0, 'hq-beacon').setDepth(bottom + LAYER.beacon);
        const t = HQ_SPOTS.ticker;
        this.ticker = scene.add.tileSprite(this.left + t.x, bottom + t.y, t.w, t.h, 'hq-blank').setOrigin(0, 0).setDepth(bottom + LAYER.ticker);
        // A click (not a drag: dragging looks around) on the building means "go in".
        this.facade.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
            if (p.getDistance() < 6) this.onClick?.();
        });
        this.build(1);

        scene.time.addEvent({ delay: 700, loop: true, callback: () => this.beacon.setVisible(!this.beacon.visible) });
        this.settled = scene.time.now + SETTLE_MS;
        this.unsubscribe = call.subscribe(() => this.sync());
        scene.events.on('update', this.tick, this);
        scene.events.once('shutdown', () => this.destroy());
        scene.events.once('destroy', () => this.destroy());
        this.sync();
    }

    get left(): number {
        return this.x - HQ_W / 2;
    }

    /** The whole building, roof sign included. */
    bounds(): Phaser.Geom.Rectangle {
        const h = hqHeight(this.floors);
        return new Phaser.Geom.Rectangle(this.left, this.bottom - h, HQ_W, h);
    }

    /** Whether someone standing at (x, y) is inside the building (feet past the front wall, under the roof). */
    contains(x: number, y: number): boolean {
        return x > this.left + 1 && x < this.left + HQ_W - 1 && y < this.bottom && y >= this.bottom - hqBodyHeight(this.floors);
    }

    /** Just inside the front door, and just outside it on the sidewalk. */
    get doorway() {
        return { inside: { x: this.x, y: this.bottom - 2 }, outside: { x: this.x, y: this.bottom + 10 } };
    }

    /** Stop following the call (the scene is going away). Safe to call more than once. */
    destroy() {
        this.unsubscribe();
        this.scene.events.off('update', this.tick, this);
        this.onResize = undefined;
        this.onClick = undefined;
    }

    /**
     * Arrivals and departures happen without walks or bubbles: right after HQ opens, while a call is still
     * connecting, and just after it connects (everyone already on the call shows up at once).
     */
    private get quiet(): boolean {
        return this.scene.time.now < this.settled || call.status.kind === 'connecting';
    }

    /**
     * `sprite` uses texture `key` and animations `anims`. Once the last sprite using them is gone, free them:
     * people come and go all day, and their sheets would otherwise pile up.
     */
    private track(sprite: Phaser.GameObjects.Sprite, key: string, anims: string[]) {
        this.uses.set(key, (this.uses.get(key) ?? 0) + 1);
        sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
            const left = (this.uses.get(key) ?? 1) - 1;
            if (left > 0) {
                this.uses.set(key, left);
                return;
            }
            this.uses.delete(key);
            for (const anim of anims) this.scene.anims.remove(anim);
            if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
        });
    }

    private tick(_time: number, delta: number) {
        this.tickerScroll += delta * 0.018;
        this.ticker.tilePositionX = Math.floor(this.tickerScroll);
    }

    /** Match the desks to whoever's on the call now. */
    private sync() {
        // Connecting to a call brings in everyone already on it at once: seat them without the parade.
        const kind = call.status.kind;
        if (kind !== this.statusKind && (kind === 'connecting' || kind === 'live')) this.settled = this.scene.time.now + SETTLE_MS;
        this.statusKind = kind;

        const people = call.list();
        const here = new Set(people.map((c) => c.id));
        for (const [id, desk] of this.byId) if (!here.has(id)) this.leave(desk);
        for (const c of people) {
            const desk = this.byId.get(c.id);
            if (!desk) this.arrive(c);
            else if (desk.caller && (desk.caller.name !== c.name || desk.caller.me !== c.me)) {
                desk.caller = c;
                if (desk.plate) this.placePlate(desk);
            }
        }
        this.refreshSigns(people);
    }

    private arrive(c: Caller) {
        // Back already? Same desk as before. Otherwise the lowest free desk, then one that's still saying
        // goodbye (cut it short), and only then a new floor. Holes left by leavers get filled first.
        let desk = this.desks.find((d) => d.leaving?.id === c.id)
            ?? this.desks.find((d) => !d.caller && !d.leaving)
            ?? this.desks.find((d) => !d.caller && d.leaving);
        if (!desk) {
            this.build(this.floors + 1);
            desk = this.desks.find((d) => !d.caller && !d.leaving)!;
        }
        const seat = desk;
        if (seat.leaving) this.endGoodbye(seat);
        const gen = ++seat.gen;
        seat.caller = c;
        this.byId.set(c.id, seat);
        if (this.quiet) this.sitDown(seat, true);
        else {
            seat.walking = this.walk(c, 'in', () => {
                if (seat.gen !== gen) return;
                seat.walking = undefined;
                this.sitDown(seat, false);
            });
        }
    }

    /** Stop a goodbye halfway: the desk is wanted. */
    private endGoodbye(desk: Desk) {
        desk.leaving = null;
        this.scene.tweens.killTweensOf(desk.dark);
        for (const part of desk.fading ?? []) {
            this.scene.tweens.killTweensOf(part);
            part.destroy();
        }
        desk.fading = undefined;
    }

    /** Put a desk's caller in their chair: at once, or with the lights flickering on and a hello. */
    private sitDown(desk: Desk, instant: boolean) {
        const c = desk.caller;
        if (!c) return;
        const { key, anim, frames } = this.coderTexture(c.id);
        const spot = deskSpot(desk.index);
        const coder = this.scene.add.sprite(this.left + spot.x, this.bottom + spot.y, key, 0)
            .setOrigin(0, 0)
            .setFlipX(spot.flip)
            .setDepth(this.bottom + LAYER.coder);
        coder.play({ key: anim, startFrame: Math.floor(Math.random() * frames) });
        this.track(coder, key, [anim]);
        desk.coder = coder;
        desk.nametag = addCreatorNametag(coder, callerLook(c.id), { headOffsetX: 8 - DESK_W / 2 });
        this.placePlate(desk);

        this.scene.tweens.killTweensOf(desk.dark);
        if (instant) {
            desk.dark.setAlpha(0);
            return;
        }
        // Fluorescent lights flicker on, then they pop in and say hi.
        this.scene.tweens.chain({
            targets: desk.dark,
            tweens: [{ alpha: 0.3, duration: 70 }, { alpha: 0.8, duration: 60 }, { alpha: 0, duration: 180 }],
        });
        coder.setAlpha(0);
        desk.plate?.setAlpha(0);
        this.scene.tweens.add({ targets: [coder, desk.plate].filter(Boolean), alpha: 1, delay: 220, duration: 260 });
        this.say(desk, 'HI!');
    }

    private leave(desk: Desk) {
        const c = desk.caller;
        if (!c) return;
        this.byId.delete(c.id);
        const gen = ++desk.gen;
        desk.caller = null;
        if (desk.walking) {
            // Never made it to their desk.
            desk.walking();
            desk.walking = undefined;
            this.shrink();
            return;
        }
        desk.leaving = c;
        const quiet = this.quiet;
        if (!quiet) this.say(desk, 'BYE!');
        const parts = [desk.coder, desk.plate].filter((p): p is NonNullable<typeof p> => !!p);
        desk.coder = undefined;
        desk.nametag = undefined;
        desk.plate = undefined;
        desk.fading = parts;
        this.scene.tweens.add({
            targets: parts,
            alpha: 0,
            duration: 420,
            onComplete: () => {
                parts.forEach((p) => p.destroy());
                if (desk.fading === parts) desk.fading = undefined;
            },
        });
        this.scene.tweens.killTweensOf(desk.dark);
        this.scene.tweens.add({
            targets: desk.dark,
            alpha: 1,
            delay: 380,
            duration: 300,
            onComplete: () => {
                if (desk.gen !== gen) return;
                desk.leaving = null;
                this.shrink();
                if (!quiet) this.walk(c, 'out');
            },
        });
    }

    /**
     * Walk someone between the street and the front door. `in` calls `arrived` as they step inside.
     * Returns a function that makes them give up and fade away.
     */
    private walk(c: Caller, way: 'in' | 'out', arrived?: () => void): () => void {
        const scene = this.scene;
        const key = this.walkerTexture(c.id);
        const door = { x: this.x, y: this.bottom + 3 };
        const front = { x: this.x, y: this.bottom + 12 };
        const side = Math.random() < 0.5 ? -1 : 1;
        // Along the sidewalk in front of HQ, so they're in view whenever HQ is.
        const far = { x: Math.round(this.x + side * (HQ_W / 2 + 28 + Math.random() * 40)), y: Math.round(this.bottom + 10 + Math.random() * 8) };
        const route = way === 'in' ? [far, front, door] : [door, front, far];
        const sprite = scene.add.sprite(route[0].x, route[0].y, key, 'down-0').setOrigin(0.5, 1).setAlpha(0).setDepth(route[0].y);
        addCreatorNametag(sprite, callerLook(c.id));
        this.track(sprite, key, (['down', 'up', 'side'] as const).map((f) => `${key}-${f}`));
        const shadow = scene.add.image(route[0].x, route[0].y, shadowTexture(scene, 10)).setAlpha(0).setDepth(-1e8);
        const follow = () => {
            sprite.setDepth(sprite.y);
            shadow.setPosition(sprite.x, sprite.y);
        };
        let gone = false;
        const vanish = (ms: number) => {
            if (gone) return;
            gone = true;
            scene.tweens.add({ targets: [sprite, shadow], alpha: 0, duration: ms, onComplete: () => [sprite, shadow].forEach((o) => o.destroy()) });
        };
        scene.tweens.add({ targets: sprite, alpha: 1, duration: 250 });
        scene.tweens.add({ targets: shadow, alpha: 0.25, duration: 250 });
        const legs = route.slice(1).map((to, i) => {
            const from = route[i];
            const dx = to.x - from.x, dy = to.y - from.y;
            const facing: Facing = Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
            return {
                x: to.x,
                y: to.y,
                duration: Math.max(150, (Math.hypot(dx, dy) / WALK_SPEED) * 1000),
                onStart: () => {
                    sprite.play(`${key}-${facing}`, true).setFlipX(facing === 'side' && dx < 0);
                },
                onUpdate: follow,
            };
        });
        const chain = scene.tweens.chain({
            targets: sprite,
            tweens: legs,
            onComplete: () => {
                sprite.stop();
                vanish(way === 'in' ? 200 : 450);
                arrived?.();
            },
        });
        return () => {
            chain.stop();
            sprite.stop();
            vanish(300);
        };
    }

    /** Drop empty floors from the top (never below one). */
    private shrink() {
        let last = -1;
        this.desks.forEach((d, i) => {
            if (d.caller || d.leaving) last = i;
        });
        const floors = Math.max(1, Math.ceil((last + 1) / BAYS));
        if (floors < this.floors) this.build(floors);
    }

    /** Repaint the building for `floors` floors, adding or removing desks to match. */
    private build(floors: number) {
        const old = [this.facade.texture.key, this.glass.texture.key];
        this.floors = floors;
        const v = ++this.textures;
        addPixels(this.scene, `hq-facade-${v}`, hqFacade(floors));
        addPixels(this.scene, `hq-glass-${v}`, hqGlass(floors));
        this.facade.setTexture(`hq-facade-${v}`);
        this.glass.setTexture(`hq-glass-${v}`);
        // setTexture keeps the old click area: resize it to the new building.
        (this.facade.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, this.facade.width, this.facade.height);
        for (const key of old) if (key.startsWith('hq-facade-') || key.startsWith('hq-glass-')) this.scene.textures.remove(key);

        while (this.desks.length < floors * BAYS) {
            const index = this.desks.length;
            const spot = deskSpot(index);
            const dark = this.scene.add.image(this.left + spot.x, this.bottom + spot.y, 'hq-dark')
                .setOrigin(0, 0)
                .setFlipX(spot.flip)
                .setDepth(this.bottom + LAYER.dark);
            this.desks.push({ index, caller: null, leaving: null, gen: 0, dark });
        }
        while (this.desks.length > floors * BAYS) {
            const desk = this.desks.pop()!;
            this.scene.tweens.killTweensOf(desk.dark);
            desk.dark.destroy();
        }

        const top = this.bottom - hqHeight(floors);
        this.sign.setPosition(this.left + HQ_SPOTS.sign.x, top + HQ_SPOTS.sign.y);
        this.beacon.setPosition(this.left + HQ_SPOTS.beacon.x + 0.5, top + HQ_SPOTS.beacon.y + 0.5);
        this.onResize?.();
    }

    private placePlate(desk: Desk) {
        const c = desk.caller;
        if (!c) return;
        const text = plateText(c.name);
        const key = `hq-plate-${c.me ? 'me' : 'them'}-${text}`;
        addPixels(this.scene, key, plateArt(text, c.me));
        const spot = deskSpot(desk.index);
        if (desk.plate) desk.plate.setTexture(key);
        else desk.plate = this.scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(this.bottom + LAYER.plate);
        desk.plate.setPosition(this.left + spot.plateX - Math.floor(desk.plate.width / 2), this.bottom + spot.plateY);
    }

    /** A speech bubble over someone's head. */
    private say(desk: Desk, text: string) {
        if (this.quiet) return;
        const key = `hq-bubble-${text}`;
        addPixels(this.scene, key, bubbleArt(text));
        const spot = deskSpot(desk.index);
        const headX = this.left + spot.x + (spot.flip ? DESK_W - 8 : 8);
        const y = this.bottom + spot.y + 3;
        const bubble = this.scene.add.image(0, y, key).setOrigin(0, 1).setDepth(this.bottom + LAYER.bubble).setAlpha(0);
        bubble.x = headX - Math.floor(bubble.width / 2);
        const nametag = desk.nametag;
        const float = { y: 0, alpha: 0 };
        const follow = () => bubble.setAlpha(float.alpha)
            .setY((nametag?.active ? nametag.y - nametag.displayHeight - 4 : y) + float.y);
        this.scene.events.on('postupdate', follow);
        bubble.once('destroy', () => this.scene.events.off('postupdate', follow));
        this.scene.tweens.chain({
            targets: float,
            tweens: [
                { alpha: 1, y: -3, duration: 200, ease: 'Back.easeOut' },
                { alpha: 0, y: -6, delay: 1500, duration: 300 },
            ],
            onComplete: () => bubble.destroy(),
        });
    }

    /** The rooftop sign lights up while anyone's on the call; the ticker over the door says who. */
    private refreshSigns(people: readonly Caller[]) {
        const lit = people.length > 0;
        if (lit !== this.signLit) {
            this.signLit = lit;
            if (lit) this.sign.play('hq-sign-chase');
            else this.sign.stop().setTexture('hq-sign-off', 0);
        }
        const text = lit ? tickerText(people) : 'NOBODY ON THE CALL  *  ADD ATV WORLD TO A TEAMS MEETING AND EVERYONE GETS A DESK';
        if (text === this.tickerText) return;
        this.tickerText = text;
        const old = this.ticker.texture.key;
        const key = `hq-ticker-${++this.textures}`;
        addPixels(this.scene, key, tickerArt(text));
        this.ticker.setTexture(key);
        if (old.startsWith('hq-ticker-')) this.scene.textures.remove(old);
    }

    /** Someone's coding loop: drawn once per person, reused if they rejoin. */
    private coderTexture(id: string): { key: string; anim: string; frames: number } {
        const key = `hq-coder-${hashString(id).toString(36)}`;
        const anim = `${key}-work`;
        if (!this.scene.textures.exists(key)) {
            const sheet = coderSheet(id);
            addPixels(this.scene, key, sheet.canvas, sheet.frames);
            this.scene.anims.remove(anim);
            this.scene.anims.create({ key: anim, frames: sheet.frames.map((f) => ({ key, frame: f.name })), frameRate: sheet.fps, repeat: -1 });
        }
        return { key, anim, frames: this.scene.anims.get(anim)?.frames.length ?? 1 };
    }

    /** The same avatar on foot, for walking to and from the door. */
    private walkerTexture(id: string): string {
        const key = `hq-walker-${hashString(id).toString(36)}`;
        if (!this.scene.textures.exists(key)) {
            const sheet = characterSheet(callerLook(id));
            addPixels(this.scene, key, sheet.canvas, sheet.frames);
            for (const facing of ['down', 'up', 'side'] as const) {
                const anim = `${key}-${facing}`;
                this.scene.anims.remove(anim);
                this.scene.anims.create({
                    key: anim,
                    frames: [`${facing}-1`, `${facing}-0`, `${facing}-2`, `${facing}-0`].map((frame) => ({ key, frame })),
                    frameRate: 9,
                    repeat: -1,
                });
            }
        }
        return key;
    }
}
