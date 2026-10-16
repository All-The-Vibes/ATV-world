/**
 * Reads a book as a bound volume. It opens from the cover, and its leaves turn with a click, a key, a button, or a drag.
 * Public-domain texts are typeset in full; any other catalog result is bound as a short record that links out.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { archiveCandidates, loadArchiveText } from './archive';
import { css, grain, marble, weave, wood } from './art';
import { Face, type FaceContent, type Side, type Volume } from './BookPage';
import { bookUrl, type FeaturedBook } from './books';
import { workDetails } from './catalog';
import { archiveEdition, bindingOf, localEdition, recordEdition, resolveSource, type Edition, type Source } from './edition';
import { findPage, paginate, type Page, type Paged } from './paginate';
import { fetchWithTimeout } from './request';
import { hasGutenbergStart, parseGutenberg } from './text';
import { FACE_NAMES, OVERHANG, SINGLE, SIZE_NAMES, SPREAD, SPREAD_MIN_WIDTH, fontsReady, loadType, measurer, saveType, typeFor, type Type, type TypeSettings } from './typeset';

type Props = {
    source: Source;
    backLabel: string;
    onBack: () => void;
    onClose: () => void;
};

type Status = { kind: 'loading' } | { kind: 'binding' } | { kind: 'ready' } | { kind: 'error'; message: string };
/** Pages laid out for one page mode and type setting. */
type Layout = { paged: Paged; spreads: boolean; type: Type };
/**
 * A leaf turning between two openings, a < b. At --turn 0 it lies on the right (opening a); at 1 it lies on the left (opening b).
 * `from` and `to` are the --turn values it animates between.
 */
type Turn = { a: number; b: number; from: number; to: number; drag: boolean };
type Drag = { id: number; x: number; spine: number; width: number; started: boolean; forward: boolean; reach: number; t: number };

const SPINE = 8;
const MARK = 'atv-library:pos:';
const DAMAGED = 'This book’s text is damaged, so it cannot be opened.';

const endOf = (turn: Turn) => (turn.to >= 0.5 ? turn.b : turn.a);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const openingOf = (page: number, spreads: boolean) => (spreads ? page - (page % 2) : page);

async function loadLocal(book: FeaturedBook, signal: AbortSignal): Promise<Edition> {
    try {
        const response = await fetchWithTimeout(bookUrl(book), {}, signal, 12000);
        if (!response.ok) throw new Error('This book is missing from the shelf. Try again later.');
        const text = await response.text();
        if (!hasGutenbergStart(text)) throw new Error(DAMAGED);
        const parsed = parseGutenberg(text);
        if (parsed.body.length < 8) throw new Error(DAMAGED);
        return localEdition(book, parsed);
    } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('The book took too long to arrive. Try again.');
        if (error instanceof TypeError) throw new Error('The book could not be fetched. Check your connection and try again.');
        throw error;
    }
}

async function loadEdition(source: Source, signal: AbortSignal): Promise<Edition> {
    if (source.kind === 'local') return loadLocal(source.book, signal);
    const book = source.book;
    let notice: string | undefined;
    if (archiveCandidates(book).length) {
        try {
            return archiveEdition(book, await loadArchiveText(book, signal));
        } catch (error) {
            if (signal.aborted) throw error;
            notice = error instanceof Error ? error.message : undefined;
        }
    }
    const details = await workDetails(book.key, signal).catch(() => undefined);
    if (signal.aborted) throw new DOMException('Book closed', 'AbortError');
    return recordEdition(book, details, notice);
}

function readMark(key: string) {
    try {
        const value = Number(localStorage.getItem(MARK + key));
        return Number.isFinite(value) && value > 0 ? value : -1;
    } catch {
        return -1;
    }
}

function writeMark(key: string, pos: number) {
    try {
        localStorage.setItem(MARK + key, String(pos));
    } catch {
        // The bookmark only lasts for this visit.
    }
}

