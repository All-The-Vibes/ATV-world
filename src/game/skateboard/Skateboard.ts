import Phaser from 'phaser';
import { PixelCanvas, addPixels } from '../kit';

const SIDE = 'skateboard-side';
const FRONT = 'skateboard-front';

/** Press S to hop on a skateboard (faster), press S again to put it away. */
export class Skateboard {
    private board: Phaser.GameObjects.Image;
    private on = false;
    private readonly follow: () => void;

    constructor(private scene: Phaser.Scene, private rider: () => Phaser.GameObjects.Sprite | undefined, private facing: () => string) {
        const side = new PixelCanvas(18, 6);
        side.ascii(0, 0, [
            '..oooooooooooo....',
            '.oggggggggggggo...',
            'oggggggggggggggo..',
            '.oooooooooooooo...',
            '..wd........wd....',
            '..dd........dd....',
        ], { '.': null, o: 'ink', g: 'orange', w: 'white', d: 'cream' });
        addPixels(scene, SIDE, side);
        const front = new PixelCanvas(8, 12);
        front.ascii(0, 0, [
            '.oooooo.',
            'oggggggo',
            'oggggggo',
            'oggggggo',
            'oggggggo',
            'oggggggo',
            'oggggggo',
            'oggggggo',
            'oggggggo',
            'oggggggo',
            'owdddwdo',
            '.oooooo.',
        ], { '.': null, o: 'ink', g: 'orange', w: 'white', d: 'cream' });
        addPixels(scene, FRONT, front);

        this.board = scene.add.image(0, 0, SIDE).setOrigin(0.5, 1).setVisible(false);
        this.follow = () => this.place();
        scene.events.on('postupdate', this.follow);
        const kb = scene.input.keyboard;
        const press = (e: KeyboardEvent) => {
            if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) this.toggle();
        };
        kb?.on('keydown-S', press);
        const stop = () => {
            scene.events.off('postupdate', this.follow);
            kb?.off('keydown-S', press);
            scene.events.off('shutdown', stop);
            scene.events.off('destroy', stop);
        };
        scene.events.once('shutdown', stop);
        scene.events.once('destroy', stop);
    }

    get active() {
        return this.on;
    }

    /** How much faster the rider moves. */
    get speedMultiplier() {
        return this.on ? 1.7 : 1;
    }

    toggle() {
        this.on = !this.on;
        this.place();
    }

    private place() {
        const sprite = this.rider();
        const show = this.on && !!sprite && sprite.visible;
        this.board.setVisible(show);
        if (!show || !sprite) return;
        const side = this.facing() === 'side';
        this.board.setTexture(side ? SIDE : FRONT);
        this.board.setPosition(sprite.x, sprite.y + (side ? 3 : 4)).setDepth(sprite.y - 0.4);
    }
}
