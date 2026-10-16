import Phaser from 'phaser';
import { PixelCanvas, ensurePixels, miniText, miniTextWidth, speechArt, stripFrames } from '../kit';

const W = 136;
const H = 68;
const FRAMES = 2;

const MESSAGE = 'Welcome to USA where Super Intelligence decides if you are our enemy or friend.';

function createUsaBillboardSheet() {
    const pc = new PixelCanvas(W * FRAMES, H);

    for (let f = 0; f < FRAMES; f++) {
        const ox = f * W;

        // Twin heavy steel support legs + concrete footings
        for (const lx of [22, W - 30]) {
            pc.rect(ox + lx, H - 16, 8, 14, 'slate')
                .rect(ox + lx + 1, H - 16, 2, 14, 'steel')
                .rect(ox + lx - 2, H - 3, 12, 3, 'night');
        }
        // Cross-beam catwalk under the board
        pc.rect(ox + 10, H - 17, W - 20, 3, 'steel')
            .rect(ox + 10, H - 17, W - 20, 1, 'cloud');

        // Outer patriotic frame (red/white/blue + chasing gold/cyan lights)
        pc.rect(ox + 2, 4, W - 4, H - 20, 'navy')
            .rect(ox + 3, 5, W - 6, H - 22, 'red')
            .rect(ox + 5, 7, W - 10, H - 26, 'white')
            .rect(ox + 6, 8, W - 12, H - 28, 'ink');

        // Top spotlights
        for (const sx of [26, Math.floor(W / 2), W - 26]) {
            pc.rect(ox + sx - 3, 1, 6, 3, 'slate')
                .rect(ox + sx - 2, 3, 4, 1, f === 0 ? 'yellow' : 'cyan');
        }

        // Chasing perimeter bulbs
        for (let bx = 6; bx < W - 6; bx += 6) {
            const on = ((bx / 6) + f) % 2 === 0;
            pc.set(ox + bx, 6, on ? 'yellow' : 'cyan');
            pc.set(ox + bx, H - 19, on ? 'cyan' : 'yellow');
        }

        // Mini US Flag in top-left corner of the screen (ox + 9, 10, 22x13)
        const fx = ox + 9, fy = 10;
        for (let row = 0; row < 7; row++) {
            pc.rect(fx, fy + row * 2, 20, 2, row % 2 === 0 ? 'red' : 'white');
        }
        pc.rect(fx, fy, 9, 7, 'blue');
        for (let sy = 1; sy <= 5; sy += 2) {
            for (let sx = 1; sx <= 7; sx += 2) pc.set(fx + sx, fy + sy, 'white');
        }

        // Super Intelligence all-seeing AI Eye in top-right corner of the screen
        const ex = ox + W - 19, ey = 16;
        pc.ellipse(ex, ey, 8, 5, 'plum')
            .ellipse(ex, ey, 6, 3, 'cyan')
            .ellipse(ex, ey, 2.5, 2.5, f === 0 ? 'red' : 'gold')
            .set(ex - 1, ey - 1, 'white');

        // Headline: WELCOME TO USA
        const title = 'WELCOME TO USA';
        const tw = miniTextWidth(title);
        const tx = ox + Math.round((W - tw) / 2);
        pc.rect(tx - 3, 11, tw + 6, 9, 'navy')
            .rect(tx - 3, 11, tw + 6, 1, 'gold');
        miniText(pc, tx, 13, title, 'yellow');

        // Subtitle lines
        const lines: [string, 'white' | 'cyan' | 'gold' | 'red'][] = [
            ['WHERE SUPER INTELLIGENCE', 'cyan'],
            ['DECIDES IF YOU ARE', 'white'],
            ['OUR ENEMY OR FRIEND.', f === 0 ? 'gold' : 'red'],
        ];
        lines.forEach(([line, color], i) => {
            const lw = miniTextWidth(line);
            const lx = ox + Math.round((W - lw) / 2);
            miniText(pc, lx, 23 + i * 8, line, color);
        });
    }

    pc.outline('ink');
    return { canvas: pc, frames: stripFrames(FRAMES, W, H) };
}

/**
 * A billboard towards the right corner welcoming visitors to the USA,
 * where Super Intelligence decides if you are our enemy or friend.
 */
export class UsaBillboard {
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    readonly footprint: Phaser.Geom.Rectangle;
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly bubble: Phaser.GameObjects.Image;

    constructor(scene: Phaser.Scene, readonly x: number, readonly y: number) {
        ensurePixels(scene, 'usa-billboard', createUsaBillboardSheet);
        ensurePixels(scene, 'usa-billboard-speech', () => speechArt(MESSAGE, 28));
        if (!scene.anims.exists('usa-billboard-blink')) {
            scene.anims.create({
                key: 'usa-billboard-blink',
                frames: [0, 1].map((frame) => ({ key: 'usa-billboard', frame })),
                frameRate: 2,
                repeat: -1,
            });
        }

        this.sprite = scene.add.sprite(x, y, 'usa-billboard', 0)
            .setOrigin(0.5, 1)
            .setDepth(y)
            .play('usa-billboard-blink')
            .setInteractive({ useHandCursor: true });
        this.parts.push(this.sprite);
        this.footprint = new Phaser.Geom.Rectangle(x - W / 2 + 12, y - 14, W - 24, 14);

        this.bubble = scene.add.image(x, y - H - 4, 'usa-billboard-speech')
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);
        this.parts.push(this.bubble);

        this.sprite.on('pointerdown', () => {
            this.bubble.setVisible(!this.bubble.visible);
        });
    }
}
