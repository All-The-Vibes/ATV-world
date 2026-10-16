import type Phaser from 'phaser';
import { PixelCanvas, addCreatorNametag, ensurePixels, shadowTexture, stripFrames } from '../kit';

export class UFO {
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private clock = 0;

    constructor(scene: Phaser.Scene, private bounds: () => Phaser.Geom.Rectangle) {
        ensurePixels(scene, 'ufo-saucer', () => {
            const canvas = new PixelCanvas(52 * 4, 28);
            for (let frame = 0; frame < 4; frame++) {
                const x = frame * 52;
                canvas
                    .ellipse(x + 26, 12, 12, 11, 'ink')
                    .ellipse(x + 26, 12, 10, 9, 'sky')
                    .ellipse(x + 26, 10, 8, 7, 'cyan')
                    .ellipse(x + 26, 11, 4, 4, 'lime')
                    .rect(x + 23, 10, 2, 2, 'ink')
                    .rect(x + 27, 10, 2, 2, 'ink')
                    .rect(x + 19, 5, 3, 4, 'ice')
                    .ellipse(x + 26, 20, 25, 7, 'ink')
                    .ellipse(x + 26, 20, 23, 5, 'steel')
                    .ellipse(x + 26, 18, 21, 3, 'cloud')
                    .rect(x + 8, 18, 36, 1, 'white')
                    .ellipse(x + 26, 25, 9, 2, 'blue')
                    .rect(x + 22, 25, 8, 1, 'cyan');
                for (let light = 0; light < 4; light++) {
                    canvas.rect(x + 10 + light * 10, 21, 3, 2, light === frame ? 'yellow' : 'violet');
                }
            }
            return { canvas, frames: stripFrames(4, 52, 28) };
        });
        this.shadow = scene.add.image(0, 0, shadowTexture(scene, 44)).setAlpha(0.2).setDepth(-1e8);
        this.sprite = scene.add.sprite(0, 0, 'ufo-saucer', 0).setName('Flying saucer').setDepth(1e6 + 2);
        addCreatorNametag(this.sprite, { githubUsername: 'aifateen' });
        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    update(dt: number) {
        this.clock += Math.min(dt, 0.1);
        const bounds = this.bounds();
        const angle = this.clock * 0.28;
        const x = Math.round(bounds.centerX + Math.cos(angle) * bounds.width * 0.32);
        const groundY = Math.round(bounds.centerY + Math.sin(angle) * bounds.height * 0.2);
        const bob = Math.round(Math.sin(this.clock * 2.5) * 4);
        this.sprite.setPosition(x, groundY - 70 + bob).setFrame(Math.floor(this.clock * 5) % 4);
        this.shadow.setPosition(x, groundY);
    }

    destroy() {
        this.sprite.destroy();
        this.shadow.destroy();
    }
}
