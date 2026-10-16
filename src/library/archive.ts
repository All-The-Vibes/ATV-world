import type { CatalogBook } from './catalog.ts';
import { fetchWithTimeout } from './request.ts';
import { hasGutenbergStart, parseGutenberg, type ParsedText } from './text.ts';

/** A Project Gutenberg text fetched from the Internet Archive's Gutenberg mirror. */
export type ArchiveText = { id: string; file: string; gutenberg: string; parsed: ParsedText };
type Candidate = { id: string; gutenberg: string };

const MAX_BYTES = 6_000_000;

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Internet Archive mirror items for the work's Project Gutenberg eBooks, lowest eBook number first. */
export function archiveCandidates(book: Pick<CatalogBook, 'gutenberg' | 'ia'>): Candidate[] {
    const wanted = new Set(book.gutenberg.map(id => String(Number(id))));
    const items = book.ia.flatMap(id => {
        const match = /(\d{5})gut$/.exec(id);
        return match ? [{ id, gutenberg: String(Number(match[1])) }] : [];
    });
    const matching = wanted.size ? items.filter(item => wanted.has(item.gutenberg)) : items;
    return matching.sort((a, b) => Number(a.gutenberg) - Number(b.gutenberg)).slice(0, 3);
}

/**
 * Picks the book's plain-text file from an item's file list. Files named for the eBook number come
 * first (UTF-8, then ASCII, then Latin-1); otherwise the largest text, which skips per-chapter splits
 * and picks the latest revision of old names such as wrnpc11.txt over wrnpc10.txt.
 */
export function pickTextFile(files: unknown, gutenberg = ''): { name: string; size: number } | null {
    if (!Array.isArray(files)) return null;
    const n = gutenberg.replace(/^0+/, '');
    const rank = (name: string) => {
        const base = name.slice(name.lastIndexOf('/') + 1).toLowerCase();
        if (n && base === `${n}-0.txt`) return 0;
        if (n && (base === `${n}.txt` || base === `pg${n}.txt`)) return 1;
        if (n && base === `${n}-8.txt`) return 2;
        return 3;
    };
    const texts = files.flatMap(file => {
        if (!record(file) || typeof file.name !== 'string') return [];
        const name = file.name;
        if (!/\.txt$/i.test(name) || /_(?:meta|djvu|files)\.txt$/i.test(name) || /readme/i.test(name) || name.includes('..') || name.startsWith('/')) return [];
        const size = Number(file.size ?? 0);
        return Number.isFinite(size) && size >= 0 && size <= MAX_BYTES ? [{ name, size }] : [];
    });
    texts.sort((a, b) => rank(a.name) - rank(b.name) || b.size - a.size || a.name.localeCompare(b.name));
    return texts[0] ?? null;
}

export function decodeText(buffer: ArrayBuffer) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder('windows-1252').decode(buffer);
    }
}

/** Checks an item's metadata and returns its text file, or explains why it cannot be read here. */
export function checkItem(value: unknown, gutenberg = ''): { name: string; size: number } {
    if (!record(value) || !record(value.metadata)) throw new Error('The Internet Archive returned an invalid record.');
    const collection = value.metadata.collection;
    const collections = Array.isArray(collection) ? collection : [collection];
    if (!collections.includes('gutenberg')) throw new Error('This Internet Archive item is not part of its Project Gutenberg mirror.');
    if (value.metadata['access-restricted-item'] === 'true' || value.is_dark === true) throw new Error('This Internet Archive item is restricted.');
    const file = pickTextFile(value.files, gutenberg);
    if (!file) throw new Error('This Internet Archive item has no plain-text copy.');
    return file;
}

async function loadCandidate(candidate: Candidate, signal: AbortSignal): Promise<ArchiveText> {
    const meta = await fetchWithTimeout(`https://archive.org/metadata/${encodeURIComponent(candidate.id)}`, {}, signal, 12000);
    if (!meta.ok) throw new Error(`The Internet Archive could not find this item (${meta.status}).`);
    const file = checkItem(await meta.json(), candidate.gutenberg);
    const path = file.name.split('/').map(encodeURIComponent).join('/');
    const response = await fetchWithTimeout(`https://archive.org/download/${encodeURIComponent(candidate.id)}/${path}`, {}, signal, 20000);
    if (!response.ok) throw new Error(`The Internet Archive could not send the text (${response.status}).`);
    if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('This text is too large to open here.');
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw new Error('This text is too large to open here.');
    const text = decodeText(buffer);
    if (!hasGutenbergStart(text)) throw new Error('This file is not a Project Gutenberg eBook.');
    const parsed = parseGutenberg(text);
    if (parsed.meta.copyrighted) throw new Error('This eBook is still under copyright, so it opens only on Project Gutenberg.');
    if (parsed.body.length < 8) throw new Error('This eBook text is incomplete.');
    return { id: candidate.id, file: file.name, gutenberg: candidate.gutenberg, parsed };
}

/** Loads the first readable Gutenberg text for a catalog work from the Internet Archive. */
export async function loadArchiveText(book: Pick<CatalogBook, 'gutenberg' | 'ia'>, signal: AbortSignal): Promise<ArchiveText> {
    const candidates = archiveCandidates(book);
    if (!candidates.length) throw new Error('No Project Gutenberg copy of this book is mirrored on the Internet Archive.');
    let failure: unknown;
    for (const candidate of candidates) {
        try {
            return await loadCandidate(candidate, signal);
        } catch (error) {
            if (signal.aborted) throw error;
            failure = error;
        }
    }
    if (failure instanceof DOMException && failure.name === 'TimeoutError') throw new Error('The Internet Archive took too long to send this book.');
    if (failure instanceof TypeError) throw new Error('Cannot reach the Internet Archive. Check your connection and try again.');
    throw failure instanceof Error ? failure : new Error('The Internet Archive copy could not be opened.');
}

export const archiveItemUrl = (id: string) => `https://archive.org/details/${encodeURIComponent(id)}`;
