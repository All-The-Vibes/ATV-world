export type CatalogBook = {
    key: string;
    title: string;
    authors: string[];
    year?: number;
    cover?: number;
    access: 'public' | 'borrowable' | 'unknown';
    /** Project Gutenberg eBook numbers for this work. */
    gutenberg: string[];
    /** Internet Archive identifiers for scanned or mirrored editions. */
    ia: string[];
};
export type WorkDetails = { description?: string; subjects: string[] };
export type SearchPage = { books: CatalogBook[]; total: number };
const cache = new Map<string, SearchPage>();
let nextRequest = 0;

function record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown, pattern: RegExp, limit = 40): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && pattern.test(item)))].slice(0, limit);
}

/** Reads the description and subjects from an Open Library work record. */
export function parseWork(value: unknown): WorkDetails {
    if (!record(value)) throw new Error('The book catalog returned an invalid record.');
    const raw = typeof value.description === 'string' ? value.description : record(value.description) && typeof value.description.value === 'string' ? value.description.value : '';
    // Descriptions are lightly formatted Markdown; keep the prose and drop link syntax and source notes.
    const description = raw
        .replace(/\r\n?/g, '\n')
        .replace(/\[([^\]]+)\]\[\d+\]/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^\s*\[\d+\]:.*$/gm, '')
        .replace(/^-{3,}[\s\S]*$/m, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 4000);
    return { description: description || undefined, subjects: strings(value.subjects, /^.{1,80}$/, 12) };
}

export function parseResults(value: unknown): SearchPage {
    if (!record(value) || !Array.isArray(value.docs) || typeof value.numFound !== 'number' || !Number.isFinite(value.numFound) || value.numFound < 0) {
        throw new Error('The book catalog returned an invalid response. Try searching again.');
    }
    const books: CatalogBook[] = value.docs.map((doc: unknown) => {
        if (!record(doc) || typeof doc.key !== 'string' || !/^\/works\/OL\d+W$/.test(doc.key) || typeof doc.title !== 'string' || !doc.title.trim()) {
            throw new Error('The book catalog returned invalid book information. Try searching again.');
        }
        return {
            key: doc.key,
            title: doc.title,
            authors: Array.isArray(doc.author_name) ? doc.author_name.filter((name): name is string => typeof name === 'string') : [],
            year: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : undefined,
            cover: typeof doc.cover_i === 'number' && Number.isSafeInteger(doc.cover_i) && doc.cover_i > 0 ? doc.cover_i : undefined,
            access: doc.ebook_access === 'public' ? 'public' : doc.ebook_access === 'borrowable' ? 'borrowable' : 'unknown',
            gutenberg: strings(doc.id_project_gutenberg, /^\d{1,6}$/),
            ia: strings(doc.ia, /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/),
        };
    });
    return { books, total: value.numFound };
}

export async function searchCatalog(query: string, page: number, signal: AbortSignal): Promise<SearchPage> {
    const key = `${query.toLowerCase()}:${page}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const start = Math.max(Date.now(), nextRequest);
    nextRequest = start + 1000;
    await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException('Search cancelled', 'AbortError')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, start - Date.now());
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
    });
    const params = new URLSearchParams({
        q: query,
        page: String(page),
        limit: '12',
        fields: 'key,title,author_name,first_publish_year,cover_i,ebook_access,id_project_gutenberg,ia',
    });
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    });
    if (!response.ok) throw new Error(response.status === 429
        ? 'Open Library is receiving too many requests. Please wait before trying again.'
        : `Open Library could not complete the search (${response.status}). Try again.`);
    const result = parseResults(await response.json());
    if (cache.size >= 40) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
}

const works = new Map<string, WorkDetails>();

export async function workDetails(key: string, signal: AbortSignal): Promise<WorkDetails> {
    if (!/^\/works\/OL\d+W$/.test(key)) throw new Error('That catalog record is not a book.');
    const cached = works.get(key);
    if (cached) return cached;
    const response = await fetch(`https://openlibrary.org${key}.json`, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
    if (!response.ok) throw new Error(`Open Library could not load this record (${response.status}).`);
    const details = parseWork(await response.json());
    if (works.size >= 40) works.delete(works.keys().next().value!);
    works.set(key, details);
    return details;
}

export const workUrl = (key: string) => `https://openlibrary.org${key}`;
export const coverUrl = (cover: number, size: 'S' | 'M' | 'L' = 'M') => `https://covers.openlibrary.org/b/id/${cover}-${size}.jpg`;