import type Phaser from 'phaser';
import { ensurePixels, speechArt } from '../kit';

export const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** A speech bubble that hangs over someone's head for a moment, following them as they move. */
export class Speaker {
    private bubble?: Phaser.GameObjects.Image;
    private until = 0;

    constructor(private readonly scene: Phaser.Scene, private readonly head: () => { x: number; y: number }) {
        const follow = () => this.follow();
        scene.events.on('postupdate', follow);
        scene.events.once('shutdown', () => scene.events.off('postupdate', follow));
    }

    say(text: string, seconds = 2.4, wrap = 18) {
        const key = ensurePixels(this.scene, `wl-say-${wrap}-${text}`, () => speechArt(text, wrap));
        this.bubble ??= this.scene.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(1e5);
        this.bubble.setTexture(key).setVisible(true);
        this.until = this.scene.time.now + seconds * 1000;
        this.follow();
    }

    get talking() {
        return !!this.bubble?.visible;
    }

    private follow() {
        if (!this.bubble?.visible) return;
        if (this.scene.time.now > this.until) {
            this.bubble.setVisible(false);
            return;
        }
        const { x, y } = this.head();
        this.bubble.setPosition(Math.round(x), Math.round(y - 2));
    }
}

/** Anything in Wonderland that runs every frame. */
export interface Feature {
    update(dt: number, player: Phaser.GameObjects.Sprite): void;
}
