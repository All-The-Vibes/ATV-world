import { useLayoutEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from './game/main';
import { LibraryBridge } from './library/bridge';

/** Mounts the Phaser game into a full-screen div. */
export function PhaserGame({ bridge, inputBlocked }: { bridge: LibraryBridge; inputBlocked: boolean }) {
    const parent = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    useLayoutEffect(() => {
        const game = createGame(parent.current!, bridge);
        gameRef.current = game;
        return () => {
            gameRef.current = null;
            game.destroy(true);
        };
    }, [bridge]);

    useLayoutEffect(() => {
        const game = gameRef.current;
        const keyboard = game?.input.keyboard;
        if (!game || !keyboard) return;
        game.scene.getScenes(false).forEach(scene => scene.input.keyboard?.resetKeys());
        keyboard.enabled = !inputBlocked;
        if (inputBlocked) keyboard.clearCaptures();
        else keyboard.addCapture([37, 38, 39, 40]);
    }, [inputBlocked]);

    return <div id="game" ref={parent} />;
}
