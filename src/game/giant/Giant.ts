import type Phaser from 'phaser';
import { addCreatorNametag, addPixels, ensurePixels, GIANT_H, giantSheet, shadowTexture, speechArt } from '../kit';
import { sp } from '../spread';

/** A giant who tramps a wide loop round the plaza, shouting that the floor is lava. */
export class Giant {
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly bubble: Phaser.GameObjects.Image;
    private clock = 0;

    constructor(scene: Phaser.Scene, private readonly center = { x: 0, y: sp(125) }) {
        ensurePixels(scene, 'giant', giantSheet);
        addPixels(scene, 'giant-shout', speechArt('THE FLOOR IS LAVA!'));
        addPixels(scene, 'giant-shout-loud', speechArt('THE FLOOR IS LAVA!!!'));
        if (!scene.anims.exists('giant-stomp')) {
            scene.anims.create({
                key: 'giant-stomp',
                frames: Array.from({ length: 4 }, (_, frame) => ({ key: 'giant', frame })),
                frameRate: 5,
                repeat: -1,
            });
        }
        this.shadow = scene.add.image(0, 0, shadowTexture(scene, 44)).setAlpha(0.3).setDepth(-1e8);
        this.sprite = scene.add.sprite(0, 0, 'giant').setOrigin(0.5, 1).play('giant-stomp');
        this.bubble = scene.add.image(0, 0, 'giant-shout').setOrigin(0.5, 1).setDepth(1e5);
        addCreatorNametag(this.sprite, { githubUsername: 'markbriggs-ms' }, { speech: () => this.bubble });
        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    update(dt: number) {
        this.clock += Math.min(dt, 0.1);
        const angle = -Math.PI / 2 + this.clock * 0.18;
        const x = Math.round(this.center.x + Math.cos(angle) * 250);
        const y = Math.round(this.center.y + Math.sin(angle) * 75);
        this.sprite.setPosition(x, y).setDepth(y);
        this.shadow.setPosition(x, y);
        const talk = this.clock % 8;
        const key = Math.floor(this.clock * 3) % 2 ? 'giant-shout-loud' : 'giant-shout';
        if (this.bubble.texture.key !== key) this.bubble.setTexture(key);
        this.bubble.setPosition(x, y - GIANT_H - 2).setVisible(talk < 6);
    }

    destroy() {
        this.sprite.destroy();
        this.shadow.destroy();
        this.bubble.destroy();
    }
}
