import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PALETTE } from '../src/game/kit/palette.ts';
import { archiveCandidates, archiveItemUrl, checkItem, decodeText, pickTextFile } from '../src/library/archive.ts';
import { bookById, books, booksOn, GUTENBERG_LICENSE, shelves } from '../src/library/books.ts';
import { LibraryBridge } from '../src/library/bridge.ts';
import { parseResults, parseWork, workUrl, type CatalogBook } from '../src/library/catalog.ts';
import { accentOn, BINDINGS, bindingFor, contrast, PAPER } from '../src/library/color.ts';
import { archiveEdition, authorsOf, localEdition, localMatch, recordEdition, resolveSource } from '../src/library/edition.ts';
import { findPage, paginate, plain, prepare, type Metrics, type Paged, type Style } from '../src/library/paginate.ts';
import { hasGutenbergStart, parseGutenberg, type Block } from '../src/library/text.ts';

type Box = { width: number; height: number };
const UNIT: Record<Style, number> = { body: 6, italic: 6, small: 5, smallItalic: 5, title: 9, titleItalic: 9, label: 7, cap: 28 };
const SPREAD: Box = { width: 356, height: 500 };
const SINGLE: Box = { width: 320, height: 480 };
const metrics = ({ width, height }: Box): Metrics => ({
    measure: (text, style) => Array.from(text).length * UNIT[style],
    width, height, size: 16, line: 24, smallLine: 20, titleLine: 30, labelLine: 18,
});

const texts = new Map(books.map(book => [book.id, parseGutenberg(readFileSync(new URL(`../public/books/${book.file}`, import.meta.url), 'utf8'))]));
const parsedOf = (id: string) => texts.get(id)!;

const squash = (text: string) => text.replace(/\s+/g, '');
function same(actual: string, expected: string, label: string) {
    if (actual === expected) return;
    let i = 0;
    while (i < actual.length && i < expected.length && actual[i] === expected[i]) i++;
    assert.fail(`${label}: text differs at ${i} of ${expected.length}: got ${JSON.stringify(actual.slice(i, i + 80))}, expected ${JSON.stringify(expected.slice(i, i + 80))}`);
}

/** What the reader should print for a run of blocks: every word of every paragraph and verse line. */
const printable = (blocks: Block[]) => squash(blocks.map(block =>
    block.type === 'para' ? plain(prepare(block.text))
        : block.type === 'verse' ? block.lines.map(line => plain(prepare(line.text))).join('')
            : '').join(''));

/** What the paginator actually set on a flow's pages. */
const printed = (paged: Paged, flow: string) => squash(paged.pages
    .filter(page => page.kind === 'text' && page.flow === flow)
    .flatMap(page => page.rows)
    .filter(row => row.kind === 'line' || row.kind === 'cap')
    .map(row => plain(row.text ?? ''))
    .join(''));

function checkLayout(paged: Paged, box: Box, spreads: boolean, label: string, numbered: string, recto: boolean) {
    const { pages, entries, flows } = paged;
    assert.deepEqual(pages.slice(0, spreads ? 3 : 2).map(page => page.kind), spreads ? ['endpaper', 'title', 'colophon'] : ['title', 'colophon'], `${label}: front pages`);
    let last = -Infinity;
    pages.forEach((page, index) => {
        if (page.kind === 'blank') return;
        assert.ok(page.pos >= last, `${label}: page ${index} is in reading order`);
        last = page.pos;
        assert.equal(pages[findPage(pages, page.pos)].pos, page.pos, `${label}: page ${index} can be found from its bookmark`);
        if (page.kind !== 'text') return;
        assert.ok(page.rows.length, `${label}: page ${index} has something on it`);
        for (const row of page.rows) {
            assert.ok(row.x >= -0.01 && row.x + row.w <= box.width + 0.01, `${label}: a ${row.kind} row on page ${index} fits across the page`);
            assert.ok(row.y >= -0.01 && row.y + row.h <= box.height + 0.5, `${label}: a ${row.kind} row on page ${index} fits down the page`);
            if (row.kind === 'line') {
                const width = Array.from(plain(row.text ?? '')).length * (row.small ? UNIT.small : UNIT.body);
                assert.ok(width <= row.w + 0.01, `${label}: line "${plain(row.text ?? '')}" on page ${index} fits its measure`);
            }
        }
    });
    if (spreads && recto) assert.equal(flows[numbered] % 2, 1, `${label}: the text starts on a right-hand page`);
    assert.equal(pages[flows[numbered]].folio, '1', `${label}: numbering starts at 1`);
    assert.ok(entries.length > 0, `${label}: has contents`);
    for (const entry of entries) {
        assert.equal(pages[entry.page]?.kind, 'text', `${label}: contents entry "${entry.text}" points at a page`);
        assert.ok(entry.folio && entry.folio === pages[entry.page].folio, `${label}: contents entry "${entry.text}" shows its page number`);
    }
    const rows = pages.flatMap(page => page.rows).filter(row => row.kind === 'toc');
    assert.equal(rows.length, entries.length, `${label}: every entry is listed`);
    for (const row of rows) assert.equal(row.target, entries[row.entry!].page, `${label}: contents rows turn to their page`);
}

