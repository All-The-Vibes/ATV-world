import { useSyncExternalStore } from 'react';
import { Portrait } from './NamePrompt';
import { PRESETS } from './characters';
import { myCharacter, myName } from './identity';
import { getPresence, isLive, onPresence } from './presence';

/** Who's here: you, the other real players (blue), and what the tags in the world mean. */
export function PlayersPanel({ onEdit }: { onEdit: () => void }) {
    const players = useSyncExternalStore(onPresence, getPresence);
    const live = useSyncExternalStore(onPresence, isLive);
    const mine = myCharacter() ?? 0;
    return (
        <aside className="players" aria-label="Players online">
            <div className="players-head">
                <span className="players-dot" data-live={live || undefined} aria-hidden="true" />
                <span>PLAYERS ONLINE</span>
                <span className="players-count">{players.length + 1}</span>
            </div>
            <ul className="players-list">
                <li className="players-row players-you">
                    <Portrait index={mine} scale={1} />
                    <span className="players-name">{myName() || 'You'}</span>
                    <span className="players-badge players-badge-you">YOU</span>
                </li>
                {players.map((p) => (
                    <li key={p.id} className="players-row">
                        <Portrait index={Math.min(p.character, PRESETS.length - 1)} scale={1} />
                        <span className="players-name">{p.name}</span>
                        <span className="players-badge">PLAYER</span>
                    </li>
                ))}
            </ul>
            <div className="players-legend" aria-label="Name tag legend">
                <span><i className="legend-swatch legend-you" />you</span>
                <span><i className="legend-swatch legend-player" />player</span>
                <span><i className="legend-swatch legend-npc" />NPC</span>
            </div>
            {!live && <div className="players-offline">Offline: playing solo</div>}
            <button type="button" className="players-edit" onMouseDown={(e) => e.preventDefault()} onClick={onEdit}>
                CHANGE NAME / CHARACTER
            </button>
        </aside>
    );
}
