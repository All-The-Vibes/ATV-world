import Phaser from 'phaser';
import { Preview } from './scenes/Preview';
import { Library } from './scenes/Library';
import { Mars } from './scenes/Mars';
import { StarShow } from './scenes/StarShow';
import { LibraryBridge } from '../library/bridge';

/** Create the game inside `parent`. The canvas always fills it. */
export function createGame(parent: HTMLElement, bridge: LibraryBridge): Phaser.Game {
    const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        backgroundColor: '#14101e',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 800, height: parent.clientHeight || 600 },
        scene: [new Preview(bridge), new Library(bridge), new Mars(), new StarShow()],
    });

    // An error thrown mid-frame would stop the game loop for good, so log it and keep going.
    const step = game.step.bind(game);
    let lastLog = -Infinity;
    game.step = (time: number, delta: number) => {
        try {
            step(time, delta);
        } catch (e) {
            if (time - lastLog > 5000) {
                lastLog = time;
                console.error('[ATV] A frame failed (the world keeps running):', e);
            }
        }
    };

    // Handy from the browser console: atv.game.scene.getScene('Preview'), ...
    const w = window as unknown as { atv?: Record<string, unknown> };
    w.atv = { ...w.atv, game };
    return game;
}
