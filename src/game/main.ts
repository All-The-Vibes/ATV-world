import Phaser from 'phaser';
import { Preview } from './scenes/Preview';

/** Create the game inside `parent`. The canvas always fills it. */
export function createGame(parent: HTMLElement): Phaser.Game {
    return new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        backgroundColor: '#14101e',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 800, height: parent.clientHeight || 600 },
        scene: [Preview],
    });
}
