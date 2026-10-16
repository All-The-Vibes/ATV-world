import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { focusCharacter, getCharacters, onCharacters } from '../game/commands';
import './characters.css';

/** Rows showing at once, and the height of one row (keep in step with characters.css). */
const PAGE = 5;
const ROW = 34;
/** How often the list turns to its next five, and how long it stays still after someone scrolls it. */
const CYCLE_MS = 3500;
const RESUME_MS = 8000;

export function CharacterSearch({ hidden, onFocusChange }: { hidden?: boolean; onFocusChange?: (focused: boolean) => void }) {
    const characters = useSyncExternalStore(onCharacters, getCharacters);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(() => window.innerWidth > 600);
    const [paused, setPaused] = useState(false);
    const list = useRef<HTMLUListElement>(null);
    const hovering = useRef(false);
    const typing = useRef(false);
    const pausedUntil = useRef(0);
    const autoUntil = useRef(0);

    const q = query.trim().toLowerCase();
    const shown = useMemo(
        () => (q ? characters.filter((c) => c.name.toLowerCase().includes(q) || c.kind.toLowerCase().includes(q)) : characters),
        [characters, q],
    );
    const here = characters.filter((c) => c.here).length;

    // Whether the list is standing still: hovered, being typed in, recently scrolled by hand, or too short to cycle.
    const holding = useCallback(() => {
        const el = list.current;
        const short = !el || el.scrollHeight <= el.clientHeight + 1;
        return hovering.current || typing.current || performance.now() < pausedUntil.current || short;
    }, []);

    const refresh = useCallback(() => setPaused(holding()), [holding]);

    useEffect(() => {
        if (!open) return;
        const id = window.setInterval(() => {
            const el = list.current;
            if (!el) return;
            if (holding()) {
                setPaused(true);
                return;
            }
            setPaused(false);
            const max = el.scrollHeight - el.clientHeight;
            const page = Math.round(el.scrollTop / ROW) * ROW;
            const next = el.scrollTop >= max - 1 ? 0 : Math.min(max, page + PAGE * ROW);
            autoUntil.current = performance.now() + 800;
            el.scrollTo({ top: next, behavior: 'smooth' });
        }, CYCLE_MS);
        return () => window.clearInterval(id);
    }, [open, holding]);

    // A new filter starts from the top.
    useEffect(() => {
        list.current?.scrollTo({ top: 0 });
        refresh();
    }, [q, refresh]);

    // Any scrolling the list didn't do itself (the scrollbar, the wheel, a swipe) holds the cycling for a while.
    const hold = () => {
        pausedUntil.current = performance.now() + RESUME_MS;
        setPaused(true);
    };

    const onScroll = () => {
        if (performance.now() < autoUntil.current) return;
        hold();
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
                    onFocus={() => { typing.current = true; refresh(); onFocusChange?.(true); }}
                    onBlur={() => { typing.current = false; refresh(); onFocusChange?.(false); }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') {
                            setQuery('');
                            e.currentTarget.blur();
                        } else if (e.key === 'Enter') {
                            const first = shown.find((c) => c.here);
                            if (first) focusCharacter(first.id);
                        }
                    }}
                />
                <ul
                    ref={list}
                    className="char-list"
                    onScroll={onScroll}
                    onPointerDown={hold}
                    onMouseEnter={() => { hovering.current = true; refresh(); }}
                    onMouseLeave={() => { hovering.current = false; pausedUntil.current = Math.max(pausedUntil.current, performance.now() + 1500); refresh(); }}
                >
                    {shown.map((c) => (
                        <li key={c.id} className="char-row" data-away={c.here ? undefined : ''}>
                            <span className="char-dot" title={c.here ? 'In town' : 'Away from town'} />
                            <span className="char-name">{c.name}</span>
                            <span className="char-kind">{c.kind}</span>
                            <button
                                type="button"
                                className="char-focus"
                                disabled={!c.here}
                                title={c.here ? `Zoom in on ${c.name}` : `${c.name} is away from town right now`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
                                    focusCharacter(c.id);
                                }}
                            >
                                Focus
                            </button>
                        </li>
                    ))}
                    {!shown.length && <li className="char-empty">No characters match.</li>}
                </ul>
                <footer className="char-foot">
                    <span>{shown.length} shown</span>
                    <span data-paused={paused ? '' : undefined}>{paused ? 'PAUSED' : 'CYCLING'}</span>
                </footer>
            </>}
        </section>
    );
}