function nameOf(pages: Page[], index: number) {
    if (index === -1) return 'Cover';
    if (index < -1) return '';
    const page = pages[index];
    if (!page || page.kind === 'endpaper') return 'Endpaper';
    if (page.kind === 'title') return 'Title page';
    if (page.kind === 'colophon') return 'Colophon';
    if (page.kind === 'blank') return '';
    return page.folio || (page.flow === 'contents' ? 'Contents' : '');
}

/** Short indicator text and its spoken form for an opening. */
function labelOf(layout: Layout | undefined, at: number) {
    if (!layout || at < 0) return { short: 'Cover', spoken: 'Cover' };
    const pages = layout.paged.pages;
    const names = (layout.spreads ? [at, at + 1] : [at]).map(index => nameOf(pages, index)).filter(Boolean);
    const total = [...pages].reverse().find(page => page.folio)?.folio;
    const numbers = names.filter(name => /^\d+$/.test(name));
    if (numbers.length && numbers.length === names.length) {
        const short = numbers.join('–') + (total ? ` / ${total}` : '');
        return { short, spoken: `${numbers.length > 1 ? 'Pages' : 'Page'} ${numbers.join(' and ')}${total ? ` of ${total}` : ''}` };
    }
    const short = names.join(' · ');
    return { short, spoken: short };
}

function positionOf(layout: Layout, at: number) {
    if (at < 0) return -1;
    const pages = layout.paged.pages;
    for (const index of layout.spreads ? [at, at + 1] : [at]) {
        const page = pages[index];
        if (page && page.kind !== 'blank') return page.pos;
    }
    return pages.at(-1)?.pos ?? -1;
}

