// Plays the real game in a browser: walk into the stone tower, take a book down, turn its pages,
// search the card catalog, and walk back out. Open Library and the Internet Archive are mocked.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = 5187;
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.LIBRARY_SCREENSHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const CORS = { 'access-control-allow-origin': '*' };
const DOCS = [
    { key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen'], first_publish_year: 1813, ebook_access: 'public', id_project_gutenberg: ['1342'] },
    { key: '/works/OL102749W', title: 'Moby Dick', author_name: ['Herman Melville'], first_publish_year: 1851, ebook_access: 'public', id_project_gutenberg: ['2701'], ia: ['mobydickorwhale02701gut'] },
    { key: '/works/OL1000001W', title: 'Sea Ballads', author_name: ['Old Sailor'], first_publish_year: 1890, ebook_access: 'public' },
    { key: '/works/OL59863W', title: 'A Wizard of Earthsea', author_name: ['Ursula K. Le Guin'], first_publish_year: 1968, ebook_access: 'borrowable' },
    { key: '/works/OL1000002W', title: 'A Modern Whale Story', author_name: ['Living Author'], first_publish_year: 2015, ebook_access: 'no_ebook' },
];
const PAGE_TWO = [{ key: '/works/OL1000003W', title: 'The Second Drawer', author_name: ['Page Two'], first_publish_year: 1901, ebook_access: 'no_ebook' }];

const CHAPTERS = ['Loomings', 'The Carpet-Bag', 'The Spouter-Inn', 'The Counterpane', 'Breakfast', 'The Street', 'The Chapel', 'The Pulpit', 'The Sermon', 'A Bosom Friend'];
const paragraph = (chapter, n) => `Paragraph ${n} of chapter ${chapter}. Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.`;
const ARCHIVE_TEXT = [
    'The Project Gutenberg eBook of Moby Dick; Or, The Whale', '',
    'This ebook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever.', '',
    'Title: Moby Dick; Or, The Whale', '', 'Author: Herman Melville', '', 'Release date: June 1, 2001 [eBook #2701]', '', 'Language: English', '',
    '*** START OF THE PROJECT GUTENBERG EBOOK MOBY DICK; OR, THE WHALE ***', '',
    ...CHAPTERS.flatMap((name, i) => [`CHAPTER ${i + 1}. ${name}.`, '', paragraph(i + 1, 1), '', paragraph(i + 1, 2), '']),
    '*** END OF THE PROJECT GUTENBERG EBOOK MOBY DICK; OR, THE WHALE ***', '',
    '1.E.1. The following sentence, with active links to, or other immediate access to, the full Project Gutenberg License must appear prominently whenever any copy of a Project Gutenberg work is accessed, displayed, performed, viewed, copied or distributed.', '',
].join('\r\n');

async function startServer() {
    const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
    for (let i = 0; i < 150; i++) {
        try {
            if ((await fetch(ORIGIN)).ok) return server;
        } catch { /* not up yet */ }
        await sleep(200);
    }
    server.kill();
    throw new Error('The Vite dev server did not start.');
}

async function launch() {
    try {
        return await chromium.launch({ channel: 'msedge' });
    } catch {
        return chromium.launch();
    }
}

async function until(check, what, timeout = 20000) {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
        try {
            last = await check();
            if (last) return last;
        } catch (error) {
            last = error;
        }
        await sleep(50);
    }
    throw new Error(`Timed out waiting for ${what} (last: ${last})`);
}

const server = await startServer();
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

await context.route(url => url.hostname === 'openlibrary.org' && url.pathname === '/search.json', route => {
    const params = new URL(route.request().url()).searchParams;
    const q = params.get('q');
    if (q === 'offline') return route.abort('internetdisconnected');
    if (q === 'busy') return route.fulfill({ status: 429, headers: CORS, body: '' });
    return route.fulfill({ headers: CORS, json: { numFound: 25, docs: params.get('page') === '2' ? PAGE_TWO : DOCS } });
});
await context.route(url => url.hostname === 'openlibrary.org' && /^\/works\/OL\d+W\.json$/.test(url.pathname), route =>
    route.fulfill({ headers: CORS, json: { description: 'A story told for this test.', subjects: ['Fiction'] } }));
await context.route(url => url.hostname === 'covers.openlibrary.org', route => route.abort());
await context.route(url => url.hostname === 'archive.org' && url.pathname.startsWith('/metadata/'), route =>
    route.fulfill({ headers: CORS, json: { metadata: { collection: ['gutenberg'] }, files: [{ name: '2701-0.txt', size: String(ARCHIVE_TEXT.length) }] } }));
await context.route(url => url.hostname === 'archive.org' && url.pathname.startsWith('/download/'), route =>
    route.fulfill({ headers: CORS, contentType: 'text/plain; charset=utf-8', body: ARCHIVE_TEXT }));

