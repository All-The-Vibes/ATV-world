import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { getViewModes, githubLabelsVisible, onGithubLabels, onViewModes, send, toggleGithubLabels } from '../game/commands';
import { music, onSoundChange, toggleSound } from '../music';

const isMuted = () => music.muted;

// Space and Enter press the focused switch; don't let them reach the game too (Space pulses).
const keepKeys = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
};

function Switch({ icon, label, on, title, onToggle }: { icon: string; label: string; on: boolean; title: string; onToggle: () => void }) {
    return (
        <button type="button" className="settings-switch" aria-pressed={on} aria-label={title} title={title}
            data-active={on || undefined} onKeyDown={keepKeys} onKeyUp={keepKeys} onMouseDown={(e) => e.preventDefault()} onClick={onToggle}>
            <span className="settings-icon" aria-hidden="true">{icon}</span>
            <span className="settings-label">{label}</span>
            <span className="settings-state" aria-hidden="true">{on ? 'ON' : 'OFF'}</span>
        </button>
    );
}

/** The gear beside the zoom buttons: sound, the world's view modes, and GitHub @ tags in one place. */
export function SettingsMenu({ views }: { views: boolean }) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const muted = useSyncExternalStore(onSoundChange, isMuted);
    const modes = useSyncExternalStore(onViewModes, getViewModes);
    const labels = useSyncExternalStore(onGithubLabels, githubLabelsVisible);

    useEffect(() => {
        if (!open) return;
        const away = (e: PointerEvent) => {
            if (!root.current?.contains(e.target as Node)) setOpen(false);
        };
        const escape = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('pointerdown', away);
        window.addEventListener('keydown', escape);
        return () => {
            window.removeEventListener('pointerdown', away);
            window.removeEventListener('keydown', escape);
        };
    }, [open]);

    return (
        <div className="settings" ref={root}>
            <button type="button" className="settings-toggle" title="Settings" aria-label="Settings" aria-expanded={open} aria-controls="settings-panel"
                onKeyDown={keepKeys} onKeyUp={keepKeys} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(o => !o)}>
                <svg viewBox="0 0 12 12" width="18" height="18" shapeRendering="crispEdges" aria-hidden="true">
                    <path fill="currentColor" d="M5 0h2v2H5zM5 10h2v2H5zM0 5h2v2H0zM10 5h2v2h-2zM2 2h2v2H2zM8 2h2v2H8zM2 8h2v2H2zM8 8h2v2H8z" />
                    <path fill="currentColor" fillRule="evenodd" d="M3 3h6v6H3zM5 5h2v2H5z" />
                </svg>
            </button>
            {open && (
                <div className="settings-panel" id="settings-panel" role="group" aria-label="Settings">
                    <div className="settings-title" aria-hidden="true">SETTINGS</div>
                    <Switch icon="♪" label="SOUND" on={!muted} title="Sound (M)" onToggle={toggleSound} />
                    {views && <Switch icon="🌙" label="NIGHT" on={modes.night} title="Night View" onToggle={() => send('toggleNight')} />}
                    {views && <Switch icon="🚲" label="UPSIDE DOWN" on={modes.stranger} title="Stranger Things (Upside Down) View" onToggle={() => send('toggleStranger')} />}
                    <Switch icon="@" label="GITHUB TAGS" on={labels} title="GitHub username labels" onToggle={toggleGithubLabels} />
                </div>
            )}
        </div>
    );
}
