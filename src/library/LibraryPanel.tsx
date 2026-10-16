/** The Tower Library's reading room: its bookcase and card catalog, and the book the reader has taken down. */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from 'react';
import './library.css';
import { weave, wood } from './art';
import { BookReader } from './BookReader';
import { booksOn, type ShelfId } from './books';
import type { LibraryView } from './bridge';
import { CatalogView } from './CatalogView';
import type { Source } from './edition';
import { ShelfView } from './ShelfView';

type Props = {
    view: LibraryView;
    onView: (view: LibraryView) => void;
    onClose: () => void;
};

type Reading = { source: Source; key: string };

const readingKey = (source: Source) => (source.kind === 'local' ? `pg:${source.book.id}` : `ol:${source.book.key}`);

export function LibraryPanel({ view, onView, onClose }: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [reading, setReading] = useState<Reading | null>(null);
    const lastShelf = useRef<ShelfId>(view.kind === 'shelf' ? view.shelf : 'classics');
    if (view.kind === 'shelf') lastShelf.current = view.shelf;
    const returnTo = useRef<string | null>(null);
    const escapedAt = useRef(-Infinity);

    useEffect(() => {
        const node = dialog.current;
        if (!node) return;
        if (!node.open) node.showModal();
        const first = view.kind === 'shelf' ? `spine-${booksOn(view.shelf)[0].id}` : 'book-query';
        document.getElementById(first)?.focus();
        // Opens once per visit to the room; App unmounts the panel to close it.
    }, []);

    // Putting a book back returns focus to its spine or catalog card.
    useEffect(() => {
        if (reading || !returnTo.current) return;
        document.getElementById(returnTo.current)?.focus();
        returnTo.current = null;
    }, [reading]);

    const open = (source: Source, returnId: string) => {
        returnTo.current = returnId;
        setReading({ source, key: readingKey(source) });
    };
    const back = () => {
        if (reading) setReading(null);
        else onClose();
    };
    const keyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        escapedAt.current = performance.now();
        back();
    };
    // Escape is handled on keydown so it steps back one level; other close requests (like a phone's back gesture) do the same.
    const cancel = (event: SyntheticEvent<HTMLDialogElement>) => {
        event.preventDefault();
        if (performance.now() - escapedAt.current > 50) back();
    };

    const style = {
        '--weave': `url(${weave().url})`,
        '--walnut': `url(${wood('walnut').url})`,
        '--oak': `url(${wood('oak').url})`,
    } as CSSProperties;

    return (
        <dialog
            ref={dialog}
            className="library"
            style={style}
            aria-labelledby={reading ? 'reader-title' : 'library-title'}
            onKeyDown={keyDown}
            onCancel={cancel}
            onClose={onClose}
        >
            <header className="library-bar" hidden={!!reading}>
                <h2 id="library-title" className="library-title">Tower Library</h2>
                <nav className="library-rooms" aria-label="Library rooms">
                    <button type="button" aria-current={view.kind === 'shelf' ? 'page' : undefined} onClick={() => onView({ kind: 'shelf', shelf: lastShelf.current })}>Shelves</button>
                    <button type="button" aria-current={view.kind === 'catalog' ? 'page' : undefined} onClick={() => onView({ kind: 'catalog' })}>Card catalog</button>
                </nav>
                <button type="button" className="library-close" aria-label="Close library books" onClick={onClose}>
                    Close <span aria-hidden="true">×</span>
                </button>
            </header>

            <ShelfView
                shelf={view.kind === 'shelf' ? view.shelf : lastShelf.current}
                hidden={!!reading || view.kind !== 'shelf'}
                onOpen={(book, returnId) => open({ kind: 'local', book }, returnId)}
            />
            <CatalogView
                hidden={!!reading || view.kind !== 'catalog'}
                onOpen={(book, returnId) => open({ kind: 'catalog', book }, returnId)}
            />
            {reading && (
                <BookReader
                    key={reading.key}
                    source={reading.source}
                    backLabel={view.kind === 'catalog' ? 'Back to results' : 'Back to shelves'}
                    onBack={() => setReading(null)}
                    onClose={onClose}
                />
            )}
        </dialog>
    );
}