const shot = async name => {
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `library-${name}.png`) });
};
const heading = () => page.locator('.banner h1').innerText();
const libraryOpen = async () => (await page.locator('dialog.library').count()) > 0;
const activeId = () => page.evaluate(() => document.activeElement?.id ?? '');
const focused = (id, what) => until(async () => (await activeId()) === id, what);
const spoken = () => page.evaluate(() => document.querySelector('input[aria-label="Turn to page"]')?.getAttribute('aria-valuetext') ?? null);
const turning = () => page.evaluate(() => document.querySelector('.reader .book')?.hasAttribute('data-turning') ?? false);

// Walking runs on a paused clock so every step is the same length.
async function pause() {
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 200);
}
async function hold(key, ms) {
    await page.keyboard.down(key);
    await page.clock.runFor(ms);
    await page.keyboard.up(key);
    await page.clock.runFor(100);
}
// Everything is walk-in: walk until `arrived` says the player got where they were going.
async function walkUntil(key, arrived, what, max = 3000) {
    await page.keyboard.down(key);
    let reached = false;
    for (let t = 0; t <= max && !reached; t += 50) {
        reached = await arrived();
        if (!reached) await page.clock.runFor(50);
    }
    await page.keyboard.up(key);
    await page.clock.runFor(100);
    assert.ok(reached, `walking ${key} reaches ${what}`);
}
const inside = async () => (await heading()) === 'TOWER LIBRARY';
const outside = async () => (await heading()) === 'ATV WORLD';

async function turn(action, what, expected) {
    await until(async () => !(await turning()), 'the last page to settle');
    const before = await spoken();
    await action();
    const after = await until(async () => {
        const now = await spoken();
        return now && now !== before && !(await turning()) ? now : null;
    }, what);
    if (expected) assert.ok(typeof expected === 'string' ? after === expected : expected.test(after), `${what}: landed on "${after}"`);
    return after;
}
const opened = what => until(async () => (await spoken()) === 'Endpaper · Title page', `${what} to open at its title page`);

async function search(text) {
    await page.locator('#book-query').fill(text);
    await page.locator('#book-query').press('Enter');
}

