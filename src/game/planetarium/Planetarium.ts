import Phaser from 'phaser';
import { PixelCanvas, addPixels, bayer, planetariumArt, shadowTexture } from '../kit';

/** Where twinkles appear around the dome, relative to the building's top-left. */
const TWINKLES: [number, number][] = [[50, 10], [96, 16], [40, 30], [106, 34], [62, 4], [86, 6], [20, 46], [126, 50]];

/**
 * The planetarium out in the world: walk into it (or click it) to go inside for the star show
 * (see ../scenes/StarShow). Its doorway glows and little stars twinkle over the dome.
 */
export class Planetarium {
    /** What the world's bounds should include. */
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    /** The building's footprint (plus the steps), where tokens shouldn't land. */
    readonly area: Phaser.Geom.Rectangle;
    /** The building's base: the player is drawn at their feet, so standing in here is "walking into" it. */
    readonly foot: Phaser.Geom.Rectangle;
    /** Where the player stands after stepping back out. */
    readonly exit: Phaser.Math.Vector2;
    /** Called when the building is clicked. */
    onClick?: () => void;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        const { canvas, door } = planetariumArt();
        addPixels(scene, 'planetarium', canvas);
        const left = x - canvas.width / 2;
        const top = y - canvas.height;
        scene.add.image(x, y - 2, shadowTexture(scene, canvas.width - 8)).setAlpha(0.25).setDepth(-1e8);
        const image = scene.add.image(x, y, 'planetarium').setOrigin(0.5, 1).setDepth(y)
            .setInteractive({ useHandCursor: true, pixelPerfect: true });
        image.on('pointerdown', () => this.onClick?.());
        this.parts.push(image);
        this.area = new Phaser.Geom.Rectangle(left, top, canvas.width, canvas.height + 12);
        this.foot = new Phaser.Geom.Rectangle(left + 6, y - 24, canvas.width - 12, 27);
        this.exit = new Phaser.Math.Vector2(left + door.x + door.w / 2, y + 18);

        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

        const glow = new PixelCanvas(21, 21);
        for (let j = 0; j < 21; j++) {
            for (let i = 0; i < 21; i++) {
                const d = Math.hypot(i - 10, j - 10) / 10.5;
                if (d < 1 && (1 - d) ** 1.5 > bayer(i, j)) glow.set(i, j, d < 0.4 ? 'cyan' : 'violet');
            }
        }
        addPixels(scene, 'planetarium-glow', glow);
        const doorGlow = scene.add.image(left + door.x + door.w / 2, top + door.y + 9, 'planetarium-glow')
            .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(y + 0.5);
        if (!still) {
            scene.tweens.add({ targets: doorGlow, alpha: { from: 0.15, to: 0.4 }, duration: 1600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
        }

        addPixels(scene, 'planetarium-twinkle', new PixelCanvas(5, 5).ascii(0, 0, [
            '..c..',
            '..w..',
            'cwywc',
            '..w..',
            '..c..',
        ], { '.': null, c: 'cyan', w: 'white', y: 'yellow' }));
        TWINKLES.forEach(([tx, ty], i) => {
            const star = scene.add.image(left + tx, top + ty, 'planetarium-twinkle')
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 0.5).setAlpha(still ? 0.6 : 0);
            if (still) return;
            scene.tweens.add({
                targets: star,
                alpha: { from: 0, to: 1 },
                scale: { from: 0.4, to: 1 },
                duration: 500,
                ease: 'Sine.easeInOut',
                yoyo: true,
                delay: i * 700,
                repeatDelay: 2600 + (i % 3) * 900,
                repeat: -1,
            });
        });
    }
}