const catalogBook = (patch: Partial<CatalogBook> = {}): CatalogBook => ({
    key: '/works/OL59863W', title: 'A Wizard of Earthsea', authors: ['Ursula K. Le Guin'], year: 1968, access: 'borrowable', gutenberg: [], ia: [], ...patch,
});

test('three bookcases of real, titled public-domain books', () => {
    assert.deepEqual(shelves.map(shelf => shelf.id), ['classics', 'adventure', 'mystery']);
    assert.equal(books.length, 12);
    assert.equal(new Set(books.map(book => book.id)).size, books.length);
    for (const shelf of shelves) assert.ok(booksOn(shelf.id).length >= 3, `${shelf.name} is stocked`);
    for (const book of books) assert.ok(book.spine.length && book.spine.every(line => line.trim()), `${book.title} has its title on the spine`);
    assert.deepEqual(bookById('1342')?.spine, ['PRIDE AND', 'PREJUDICE']);
});

test('bundled texts are complete, unaltered Project Gutenberg eBooks', () => {
    for (const book of books) {
        const parsed = parsedOf(book.id);
        assert.equal(parsed.meta.title, book.gutenbergTitle, `${book.id} title`);
        assert.equal(parsed.meta.author, book.gutenbergAuthor, `${book.id} author`);
        assert.ok(hasGutenbergStart(parsed.source), `${book.title} has a start marker`);
        assert.equal(parsed.meta.copyrighted, false, `${book.title} is public domain`);
        assert.ok(parsed.chapters.length >= 5, `${book.title} has chapters`);
        assert.ok(parsed.source.length > 100_000, `${book.title} is the whole book`);
        same([...parsed.front, ...parsed.body, ...parsed.back].map(block => parsed.source.slice(block.start, block.end)).join(''), parsed.source, `${book.title} regions`);
        const back = parsed.back.map(block => parsed.source.slice(block.start, block.end)).join('');
        assert.match(back, /\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG E(?:BOOK|TEXT)/i, `${book.title} keeps its end marker`);
        assert.ok(back.includes('1.E.1.'), `${book.title} keeps the Project Gutenberg License`);
    }
});

test('every shelf book is typeset losslessly as two-page spreads', () => {
    for (const book of books) {
        const parsed = parsedOf(book.id);
        const edition = localEdition(book, parsed);
        assert.deepEqual(edition.flows.map(flow => flow.id), ['contents', 'body', 'about', 'license']);
        const paged = paginate({ flows: edition.flows, spreads: true, metrics: metrics(SPREAD) });
        checkLayout(paged, SPREAD, true, book.title, 'body', true);
        same(printed(paged, 'body'), printable(parsed.body), `${book.title} body`);
        same(printed(paged, 'about'), printable(parsed.front), `${book.title} front matter`);
        same(printed(paged, 'license'), printable(parsed.back), `${book.title} license`);
    }
});

test('shelf editions credit Project Gutenberg and keep its license', () => {
    const book = bookById('1342')!;
    const edition = localEdition(book, parsedOf('1342'));
    assert.equal(edition.key, 'pg:1342');
    assert.equal(edition.kind, 'local');
    assert.equal(edition.imprint, 'Project Gutenberg · eBook #1342');
    assert.ok(edition.colophon.lines.includes('Public domain in the USA.'));
    assert.deepEqual(edition.colophon.links.map(link => link.href), ['https://www.gutenberg.org/ebooks/1342', GUTENBERG_LICENSE]);
    assert.ok(edition.colophon.links.every(link => link.text.endsWith('(new tab)')));
});

