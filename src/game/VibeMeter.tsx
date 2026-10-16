import { useSyncExternalStore } from 'react';
import { isInsideHQ, onInsideHQ } from './commands';
import { getVibes, onVibes } from './vibes';

export function VibeMeter({ insideLibrary }: { insideLibrary: boolean }) {
    const state = useSyncExternalStore(onVibes, getVibes);
    const insideHQ = useSyncExternalStore(onInsideHQ, isInsideHQ);
    if (!state.active || insideLibrary || insideHQ) return null;

    return (
        <aside className="vibe-meter" data-rush={state.rush || undefined} aria-label="Vibe Run score">
            <div className="vibe-meter-top">
                <span className="vibe-meter-gem" aria-hidden="true">◆</span>
                <span className="vibe-meter-title">VIBE RUN</span>
                <span className="vibe-meter-round">R{state.round}</span>
            </div>
            <div className="vibe-meter-track" aria-label={`${state.collected} of ${state.total} vibes collected`}>
                {Array.from({ length: state.total }, (_, index) => (
                    <span key={index} data-lit={index < state.collected || undefined} />
                ))}
            </div>
            <div className="vibe-meter-score">
                <strong>{state.score.toLocaleString()}</strong>
                {state.streak > 1 && <span>COMBO ×{state.streak}</span>}
                {state.rush && <span>RUSH!</span>}
            </div>
            <span className="sr-only" role="status" aria-live="polite">{state.message}</span>
        </aside>
    );
}