export function BookReader({ source, backLabel, onBack, onClose }: Props) {
    const stageRef = useRef<HTMLElement>(null);
    const bookRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    const resolved = useMemo(() => resolveSource(source), [source]);
    const [edition, setEdition] = useState<Edition>();
    const [status, setStatus] = useState<Status>({ kind: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [settings, setSettings] = useState<TypeSettings>(loadType);
    const [stage, setStage] = useState({ w: 0, h: 0 });
    const [layout, setLayout] = useState<Layout>();
    const [at, setAt] = useState(-2);
    const [turn, setTurn] = useState<Turn | null>(null);
    const [menu, setMenu] = useState(false);
    const [announce, setAnnounce] = useState('');
    const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

    const binding = useMemo(() => edition ?? bindingOf(resolved), [edition, resolved]);
    const type = useMemo(() => typeFor(settings), [settings]);
    const wantSpreads = stage.w >= SPREAD_MIN_WIDTH;
    const measured = stage.w > 0;

    const spreads = layout?.spreads ?? wantSpreads;
    const geometry = spreads ? SPREAD : SINGLE;
    const closedAt = spreads ? -2 : -1;
    const len = layout?.paged.pages.length ?? 0;
    const maxAt = !len ? closedAt : spreads ? len - 1 - ((len - 1) % 2) : len - 1;
    const ready = status.kind === 'ready' && !!layout;
    const shown = layout ? at : closedAt;
    const settled = turn ? endOf(turn) : shown;

    const posRef = useRef(-1);
    const openedRef = useRef(false);
    const queueRef = useRef<number | null>(null);
    const dragRef = useRef<Drag | null>(null);
    const turnRef = useRef(turn);
    turnRef.current = turn;
    const atRef = useRef(shown);
    atRef.current = shown;

    useLayoutEffect(() => {
        const element = stageRef.current;
        if (!element) return;
        const measure = () => setStage(current => (current.w === element.clientWidth && current.h === element.clientHeight ? current : { w: element.clientWidth, h: element.clientHeight }));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        stageRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setStatus({ kind: 'loading' });
        setEdition(undefined);
        setLayout(undefined);
        loadEdition(resolved, controller.signal).then(result => {
            if (controller.signal.aborted) return;
            setEdition(result);
            setStatus({ kind: 'binding' });
        }, (reason: unknown) => {
            if (controller.signal.aborted) return;
            setStatus({ kind: 'error', message: reason instanceof Error ? reason.message : 'This book could not be opened. Try again.' });
        });
        return () => controller.abort();
    }, [resolved, attempt]);

    // Typeset the book for the current page mode and type. The old pages stay up until the new ones are ready.
    useEffect(() => {
        if (!edition || !measured) return;
        let live = true;
        let timer = 0;
        void fontsReady().then(() => {
            if (!live) return;
            timer = window.setTimeout(() => {
                const box = (wantSpreads ? SPREAD : SINGLE).box;
                const paged = paginate({
                    flows: edition.flows,
                    spreads: wantSpreads,
                    metrics: { measure: measurer(type), width: box.w, height: box.h, size: type.size, line: type.line, smallLine: type.smallLine, titleLine: type.titleLine, labelLine: type.labelLine },
                });
                if (!live) return;
                const pos = posRef.current;
                dragRef.current = null;
                queueRef.current = null;
                setLayout({ paged, spreads: wantSpreads, type });
                setAt(pos < 0 ? (wantSpreads ? -2 : -1) : openingOf(findPage(paged.pages, pos), wantSpreads));
                setTurn(null);
                setStatus(current => (current.kind === 'binding' ? { kind: 'ready' } : current));
            }, 30);
        });
        return () => {
            live = false;
            window.clearTimeout(timer);
        };
    }, [edition, type, wantSpreads, measured]);

    const settle = useCallback((next: number) => {
        setAt(next);
        if (!layout || !edition) return;
        const pos = positionOf(layout, next);
        posRef.current = pos;
        if (pos >= 0) writeMark(edition.key, pos);
        setAnnounce(labelOf(layout, next).spoken);
    }, [layout, edition]);

    const go = useCallback((target: number, animate = true) => {
        if (!layout || turnRef.current?.drag) return;
        const current = turnRef.current;
        const base = current ? endOf(current) : atRef.current;
        target = clamp(target, closedAt, maxAt);
        if (target === base) {
            if (current) {
                setTurn(null);
                settle(base);
            }
            return;
        }
        if (!animate || reduced) {
            queueRef.current = null;
            setTurn(null);
            settle(target);
            return;
        }
        // A closed book opens at the cover first, then turns to the page.
        if (base === closedAt && target > 0) {
            queueRef.current = target;
            target = 0;
        }
        const forward = target > base;
        setAt(base);
        setTurn({ a: forward ? base : target, b: forward ? target : base, from: forward ? 0 : 1, to: forward ? 1 : 0, drag: false });
    }, [layout, closedAt, maxAt, reduced, settle]);

    const step = (direction: 1 | -1) => (spreads ? 2 : 1) * direction;
    const navigate = (target: number, animate = true) => {
        queueRef.current = null;
        go(target, animate);
    };
    const next = () => navigate(settled + step(1));
    const prev = () => navigate(settled + step(-1));

    const goRef = useRef(go);
    goRef.current = go;
    const spreadsRef = useRef(spreads);
    spreadsRef.current = spreads;
    const jump = useCallback((page: number) => {
        queueRef.current = null;
        goRef.current(openingOf(page, spreadsRef.current));
    }, []);

    const finish = () => {
        const current = turnRef.current;
        if (!current) return;
        const end = endOf(current);
        const queued = queueRef.current;
        queueRef.current = null;
        setTurn(null);
        if (queued !== null && end === 0) {
            // Keep the saved bookmark until the book reaches it.
            setAt(0);
            go(queued);
            return;
        }
        settle(end);
    };
    const finishRef = useRef(finish);
    finishRef.current = finish;

    useLayoutEffect(() => {
        const book = bookRef.current;
        if (!book) return;
        book.getAnimations().forEach(animation => animation.cancel());
        if (!turn) {
            book.style.setProperty('--turn', '0');
            return;
        }
        book.style.setProperty('--turn', String(turn.from));
        if (turn.drag) return;
        if (reduced || turn.from === turn.to) {
            finishRef.current();
            return;
        }
        const animation = book.animate([{ '--turn': turn.from }, { '--turn': turn.to }], {
            duration: Math.max(140, 560 * Math.abs(turn.to - turn.from)),
            easing: 'cubic-bezier(.45, .05, .25, 1)',
            fill: 'forwards',
        });
        animation.onfinish = () => finishRef.current();
        return () => {
            animation.onfinish = null;
        };
    }, [turn, reduced]);

    // Open the cover shortly after the book is bound, then turn to the bookmark.
    useEffect(() => {
        if (!layout || !edition || openedRef.current) return;
        const timer = window.setTimeout(() => {
            openedRef.current = true;
            const mark = readMark(edition.key);
            goRef.current(mark > 0 ? openingOf(findPage(layout.paged.pages, mark), layout.spreads) : 0);
        }, 350);
        return () => window.clearTimeout(timer);
    }, [layout, edition]);

    useEffect(() => {
        if (!menu) return;
        const close = (event: globalThis.PointerEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
        };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [menu]);

    const choose = (next: TypeSettings) => {
        setSettings(next);
        saveType(next);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape' && menu) {
            event.preventDefault();
            event.stopPropagation();
            setMenu(false);
            menuButtonRef.current?.focus();
            return;
        }
        if (!ready || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target as HTMLElement;
        if (target.closest('button, a, input, select, textarea')) return;
        switch (event.key) {
            case 'ArrowRight':
            case 'PageDown':
                next();
                break;
            case 'ArrowLeft':
            case 'PageUp':
                prev();
                break;
            case ' ':
                if (event.shiftKey) prev();
                else next();
                break;
            case 'Home':
                navigate(0);
                break;
            case 'End':
                navigate(maxAt);
                break;
            default:
                return;
        }
        event.preventDefault();
    };

    const scalerRef = useRef<HTMLDivElement>(null);
    const onPointerDown = (event: PointerEvent<HTMLElement>) => {
        const book = bookRef.current;
        const target = event.target as HTMLElement;
        if (!ready || !book || event.button !== 0 || turnRef.current?.drag) return;
        if (!scalerRef.current?.contains(target) || target.closest('a, button, input')) return;
        const rect = book.getBoundingClientRect();
        dragRef.current = { id: event.pointerId, x: event.clientX, spine: spreads ? rect.left + rect.width / 2 : rect.left, width: rect.width / (spreads ? 2 : 1), started: false, forward: true, reach: 1, t: 0 };
    };

    const onPointerMove = (event: PointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        const book = bookRef.current;
        if (!drag || drag.id !== event.pointerId || !book) return;
        const dx = event.clientX - drag.x;
        if (!drag.started) {
            if (Math.abs(dx) < 6) return;
            const current = turnRef.current;
            const base = current ? endOf(current) : atRef.current;
            const forward = spreads ? drag.x > drag.spine : dx < 0;
            const target = clamp(base + step(forward ? 1 : -1), closedAt, maxAt);
            if (target === base) {
                dragRef.current = null;
                return;
            }
            queueRef.current = null;
            drag.started = true;
            drag.forward = forward;
            const offset = drag.x - drag.spine;
            drag.reach = Math.max(Math.abs(offset), drag.width * 0.25);
            drag.t = forward ? 0 : 1;
            event.currentTarget.setPointerCapture(event.pointerId);
            setAt(base);
            setTurn({ a: forward ? base : target, b: forward ? target : base, from: drag.t, to: drag.t, drag: true });
            return;
        }
        drag.t = spreads
            ? Math.acos(clamp((event.clientX - drag.spine) / drag.reach, -1, 1)) / Math.PI
            : drag.forward ? clamp(-dx / (drag.width * 0.85), 0, 1) : clamp(1 - dx / (drag.width * 0.85), 0, 1);
        book.style.setProperty('--turn', String(drag.t));
    };

    const release = (event: PointerEvent<HTMLElement>, cancelled: boolean) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        dragRef.current = null;
        if (!drag.started) {
            if (cancelled) return;
            const book = bookRef.current?.getBoundingClientRect();
            if (!book) return;
            const forward = spreads ? event.clientX > drag.spine : event.clientX - book.left > book.width * 0.33;
            if (forward) next();
            else prev();
            return;
        }
        const t = drag.t;
        const done = !cancelled && (spreads ? (drag.forward ? t > 1 / 3 : t < 2 / 3) : drag.forward ? t > 0.22 : t < 0.78);
        const to = drag.forward === done ? 1 : 0;
        setTurn(current => current && { ...current, from: t, to, drag: false });
    };

    const pageAt = (index: number): FaceContent => {
        if (index < -1) return 'none';
        if (index === -1) return 'cover';
        if (!layout || index >= len) return 'end';
        return index;
    };
    const sideOf = (index: number): Side => (spreads && index >= 0 && index % 2 === 0 ? 'verso' : 'recto');

    const volume = useMemo<Volume>(() => ({ binding, edition, paged: layout?.paged, geometry, spreads, jump }), [binding, edition, layout, geometry, spreads, jump]);

    let left: FaceContent = 'none';
    let right: FaceContent;
    let leaf: { front: FaceContent; back: FaceContent; board: boolean } | null = null;
    if (spreads) {
        left = pageAt(turn ? turn.a : shown);
        right = pageAt(turn ? turn.b + 1 : shown + 1);
        if (turn) leaf = { front: pageAt(turn.a + 1), back: pageAt(turn.b), board: turn.a === closedAt };
    } else {
        right = pageAt(turn ? turn.b : shown);
        if (turn) leaf = { front: pageAt(turn.a), back: turn.a === closedAt ? 'inside' : 'paper', board: turn.a === closedAt };
    }
    const cover = turn ? (turn.a === closedAt ? 'turning' : 'open') : shown === closedAt ? 'closed' : 'open';
    const progress = len ? clamp((settled + 1) / len, 0, 1) : 0;
    const curl = ready && !turn && shown >= 0;

    const t = layout?.type ?? type;
    const bookWidth = spreads ? geometry.page.w * 2 : geometry.page.w;
    const outerWidth = spreads ? bookWidth + OVERHANG * 2 : bookWidth + OVERHANG + SPINE;
    const outerHeight = geometry.page.h + OVERHANG * 2;
    const scale = measured ? Math.max(0.2, Math.min((stage.w - 24) / outerWidth, (stage.h - 24) / outerHeight, 1.3)) : 1;
    const vars = {
        '--book-cloth': css(binding.cloth),
        '--book-foil': css(binding.ink),
        '--book-label': css(binding.label),
        '--book-accent': css(binding.accent),
        '--weave': `url(${weave().url})`,
        '--grain': `url(${grain().url})`,
        '--marble': `url(${marble().url})`,
        '--desk': `url(${wood('walnut').url})`,
        '--f-body': t.fonts.body,
        '--f-small': t.fonts.small,
        '--f-title': t.fonts.title,
        '--f-label': t.fonts.label,
        '--f-cap': t.fonts.cap,
        '--f-fine': t.fine,
        '--title-size': `${t.title}px`,
        '--pw': `${geometry.page.w}px`,
        '--ph': `${geometry.page.h}px`,
    } as CSSProperties;

    const label = labelOf(layout, settled);
    const contentsPage = layout?.paged.flows.contents;
    const statusText = status.kind === 'loading'
        ? resolved.kind === 'local' ? 'Taking the book down from the shelf…' : 'Looking for a copy you can read…'
        : status.kind === 'binding' ? 'Binding the pages…' : '';

    return (
        <div className="reader" style={vars} onKeyDown={onKeyDown}>
            <header className="reader-bar">
                <button type="button" className="reader-back" onClick={onBack}>{backLabel}</button>
                <h2 id="reader-title" className="reader-title">
                    {binding.title}<span className="reader-author"> · {binding.author}</span>
                </h2>
                <div className="reader-tools">
                    <button type="button" disabled={!ready || contentsPage === undefined} onClick={() => contentsPage !== undefined && jump(contentsPage)}>Contents</button>
                    <div className="type-control" ref={menuRef}>
                        <button
                            ref={menuButtonRef}
                            type="button"
                            className="type-toggle"
                            aria-expanded={menu}
                            aria-controls="reader-type-menu"
                            onClick={() => setMenu(open => !open)}
                        >
                            Aa<span className="library-sr"> text settings</span>
                        </button>
                        {menu && (
                            <div id="reader-type-menu" className="type-menu">
                                <p id="type-size-label">Text size</p>
                                <div className="type-choices" role="group" aria-labelledby="type-size-label">
                                    {SIZE_NAMES.map((name, size) => (
                                        <button key={name} type="button" aria-pressed={settings.size === size} onClick={() => choose({ ...settings, size: size as TypeSettings['size'] })}>{name}</button>
                                    ))}
                                </div>
                                <p id="type-face-label">Typeface</p>
                                <div className="type-choices" role="group" aria-labelledby="type-face-label">
                                    {(['pixel', 'book'] as const).map(face => (
                                        <button key={face} type="button" aria-pressed={settings.face === face} onClick={() => choose({ ...settings, face })}>{FACE_NAMES[face]}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button type="button" className="library-close" aria-label="Close library books" onClick={onClose}>
                        <span aria-hidden="true">×</span>
                    </button>
                </div>
            </header>

            <section
                ref={stageRef}
                className="reader-stage"
                tabIndex={0}
                aria-label={`Open book: ${binding.title}`}
                aria-busy={!ready}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={event => release(event, false)}
                onPointerCancel={event => release(event, true)}
            >
                <div ref={scalerRef} className="book-scaler" style={{ width: outerWidth, height: outerHeight, transform: `translate(-50%, -50%) scale(${scale})` }}>
                    <div
                        ref={bookRef}
                        className={`book ${spreads ? 'book-spread' : 'book-single'}`}
                        data-cover={cover}
                        data-turning={turn ? '' : undefined}
                        data-ready={ready ? '' : undefined}
                        style={{ left: spreads ? OVERHANG : SPINE, top: OVERHANG, width: bookWidth, height: geometry.page.h, '--half': `${geometry.page.w / 2}px` } as CSSProperties}
                    >
                        <div className="board board-back" />
                        {spreads && <div className="board board-front" />}
                        {spreads && <div className="edges edges-left" style={{ width: Math.round(1 + progress * 7) }} />}
                        <div className="edges edges-right" style={{ width: Math.round(1 + (1 - progress) * 7) }} />
                        {spreads && (
                            <div className="slot slot-left">
                                <Face volume={volume} content={left} side={sideOf(turn ? turn.a : shown)} />
                                {curl && shown > 0 && <span className="curl curl-left" />}
                            </div>
                        )}
                        <div className="slot slot-right">
                            <Face volume={volume} content={right} side="recto" />
                            {curl && shown < maxAt && <span className="curl curl-right" />}
                        </div>
                        {leaf && turn && (
                            <div className="leaf" inert>
                                <div className="leaf-face leaf-front"><Face volume={volume} content={leaf.front} side="recto" /></div>
                                <div className="leaf-face leaf-back"><Face volume={volume} content={leaf.back} side="verso" board={leaf.board} /></div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <footer className="reader-foot">
                <button type="button" className="reader-turn" disabled={!ready || settled <= closedAt} onClick={prev}>
                    <span aria-hidden="true">‹ </span>Previous<span className="reader-turn-word"> page</span>
                </button>
                {status.kind === 'error' ? (
                    <div className="reader-status reader-error">
                        <p role="alert">{status.message}</p>
                        <button type="button" onClick={() => setAttempt(count => count + 1)}>Try again</button>
                    </div>
                ) : ready ? (
                    <div className="reader-progress">
                        <input
                            type="range"
                            aria-label="Turn to page"
                            min={closedAt}
                            max={maxAt}
                            step={spreads ? 2 : 1}
                            value={settled}
                            aria-valuetext={label.spoken}
                            onChange={event => navigate(Number(event.target.value), false)}
                        />
                        <span className="reader-page" aria-hidden="true">{label.short}</span>
                    </div>
                ) : (
                    <p className="reader-status">{statusText}</p>
                )}
                <button type="button" className="reader-turn" disabled={!ready || settled >= maxAt} onClick={next}>
                    Next<span className="reader-turn-word"> page</span><span aria-hidden="true"> ›</span>
                </button>
                <p className="library-sr" aria-live="polite">{announce}</p>
            </footer>
        </div>
    );
}
