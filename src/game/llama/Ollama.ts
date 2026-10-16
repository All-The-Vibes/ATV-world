import type Phaser from 'phaser';
import { addPixels, ensurePixels, llamaSheet, shadowTexture, speechArt } from '../kit';

/** A local llama running laps of the open plaza, with a greeting and a punchline. */
export class Ollama {
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly bubble: Phaser.GameObjects.Image;
    private clock = 0;

    constructor(scene: Phaser.Scene) {
        ensurePixels(scene, 'ollama', llamaSheet);
        addPixels(scene, 'ollama-hello', speechArt("Hi, I'm Ollama!"));
        addPixels(scene, 'ollama-joke', speechArt('I run local. Mostly in circles.'));
        if (!scene.anims.exists('ollama-run')) {
            scene.anims.create({
                key: 'ollama-run',
                frames: Array.from({ length: 4 }, (_, frame) => ({ key: 'ollama', frame })),
                frameRate: 12,
                repeat: -1,
            });
        }
        this.shadow = scene.add.image(0, 135, shadowTexture(scene, 28)).setAlpha(0.25).setDepth(-1e8);
        this.sprite = scene.add.sprite(0, 135, 'ollama').setOrigin(0.5, 1).play('ollama-run');
        this.bubble = scene.add.image(0, 89, 'ollama-hello').setOrigin(0.5, 1).setDepth(1e5);
        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    update(dt: number) {
        this.clock += Math.min(dt, 0.1);
        const angle = Math.PI / 2 + this.clock * 0.75;
        const x = Math.round(Math.cos(angle) * 90);
        const y = Math.round(90 + Math.sin(angle) * 45);
        this.sprite.setPosition(x, y).setDepth(y).setFlipX(Math.sin(angle) > 0);
        this.shadow.setPosition(x, y);
        const talk = this.clock % 12;
        const key = talk < 4 ? 'ollama-hello' : 'ollama-joke';
        if (this.bubble.texture.key !== key) this.bubble.setTexture(key);
        this.bubble.setPosition(x, y - 46).setVisible(talk < 9);
    }

    destroy() {
        this.sprite.destroy();
        this.shadow.destroy();
        this.bubble.destroy();
    }
}
