import { PhaserGame } from './PhaserGame';
import { useMemo, useSyncExternalStore } from 'react';
import { CallPanel } from './call/CallPanel';
import { send, type Command } from './game/commands';
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
    return (
        <>
            <PhaserGame bridge={bridge} />
            <div className="banner">
                <h1>{state.inside ? 'TOWER LIBRARY' : 'ATV WORLD'}</h1>
                <p>{state.inside ? 'Arrow keys move. Walk up to a bookcase or the card catalog.' : 'Arrows walk · Wheel or +/- zooms · Drag to look around'}</p>
            </div>
            <CallPanel />
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
