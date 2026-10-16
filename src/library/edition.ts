/**
 * Binds a book for the paged reader: its cloth, title page, colophon, and the flows of text the paginator lays out.
 * Public-domain texts become full editions; any other catalog result becomes a short catalog record that links out.
 */
import type { ColorName } from '../game/kit/palette.ts';
import { archiveItemUrl, type ArchiveText } from './archive.ts';
import { books, GUTENBERG_LICENSE, GUTENBERG_NOTICE, gutenbergPage, type Emblem, type FeaturedBook } from './books.ts';
import { workUrl, type CatalogBook, type WorkDetails } from './catalog.ts';
import { accentOn, bindingFor, labelFor } from './color.ts';
import type { Flow, LayoutBlock } from './paginate.ts';
import type { ParsedText } from './text.ts';

export type Source = { kind: 'local'; book: FeaturedBook } | { kind: 'catalog'; book: CatalogBook };

/** What the closed book looks like, known before its text arrives. */
export type Binding = {
    title: string;
    author: string;
    year?: number;
    cloth: ColorName;
    ink: ColorName;
    /** Leather label behind the title on spines. */
    label: ColorName;
    /** Chapter labels and ornaments on the page. */
    accent: ColorName;
    emblem?: Emblem;
    /** Open Library cover image id, shown as a plate on the cloth. */
    cover?: number;
};

export type Link = { text: string; href: string };

export type Edition = Binding & {
    /** Bookmark key. */
    key: string;
    kind: 'local' | 'archive' | 'record';
    /** Publisher line on the title page. */
    imprint: string;
    colophon: { lines: string[]; notice?: string; links: Link[] };
    flows: Flow[];
};

export const authorsOf = (book: CatalogBook) => book.authors.slice(0, 2).join(' & ') || 'Author not listed';

/** The shelf copy of a catalog work, when the Tower Library owns one of its Gutenberg eBooks. */
export function localMatch(book: Pick<CatalogBook, 'gutenberg'>): FeaturedBook | undefined {
    const ids = new Set(book.gutenberg.map(id => String(Number(id))));
    return books.find(featured => ids.has(featured.id));
}

/** Catalog results that match a shelf book open the shelf copy. */
export function resolveSource(source: Source): Source {
    if (source.kind === 'catalog') {
        const local = localMatch(source.book);
        if (local) return { kind: 'local', book: local };
    }
    return source;
}

export function bindingOf(source: Source): Binding {
    if (source.kind === 'local') {
        const { title, author, year, cloth, ink, emblem } = source.book;
        return { title, author, year, cloth, ink, label: labelFor(cloth, ink), accent: accentOn(cloth, ink), emblem };
    }
    const book = source.book;
    const { cloth, ink } = bindingFor(book.key);
    return { title: book.title, author: authorsOf(book), year: book.year, cloth, ink, label: labelFor(cloth, ink), accent: accentOn(cloth, ink), cover: book.cover };
}

const released = (parsed: ParsedText) => parsed.meta.released?.split(' [')[0].trim();
const newTab = (text: string, href: string): Link => ({ text: `${text} (new tab)`, href });

/** Contents, the book, then Gutenberg's own front matter and license, which every copy must keep. */
export function textFlows(parsed: ParsedText, title: string): Flow[] {
    const flows: Flow[] = [
        { id: 'contents', head: 'Contents', blocks: [], opener: { label: 'Contents' }, contents: true },
        { id: 'body', head: title, blocks: parsed.body, chapters: true, recto: true, numbered: true },
        { id: 'about', head: 'About this eBook', blocks: parsed.front, opener: { label: 'About this eBook' }, toc: 'About this eBook', small: true },
        { id: 'license', head: 'The Project Gutenberg License', blocks: parsed.back, opener: { label: 'License', title: 'The Project Gutenberg License' }, toc: 'License', small: true },
    ];
    return flows.filter(flow => flow.contents || flow.blocks.length);
}