test('catalog results open the shelf copy, an Internet Archive copy, or a catalog record', () => {
    const pride = catalogBook({ key: '/works/OL66554W', title: 'Pride and Prejudice', authors: ['Jane Austen'], gutenberg: ['01342', '42671'] });
    assert.equal(localMatch(pride)?.id, '1342');
    assert.deepEqual(resolveSource({ kind: 'catalog', book: pride }), { kind: 'local', book: bookById('1342') });

    const moby = catalogBook({ key: '/works/OL102749W', title: 'Moby Dick', authors: ['Herman Melville'], gutenberg: ['2701', '15'], ia: ['mobydickorwhale02701gut', 'mobydick00015gut', 'mobydick1851', 'other99999gut'] });
    assert.equal(resolveSource({ kind: 'catalog', book: moby }).kind, 'catalog');
    assert.deepEqual(archiveCandidates(moby), [{ id: 'mobydick00015gut', gutenberg: '15' }, { id: 'mobydickorwhale02701gut', gutenberg: '2701' }]);
    assert.deepEqual(archiveCandidates(catalogBook({ ia: ['scan1851', 'a00002gut'] })), [{ id: 'a00002gut', gutenberg: '2' }]);

    const archive = archiveEdition(moby, { id: 'mobydickorwhale02701gut', file: '2701-0.txt', gutenberg: '2701', parsed: parsedOf('11') });
    assert.equal(archive.key, 'pg:2701');
    assert.equal(archive.kind, 'archive');
    assert.equal(archive.title, 'Moby Dick');
    assert.deepEqual(archive.colophon.links[0], { text: 'This copy on the Internet Archive (new tab)', href: archiveItemUrl('mobydickorwhale02701gut') });
    assert.ok(archive.colophon.lines.includes('Public domain in the USA.'));

    assert.equal(authorsOf(catalogBook({ authors: [] })), 'Author not listed');
    assert.equal(authorsOf(catalogBook({ authors: ['A', 'B', 'C'] })), 'A & B');
});

test('books we cannot print become an honest catalog record that links out', () => {
    const book = catalogBook();
    const edition = recordEdition(book, { description: 'A boy wizard learns the true names of things.', subjects: ['Fantasy', 'Wizards'] });
    assert.equal(edition.key, 'ol:/works/OL59863W');
    assert.equal(edition.kind, 'record');
    assert.deepEqual(edition.colophon.lines, ['Open Library work OL59863W', 'This is a catalog record, not the book. Its full text is not available to read here.']);
    assert.equal(edition.colophon.notice, undefined);

    const paged = paginate({ flows: edition.flows, spreads: true, metrics: metrics(SPREAD) });
    checkLayout(paged, SPREAD, true, 'catalog record', 'about', false);
    const rows = paged.pages.flatMap(page => page.rows);
    assert.ok(rows.some(row => row.kind === 'link' && row.href === workUrl(book.key)), 'links to the Open Library record');
    const words = rows.flatMap(row => row.lines ?? [row.text ?? '']).map(plain).join(' ');
    assert.match(words, /may still be under copyright/);
    assert.match(words, /borrow from the Internet Archive/);
    assert.doesNotMatch(words, /Public domain in the USA/);

    const unknown = recordEdition(catalogBook({ access: 'unknown' }));
    const unknownWords = paginate({ flows: unknown.flows, spreads: false, metrics: metrics(SINGLE) }).pages.flatMap(page => page.rows).flatMap(row => row.lines ?? [row.text ?? '']).map(plain).join(' ');
    assert.match(unknownWords, /no free digital edition/);
    assert.match(unknownWords, /no description of this book yet/);
});

