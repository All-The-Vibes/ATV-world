import Phaser from 'phaser';
import {
    PixelCanvas, addPixels, miniText, miniTextWidth, shadowTexture, speechArt, stripFrames, type Color,
} from '../kit';

const W = 20;
const H = 22;
const FRAMES = 2;

const SPIDEY_QUIPS = [
    'Thwip! Friendly neighborhood Spider Man!',
    'With great vibes comes great responsibility!',
    'My Spidey-Sense is tingling... someone pushed to main!',
    'Swinging through The Town!',
];

function drawSpiderManSheet(): PixelCanvas {
    const pc = new PixelCanvas(W * FRAMES, H);
    for (let f = 0; f < FRAMES; f++) {
        const ox = f * W;
        const p = (x: number, y: number, c: Color) => pc.set(ox + x, y, c);
        const row = (y: number, x0: number, x1: number, c: Color) => {
            for (let x = x0; x <= x1; x++) p(x, y, c);
        };

        // Frame 0: dynamic web-swinging pose (arm extended forward shooting web, legs tucked in air)
        // Frame 1: perched/acrobatic mid-air pose
        const kick = f === 0 ? 0 : 1;

        // Red masked head
        row(2, 8, 12, 'red');
        for (let y = 3; y <= 7; y++) row(y, 7, 13, 'red');
        row(8, 8, 12, 'red');
        // Iconic white lens eyes with black rims
        p(9, 4, 'ink'); p(10, 4, 'white'); p(11, 4, 'white');
        p(10, 5, 'white'); p(11, 5, 'ink');
        p(12, 4, 'ink'); p(13, 4, 'white');
        p(13, 5, 'ink');

        // Red & blue Spider-Man suit torso with black chest spider emblem
        for (let y = 9; y <= 13; y++) row(y, 7, 12, 'blue');
        row(9, 7, 12, 'red');
        row(10, 8, 11, 'red');
        p(10, 10, 'ink'); p(9, 11, 'ink'); p(11, 11, 'ink'); // spider symbol

        // Extended front arm shooting a web ("thwip!")
        pc.line(ox + 12, 10, ox + 17, 7 - kick, 'red');
        p(17, 7 - kick, 'red');
        p(18, 6 - kick, 'white'); // web nozzle flash

        // Back arm for balance
        pc.line(ox + 7, 10, ox + 4, 8 + kick, 'red');

        // Bent acrobatic legs (blue thighs + red web boots)
        pc.line(ox + 8, 14, ox + 5, 16 + kick, 'blue');
        pc.line(ox + 5, 16 + kick, ox + 4, 18, 'red');
        pc.line(ox + 11, 14, ox + 14, 15 - kick, 'blue');
        pc.line(ox + 14, 15 - kick, ox + 15, 17, 'red');
    }
    pc.outline('ink', false);
    return pc;
}

/**
 * Spider Man inside "The Town" swinging/flying on web lines from one tree to another.
 */
export class SpiderMan {
    readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly label: Phaser.GameObjects.Image;
    private readonly bubble: Phaser.GameObjects.Image;
    private readonly web: Phaser.GameObjects.Graphics;
    private readonly quipKeys: string[] = [];
    private readonly trees: { x: number; y: number }[];
    private fromIdx = 0;
    private toIdx = 1;
    private t = 0;
    private pause = 0.6;
    private clock = 0;

