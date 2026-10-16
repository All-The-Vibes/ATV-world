export const ITEMS = [
    { id: 'mac-mini', name: 'Mac mini', description: 'Tiny desktop. Big build energy.' },
    { id: 'dgx-spark', name: 'DGX Spark', description: 'A pocket-sized AI supercomputer.' },
    { id: 'codex-pro', name: 'Codex Pro subscription', description: 'Your next coding power-up.' },
    { id: 'cloud-scout', name: 'Cloud Scout app', description: 'A little scout for your next cloud adventure.' },
] as const;

export type ItemId = typeof ITEMS[number]['id'];
export type Loot = 'token' | ItemId;
const KEY = 'atv-backpack';

function load() {
    const counts: Record<ItemId, number> = { 'mac-mini': 0, 'dgx-spark': 0, 'codex-pro': 0, 'cloud-scout': 0 };
    try {
        const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
        for (const { id } of ITEMS) {
            if (Number.isSafeInteger(stored?.[id]) && stored[id] >= 0) counts[id] = stored[id];
        }
    } catch { /* Keep playing with an empty bag if storage is unavailable or damaged. */ }
    return counts;
}

let state = { counts: load(), lastItem: null as ItemId | null, saved: true };
const listeners = new Set<() => void>();
export const getInventory = () => state;

export function collectItem(id: ItemId) {
    const collect = () => {
        const counts = load();
        for (const item of ITEMS) counts[item.id] = Math.max(counts[item.id], state.counts[item.id]);
        counts[id] = Math.min(Number.MAX_SAFE_INTEGER, counts[id] + 1);
        let saved = true;
        // shortcut: browser-local inventory, add account storage only when cross-device play is needed.
        try { localStorage.setItem(KEY, JSON.stringify(counts)); }
        catch { saved = false; }
        state = { counts, lastItem: id, saved };
        listeners.forEach(listener => listener());
    };
    // Serialize pickups across tabs so a stale tab cannot overwrite another tab's stash.
    if (globalThis.navigator?.locks) return navigator.locks.request(KEY, collect).catch(collect);
    collect();
}

export function onInventory(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