test('Open Library search results are validated before they reach a card', () => {
    const page = parseResults({
        numFound: 2,
        docs: [
            { key: '/works/OL102749W', title: 'Moby Dick', author_name: ['Herman Melville', 7], first_publish_year: 1851, cover_i: 12, ebook_access: 'public', id_project_gutenberg: ['2701', '2701', 'x'], ia: ['mobydickorwhale02701gut', 'bad id!'] },
            { key: '/works/OL59863W', title: 'A Wizard of Earthsea', cover_i: -1, ebook_access: 'printdisabled' },
        ],
    });
    assert.equal(page.total, 2);
    assert.deepEqual(page.books[0], { key: '/works/OL102749W', title: 'Moby Dick', authors: ['Herman Melville'], year: 1851, cover: 12, access: 'public', gutenberg: ['2701'], ia: ['mobydickorwhale02701gut'] });
    assert.equal(page.books[1].access, 'unknown');
    assert.equal(page.books[1].cover, undefined);
    assert.deepEqual(page.books[1].authors, []);
    assert.throws(() => parseResults({ docs: [] }), /invalid response/);
    assert.throws(() => parseResults({ numFound: -1, docs: [] }), /invalid response/);
    assert.throws(() => parseResults({ numFound: 1, docs: [{ key: '/books/OL1M', title: 'x' }] }), /invalid book information/);
    assert.throws(() => parseResults({ numFound: 1, docs: [{ key: '/works/OL1W', title: '  ' }] }), /invalid book information/);

    const work = parseWork({
        description: { value: 'A whale of a [tale][1].\r\n\r\nSee [the site](https://example.com).\n\n[1]: https://example.com\n----------\nSource: somewhere' },
        subjects: ['Whales', '', 'x'.repeat(81), 'Sea stories'],
    });
    assert.equal(work.description, 'A whale of a tale.\n\nSee the site.');
    assert.deepEqual(work.subjects, ['Whales', 'Sea stories']);
    assert.deepEqual(parseWork({ description: 'Plain.', subjects: 'nope' }), { description: 'Plain.', subjects: [] });
    assert.throws(() => parseWork([]), /invalid record/);
});

test('Internet Archive copies must be plain-text Gutenberg mirror files', () => {
    assert.deepEqual(pickTextFile([{ name: '2701.txt', size: '900' }, { name: '2701-0.txt', size: '800' }, { name: '2701-8.txt', size: '990' }, { name: '2701_meta.txt', size: '5' }], '2701'), { name: '2701-0.txt', size: 800 });
    assert.deepEqual(pickTextFile([{ name: 'wrnpc10.txt', size: '100' }, { name: 'wrnpc11.txt', size: '200' }, { name: '../evil.txt', size: '999' }, { name: 'huge.txt', size: '7000000' }, { name: 'README.txt', size: '500' }]), { name: 'wrnpc11.txt', size: 200 });
    assert.equal(pickTextFile('nope'), null);

    const item = { metadata: { collection: ['gutenberg'] }, files: [{ name: '2701-0.txt', size: '5000' }] };
    assert.deepEqual(checkItem(item, '2701'), { name: '2701-0.txt', size: 5000 });
    assert.throws(() => checkItem(null), /invalid record/);
    assert.throws(() => checkItem({ ...item, metadata: { collection: ['opensource'] } }), /not part of its Project Gutenberg mirror/);
    assert.throws(() => checkItem({ ...item, metadata: { collection: 'gutenberg', 'access-restricted-item': 'true' } }), /restricted/);
    assert.throws(() => checkItem({ ...item, is_dark: true }), /restricted/);
    assert.throws(() => checkItem({ metadata: { collection: 'gutenberg' }, files: [] }), /no plain-text copy/);

    assert.equal(decodeText(new TextEncoder().encode('café').slice().buffer), 'café');
    assert.equal(decodeText(new Uint8Array([0x63, 0x61, 0x66, 0xe9]).buffer), 'café');
});

test('bindings are stable and their lettering is legible', () => {
    for (const [cloth, ink] of BINDINGS) assert.ok(contrast(PALETTE[cloth], PALETTE[ink]) >= 4.5, `${cloth} cloth with ${ink} lettering`);
    assert.deepEqual(bindingFor('/works/OL59863W'), bindingFor('/works/OL59863W'));
    for (const book of books) {
        const accent = accentOn(book.cloth, book.ink);
        assert.ok(contrast(PALETTE[accent], PAPER) >= 4.5, `${book.title} chapter labels read on the page`);
    }
});

test('the library bridge only notifies on real changes', () => {
    const bridge = new LibraryBridge();
    let updates = 0;
    let actions = 0;
    const unsubscribe = bridge.subscribe(() => updates++);
    bridge.update({ inside: true });
    bridge.update({ inside: true });
    assert.equal(updates, 1);
    bridge.setPrompt('Browse Classics', () => actions++);
    assert.equal(updates, 2);
    bridge.interact();
    assert.equal(actions, 1);
    bridge.update({ open: true });
    bridge.interact();
    assert.equal(actions, 1, 'nothing happens behind an open book');
    unsubscribe();
    bridge.update({ open: false });
    assert.equal(updates, 3);
});