export function localEdition(book: FeaturedBook, parsed: ParsedText): Edition {
    const date = released(parsed);
    return {
        ...bindingOf({ kind: 'local', book }),
        key: `pg:${book.id}`,
        kind: 'local',
        imprint: `Project Gutenberg · eBook #${book.id}`,
        colophon: {
            lines: [`Project Gutenberg eBook #${book.id}`, ...(date ? [`Released ${date}`] : []), 'Public domain in the USA.'],
            notice: GUTENBERG_NOTICE,
            links: [newTab('This eBook on Project Gutenberg', gutenbergPage(book.id)), newTab('Project Gutenberg License', GUTENBERG_LICENSE)],
        },
        flows: textFlows(parsed, book.title),
    };
}

export function archiveEdition(book: CatalogBook, text: ArchiveText): Edition {
    const date = released(text.parsed);
    return {
        ...bindingOf({ kind: 'catalog', book }),
        key: `pg:${text.gutenberg}`,
        kind: 'archive',
        imprint: 'Internet Archive · Gutenberg mirror',
        colophon: {
            lines: [
                `Project Gutenberg eBook #${text.gutenberg}`,
                ...(date ? [`Released ${date}`] : []),
                `Text from the Internet Archive’s Gutenberg mirror, item ${text.id}.`,
                'Public domain in the USA.',
            ],
            notice: GUTENBERG_NOTICE,
            links: [
                newTab('This copy on the Internet Archive', archiveItemUrl(text.id)),
                newTab('This eBook on Project Gutenberg', gutenbergPage(text.gutenberg)),
                newTab('Project Gutenberg License', GUTENBERG_LICENSE),
            ],
        },
        flows: textFlows(text.parsed, book.title),
    };
}

const ACCESS: Record<CatalogBook['access'], string> = {
    public: 'Open Library lists a free digital edition of this work. You can read it online through Open Library and the Internet Archive.',
    borrowable: 'Open Library lists editions you can borrow from the Internet Archive’s lending library. Borrowing needs a free account and an available copy.',
    unknown: 'Open Library lists no free digital edition of this work. Look for it at your local library or bookshop.',
};

/** A slim volume for books we cannot print: what the catalog knows and where the book can be read. */
export function recordEdition(book: CatalogBook, details?: WorkDetails, notice?: string): Edition {
    const para = (text: string): LayoutBlock => ({ type: 'para', text });
    const description = details?.description?.split(/\n\s*\n/).map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean) ?? [];
    const about: LayoutBlock[] = [
        ...(description.length ? description.map(para) : [para('Open Library has no description of this book yet.')]),
        ...(details?.subjects.length ? [para(`Subjects: ${details.subjects.slice(0, 8).join(', ')}.`)] : []),
        ...(book.year ? [para(`First published in ${book.year}.`)] : []),
    ];
    const id = book.key.split('/').pop() ?? book.key;
    const where: LayoutBlock[] = [
        para(ACCESS[book.access]),
        ...(notice ? [para(notice)] : []),
        { type: 'link', ...newTab('Open Library: record and editions', workUrl(book.key)) },
        ...book.ia.slice(0, 2).map((item): LayoutBlock => ({ type: 'link', ...newTab(`Internet Archive: ${item}`, archiveItemUrl(item)) })),
        ...book.gutenberg.slice(0, 2).map((ebook): LayoutBlock => ({ type: 'link', ...newTab(`Project Gutenberg eBook #${ebook}`, gutenbergPage(ebook)) })),
        para(book.gutenberg.length
            ? 'Project Gutenberg editions are public domain in the USA. Other editions may still be under copyright.'
            : 'This book may still be under copyright, so the Tower Library keeps only its catalog record. Catalog data comes from Open Library.'),
    ];
    return {
        ...bindingOf({ kind: 'catalog', book }),
        key: `ol:${book.key}`,
        kind: 'record',
        imprint: 'Open Library · catalog record',
        colophon: {
            lines: [`Open Library work ${id}`, 'This is a catalog record, not the book. Its full text is not available to read here.'],
            links: [newTab('This record on Open Library', workUrl(book.key))],
        },
        flows: [
            { id: 'contents', head: 'Contents', blocks: [], opener: { label: 'Contents' }, contents: true },
            { id: 'about', head: 'About this book', blocks: about, opener: { label: 'About this book' }, toc: 'About this book', numbered: true },
            { id: 'where', head: 'Where to read', blocks: where, opener: { label: 'Where to read' }, toc: 'Where to read' },
        ],
    };
}
