/** The library's bookcase: three bays of real books with their titles on the spines, and a catalog card for the book in hand. */
import { useEffect, useState, type CSSProperties } from 'react';
import { hashString } from '../game/kit/noise';
import { css, emblem, prop, type PropName } from './art';
import { booksOn, shelves, type FeaturedBook, type ShelfId } from './books';
import { labelFor } from './color';

type Props = {
    /** The bay the player walked up to; its first book starts on the catalog card. */
    shelf: ShelfId;
    hidden: boolean;
    onOpen: (book: FeaturedBook, returnId: string) => void;
};

const PROPS: Record<ShelfId, PropName> = { classics: 'candle', adventure: 'globe', mystery: 'hourglass' };

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
const surname = (author: string) => author.split(' ').at(-1) ?? author;

/** Catalog heading order: "Austen, Jane." */
function heading(author: string) {
    const names = author.split(' ');
    const last = names.pop() ?? author;
    return names.length ? `${last}, ${sentence(names.join(' '))}` : sentence(last);
}

/** Cloth, lettering, and a stable size for each spine, so the shelf looks hand-filled rather than stamped out. */
function spineStyle(book: FeaturedBook): CSSProperties {
    const hash = hashString(book.id);
    return {
        '--cloth': css(book.cloth),
        '--foil': css(book.ink),
        '--label': css(labelFor(book.cloth, book.ink)),
        '--w': `${(book.spine.length > 1 ? 50 : 40) + (hash % 4) * 2}px`,
        '--h': `${256 + ((hash >>> 3) % 6) * 8}px`,
    } as CSSProperties;
}

export function ShelfView({ shelf, hidden, onOpen }: Props) {
    const [card, setCard] = useState(() => booksOn(shelf)[0]);
    useEffect(() => setCard(booksOn(shelf)[0]), [shelf]);
    const bookend = prop('bookend');

    return (
        <div className="shelf-room" hidden={hidden}>
            <div className="shelf-layout">
                <div className="case">
                    <div className="case-cornice" aria-hidden="true" />
                    <div className="case-bays">
                        {shelves.map(bay => {
                            const ornament = prop(PROPS[bay.id]);
                            return (
                                <section key={bay.id} className="bay" aria-labelledby={`plaque-${bay.id}`}>
                                    <h3 id={`plaque-${bay.id}`} className="plaque">{bay.name}</h3>
                                    <p className="bay-note">{bay.note}</p>
                                    <div className="shelf">
                                        <ul className="spines">
                                            {booksOn(bay.id).map(book => (
                                                <li key={book.id}>
                                                    <button
                                                        type="button"
                                                        id={`spine-${book.id}`}
                                                        className="spine"
                                                        style={spineStyle(book)}
                                                        aria-label={`${book.title} by ${book.author}`}
                                                        aria-describedby={`spine-note-${book.id}`}
                                                        onPointerEnter={() => setCard(book)}
                                                        onFocus={() => setCard(book)}
                                                        onClick={() => onOpen(book, `spine-${book.id}`)}
                                                    >
                                                        <span className="spine-band spine-head" />
                                                        <span className="spine-label">
                                                            {book.spine.map(line => <span key={line} className="spine-line">{line}</span>)}
                                                        </span>
                                                        <img className="spine-emblem" src={emblem(book.emblem, book.ink).url} width={22} height={22} alt="" />
                                                        <span className="spine-author">{surname(book.author)}</span>
                                                        <span className="spine-band spine-tail" />
                                                    </button>
                                                    <span id={`spine-note-${book.id}`} hidden>{`${book.year}. ${book.blurb}`}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <img className="shelf-bookend" src={bookend.url} width={bookend.w * 2} height={bookend.h * 2} alt="" />
                                        <img className="shelf-prop" src={ornament.url} width={ornament.w * 2} height={ornament.h * 2} alt="" />
                                    </div>
                                    <div className="plank" aria-hidden="true" />
                                </section>
                            );
                        })}
                    </div>
                    <div className="case-plinth" aria-hidden="true" />
                </div>

                <aside className="index-card" aria-label="Catalog card">
                    <div className="card-main">
                        <p className="card-call">Gutenberg #{card.id}</p>
                        <p className="card-head">{heading(card.author)}</p>
                        <p className="card-entry"><cite>{card.title}</cite> / {sentence(card.author)} — {card.year}.</p>
                    </div>
                    <div className="card-notes">
                        <p className="card-blurb">{card.blurb}</p>
                        <p className="card-rights">Public domain in the USA · Full text on this shelf</p>
                        <p className="card-hint">Pick a book to take it down. Turn pages with ← → or drag a corner.</p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
