import { useLayoutEffect, useRef } from 'react';
import { createGame } from './game/main';

/** Mounts the Phaser game into a full-screen div. */
export function PhaserGame() {
    const parent = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const game = createGame(parent.current!);
        return () => game.destroy(true);
    }, []);

    return <div id="game" ref={parent} />;
}
