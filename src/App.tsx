import { PhaserGame } from './PhaserGame';
import { useMemo, useSyncExternalStore } from 'react';
import { CallPanel } from './call/CallPanel';
import { onTokens, send, tokenCount, type Command } from './game/commands';
import { VibeMeter } from './game/VibeMeter';
import { LibraryBridge } from './library/bridge';
import { LibraryPanel } from './library/LibraryPanel';
import { SoundButton } from './music/SoundButton';

const buttons: [label: string, command: Command, title: string][] = [
    ['-', 'zoomOut', 'Zoom out (-)'],
    ['FIT', 'fit', 'Show the whole world (F)'],
    ['+', 'zoomIn', 'Zoom in (+)'],
];

export default function App() {
    const bridge = useMemo(() => new LibraryBridge(), []);
    const state = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot);
    const tokens = useSyncExternalStore(onTokens, tokenCount);
    return (
        <>
            <PhaserGame bridge={bridge} />
            <div className="banner">
                <h1>{state.inside ? 'TOWER LIBRARY' : 'ATV WORLD'}</h1>
                <p>{state.inside ? 'Arrow keys move. Walk up to a bookcase or the card catalog.' : 'Arrows walk · Space pulses · Collect vibes'}</p>
            </div>
            {!state.inside && <div className="tokens" title="Free tokens you've picked up. Flying cars drop them: walk over one to grab it.">
                <svg viewBox="0 0 9 9" width="18" height="18" shapeRendering="crispEdges" aria-hidden="true">
                    <path fill="#14101e" d="M2 0h5v1h1v1h1v5H8v1H7v1H2V8H1V7H0V2h1V1h1z" />
                    <path fill="#f7b538" d="M2 1h5v1h1v5H7v1H2V7H1V2h1z" />
                    <path fill="#c9925a" d="M3 2h3v1H5v4H4V3H3z" />
                </svg>
                <span>{tokens}</span>
            </div>}
            <CallPanel />
            <VibeMeter insideLibrary={state.inside} />
            <div className="zoom">
                {!state.inside && buttons.map(([label, command, title]) => (
                    // preventDefault on mousedown keeps keyboard focus on the game.
                    <button key={command} type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={() => send(command)}>
                        {label}
                    </button>
                ))}
                <SoundButton />
            </div>
            {!state.open && state.inside && <div className="world-actions">
                <button onClick={() => bridge.leave?.()}>Leave library</button>
            </div>}
            {state.open && <LibraryPanel
                view={state.view}
                onView={view => bridge.update({ view })}
                onClose={() => bridge.update({ open: false })}
            />}
        </>
    );
}
