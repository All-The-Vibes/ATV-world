import assert from 'node:assert/strict';
import { test } from 'node:test';

let serial = 0;
async function inventory(saved: string | null = null, blocked = false) {
    const storage = new Map<string, string>();
    if (saved !== null) storage.set('atv-backpack', saved);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: (key: string) => {
            if (blocked) throw new Error('Storage unavailable');
            return storage.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
            if (blocked) throw new Error('Storage unavailable');
            storage.set(key, value);
        },
    } });
    return { store: await import(`../src/backpack/inventory.ts?test=${serial++}`), storage };
}

test('all four collectibles stack, notify, and survive a reload without touching tokens', async () => {
    const { store, storage } = await inventory();
    storage.set('atv-tokens', '37');
    assert.deepEqual(store.ITEMS.map((item: { id: string }) => item.id),
        ['mac-mini', 'dgx-spark', 'codex-pro', 'cloud-scout']);
    const initial = store.getInventory();
    let changes = 0;
    const off = store.onInventory(() => changes++);
    for (const { id } of store.ITEMS) store.collectItem(id);
    store.collectItem('mac-mini');
    assert.equal(changes, 5);
    assert.equal(initial.counts['mac-mini'], 0, 'published snapshots stay immutable');
    assert.deepEqual(store.getInventory().counts,
        { 'mac-mini': 2, 'dgx-spark': 1, 'codex-pro': 1, 'cloud-scout': 1 });
    assert.equal(store.getInventory().lastItem, 'mac-mini');
    assert.equal(storage.get('atv-tokens'), '37');
    off();
    store.collectItem('cloud-scout');
    assert.equal(changes, 5, 'unsubscribe stops notifications');
    const reloaded = await inventory(storage.get('atv-backpack'));
    assert.equal(reloaded.store.getInventory().counts['cloud-scout'], 2);
});

test('bad or unavailable storage does not break the backpack', async () => {
    for (const saved of ['not json', 'null', '[]', '{"mac-mini":-1,"dgx-spark":1.5,"codex-pro":"9","cloud-scout":1e100}']) {
        const { store } = await inventory(saved);
        assert.ok(Object.values(store.getInventory().counts).every(count => count === 0));
        store.collectItem('mac-mini');
        assert.equal(store.getInventory().counts['mac-mini'], 1);
    }
    const { store } = await inventory(null, true);
    store.collectItem('dgx-spark');
    assert.equal(store.getInventory().counts['dgx-spark'], 1);
    assert.equal(store.getInventory().saved, false);
});

test('unknown keys are ignored and counts cannot overflow', async () => {
    const { store } = await inventory('{"mac-mini":9007199254740991,"surprise":99}');
    store.collectItem('mac-mini');
    assert.equal(store.getInventory().counts['mac-mini'], Number.MAX_SAFE_INTEGER);
    assert.equal(Object.hasOwn(store.getInventory().counts, 'surprise'), false);
});

test('two tabs preserve different items and overlapping pickups with the same browser lock', async () => {
    let pending = Promise.resolve();
    const navigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: {
        request: (_key: string, fn: () => void) => { pending = pending.then(fn); return pending; },
    } } });
    try {
        const { store: first, storage } = await inventory();
        const second = await import(`../src/backpack/inventory.ts?test=${serial++}`);
        await Promise.all([first.collectItem('mac-mini'), second.collectItem('dgx-spark')]);
        await Promise.all([first.collectItem('mac-mini'), second.collectItem('mac-mini')]);
        assert.deepEqual(JSON.parse(storage.get('atv-backpack')!),
            { 'mac-mini': 3, 'dgx-spark': 1, 'codex-pro': 0, 'cloud-scout': 0 });
    } finally {
        if (navigator) Object.defineProperty(globalThis, 'navigator', navigator);
        else Reflect.deleteProperty(globalThis, 'navigator');
    }
});
