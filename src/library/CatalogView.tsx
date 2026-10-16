/** The card catalog: real-book search over Open Library, where every result can be taken down and opened as a book. */
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { archiveCandidates } from './archive';
import { css } from './art';
import { coverUrl, searchCatalog, type CatalogBook, type SearchPage } from './catalog';
import { bindingFor } from './color';
import { authorsOf, localMatch } from './edition';

type Props = {
    hidden: boolean;
    onOpen: (book: CatalogBook, returnId: string) => void;
};

const PER_PAGE = 12;
const SUGGESTIONS = ['Jane Austen', 'Moby Dick', 'Frederick Douglass', 'Ursula K. Le Guin'];
const DRAWERS = ['A–C', 'D–F', 'G–I', 'J–L', 'M–O', 'P–R', 'S–U', 'V–Z'];

/** The catalog stays where the reader left it when they put a book back or leave the room. */
const memory = { query: '', submitted: '', page: 1 };

type Stamp = { text: string; tone: 'forest' | 'blue' | 'wine' | 'plum' | 'earth'; meaning: string };

/** What happens when this card is opened, stamped honestly on the card. */
function stampFor(book: CatalogBook): Stamp {
    if (localMatch(book)) return { text: 'On our shelf', tone: 'forest', meaning: 'Opens the full text from the Tower Library shelves.' };
    if (archiveCandidates(book).length) return { text: 'Read here', tone: 'blue', meaning: 'Public domain. Opens the full text from the Internet Archive.' };
    if (book.access === 'public') return { text: 'Read online', tone: 'wine', meaning: 'Opens a catalog record with a link to read it free online.' };
    if (book.access === 'borrowable') return { text: 'Borrow', tone: 'plum', meaning: 'Opens a catalog record with a link to borrow it.' };
    return { text: 'Catalog only', tone: 'earth', meaning: 'Opens a catalog record.' };
}

function failure(cause: unknown) {
    if (cause instanceof DOMException && cause.name === 'TimeoutError') return 'Open Library took too long to respond. Try again.';
    if (cause instanceof TypeError) return 'Cannot reach Open Library. Check your connection and try again.';
    return cause instanceof Error && cause.message ? cause.message : 'Book search failed. Try again.';
}

