import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { insets, isInsideHQ, onInsideHQ, send } from '../game/commands';
import { callerFace } from '../game/hq/art';
import { endDemo, startDemo } from './demo';
import { call, type CallStatus } from './roster';
import './panel.css';

const subscribe = (fn: () => void) => call.subscribe(fn);
const snapshot = () => call.version;
const inTeams = new URLSearchParams(location.search).has('teams');
/** Same breakpoint as panel.css: below it, the panel docks along the bottom instead of the right. */
const DOCK_BOTTOM = '(max-width: 640px)';
/** Past this many people, the list tightens up (calls run 40-50). */
const MANY = 12;

function statusText(status: CallStatus, count: number): string {
    if (status.kind !== 'idle') return status.text;
    if (count) return `${count} ${count === 1 ? 'person' : 'people'} at their desks.`;
    return "Nobody's on the call yet. Add ATV World to a Teams meeting and everyone who opens it gets a desk here, coding.";
}

/** The call panel, shown only while the player is inside ATV HQ. */
export function CallPanel() {
    const inside = useSyncExternalStore(onInsideHQ, isInsideHQ);
    return inside ? <Panel /> : null;
}

/** Who's on the call: faces, names, and the ways to fill ATV HQ. */
function Panel() {
    useSyncExternalStore(subscribe, snapshot);
    const people = call.list();
    const status = call.status;
    const [open, setOpen] = useState(() => !matchMedia(DOCK_BOTTOM).matches);
    const [busy, setBusy] = useState(false);
    const [hint, setHint] = useState('');
    const panel = useRef<HTMLElement>(null);

    // Tell the camera what the panel covers, so HQ is framed beside it, not under it.
    useLayoutEffect(() => {
        const el = panel.current;
        if (!el) return;
        const measure = () => {
            const r = el.getBoundingClientRect();
            const bottom = matchMedia(DOCK_BOTTOM).matches;
            insets.bottom = bottom ? Math.max(0, window.innerHeight - r.top) : 0;
            insets.right = !bottom && r.height > 120 ? Math.max(0, window.innerWidth - r.left) : 0;
        };
        measure();
        const watch = new ResizeObserver(measure);
        watch.observe(el);
        window.addEventListener('resize', measure);
        return () => {
            watch.disconnect();
            window.removeEventListener('resize', measure);
            insets.bottom = insets.right = 0;
        };
    }, []);

    useEffect(() => {
        if (!hint) return;
        const t = setTimeout(() => setHint(''), 20_000);
        return () => clearTimeout(t);
    }, [hint]);

    const run = async (task: () => void | Promise<void>, done = '') => {
        setBusy(true);
        setHint('');
        try {
            await task();
            setHint(done);
        } catch (e) {
            setHint(`That didn't work: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setBusy(false);
        }
    };
    const addToTeams = () =>
        run(
            async () => (await import('./teamsApp')).downloadTeamsApp(),
            'Saved atv-world-teams.zip. In Teams, go to Apps › Manage your apps › Upload an app, then add ATV World to a meeting and share it to the stage.',
        );

    const action = status.action;
    const primary = action ? 'action' : !inTeams && !people.length ? 'teams' : '';
    const dot = status.kind === 'idle' && people.length ? 'live' : status.kind;
    // Keep keyboard focus on the game when a button is clicked with the mouse.
    const keepFocus = (e: MouseEvent) => e.preventDefault();

    return (
        <section ref={panel} className="callpanel" aria-label="ATV HQ call">
            <button type="button" className="callpanel-head" aria-expanded={open} onClick={() => setOpen(!open)}>
                <span className="callpanel-dot" data-state={dot} aria-hidden="true" />
                <span>ATV HQ</span>
                <span className="callpanel-count" title="On the call">{people.length}</span>
                <span className="callpanel-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
            </button>
            {open && (
                <div className="callpanel-body">
                    <p className="callpanel-status" data-state={status.kind} aria-live="polite">{statusText(status, people.length)}</p>
                    {status.kind === 'config' && status.field && (
                        <label className="callpanel-field">
                            <span>{status.field.label}</span>
                            <input
                                type="password"
                                defaultValue={status.field.value}
                                placeholder={status.field.placeholder}
                                autoComplete="off"
                                spellCheck={false}
                                onChange={(e) => status.field?.onChange(e.target.value)}
                            />
                        </label>
                    )}
                    {people.length > 0 && (
                        <ul className="callpanel-list" data-many={people.length > MANY || undefined}>
                            {people.map((c) => (
                                <li key={c.id}>
                                    <img src={callerFace(c.id)} alt="" width={32} height={30} />
                                    <span className="callpanel-name" title={c.name}>{c.name}</span>
                                    {c.me && <span className="callpanel-you">you</span>}
                                    <span className="callpanel-caret" title="Coding" />
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="callpanel-actions">
                        {action && (
                            <button type="button" className={primary === 'action' ? 'primary' : ''} title={action.title} disabled={busy} onMouseDown={keepFocus} onClick={() => run(action.run)}>
                                {action.label}
                            </button>
                        )}
                        {!inTeams && (
                            <button type="button" className={primary === 'teams' ? 'primary' : ''} title="Download the Teams app for your meetings" disabled={busy} onMouseDown={keepFocus} onClick={addToTeams}>
                                Add to Teams
                            </button>
                        )}
                        {!inTeams && status.kind !== 'live' && (
                            <button
                                type="button"
                                title="A pretend call: the README's agents dial in"
                                onMouseDown={keepFocus}
                                onClick={() => (status.kind === 'demo' ? endDemo() : startDemo())}
                            >
                                {status.kind === 'demo' ? 'End demo' : 'Demo'}
                            </button>
                        )}
                        <button type="button" title="Walk back out the front door (or press the down arrow)" onMouseDown={keepFocus} onClick={() => send('leaveHQ')}>
                            Step out
                        </button>
                    </div>
                    <p className="callpanel-hint" role="status" aria-live="polite">{hint}</p>
                </div>
            )}
        </section>
    );
}