import type { ShelfId } from './books.ts';

/** What the library panel shows when it opens: one bookcase, or the card catalog search. */
export type LibraryView = { kind: 'shelf'; shelf: ShelfId } | { kind: 'catalog' };

export type LibraryState = {
    inside: boolean;
    open: boolean;
    view: LibraryView;
};

export class LibraryBridge {
    private state: LibraryState = { inside: false, open: false, view: { kind: 'shelf', shelf: 'classics' } };
    private listeners = new Set<() => void>();
    leave?: () => void;

    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    update(patch: Partial<LibraryState>) {
        if (Object.entries(patch).every(([key, value]) => this.state[key as keyof LibraryState] === value)) return;
        this.state = { ...this.state, ...patch };
        this.listeners.forEach(listener => listener());
    }
}
