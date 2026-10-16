import Phaser from 'phaser';
import { PixelCanvas, ensurePixels } from '../kit';
import { Speaker, pick, still, type Feature } from './talk';

const LAWN = { w: 250, h: 100 };
const CHEERS = ['Splendid! I taught it that.', 'A royal shot!', 'Applaud, everyone! APPLAUD!'];
const RANTS = ['OFF WITH THEIR HEADS!', 'Off with the hedgehog\'s head!', 'Who moved that hoop?! OFF WITH IT!'];
const CHAT = ['Can you play croquet?', "Curtsey while you're thinking!", "All the ways about here belong to ME."];

function lawn() {
    const pc = new PixelCanvas(LAWN.w, LAWN.h);
    for (let y = 0; y < LAWN.h; y++) for (let x = 0; x < LAWN.w; x++) pc.set(x, y, Math.floor(x / 25) % 2 ? 'grass' : 'lime');
    return pc.outline('forest').outline('pine');
}

/**
 * The Queen of Hearts' croquet ground: a flamingo for a mallet, a hedgehog for a ball, and card soldiers bent over for
 * hoops. The ball rolls off wherever it likes, and when it misses the Queen orders off with everyone's heads.
 */
export class Croquet implements Feature {
    private readonly queen: Phaser.GameObjects.Sprite;
    private readonly queenSays: Speaker;
    private readonly flamingo: Phaser.GameObjects.Sprite;
    private readonly hedgehog: Phaser.GameObjects.Sprite;
    private readonly hoops: Phaser.GameObjects.Image[];
    private readonly tee: { x: number; y: number };
    private state: 'ready' | 'rolling' | 'home' = 'ready';
    private wait = 2.5;
    private chatted = 0;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly onRage: () => void) {
        ensurePixels(scene, 'wl-lawn', lawn);
        scene.add.image(x, y, 'wl-lawn').setDepth(-1e8 + 3);
        scene.add.image(x - 70, y - LAWN.h / 2 - 2, 'wl-tag-croquet').setOrigin(0.5, 1).setDepth(y - LAWN.h / 2 - 2);
        this.tee = { x: x - 95, y: y + 12 };
        this.hoops = [-35, 20, 75].map((dx, i) => scene.add.image(x + dx, this.tee.y + (i % 2 ? -4 : 3), 'wl-hoop').setOrigin(0.5, 1).setDepth(this.tee.y + 1));
        this.flamingo = scene.add.sprite(this.tee.x - 14, this.tee.y, 'wl-flamingo', 0).setOrigin(0.5, 1).setDepth(this.tee.y);
        this.hedgehog = scene.add.sprite(this.tee.x, this.tee.y, 'wl-hedgehog', 0).setDepth(this.tee.y + 0.5);
        this.queen = scene.add.sprite(x - 100, y - 20, 'wl-queen', 0).setOrigin(0.5, 1).setDepth(y - 20);
        this.queenSays = new Speaker(scene, () => ({ x: this.queen.x, y: this.queen.y - this.queen.height }));
    }

    update(dt: number, player: Phaser.GameObjects.Sprite) {
        if (this.state === 'ready' && (this.wait -= dt) <= 0) this.swing();
        else if (this.state === 'home') {
            const h = this.hedgehog, dx = this.tee.x - h.x, dy = this.tee.y - h.y, d = Math.hypot(dx, dy), step = 22 * dt;
            if (d <= step) {
                h.setPosition(this.tee.x, this.tee.y).setFrame(0).setFlipX(false);
                this.state = 'ready';
                this.wait = Phaser.Math.FloatBetween(2.5, 4.5);
            } else {
                h.setPosition(h.x + (dx / d) * step, h.y + (dy / d) * step).setFlipX(dx < 0).setDepth(h.y + 0.5);
            }
        }
        if (Phaser.Math.Distance.Between(player.x, player.y, this.queen.x, this.queen.y) < 60 && this.scene.time.now > this.chatted) {
            this.chatted = this.scene.time.now + 10000;
            if (!this.queenSays.talking) this.queenSays.say(pick(CHAT), 2.6);
        }
    }

    /** The flamingo swings, and the hedgehog goes rolling (somewhere). */
    private swing() {
        this.state = 'rolling';
        this.flamingo.setFrame(1);
        this.scene.time.delayedCall(300, () => this.flamingo.setFrame(0));
        const good = Math.random() < 0.45;
        const to = good
            ? { x: this.x + 112, y: this.tee.y }
            : { x: this.x + Phaser.Math.Between(-30, 90), y: this.tee.y + Phaser.Math.Between(18, 40) * (Math.random() < 0.5 ? -1 : 1) };
        const h = this.hedgehog.setFrame(0);
        this.scene.time.delayedCall(180, () => {
            this.scene.tweens.add({
                targets: h,
                x: to.x,
                y: to.y,
                angle: still() ? 0 : 900,
                duration: (Math.hypot(to.x - h.x, to.y - h.y) / 150) * 1000,
                ease: 'Quad.easeOut',
                onUpdate: () => h.setDepth(h.y + 0.5),
                onComplete: () => {
                    h.setAngle(0).setFrame(1);
                    if (good) this.queenSays.say(pick(CHEERS), 2.2);
                    else this.rage();
                    this.scene.time.delayedCall(900, () => (this.state = 'home'));
                },
            });
        });
    }

    /** The Queen goes purple with fury, and the card hoops quake. */
    private rage() {
        this.queen.setFrame(1);
        this.queenSays.say(pick(RANTS), 2.4);
        this.scene.time.delayedCall(1600, () => this.queen.setFrame(0));
        if (!still()) {
            this.scene.cameras.main.shake(200, 0.003);
            this.hoops.forEach((hoop) => this.scene.tweens.add({ targets: hoop, x: hoop.x + 1, duration: 40, yoyo: true, repeat: 8 }));
        }
        this.onRage();
    }
}
