import Phaser from 'phaser';
import { PLAYER_LOOK, addCreatorNametag, addPixels, shadowTexture, speechArt, type Facing } from '../kit';
import { PORTAL, wonderlandTextures } from '../wonderland/art';
import { WhiteRabbit } from '../wonderland/RabbitTree';

/** The walkable part of Wonderland. */
const AREA = new Phaser.Geom.Rectangle(-400, -260, 800, 520);
/** The little door home, in its hedge arch, and where the player lands after falling down the rabbit hole. */
const DOOR = { x: 0, y: -120 };
const LANDING = { x: 0, y: -40 };
const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Where the White Rabbit runs, round and round (and where he stops to check the time). */
const RABBIT_ROUTE: { x: number; y: number; watch?: boolean }[] = [
    { x: -120, y: 10 }, { x: -230, y: 60, watch: true }, { x: -300, y: -60 }, { x: -140, y: -170 },
    { x: 60, y: -180, watch: true }, { x: 200, y: -60 }, { x: 330, y: 0 }, { x: 260, y: 150, watch: true },
    { x: 80, y: 200 }, { x: -60, y: 130 },
];

const CAT_SPOTS = [{ x: -340, y: -80 }, { x: -200, y: -250 }, { x: 360, y: -250 }, { x: 100, y: -260 }, { x: 340, y: 190 }, { x: -360, y: 160 }];

/**
 * Wonderland: you fall down the rabbit hole onto a checkerboard lawn, with the Mad Hatter's tea party, the Caterpillar
 * puffing smoke rings on his mushroom, card soldiers painting the roses red, the Cheshire Cat fading in and out, and
 * the White Rabbit forever running late. Walk back into the little hedge door to go home.
 */
