import Phaser from 'phaser';
import { walkInput } from '../commands';
import { PLAYER_LOOK, addCreatorNametag, addPixels, shadowTexture, speechArt, type Facing } from '../kit';
import { PORTAL, wonderlandTextures } from '../wonderland/art';
import { Chess } from '../wonderland/Chess';
import { Croquet } from '../wonderland/Croquet';
import { curioTextures } from '../wonderland/curios';
import { Clocks, FairyRing, FallingUp, LookingGlass, Potions, Signpost, Tweedles } from '../wonderland/Curiosities';
import { folkTextures } from '../wonderland/folk';
import { Garden } from '../wonderland/Garden';
import { WhiteRabbit } from '../wonderland/RabbitTree';
import { TeaParty } from '../wonderland/TeaParty';
import { Speaker, pick, still, type Feature } from '../wonderland/talk';

/** The walkable part of Wonderland. */
const AREA = new Phaser.Geom.Rectangle(-560, -400, 1120, 800);
/** The little door home, in its hedge arch, and where the player lands after falling down the rabbit hole. */
const DOOR = { x: 0, y: -120 };
const LANDING = { x: 0, y: -40 };
const SPEED = 92;
/** How long shrinking, growing, and the world turning upside down last. */
const SPELL_SECONDS = 12;
const TOPSY_SECONDS = 9;

/** Where the White Rabbit runs, round and round (and where he stops to check the time). */
const RABBIT_ROUTE: { x: number; y: number; watch?: boolean }[] = [
    { x: -150, y: 10 }, { x: -230, y: 70, watch: true }, { x: -440, y: -10 }, { x: -300, y: -150 }, { x: -60, y: -170, watch: true },
    { x: 90, y: -160 }, { x: 250, y: -30 }, { x: 470, y: 40 }, { x: 480, y: 290, watch: true }, { x: 200, y: 320 },
    { x: -60, y: 300 }, { x: -260, y: 280 }, { x: -170, y: 120 },
];

const BLOSSOMS = [[-480, -130], [-230, -330], [360, -330], [-470, 220], [470, 340], [120, -320], [-120, 350], [80, 360], [520, -200]];
const UPSIDE_DOWN = [[-510, -320], [500, -330], [-500, 340], [520, 140]];
const CAT_LINES = ["We're all mad here.", "I'm not crazy. My reality is just different.", 'Most everyone is mad here.', 'Which way? Depends where you want to get to.'];
const SHRINK_LINES = ['Curiouser and curiouser!', "I'm shutting up like a telescope!"];
const GROW_LINES = ['Goodbye, feet!', 'Opening out like the largest telescope!'];

/**
 * Wonderland. You fall down the rabbit hole by the little hedge door, and there's all this to find:
 * - the Mad Tea Party (TeaParty), the Queen's croquet (Croquet), the Looking-Glass chessboard (Chess), and the garden of
 *   live flowers with its bread-and-butterflies (Garden);
 * - a "drink me" bottle that shrinks you and an "eat me" cake that makes you huge, a fairy ring that turns the whole
 *   world upside down, a looking-glass with a contrary reflection, clocks running backwards, a signpost that can't
 *   decide, and Tweedledum and Tweedledee (all in Curiosities);
 * - the Caterpillar's smoke rings, card soldiers painting the roses red, the Cheshire Cat's fading grin, upside-down
 *   trees, odds and ends falling up into the sky, and the White Rabbit forever running late.
 * Walk back into the little door to go home.
 */
