import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { focusCharacter, getCharacters, onCharacters } from '../game/commands';
import { PHONE } from '../touch/device';
import './characters.css';

/** Rows showing at once, and the height of one row, unless the list can measure them (touch and phones use taller, fewer rows). */
const PAGE = 5;
const ROW = 34;
/** How often the list turns to its next five, how long the turn takes, and how long it stays put after someone scrolls it. */
const CYCLE_MS = 3000;
const TURN_MS = 500;
const RESUME_MS = 6000;

type Hold = 'searching' | 'scrolled' | undefined;

export function CharacterSearch({ hidden, onFocusChange }: { hidden?: boolean; onFocusChange?: (focused: boolean) => void }) {
    const characters = useSyncExternalStore(onCharacters, getCharacters);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(() => !matchMedia(PHONE).matches);
    const [hold, setHold] = useState<Hold>();
    const list = useRef<HTMLUListElement>(null);
    const typing = useRef(false);
    const queried = useRef(false);
    const scrolledUntil = useRef(0);
    // The list turns itself with a short script, so its own scrolling is told apart from the user's.
    const turning = useRef(0);
    const lastSet = useRef(0);

    const q = query.trim().toLowerCase();
    queried.current = q !== '';
    const shown = useMemo(
        () => (q ? characters.filter((c) => c.name.toLowerCase().includes(q) || c.kind.toLowerCase().includes(q)) : characters),
        [characters, q],
    );
    const here = characters.filter((c) => c.here).length;

    // Why the list should stand still right now, if it should: someone is using the search, or scrolled it by hand.
    const holdReason = useCallback((): Hold => {
        if (typing.current || queried.current) return 'searching';
        if (performance.now() < scrolledUntil.current) return 'scrolled';
        return undefined;
    }, []);

    const stopTurning = useCallback(() => {
        cancelAnimationFrame(turning.current);
        turning.current = 0;
    }, []);

    const turnTo = useCallback((el: HTMLElement, to: number) => {
        stopTurning();
        const from = el.scrollTop;
        const start = performance.now();
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / TURN_MS);
            const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
            el.scrollTop = from + (to - from) * eased;
            lastSet.current = el.scrollTop;
            turning.current = t < 1 ? requestAnimationFrame(step) : 0;
        };
        turning.current = requestAnimationFrame(step);
    }, [stopTurning]);

    useEffect(() => {
        if (!open) return;
        const id = window.setInterval(() => {
            const el = list.current;
            const reason = holdReason();
            setHold(reason);
            if (!el || reason || el.scrollHeight <= el.clientHeight + 1) return;
            const max = el.scrollHeight - el.clientHeight;
            const row = el.querySelector<HTMLElement>('.char-row')?.offsetHeight || ROW;
            const rows = Math.max(1, Math.floor(el.clientHeight / row)) || PAGE;
            const page = Math.round(el.scrollTop / row) * row;
            turnTo(el, el.scrollTop >= max - 1 ? 0 : Math.min(max, page + rows * row));
        }, CYCLE_MS);
        return () => {
            window.clearInterval(id);
            stopTurning();
        };
    }, [open, holdReason, turnTo, stopTurning]);

    // A new filter starts from the top.
    useEffect(() => {
        const el = list.current;
        if (el) {
            stopTurning();
            el.scrollTop = 0;
            lastSet.current = el.scrollTop;
        }
        setHold(holdReason());
    }, [q, holdReason, stopTurning]);

    // Scrolling by hand (the scrollbar, the wheel, a swipe) holds the cycling for a few seconds.
    const scrolledByHand = () => {
        stopTurning();
        scrolledUntil.current = performance.now() + RESUME_MS;
        setHold(holdReason());
    };

    const onScroll = () => {
        const el = list.current;
        if (!el || turning.current || Math.abs(el.scrollTop - lastSet.current) < 2) return;
        lastSet.current = el.scrollTop;
        scrolledByHand();
    };

    if (hidden) return null;

    return (
        <section className="char-search" aria-label="Character search">
            <header className="char-head">
                <button type="button" className="char-toggle" aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}>
                    <span className="char-title">CHARACTERS</span>
                    <span className="char-count">{here}/{characters.length} here</span>
                    <span aria-hidden="true">{open ? '–' : '+'}</span>
                </button>
            </header>
            {open && <>
                <input
                    className="char-filter"
                    type="text"
                    value={query}
                    placeholder="Filter characters..."
                    aria-label="Filter characters"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { typing.current = true; setHold(holdReason()); onFocusChange?.(true); }}
                    onBlur={() => { typing.current = false; setHold(holdReason()); onFocusChange?.(false); }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') {
                            setQuery('');
                            e.currentTarget.blur();
                        } else if (e.key === 'Enter') {
                            const first = shown.find((c) => c.here || c.kind === 'visitor');
                            if (first) focusCharacter(first.id);
                        }
                    }}
                />
                <ul
                    ref={list}
                    className="char-list"
                    onScroll={onScroll}
                    onWheel={scrolledByHand}
                    onPointerDown={(e) => { if (e.target === e.currentTarget) scrolledByHand(); }}
                    onTouchMove={scrolledByHand}
                >
                    {shown.map((c) => (
                        <li key={c.id} className="char-row" data-away={c.here ? undefined : ''} data-invitable={!c.here && c.kind === 'visitor' ? '' : undefined}>
                            <span className="char-dot" title={c.here ? 'In town' : 'Away from town'} />
                            <span className="char-name">{c.name}</span>
                            <span className="char-kind">{c.kind}</span>
                            <button
                                type="button"
                                className="char-focus"
                                disabled={!c.here && c.kind !== 'visitor'}
                                title={c.here ? `Zoom in on ${c.name}` : c.kind === 'visitor' ? `Invite ${c.name} into town and zoom in` : `${c.name} is away from town right now`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
                                    focusCharacter(c.id);
                                }}
                            >
                                {c.here || c.kind !== 'visitor' ? 'Focus' : 'Invite'}
                            </button>
                        </li>
                    ))}
                    {!shown.length && <li className="char-empty">No characters match.</li>}
                </ul>
                <footer className="char-foot">
                    <span>{shown.length} shown</span>
                    <span data-paused={hold ? '' : undefined}>{hold === 'searching' ? 'PAUSED: SEARCH' : hold === 'scrolled' ? 'PAUSED: SCROLLED' : 'CYCLING'}</span>
                </footer>
            </>}
        </section>
    );
}
