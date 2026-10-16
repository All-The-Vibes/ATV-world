import { useLayoutEffect, useRef } from 'react';
import { isTyping } from './game/commands';
import { createGame } from './game/main';
import { LibraryBridge } from './library/bridge';

/** Mounts the Phaser game into a full-screen div. */
export function PhaserGame({ bridge }: { bridge: LibraryBridge }) {
    const parent = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const game = createGame(parent.current!, bridge);
        const syncInput = () => {
            const keyboard = game.input.keyboard;
            if (!keyboard) return;
            game.scene.getScenes(false).forEach(scene => scene.input.keyboard?.resetKeys());
            keyboard.enabled = !bridge.getSnapshot().open;
            if (bridge.getSnapshot().open) keyboard.clearCaptures();
            else keyboard.addCapture([37, 38, 39, 40]);
        };
        let open = false;
        const unsubscribe = bridge.subscribe(() => {
            if (open !== bridge.getSnapshot().open) {
                open = bridge.getSnapshot().open;
                syncInput();
            }
        });
        // E takes whatever the scene in front offers (enter the library, browse a shelf, leave).
        // A window listener, so quick taps count and typing an "e" in a text field doesn't.
        const onKey = (e: KeyboardEvent) => {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
            if (e.key === 'e' || e.key === 'E') bridge.interact();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            unsubscribe();
            window.removeEventListener('keydown', onKey);
            game.destroy(true);
        };
    }, [bridge]);

    return <div id="game" ref={parent} />;
}