export class Wonderland extends Phaser.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private shadow!: Phaser.GameObjects.Image;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private facing: Facing = 'down';
    private hint!: Phaser.GameObjects.Image;
    private rabbit!: WhiteRabbit;
    private thoughts!: Speaker;
    private catVoice!: Speaker;
    private catSpot = { x: 0, y: 0 };
    private features: Feature[] = [];
    private cards: { sprite: Phaser.GameObjects.Sprite; from: number; to: number; dir: number; paint: number }[] = [];
    /** Falling in, or going home: the player can't walk. */
    private busy = true;
    /** The player's size (1, small, or huge) and the camera zoom that goes with it. */
    private size = 1;
    private sizeTimer?: Phaser.Time.TimerEvent;
    private zoomFor = 1;
    private topsy = false;

    constructor() {
        super('Wonderland');
    }

    create() {
        this.busy = true;
        this.facing = 'down';
        this.features = [];
        this.cards = [];
        this.size = 1;
        this.zoomFor = 1;
        this.topsy = false;
        this.sizeTimer = undefined;
        wonderlandTextures(this);
        folkTextures(this);
        curioTextures(this);
        this.cameras.main.setBackgroundColor('#2c6a4a').setRotation(0);
        this.add.tileSprite(0, 0, 2400, 2400, 'wl-ground').setDepth(-1e9);

        const at = (key: string, x: number, y: number, flip = false) =>
            this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y).setFlipX(flip);
        const shade = (x: number, y: number, w: number) => this.add.image(x, y, shadowTexture(this, w)).setAlpha(0.25).setDepth(-1e8 + 2);

        BLOSSOMS.forEach(([x, y], i) => {
            shade(x, y, 30);
            at('wl-blossom', x, y, i % 2 === 1);
        });
        // Trees standing on their heads, roots in the air.
        UPSIDE_DOWN.forEach(([x, y], i) => {
            shade(x, y, 40);
            at('wl-blossom', x, y, i % 2 === 0).setFlipY(true);
        });
        [[-440, 120], [420, 110], [-180, -340], [220, 350], [-260, 340], [40, -300]].forEach(([x, y], i) => {
            shade(x, y, 28);
            at('wl-mushroom-red', x, y, i % 2 === 0).setScale(i % 2 ? 0.7 : 1);
        });
        shade(300, -120, 34);
        at('wl-mushroom-blue', 300, -120);
        at('wl-caterpillar', 298, -168).setDepth(-119);
        if (!still()) this.time.addEvent({ delay: 1400, loop: true, callback: () => this.smokeRing(310, -180) });
        at('wl-welcome', 70, -100);

        [220, 270, 320, 370].forEach((x) => at('wl-roses', x, 40));
        [[210, 330], [250, 380]].forEach(([from, to], i) => {
            const sprite = this.add.sprite(from + i * 40, 60 + i * 6, 'wl-card', 0).setOrigin(0.5, 1).play('wl-card');
            this.cards.push({ sprite, from, to, dir: i ? -1 : 1, paint: 0 });
        });

        this.add.image(DOOR.x, DOOR.y, 'wl-door').setOrigin(0.5, 1).setDepth(DOOR.y);
        const portal = this.add.sprite(DOOR.x, DOOR.y, 'wl-portal', 0).setOrigin(0.5, 1).setDepth(DOOR.y + 0.1);
        if (!still()) portal.play('wl-portal');

        this.features.push(
            new TeaParty(this, -300, 150),
            new Chess(this, 0, 130),
            new Croquet(this, 330, 215, () => this.cardsFlinch()),
            new Garden(this, -330, -225, new Phaser.Geom.Rectangle(AREA.x + 40, AREA.y + 40, AREA.width - 80, AREA.height - 80)),
            new Potions(this, { x: -110, y: -30 }, { x: 110, y: -30 }, { shrink: () => this.resize(0.5), grow: () => this.resize(2) }),
            new FairyRing(this, -350, -40, () => this.turnTopsy()),
            new LookingGlass(this, 160, -230),
            new Clocks(this, -110, -240, [{ x: -60, y: -222 }, { x: -150, y: -205 }, { x: -40, y: -270 }]),
            new Signpost(this, -170, 50),
            new Tweedles(this, 440, -60),
            new FallingUp(this, AREA),
        );

        this.rabbit = new WhiteRabbit(this, -60, 60, 80);
        this.runRabbit(0);
        this.catVoice = new Speaker(this, () => ({ x: this.catSpot.x, y: this.catSpot.y - 12 }));
        this.time.delayedCall(2500, () => this.cheshire());

        this.shadow = this.add.image(LANDING.x, LANDING.y, shadowTexture(this, 12)).setAlpha(0.3);
        this.player = this.add.sprite(LANDING.x, LANDING.y, 'preview-player', 'down-0').setOrigin(0.5, 1);
        addCreatorNametag(this.player, PLAYER_LOOK);
        this.thoughts = new Speaker(this, () => ({ x: this.player.x, y: this.player.y - this.player.displayHeight - 14 }));
        this.hint = this.add.image(DOOR.x, DOOR.y - PORTAL.h - 16, addPixels(this, 'wl-hint', speechArt('Walk into the little door to go home', 22)))
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);
        this.place();
        this.cursors = this.input.keyboard!.createCursorKeys();

        const cam = this.cameras.main;
        cam.setBounds(AREA.x, AREA.y, AREA.width, AREA.height).setRoundPixels(true).startFollow(this.player, true);
        const fit = () => cam.setZoom(this.baseZoom() * this.zoomFor);
        fit();
        this.scale.on('resize', fit);
        this.events.once('shutdown', () => this.scale.off('resize', fit));
        cam.fadeIn(500, 125, 75, 181);
        this.fallIn();
    }

    private baseZoom() {
        const s = Math.min(this.scale.width / 360, this.scale.height / 260);
        return s >= 1 ? Math.floor(s) : Math.max(0.5, Math.floor(s * 4) / 4);
    }

    update(_time: number, dt: number) {
        const s = Math.min(dt, 50) / 1000;
        this.rabbit.update(s);
        this.marchCards(s);
        for (const f of this.features) f.update(s, this.player);
        if (this.busy) return;

        const { dx, dy } = walkInput(this.cursors);
        if (dx || dy) {
            const speed = SPEED * (this.size < 1 ? 0.75 : this.size > 1 ? 1.3 : 1);
            const step = (s * speed) / Math.hypot(dx, dy);
            this.player.x = Phaser.Math.Clamp(this.player.x + dx * step, AREA.left + 12, AREA.right - 12);
            this.player.y = Phaser.Math.Clamp(this.player.y + dy * step, AREA.top + 24, AREA.bottom - 4);
            if (Math.abs(dx) > Math.abs(dy)) {
                this.facing = 'side';
                this.player.setFlipX(dx < 0);
            } else {
                this.facing = dy < 0 ? 'up' : 'down';
                this.player.setFlipX(false);
            }
            const anim = `preview-player-${this.facing}-walk`;
            if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying) this.player.play(anim);
        } else {
            this.player.stop();
            this.player.setFrame(`${this.facing}-0`);
        }
        this.place();
        const { x, y } = this.player;
        this.hint.setVisible(Phaser.Math.Distance.Between(x, y, DOOR.x, DOOR.y) < 60);
        if (Math.abs(x - DOOR.x) < PORTAL.w / 2 - 2 && y < DOOR.y + 2 && y > DOOR.y - 12) this.goHome();
    }

    private place() {
        const { x, y } = this.player;
        this.player.setDepth(y);
        this.shadow.setPosition(x, y).setDepth(y - 0.5);
    }

    /** "Drink me" (0.5) or "eat me" (2): the player shrinks or grows for a while, and the camera follows suit. */
    private resize(to: number) {
        this.sizeTimer?.remove();
        this.size = to;
        this.thoughts.say(pick(to < 1 ? SHRINK_LINES : GROW_LINES), 2.4);
        this.scaleTo(to);
        this.sizeTimer = this.time.delayedCall(SPELL_SECONDS * 1000, () => {
            this.size = 1;
            this.scaleTo(1);
            this.thoughts.say("That's better. I think.", 2);
        });
    }

    private scaleTo(size: number) {
        const zoom = size < 1 ? 1.6 : size > 1 ? 0.75 : 1;
        this.zoomFor = zoom;
        const ms = still() ? 1 : 700;
        this.tweens.add({ targets: [this.player, this.shadow], scale: size, duration: ms, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.cameras.main, zoom: this.baseZoom() * zoom, duration: ms, ease: 'Sine.easeInOut' });
    }

    /** The fairy ring: the whole world turns upside down for a while. */
    private turnTopsy() {
        if (this.topsy) return;
        this.topsy = true;
        this.thoughts.say('Everything is topsy-turvy!', 2.4);
        const cam = this.cameras.main;
        const ms = still() ? 1 : 900;
        this.tweens.add({ targets: cam, rotation: Math.PI, duration: ms, ease: 'Sine.easeInOut' });
        this.time.delayedCall(TOPSY_SECONDS * 1000, () => {
            this.tweens.add({
                targets: cam,
                rotation: 0,
                duration: ms,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    cam.setRotation(0);
                    this.topsy = false;
                },
            });
        });
    }

    /** Down the rabbit hole: the player tumbles in from above and lands on the lawn. */
    private fallIn() {
        const drop = still() ? 0 : 240;
        this.player.setPosition(LANDING.x, LANDING.y - drop).setDepth(1e4);
        this.shadow.setScale(0.3);
        this.tweens.add({ targets: this.shadow, scale: 1, duration: 1200, ease: 'Quad.easeIn' });
        this.tweens.add({
            targets: this.player,
            y: LANDING.y,
            angle: { from: drop ? 540 : 0, to: 0 },
            duration: drop ? 1200 : 1,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.player.setAngle(0);
                this.cameras.main.shake(120, 0.004);
                this.place();
                this.busy = false;
            },
        });
    }

    /** Into the little door, and back out of the big tree at home. */
    private goHome() {
        this.busy = true;
        this.hint.setVisible(false);
        this.player.stop().setDepth(DOOR.y + 0.2);
        this.shadow.setVisible(false);
        this.tweens.add({
            targets: this.player,
            scale: 0.1,
            alpha: 0,
            y: this.player.y - 14,
            angle: still() ? 0 : 360,
            duration: 500,
            ease: 'Quad.easeIn',
            onComplete: () => {
                const cam = this.cameras.main;
                cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                    this.scene.wake('Preview', { from: 'wonderland' });
                    this.scene.stop();
                });
                cam.fadeOut(300, 125, 75, 181);
            },
        });
    }

    /** The White Rabbit runs his loop, stopping now and then to stare at his watch. */
    private runRabbit(i: number) {
        const stop = RABBIT_ROUTE[i % RABBIT_ROUTE.length];
        this.rabbit.runTo(stop.x, stop.y, () => {
            if (!stop.watch) {
                this.runRabbit(i + 1);
                return;
            }
            this.rabbit.checkWatch(1.4);
            this.time.delayedCall(1400, () => this.runRabbit(i + 1));
        });
    }

    /** The card soldiers march along the rose bushes, stopping to paint the white roses red. */
    private marchCards(s: number) {
        for (const c of this.cards) {
            if (c.paint > 0) {
                c.paint -= s;
                if (c.paint <= 0) c.sprite.play('wl-card');
                continue;
            }
            c.sprite.x += c.dir * 18 * s;
            if (c.sprite.x > c.to || c.sprite.x < c.from) {
                c.sprite.x = Phaser.Math.Clamp(c.sprite.x, c.from, c.to);
                c.dir *= -1;
                c.paint = 1.6;
                c.sprite.stop().setFrame(1);
            }
            c.sprite.setFlipX(c.dir < 0).setDepth(c.sprite.y);
        }
    }

    /** The Queen is shouting: the rose painters jump out of their skins. */
    private cardsFlinch() {
        if (still()) return;
        for (const c of this.cards) this.tweens.add({ targets: c.sprite, y: c.sprite.y - 10, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    }

    /** The Caterpillar puffs a smoke ring that drifts up and away. */
    private smokeRing(x: number, y: number) {
        const ring = this.add.image(x, y, 'wl-ring').setDepth(1e4).setAlpha(0.9);
        this.tweens.add({ targets: ring, x: x + 14, y: y - 40, scale: 2.2, alpha: 0, duration: 2400, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
    }

    /** The Cheshire Cat appears in a tree, says something unsettling, and fades away until only the grin is left. */
    private cheshire() {
        const [tx, ty] = pick(BLOSSOMS);
        const spot = (this.catSpot = { x: tx, y: ty - 46 });
        const cat = this.add.image(spot.x, spot.y, 'wl-cat').setDepth(1e4).setAlpha(0);
        const grin = this.add.image(spot.x, spot.y, 'wl-grin').setDepth(1e4).setAlpha(0);
        const next = () => {
            cat.destroy();
            grin.destroy();
            this.time.delayedCall(Phaser.Math.Between(3000, 6000), () => this.cheshire());
        };
        this.tweens.chain({
            tweens: [
                { targets: cat, alpha: 1, duration: 900, onComplete: () => this.catVoice.say(pick(CAT_LINES), 2.6) },
                { targets: cat, alpha: 1, duration: 1800 },
                { targets: grin, alpha: 1, duration: 1 },
                { targets: cat, alpha: 0, duration: 1200 },
                { targets: grin, alpha: 1, duration: 1200 },
                { targets: grin, alpha: 0, duration: 900, onComplete: next },
            ],
        });
    }
}
