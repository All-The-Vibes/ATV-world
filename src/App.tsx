import { PhaserGame } from './PhaserGame';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Backpack } from './backpack/Backpack';
import { CallPanel } from './call/CallPanel';
import { CharacterSearch } from './characters/CharacterSearch';
import { FactoryPanel } from './factory/FactoryPanel';
import { getViewModes, onViewModes, send, type Command } from './game/commands';
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
    const modes = useSyncExternalStore(onViewModes, getViewModes);
    const [backpackOpen, setBackpackOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    return (
        <>
            <PhaserGame bridge={bridge} inputBlocked={state.open || backpackOpen || searching} />
            <div className="banner">
                <h1>{state.inside ? 'TOWER LIBRARY' : 'ATV WORLD'}</h1>
                <p>{state.inside ? 'Arrow keys move. Walk up to a bookcase or the card catalog.' : 'Arrows walk · Space pulses · Collect vibes'}</p>
            </div>
            <Backpack open={backpackOpen} onOpenChange={setBackpackOpen} />
            <CharacterSearch hidden={state.inside} onFocusChange={setSearching} />
            {!state.inside && (
                <div className="view-switches" role="group" aria-label="World view switches">
                    <button
                        type="button"
                        className="view-switch"
                        data-active={modes.night || undefined}
                        aria-pressed={modes.night}
                        title="Toggle Night View on/off"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => send('toggleNight')}
                    >
                        <span className="view-switch-dot" aria-hidden="true">🌙</span>
                        <span>NIGHT: {modes.night ? 'ON' : 'OFF'}</span>
                    </button>
                    <button
                        type="button"
                        className="view-switch view-switch-stranger"
                        data-active={modes.stranger || undefined}
                        aria-pressed={modes.stranger}
                        title="Toggle Stranger Things (Upside Down) View on/off"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => send('toggleStranger')}
                    >
                        <span className="view-switch-dot" aria-hidden="true">🚲</span>
                        <span>STRANGER THINGS: {modes.stranger ? 'ON' : 'OFF'}</span>
                    </button>
                </div>
            )}
            <CallPanel />
            <FactoryPanel hidden={state.inside} />
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
