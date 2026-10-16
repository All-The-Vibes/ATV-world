import { useSyncExternalStore } from 'react';
import { music, onSoundChange, toggleSound } from './index';

const isMuted = () => music.muted;

/** The speaker button beside the zoom buttons. M does the same thing. */
export function SoundButton() {
    const muted = useSyncExternalStore(onSoundChange, isMuted);
    const title = `Sound ${muted ? 'off' : 'on'} (M)`;
    return (
        // preventDefault on mousedown keeps keyboard focus on the game.
        <button type="button" className="sound" title={title} aria-label="Sound" aria-pressed={!muted} onMouseDown={(e) => e.preventDefault()} onClick={toggleSound}>
            <svg viewBox="0 0 12 12" width="18" height="18" shapeRendering="crispEdges" aria-hidden="true">
                <path fill="currentColor" d="M1 4h3v4H1zM4 3h1v6H4zM5 2h1v8H5zM6 1h1v10H6z" />
                {muted
                    ? <path fill="currentColor" d="M8 4h1v1H8zM9 5h1v1H9zM10 6h1v1h-1zM11 7h1v1h-1zM11 4h1v1h-1zM10 5h1v1h-1zM9 6h1v1H9zM8 7h1v1H8z" />
                    : <path fill="currentColor" d="M8 4h1v4H8zM9 2h1v1H9zM10 3h1v6h-1zM9 9h1v1H9z" />}
            </svg>
        </button>
    );
}
