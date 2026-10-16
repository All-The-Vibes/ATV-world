import Phaser from 'phaser';
import { walkInput } from '../commands';
import { PLAYER_LOOK, addCreatorNametag, addPixels, shadowTexture, speechArt, type Facing } from '../kit';
import { marsTextures } from '../mars/art';
import { cabinetTexture } from '../mars/blasterArt';
import { Martians } from '../mars/Martians';
import { Rocket } from '../mars/Rocket';

/** The walkable part of Mars. */
const AREA = new Phaser.Geom.Rectangle(-360, -240, 720, 480);
/** Where the rocket lands, and where the player steps out of it. */
const PAD = { x: 0, y: 20 };
const EXIT = { x: PAD.x + 26, y: PAD.y + 18 };
/** The MARS BLASTER arcade cabinet; walk up to it to play. */
const ARCADE = { x: 130, y: -24 };

/** Mars: the rocket lands, you walk around the red dirt, and walking back into the rocket flies you home. */
export class Mars extends Phaser.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private shadow!: Phaser.GameObjects.Image;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private facing: Facing = 'down';
    private rocket!: Rocket;
    private hint!: Phaser.GameObjects.Image;
    private rover!: Phaser.GameObjects.Sprite;
    private roverDir = 1;
    martians!: Martians;
    private dust: { image: Phaser.GameObjects.Image; speed: number }[] = [];
    private arcadeHint!: Phaser.GameObjects.Image;
    /** At the cabinet's controls; step away and back to play again. */
    private atArcade = false;
    /** Aboard the rocket (landing or taking off), so the player can't walk. */
    private flying = true;

    constructor() {
        super('Mars');
    }

    create() {
        this.flying = true;
        this.atArcade = false;
        this.facing = 'down';
        this.roverDir = 1;
        this.dust = [];
        marsTextures(this);
        this.cameras.main.setBackgroundColor('#3b2427');
        this.add.tileSprite(0, 0, 2048, 2048, 'mars-ground').setDepth(-1e9);

        [[-250, -170, 1], [150, -150, 1.4], [260, 60, 0.8], [-120, 170, 1.2], [90, 190, 0.7], [-300, 80, 0.9], [-60, -60, 0.6]]
            .forEach(([x, y, s]) => this.add.image(x, y, 'mars-crater').setScale(s).setDepth(-1e8 - 1));
        [[-170, 20], [70, -90], [210, -40], [-40, 120], [300, 180], [-320, -60], [160, 120], [-210, 200], [330, -190]]
            .forEach(([x, y], i) => {
                this.add.image(x, y, shadowTexture(this, 14)).setAlpha(0.25).setDepth(-1e8);
                this.add.image(x, y + 1, 'mars-rock').setOrigin(0.5, 1).setDepth(y).setScale(1 + (i % 3) * 0.25).setFlipX(i % 2 === 0);
            });
        this.add.image(-200, -70, 'mars-dome').setOrigin(0.5, 1).setDepth(-70);
        this.add.image(42, 22, 'mars-flag').setOrigin(0.5, 1).setDepth(22);
        this.add.image(PAD.x, PAD.y + 40, 'mars-sign').setDepth(PAD.y + 40);
        cabinetTexture(this);
        this.add.image(ARCADE.x, ARCADE.y, shadowTexture(this, 26)).setAlpha(0.3).setDepth(-1e8);
        this.add.sprite(ARCADE.x, ARCADE.y, 'mars-arcade', 0).setOrigin(0.5, 1).setDepth(ARCADE.y).play('mars-arcade')
            .setInteractive({ useHandCursor: true })
            .on('pointerup', (p: Phaser.Input.Pointer) => p.getDistance() < 6 && !this.flying && this.playBlaster());
        this.arcadeHint = this.add.image(ARCADE.x, ARCADE.y - 48, addPixels(this, 'mars-arcade-hint', speechArt('Step up to play MARS BLASTER!')))
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);
        this.rover = this.add.sprite(-80, 150, 'mars-rover', 0).setOrigin(0.5, 1).setDepth(150).play('mars-rover');

        this.martians = new Martians(this, AREA, [
            new Phaser.Geom.Rectangle(PAD.x - 50, PAD.y - 40, 110, 100),
            new Phaser.Geom.Rectangle(-245, -80, 90, 30),
            new Phaser.Geom.Rectangle(ARCADE.x - 24, ARCADE.y - 20, 48, 40),
        ]);

        this.rocket = new Rocket(this, PAD.x, PAD.y);
        this.shadow = this.add.image(EXIT.x, EXIT.y, shadowTexture(this, 12)).setAlpha(0.3).setVisible(false);
        this.player = this.add.sprite(EXIT.x, EXIT.y, 'preview-player', 'down-0').setOrigin(0.5, 1).setVisible(false);
        addCreatorNametag(this.player, PLAYER_LOOK);
        this.hint = this.add.image(PAD.x, PAD.y - 60, addPixels(this, 'mars-hint', speechArt('Walk into the rocket to fly home')))
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);
        this.place();
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.windblown();

        const cam = this.cameras.main;
        cam.setBounds(AREA.x, AREA.y, AREA.width, AREA.height).setRoundPixels(true).startFollow(this.player, true);
        const fit = () => {
            const s = Math.min(this.scale.width / 360, this.scale.height / 260);
            cam.setZoom(s >= 1 ? Math.floor(s) : Math.max(0.5, Math.floor(s * 4) / 4));
        };
        fit();
        this.scale.on('resize', fit);
        this.events.once('shutdown', () => this.scale.off('resize', fit));
        cam.fadeIn(400, 20, 16, 30);

        this.rocket.land(() => {
            this.flying = false;
            this.player.setVisible(true);
            this.shadow.setVisible(true);
            if (new URLSearchParams(location.search).has('blaster')) this.playBlaster();
        });
    }

    update(_time: number, dt: number) {
        const s = Math.min(dt, 50) / 1000;
        this.driveRover(s);
        this.blowDust(s);
        this.martians.update(s, this.player);
        if (this.flying) return;

        const { dx, dy } = walkInput(this.cursors);
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
        this.hint.setVisible(Phaser.Math.Distance.Between(x, y, PAD.x, PAD.y) < 64);
        if (this.rocket.foot().contains(x, y)) this.flyHome();

        const arcade = Phaser.Math.Distance.Between(x, y, ARCADE.x, ARCADE.y);
        this.arcadeHint.setVisible(arcade < 60 && arcade >= 14);
        const atArcade = Math.abs(x - ARCADE.x) < 14 && y > ARCADE.y && y < ARCADE.y + 12;
        if (atArcade && !this.atArcade) this.playBlaster();
        this.atArcade = atArcade;
    }

    /** Step up to the cabinet: Mars waits while MARS BLASTER runs on top. */
    playBlaster() {
        if (this.scene.isActive('Blaster')) return;
        this.atArcade = true;
        this.player.stop().setFrame('up-0');
        this.facing = 'up';
        this.arcadeHint.setVisible(false);
        this.scene.launch('Blaster');
        this.scene.sleep();
    }

    private place() {
        const { x, y } = this.player;
        this.player.setDepth(y);
        this.shadow.setPosition(x, y).setDepth(y - 0.5);
    }

    /** Climb aboard, blast off, and wake the town back up (where the rocket lands on its pad). */
    private flyHome() {
        this.flying = true;
        this.player.stop().setVisible(false);
        this.shadow.setVisible(false);
        this.hint.setVisible(false);
        this.rocket.launch(() => {
            const cam = this.cameras.main;
            cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                this.scene.wake('Preview', { from: 'mars' });
                this.scene.stop();
            });
            cam.fadeOut(300, 20, 16, 30);
        });
    }

    /** The rover trundles back and forth across the plain. */
    private driveRover(s: number) {
        this.rover.x += this.roverDir * 14 * s;
        if (this.rover.x > 240 || this.rover.x < -280) {
            this.rover.x = Phaser.Math.Clamp(this.rover.x, -280, 240);
            this.roverDir *= -1;
        }
        this.rover.setFlipX(this.roverDir < 0);
    }

    /** Specks of dust blowing across the plain. */
    private windblown() {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        for (let i = 0; i < 60; i++) {
            const image = this.add.image(
                Phaser.Math.Between(AREA.left, AREA.right),
                Phaser.Math.Between(AREA.top, AREA.bottom),
                'mars-dust',
            ).setDepth(1e6).setAlpha(Phaser.Math.FloatBetween(0.3, 0.8));
            this.dust.push({ image, speed: Phaser.Math.Between(24, 60) });
        }
    }

    private blowDust(s: number) {
        for (const d of this.dust) {
            d.image.x += d.speed * s;
            d.image.y += d.speed * s * 0.15;
            if (d.image.x > AREA.right) d.image.x = AREA.left;
            if (d.image.y > AREA.bottom) d.image.y = AREA.top;
        }
    }
}
