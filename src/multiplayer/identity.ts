/** Who you are in the world: a name you pick once, and a random id. Both stay in this browser; there are no accounts. */

const NAME_KEY = 'atv-world-name';
const ID_KEY = 'atv-world-id';

const listeners = new Set<() => void>();

function read(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function write(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* Private mode: the name lasts until the tab closes. */
    }
}

let memoryName: string | null = null;
let memoryId: string | null = null;

export const cleanName = (raw: string) => raw.replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);

export function myName(): string {
    return memoryName ?? cleanName(read(NAME_KEY) ?? '');
}

export function myId(): string {
    if (memoryId) return memoryId;
    let id = read(ID_KEY);
    if (!id || id.length < 8) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
        write(ID_KEY, id);
    }
    memoryId = id;
    return id;
}

export function setMyName(raw: string): boolean {
    const name = cleanName(raw);
    if (!name) return false;
    memoryName = name;
    write(NAME_KEY, name);
    listeners.forEach((fn) => fn());
    return true;
}

export function onIdentity(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