export class Wonderland extends Phaser.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private shadow!: Phaser.GameObjects.Image;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private facing: Facing = 'down';
    private hint!: Phaser.GameObjects.Image;
    private rabbit!: WhiteRabbit;
    private leg = 0;
    private cards: { sprite: Phaser.GameObjects.Sprite; from: number; to: number; dir: number; paint: number }[] = [];
    private petals: { image: Phaser.GameObjects.Image; speed: number; sway: number }[] = [];
    /** Falling in, or going home: the player can't walk. */
    private busy = true;

    constructor() {
        super('Wonderland');
    }

    create() {
        this.busy = true;
        this.facing = 'down';
        this.leg = 0;
        this.cards = [];
        this.petals = [];
        wonderlandTextures(this);
        this.cameras.main.setBackgroundColor('#2c6a4a');
        this.add.tileSprite(0, 0, 2048, 2048, 'wl-ground').setDepth(-1e9);
        this.add.image(0, 40, 'wl-checker').setDepth(-1e8 + 1);

        const at = (key: string, x: number, y: number, flip = false) =>
            this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y).setFlipX(flip);
        const shade = (x: number, y: number, w: number) => this.add.image(x, y, shadowTexture(this, w)).setAlpha(0.25).setDepth(-1e8 + 2);

        [[-340, -40], [-200, -210], [360, -210], [-360, 200], [340, 230], [100, -220]].forEach(([x, y], i) => {
            shade(x, y, 30);
            at('wl-blossom', x, y, i % 2 === 1);
        });
        [[-300, -150], [320, 110], [-120, -200], [150, 230]].forEach(([x, y], i) => {
            shade(x, y, 28);
            at('wl-mushroom-red', x, y, i % 2 === 0).setScale(i % 2 ? 0.7 : 1);
        });
        shade(240, -110, 34);
        at('wl-mushroom-blue', 240, -110);
        at('wl-caterpillar', 238, -158).setDepth(-109);
        if (!still()) this.time.addEvent({ delay: 1400, loop: true, callback: () => this.smokeRing(250, -170) });

        shade(-220, 140, 90);
        at('wl-tea', -220, 140);
        at('wl-hat', -234, 96).setDepth(141);
        at('wl-drink', -100, -30);
        at('wl-welcome', 70, -100);

        [180, 230, 280, 330].forEach((x) => at('wl-roses', x, 40));
        [[170, 300], [210, 340]].forEach(([from, to], i) => {
            const sprite = this.add.sprite(from + i * 40, 60 + i * 6, 'wl-card', 0).setOrigin(0.5, 1).play('wl-card');
            this.cards.push({ sprite, from, to, dir: i ? -1 : 1, paint: 0 });
        });

        this.add.image(DOOR.x, DOOR.y, 'wl-door').setOrigin(0.5, 1).setDepth(DOOR.y);
        const portal = this.add.sprite(DOOR.x, DOOR.y, 'wl-portal', 0).setOrigin(0.5, 1).setDepth(DOOR.y + 0.1);
        if (!still()) portal.play('wl-portal');

        this.rabbit = new WhiteRabbit(this, -60, 60, 80);
        this.runRabbit(0);
        this.cheshire();

        this.shadow = this.add.image(LANDING.x, LANDING.y, shadowTexture(this, 12)).setAlpha(0.3);
        this.player = this.add.sprite(LANDING.x, LANDING.y, 'preview-player', 'down-0').setOrigin(0.5, 1);
        addCreatorNametag(this.player, PLAYER_LOOK);
        this.hint = this.add.image(DOOR.x, DOOR.y - PORTAL.h - 16, addPixels(this, 'wl-hint', speechArt('Walk into the little door to go home', 22)))
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);
        this.place();
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.drift();

        const cam = this.cameras.main;
        cam.setBounds(AREA.x, AREA.y, AREA.width, AREA.height).setRoundPixels(true).startFollow(this.player, true);
        const fit = () => {
            const s = Math.min(this.scale.width / 360, this.scale.height / 260);
            cam.setZoom(s >= 1 ? Math.floor(s) : Math.max(0.5, Math.floor(s * 4) / 4));
        };
        fit();
        this.scale.on('resize', fit);
        this.events.once('shutdown', () => this.scale.off('resize', fit));
        cam.fadeIn(500, 125, 75, 181);
        this.fallIn();
    }

    update(_time: number, dt: number) {
        const s = Math.min(dt, 50) / 1000;
        this.rabbit.update(s);
        this.marchCards(s);
        this.blowPetals(s);
        if (this.busy) return;

        const dx = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const dy = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
        if (dx || dy) {
            const step = (s * 92) / Math.hypot(dx, dy);
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

    /** The Caterpillar puffs a smoke ring that drifts up and away. */
    private smokeRing(x: number, y: number) {
        const ring = this.add.image(x, y, 'wl-ring').setDepth(1e4).setAlpha(0.9);
        this.tweens.add({ targets: ring, x: x + 14, y: y - 40, scale: 2.2, alpha: 0, duration: 2400, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
    }

    /** The Cheshire Cat appears in a tree, grins, and fades away until only the grin is left. */
    private cheshire() {
        const spot = Phaser.Utils.Array.GetRandom(CAT_SPOTS);
        const cat = this.add.image(spot.x, spot.y, 'wl-cat').setDepth(1e4).setAlpha(0);
        const grin = this.add.image(spot.x, spot.y, 'wl-grin').setDepth(1e4).setAlpha(0);
        const next = () => {
            cat.destroy();
            grin.destroy();
            this.time.delayedCall(Phaser.Math.Between(3000, 6000), () => this.cheshire());
        };
        this.tweens.chain({
            tweens: [
                { targets: cat, alpha: 1, duration: 900 },
                { targets: cat, alpha: 1, duration: 1800 },
                { targets: grin, alpha: 1, duration: 1 },
                { targets: cat, alpha: 0, duration: 1200 },
                { targets: grin, alpha: 1, duration: 1200 },
                { targets: grin, alpha: 0, duration: 900, onComplete: next },
            ],
        });
    }

    /** Pink petals drifting across the lawn. */
    private drift() {
        if (still()) return;
        for (let i = 0; i < 50; i++) {
            const image = this.add.image(
                Phaser.Math.Between(AREA.left, AREA.right),
                Phaser.Math.Between(AREA.top, AREA.bottom),
                'wl-petal',
            ).setDepth(1e6).setAlpha(Phaser.Math.FloatBetween(0.5, 0.95));
            this.petals.push({ image, speed: Phaser.Math.Between(10, 26), sway: Math.random() * Math.PI * 2 });
        }
    }

    private blowPetals(s: number) {
        this.leg += s;
        for (const p of this.petals) {
            p.image.x += (p.speed * 0.6 + Math.sin(this.leg * 2 + p.sway) * 8) * s;
            p.image.y += p.speed * s;
            if (p.image.x > AREA.right) p.image.x = AREA.left;
            if (p.image.y > AREA.bottom) p.image.y = AREA.top;
        }
    }
}
