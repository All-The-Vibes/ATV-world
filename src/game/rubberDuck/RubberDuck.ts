import type Phaser from 'phaser';
import { addPixels, ensurePixels, shadowTexture, speechArt } from '../kit';
import { DUCK_HEIGHT, rubberDuckSheet } from './art';

const LINES = [
    "Hi I'm Rubber Duck",
    'May I review your code, please?',
    'Would you kindly walk me through your idea?',
    'May we check the edge cases together?',
    'If you like, I would be delighted to review your tests.',
    'Thank you for sharing. Take your time; I am happy to listen.',
];

export class RubberDuck {
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly bubble: Phaser.GameObjects.Image;
    private clock = 0;
    private lineTime = 0;
    private lineIndex = 0;

    constructor(scene: Phaser.Scene) {
        ensurePixels(scene, 'rubber-duck', rubberDuckSheet);
        LINES.forEach((line, index) => addPixels(scene, `rubber-duck-line-${index}`, speechArt(line, 26)));
        if (!scene.anims.exists('rubber-duck-waddle')) {
            scene.anims.create({
                key: 'rubber-duck-waddle',
                frames: Array.from({ length: 4 }, (_, frame) => ({ key: 'rubber-duck', frame })),
                frameRate: 6,
                repeat: -1,
            });
        }
        this.shadow = scene.add.image(0, 0, shadowTexture(scene, 52))
            .setName('Rubber Duck-shadow').setAlpha(0.25).setDepth(-1e8);
        this.sprite = scene.add.sprite(0, 0, 'rubber-duck')
            .setName('Rubber Duck').setOrigin(0.5, 1).play('rubber-duck-waddle')
            .setInteractive({ useHandCursor: true });
        this.bubble = scene.add.image(0, 0, 'rubber-duck-line-0')
            .setName('Rubber Duck-speech').setOrigin(0.5, 1).setDepth(1e5);
        this.sprite.on('pointerdown', () => this.nextLine());
        this.showLine();
        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    update(dt: number) {
        const step = Math.min(dt, 0.1);
        this.clock += step;
        this.lineTime += step;
        if (this.lineTime >= 8) this.nextLine();

        const angle = Math.PI / 2 + this.clock * 0.24;
        const x = Math.round(Math.cos(angle) * 180);
        const y = Math.round(106 + Math.sin(angle) * 24);
        this.sprite.setPosition(x, y).setDepth(y).setFlipX(Math.sin(angle) > 0);
        this.shadow.setPosition(x, y);
        this.bubble.setPosition(x, y - DUCK_HEIGHT - 3).setVisible(this.lineTime < 6.5);
    }

    private nextLine() {
        this.lineIndex = (this.lineIndex + 1) % LINES.length;
        this.lineTime = 0;
        this.showLine();
    }

    private showLine() {
        this.bubble.setTexture(`rubber-duck-line-${this.lineIndex}`)
            .setData('text', LINES[this.lineIndex]).setVisible(true);
    }

    destroy() {
        this.sprite.destroy();
        this.shadow.destroy();
        this.bubble.destroy();
    }
}
