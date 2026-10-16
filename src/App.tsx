import { PhaserGame } from './PhaserGame';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Backpack } from './backpack/Backpack';
import { CallPanel } from './call/CallPanel';
import { CharacterSearch } from './characters/CharacterSearch';
import { FactoryPanel } from './factory/FactoryPanel';
import { activeScene, isInsideHQ, onActiveScene, onInsideHQ, send, type Command } from './game/commands';
import { VibeMeter } from './game/VibeMeter';
import { LibraryBridge } from './library/bridge';
import { LibraryPanel } from './library/LibraryPanel';
import { MapButton, MiniMap } from './map/MiniMap';
import { SettingsMenu } from './settings/SettingsMenu';
import { myCharacter, myName } from './multiplayer/identity';
import { NamePrompt } from './multiplayer/NamePrompt';
import { PlayersPanel } from './multiplayer/PlayersPanel';
import { ChatBox } from './multiplayer/ChatBox';
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
    const [backpackOpen, setBackpackOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const [named, setNamed] = useState(() => (!!myName() && myCharacter() !== null) || navigator.webdriver);
    const [editing, setEditing] = useState(false);
    const [chatting, setChatting] = useState(false);
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
            <PhaserGame bridge={bridge} inputBlocked={state.open || backpackOpen || searching || chatting || !named || editing} />
            {!named && <NamePrompt onDone={() => setNamed(true)} />}
            {named && editing && <NamePrompt onDone={() => location.reload()} onCancel={() => setEditing(false)} />}
            {named && outdoors && <PlayersPanel onEdit={() => setEditing(true)} />}
            <div className="banner">
                <h1>{state.inside ? 'TOWER LIBRARY' : 'ATV WORLD'}</h1>
                <p>{state.inside
                    ? (touch ? 'Walk with the stick to a bookcase or the card catalog.' : 'Arrow keys move. Walk up to a bookcase or the card catalog.')
                    : (touch ? 'Stick walks · ✦ pulses · Pinch zooms' : 'Arrows walk · S skateboards · Space pulses · Collect vibes')}</p>
            </div>
            <div className="hud-left">
                <Backpack open={backpackOpen} onOpenChange={setBackpackOpen} />
                <VibeMeter insideLibrary={state.inside} />
                <CharacterSearch hidden={state.inside} onFocusChange={setSearching} />
            </div>
            <div className="hud-right">
            <div className="zoom">
                {!state.inside && buttons.map(([label, command, title]) => (
                    // preventDefault on mousedown keeps keyboard focus on the game.
                    <button key={command} type="button" data-cmd={command} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={() => send(command)}>
                        {label}
                    </button>
                ))}
                {outdoors && <MapButton />}
                <SettingsMenu views={!state.inside} />
            </div>
            </div>
            <CallPanel />
            <ChatBox hidden={!named || state.inside || state.open || backpackOpen} onFocusChange={setChatting} />
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
