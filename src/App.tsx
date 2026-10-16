import { PhaserGame } from './PhaserGame';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Backpack } from './backpack/Backpack';
import { CallPanel } from './call/CallPanel';
import { CharacterSearch } from './characters/CharacterSearch';
import { FactoryPanel } from './factory/FactoryPanel';
import { activeScene, getViewModes, githubLabelsVisible, isInsideHQ, onActiveScene, onGithubLabels, onInsideHQ, onViewModes, send, toggleGithubLabels, type Command } from './game/commands';
import { VibeMeter } from './game/VibeMeter';
import { LibraryBridge } from './library/bridge';
import { LibraryPanel } from './library/LibraryPanel';
import { MapButton, MiniMap } from './map/MiniMap';
import { SoundButton } from './music/SoundButton';
import { myCharacter, myName } from './multiplayer/identity';
import { NamePrompt } from './multiplayer/NamePrompt';
import { PlayersPanel } from './multiplayer/PlayersPanel';
import { useTouch } from './touch/device';
import { TouchControls } from './touch/TouchControls';

/** Scenes with a player to walk around. */
const WALKABLE = new Set(['Preview', 'Library', 'Mars', 'Wonderland']);

const buttons: [label: string, command: Command, title: string][] = [
    ['-', 'zoomOut', 'Zoom out (-)'],
    ['FIT', 'fit', 'Show the whole world (F)'],
    ['+', 'zoomIn', 'Zoom in (+)'],
];

export default function App() {
    const bridge = useMemo(() => new LibraryBridge(), []);
    const state = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot);
    const githubLabels = useSyncExternalStore(onGithubLabels, githubLabelsVisible);
    const modes = useSyncExternalStore(onViewModes, getViewModes);
    const [backpackOpen, setBackpackOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const [named, setNamed] = useState(() => (!!myName() && myCharacter() !== null) || navigator.webdriver);
    const [editing, setEditing] = useState(false);
    const insideHQ = useSyncExternalStore(onInsideHQ, isInsideHQ);
    const scene = useSyncExternalStore(onActiveScene, activeScene);
    const touch = useTouch();
    // The world map sits out indoors, where the call panel and the library take the screen.
    const outdoors = !state.inside && !insideHQ;
    // The thumb stick shows wherever there's someone to walk and nothing on top; Pulse is the town's Space.
    const canWalk = WALKABLE.has(scene) && !insideHQ && !state.open && !backpackOpen && named;
    const canPulse = scene === 'Preview' && !insideHQ && !state.open && !backpackOpen && named;
    return (
        <>
            <PhaserGame bridge={bridge} inputBlocked={state.open || backpackOpen || searching || !named || editing} />
            {!named && <NamePrompt onDone={() => setNamed(true)} />}
            {named && editing && <NamePrompt onDone={() => location.reload()} onCancel={() => setEditing(false)} />}
            {named && outdoors && <PlayersPanel onEdit={() => setEditing(true)} />}
            <div className="banner">
                <h1>{state.inside ? 'TOWER LIBRARY' : 'ATV WORLD'}</h1>
                <p>{state.inside
                    ? (touch ? 'Walk with the stick to a bookcase or the card catalog.' : 'Arrow keys move. Walk up to a bookcase or the card catalog.')
                    : (touch ? 'Stick walks · ✦ pulses · Pinch zooms' : 'Arrows walk · Space pulses · Collect vibes')}</p>
            </div>
            <div className="hud-left">
                <Backpack open={backpackOpen} onOpenChange={setBackpackOpen} />
                <VibeMeter insideLibrary={state.inside} />
                <CharacterSearch hidden={state.inside} onFocusChange={setSearching} />
            </div>
            <div className="hud-right">
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
                        <span className="view-switch-label">NIGHT: {modes.night ? 'ON' : 'OFF'}</span>
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
                        <span className="view-switch-label">STRANGER THINGS: {modes.stranger ? 'ON' : 'OFF'}</span>
                    </button>
                </div>
            )}
            <div className="zoom">
                {!state.inside && buttons.map(([label, command, title]) => (
                    // preventDefault on mousedown keeps keyboard focus on the game.
                    <button key={command} type="button" data-cmd={command} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={() => send(command)}>
                        {label}
                    </button>
                ))}
                <button type="button" className="github-labels" title={`${githubLabels ? 'Hide' : 'Show'} GitHub usernames`}
                    aria-label="GitHub username labels" aria-pressed={githubLabels}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); }}
                    onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); }}
                    onMouseDown={(e) => e.preventDefault()} onClick={toggleGithubLabels}>
                    @
                </button>
                {outdoors && <MapButton />}
                <SoundButton />
            </div>
            </div>
            <CallPanel />
            <FactoryPanel hidden={state.inside} />
            {outdoors && <MiniMap />}
            <TouchControls walk={canWalk} pulse={canPulse} />
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