const initial = (title: string) => (title.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
const domId = (key: string) => `result-${key.split('/').at(-1)}`;

function Cover({ book }: { book: CatalogBook }) {
    const [failed, setFailed] = useState(false);
    if (book.cover && !failed) {
        return <img className="result-plate" src={coverUrl(book.cover, 'M')} width={56} height={84} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
    }
    const { cloth, ink } = bindingFor(book.key);
    return <span className="mini-book" style={{ '--cloth': css(cloth), '--foil': css(ink) } as CSSProperties}>{initial(book.title)}</span>;
}

export function CatalogView({ hidden, onOpen }: Props) {
    const [query, setQuery] = useState(memory.query);
    const [submitted, setSubmitted] = useState(memory.submitted);
    const [page, setPage] = useState(memory.page);
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<SearchPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hint, setHint] = useState('');
    const room = useRef<HTMLDivElement>(null);
    const status = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const retry = useRef<HTMLButtonElement>(null);
    const scrollOnLoad = useRef(false);

    useEffect(() => { memory.query = query; }, [query]);
    useEffect(() => { memory.submitted = submitted; memory.page = page; }, [submitted, page]);

    useEffect(() => {
        if (!submitted) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        searchCatalog(submitted, page, controller.signal).then(found => {
            if (controller.signal.aborted) return;
            setResult(found);
            setLoading(false);
        }, (cause: unknown) => {
            if (controller.signal.aborted) return;
            setResult(null);
            setLoading(false);
            setError(failure(cause));
        });
        return () => controller.abort();
    }, [submitted, page, attempt]);

    useEffect(() => {
        if (loading || !scrollOnLoad.current) return;
        scrollOnLoad.current = false;
        const box = room.current, line = status.current;
        if (box && line) box.scrollTop += line.getBoundingClientRect().top - box.getBoundingClientRect().top - 12;
    }, [loading]);

    // A failed page removes the results the reader was focused on; hand focus to the retry button instead of losing it.
    useEffect(() => {
        if (error && (!document.activeElement || document.activeElement === document.body)) retry.current?.focus();
    }, [error]);

    const search = (text: string) => {
        const terms = text.trim().replace(/\s+/g, ' ');
        if (!terms) {
            setHint('Enter a title, author, or keyword to search.');
            input.current?.focus();
            return;
        }
        setHint('');
        setSubmitted(terms);
        setPage(1);
        setAttempt(count => count + 1);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        search(query);
    };
    const suggest = (text: string) => {
        setQuery(text);
        search(text);
    };
    const turn = (next: number) => {
        scrollOnLoad.current = true;
        setPage(next);
    };

    const pages = result ? Math.max(1, Math.ceil(result.total / PER_PAGE)) : 1;
    const atStart = page <= 1;
    const atEnd = !result || page * PER_PAGE >= result.total;
    const summary = hint
        || (loading ? 'Searching Open Library…'
            : error || !result ? ''
                : result.total === 0 ? `No books found for “${submitted}”. Try another title or author.`
                    : `${result.total.toLocaleString()} ${result.total === 1 ? 'result' : 'results'} for “${submitted}” · Page ${page} of ${pages.toLocaleString()}`);

    return (
        <div className="catalog-room" ref={room} hidden={hidden}>
            <div className="cabinet" aria-hidden="true">
                {DRAWERS.map(drawer => (
                    <span key={drawer} className="drawer">
                        <span className="drawer-label">{drawer}</span>
                        <span className="drawer-pull" />
                    </span>
                ))}
            </div>

            <section className="slip" aria-labelledby="catalog-title">
                <h3 id="catalog-title" className="slip-title">Card catalog</h3>
                <form role="search" className="search" onSubmit={submit}>
                    <label htmlFor="book-query">Search Open Library by title, author, or keyword</label>
                    <div className="search-row">
                        <input
                            ref={input}
                            id="book-query"
                            type="search"
                            value={query}
                            maxLength={160}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="Moby Dick, Toni Morrison, sea stories…"
                            onChange={event => setQuery(event.target.value)}
                        />
                        <button type="submit" className="search-go">Search</button>
                    </div>
                </form>
                <p className="slip-rights">
                    Search includes books still under copyright. Only public-domain texts open in full here; other books open as catalog records with links to read or borrow elsewhere. Catalog data from <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library (new tab)</a>.
                </p>
            </section>

            <div className="catalog-status" ref={status}>
                <p role="status" className="catalog-summary">{summary}</p>
                {error && (
                    <div role="alert" className="catalog-error">
                        <p>{error}</p>
                        <button ref={retry} type="button" onClick={() => setAttempt(count => count + 1)}>Try again</button>
                    </div>
                )}
            </div>

            {!submitted && (
                <div className="catalog-empty">
                    <p>Every card is a real, published book. Try one of these:</p>
                    <ul className="suggestions">
                        {SUGGESTIONS.map(text => <li key={text}><button type="button" onClick={() => suggest(text)}>{text}</button></li>)}
                    </ul>
                </div>
            )}

            {result && result.books.length > 0 && (
                <ul className="results" aria-busy={loading} aria-label="Search results">
                    {result.books.map(book => {
                        const stamp = stampFor(book);
                        const id = domId(book.key);
                        const by = `${authorsOf(book)}${book.year ? ` · ${book.year}` : ''}`;
                        return (
                            <li key={book.key}>
                                <button
                                    type="button"
                                    id={id}
                                    className="result"
                                    aria-label={`${book.title} by ${authorsOf(book)}${book.year ? `, ${book.year}` : ''}. ${stamp.text}.`}
                                    aria-describedby={`${id}-note`}
                                    onClick={() => onOpen(book, id)}
                                >
                                    <span className="result-cover"><Cover book={book} /></span>
                                    <span className="result-text">
                                        <span className="result-title">{book.title}</span>
                                        <span className="result-by">{by}</span>
                                        <span className={`stamp stamp-${stamp.tone}`}>{stamp.text}</span>
                                    </span>
                                </button>
                                <span id={`${id}-note`} hidden>{stamp.meaning}</span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {result && result.total > PER_PAGE && (
                <nav className="pager" aria-label="Search result pages">
                    <button type="button" aria-disabled={atStart} onClick={() => !atStart && turn(page - 1)}>‹ Previous</button>
                    <span className="pager-page">Page {page} of {pages.toLocaleString()}</span>
                    <button type="button" aria-disabled={atEnd} onClick={() => !atEnd && turn(page + 1)}>Next ›</button>
                </nav>
            )}
        </div>
    );
}