try {
    await page.clock.install();
    await page.goto(ORIGIN);
    await until(async () => (await heading()) === 'ATV WORLD', 'the world to load');
    await sleep(500);

    // Outside: walk to the tower door.
    await pause();
    await hold('ArrowRight', 3080);
    await shot('exterior');
    await walkUntil('ArrowDown', inside, 'the library door');
    await page.clock.resume();
    await until(async () => (await heading()) === 'TOWER LIBRARY', 'the reading room');
    await sleep(400);
    await shot('interior');

    // The Classics bookcase: titled spines, a catalog card, and a book that opens.
    await pause();
    await hold('ArrowLeft', 2200);
    await hold('ArrowUp', 1600);
    await walkUntil('ArrowRight', libraryOpen, 'the Classics bookcase');
    await page.clock.resume();
    await page.locator('dialog.library').waitFor();
    await focused('spine-1342', 'Pride and Prejudice to be first on the shelf');
    assert.equal(await page.locator('dialog.library .spine').count(), 12, 'all twelve books are shelved');
    assert.match(await page.locator('#spine-1342').innerText(), /PRIDE AND\s*PREJUDICE/);
    assert.equal(await page.locator('.card-call').innerText(), 'Gutenberg #1342');
    await shot('shelves');

    await page.locator('#spine-1342').click();
    await opened('Pride and Prejudice');
    assert.match(await page.locator('#reader-title').innerText(), /Pride and Prejudice/);
    await shot('book-open');
    await page.locator('.reader-stage').focus();
    await turn(() => page.keyboard.press('ArrowRight'), 'the right arrow', 'Colophon · Contents');
    assert.match(await page.locator('.colophon').innerText(), /Public domain in the USA/);
    await turn(() => page.locator('.slot-right button.row-toc').first().click(), 'a contents entry', /^Pages? \d/);
    await turn(() => page.locator('.reader-turn').last().click(), 'the Next page button', /^Pages? \d/);
    const book = await page.locator('.reader .book').boundingBox();
    await turn(() => page.mouse.click(book.x + book.width * 0.78, book.y + book.height * 0.55), 'a click on the right-hand page', /^Pages? \d/);
    await turn(async () => {
        const y = book.y + book.height * 0.6;
        await page.mouse.move(book.x + book.width * 0.92, y);
        await page.mouse.down();
        await page.mouse.move(book.x + book.width * 0.6, y, { steps: 8 });
        await sleep(150);
        await shot('page-turn');
        await page.mouse.move(book.x + book.width * 0.08, y, { steps: 8 });
        await page.mouse.up();
    }, 'dragging a page across the spine', /^Pages? \d/);
    await page.locator('.reader-stage').focus();
    await turn(() => page.keyboard.press('ArrowLeft'), 'the left arrow', /^Pages? \d/);
    await shot('reader');
    await turn(() => page.getByRole('button', { name: 'Contents', exact: true }).click(), 'the Contents button', /Contents/);
    const contentsPosition = await spoken();
    await page.getByRole('button', { name: 'Contents', exact: true }).press('ArrowRight');
    assert.equal(await spoken(), contentsPosition, 'reader shortcuts do not fire from a focused control');

    await page.locator('.type-toggle').click();
    await page.getByRole('button', { name: 'Large', exact: true }).click();
    await page.getByRole('button', { name: 'Book', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Book', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    await until(async () => (await page.locator('#reader-type-menu').count()) === 0, 'the type menu to close');
    assert.ok(await page.locator('.type-toggle').evaluate(node => node === document.activeElement), 'focus returns to the Aa button');
    await until(async () => page.evaluate(() => document.querySelector('.reader .book')?.hasAttribute('data-ready')), 'the book to reset in the new type');

    await page.keyboard.press('Escape');
    await focused('spine-1342', 'the book to go back on its shelf');
    await page.keyboard.press('Escape');
    await until(async () => (await page.locator('dialog.library').count()) === 0, 'the bookcase to close');

    // The card catalog: real search over Open Library, with honest stamps.
    // Out by the on-screen button, back in on foot, then over to the catalog.
    await page.getByRole('button', { name: 'Leave library' }).click();
    await until(outside, 'the world outside the door');
    await pause();
    await walkUntil('ArrowUp', inside, 'the library door again');
    await hold('ArrowRight', 2200);
    await walkUntil('ArrowUp', libraryOpen, 'the card catalog');
    await page.clock.resume();
    await focused('book-query', 'the search box');

    await search('offline');
    await until(async () => /Check your connection/.test(await page.locator('.catalog-error').innerText({ timeout: 500 })), 'the offline message');
    await search('busy');
    await until(async () => /too many requests/.test(await page.locator('.catalog-error').innerText({ timeout: 500 })), 'the rate-limit message');
    await search('whales');
    await until(async () => (await page.locator('.catalog-summary').innerText()) === '25 results for “whales” · Page 1 of 3', 'whale results');
    assert.deepEqual(await page.locator('.results .stamp').allTextContents(), ['On our shelf', 'Read here', 'Read online', 'Borrow', 'Catalog only']);
    await shot('catalog');
    await page.getByRole('button', { name: 'Next ›' }).click();
    await until(async () => (await page.locator('.result-title').allTextContents()).join() === 'The Second Drawer', 'the second results page');
    await page.getByRole('button', { name: '‹ Previous' }).click();
    await until(async () => (await page.locator('.catalog-summary').innerText()).endsWith('Page 1 of 3'), 'the first results page again');

    await page.locator('#result-OL102749W').click();
    await opened('the Internet Archive copy of Moby Dick');
    assert.match(await page.locator('#reader-title').innerText(), /Moby Dick/);
    await page.locator('.reader-stage').focus();
    await turn(() => page.keyboard.press('ArrowRight'), 'the Moby Dick colophon', 'Colophon · Contents');
    assert.match(await page.locator('.colophon').innerText(), /This copy on the Internet Archive/);
    await page.keyboard.press('Escape');
    await focused('result-OL102749W', 'focus to return to the Moby Dick card');

    await page.locator('#result-OL1000002W').click();
    await opened('the catalog record');
    await page.locator('.reader-stage').focus();
    await turn(() => page.keyboard.press('ArrowRight'), 'the record colophon', 'Colophon · Contents');
    const colophon = await page.locator('.colophon').innerText();
    assert.match(colophon, /This is a catalog record, not the book/);
    assert.doesNotMatch(colophon, /Public domain/);
    await shot('record');
    await page.keyboard.press('Escape');
    await focused('result-OL1000002W', 'focus to return to the record card');

    await page.locator('#result-OL66554W').click();
    await until(async () => page.evaluate(() => document.querySelector('.reader .book')?.hasAttribute('data-ready')), 'the shelf copy to open from the catalog');
    assert.match(await page.locator('#reader-title').innerText(), /Pride and Prejudice/);
    await page.keyboard.press('Escape');
    await focused('result-OL66554W', 'focus to return to the Pride and Prejudice card');
    await page.keyboard.press('Escape');
    await until(async () => (await page.locator('dialog.library').count()) === 0, 'the catalog to close');

    // Leaving on foot through the door, and staying out while walking away.
    await pause();
    await hold('ArrowDown', 900);
    await walkUntil('ArrowLeft', outside, 'the door out');
    await hold('ArrowLeft', 700);
    assert.ok(await outside(), 'walking away from the door stays outside');
    await page.clock.resume();

    assert.deepEqual(errors, [], 'no page errors');
    console.log(`Library browser test passed${SHOTS ? `; screenshots in ${SHOTS}` : ''}.`);
} catch (error) {
    await shot('failure').catch(() => {});
    console.error(error);
    if (errors.length) console.error('Page errors:', errors);
    process.exitCode = 1;
} finally {
    await browser.close();
    server.kill();
}