    constructor(
        private readonly scene: Phaser.Scene,
        townLeft = 451,
    ) {
        // Matches the 5 trees inside The Town (see Town.ts):
        // [[ox + 130, 40], [ox + 215, 10], [ox + 300, 70], [ox + 360, 20], [ox + 180, 110]]
        this.trees = [
            { x: townLeft + 130, y: 14 },
            { x: townLeft + 215, y: -16 },
            { x: townLeft + 300, y: 44 },
            { x: townLeft + 360, y: -6 },
            { x: townLeft + 180, y: 84 },
        ];

        const key = 'town-spiderman';
        addPixels(scene, key, drawSpiderManSheet(), stripFrames(FRAMES, W, H));
        if (!scene.anims.exists('town-spiderman-swing')) {
            scene.anims.create({
                key: 'town-spiderman-swing',
                frames: [0, 1].map((frame) => ({ key, frame })),
                frameRate: 6,
                repeat: -1,
            });
        }

        SPIDEY_QUIPS.forEach((q, i) => {
            const k = `town-spiderman-quip-${i}`;
            addPixels(scene, k, speechArt(q, 24));
            this.quipKeys.push(k);
        });

        const start = this.trees[0];
        this.web = scene.add.graphics().setDepth(1e4);
        this.shadow = scene.add.image(start.x, start.y + 26, shadowTexture(scene, 12)).setAlpha(0.25).setDepth(-1e8);
        this.sprite = scene.add.sprite(start.x, start.y, key, 0).setOrigin(0.5, 1).setDepth(start.y + 30).play('town-spiderman-swing');
        this.sprite.setName('Spider Man');

        const labelKey = 'town-spiderman-label';
        const labelCanvas = new PixelCanvas(miniTextWidth('Spider Man') + 6, 9);
        labelCanvas.rect(0, 0, labelCanvas.width, 9, 'red').rect(0, 0, labelCanvas.width, 1, 'blue');
        miniText(labelCanvas, 3, 2, 'Spider Man', 'white');
        addPixels(scene, labelKey, labelCanvas);
        this.label = scene.add.image(start.x, start.y - 24, labelKey).setOrigin(0.5, 1).setDepth(start.y + 31);

        this.bubble = scene.add.image(start.x, start.y - 35, this.quipKeys[0])
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);

        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    update(dt: number) {
        const step = Math.min(dt, 0.1);
        this.clock += step;

        const from = this.trees[this.fromIdx];
        const to = this.trees[this.toIdx];

        this.web.clear();

        if (this.pause > 0) {
            this.pause -= step;
            this.sprite.setPosition(from.x, from.y).setFrame(1).setDepth(from.y + 30);
            this.shadow.setPosition(from.x, from.y + 26).setScale(1);
            this.label.setPosition(from.x, from.y - 24).setDepth(from.y + 31);
        } else {
            const dist = Math.hypot(to.x - from.x, to.y - from.y);
            const duration = Math.max(0.75, dist / 125);
            this.t += step / duration;

            if (this.t >= 1) {
                this.t = 0;
                this.fromIdx = this.toIdx;
                this.toIdx = (this.toIdx + 1) % this.trees.length;
                this.pause = 0.55;
            } else {
                const k = this.t;
                const x = Phaser.Math.Linear(from.x, to.x, k);
                // Swooping pendulum arc between tree canopies
                const dip = Math.sin(k * Math.PI) * 18 - Math.sin(k * Math.PI * 2) * 4;
                const baseY = Phaser.Math.Linear(from.y, to.y, k);
                const y = baseY + dip;
                const flip = to.x < from.x;

                // Draw silver-white web line from Spider-Man's hand to the target tree canopy
                const handX = x + (flip ? -7 : 7);
                const handY = y - 14;
                const anchorX = k < 0.5 ? (from.x + to.x) / 2 : to.x;
                const anchorY = (k < 0.5 ? Math.min(from.y, to.y) : to.y) - 18;

                this.web.lineStyle(1, 0xf4f4ef, 0.9);
                this.web.beginPath();
                this.web.moveTo(handX, handY);
                this.web.lineTo(anchorX, anchorY);
                this.web.strokePath();

                this.sprite.setPosition(Math.round(x), Math.round(y))
                    .setFlipX(flip)
                    .setFrame(0)
                    .setDepth(Math.max(from.y, to.y) + 35);
                this.shadow.setPosition(Math.round(x), Math.round(baseY + 26)).setScale(0.8);
                this.label.setPosition(Math.round(x), Math.round(y - 24)).setDepth(Math.max(from.y, to.y) + 36);
            }
        }

        const talkCycle = this.clock % 10;
        if (talkCycle < 3.4) {
            const qIdx = Math.floor(this.clock / 10) % this.quipKeys.length;
            const key = this.quipKeys[qIdx];
            if (this.bubble.texture.key !== key) this.bubble.setTexture(key);
            this.bubble.setPosition(this.sprite.x, this.sprite.y - 35).setVisible(true);
        } else {
            this.bubble.setVisible(false);
        }
    }

    destroy() {
        this.web.destroy();
        this.sprite.destroy();
        this.shadow.destroy();
        this.label.destroy();
        this.bubble.destroy();
    }
}
