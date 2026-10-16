/**
 * Who's in the call. Teams (see ./teams.ts), the demo, or the URL fill it in;
 * ATV HQ (src/game/hq) and the call panel draw it.
 */
export type CallSource = 'teams' | 'relay' | 'url' | 'demo' | 'console';

export interface Caller {
    /** Stable key: the Teams user ID, or the name for people added by hand. */
    id: string;
    name: string;
    /** True for the person looking at this screen. */
    me: boolean;
    source: CallSource;
}

/** A button the call panel shows next to the status, e.g. "Share to stage" in a Teams side panel. */
export interface CallAction {
    label: string;
    title?: string;
    run: () => void | Promise<void>;
}

/** A text box the call panel shows under the status, e.g. the website mirror key on the Teams setup page. */
export interface CallField {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
}

export type CallStatus =
    | { kind: 'idle'; action?: CallAction }
    | { kind: 'connecting'; text: string; action?: CallAction }
    | { kind: 'live'; text: string; action?: CallAction }
    | { kind: 'demo'; text: string; action?: CallAction }
    | { kind: 'config'; text: string; action?: CallAction; field?: CallField }
    | { kind: 'error'; text: string; action?: CallAction };

export interface JoinInfo {
    id?: string;
    name: string;
    me?: boolean;
    source?: CallSource;
}

const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 64);

class Roster {
    private people = new Map<string, Caller>();
    private listeners = new Set<() => void>();
    private snapshot: readonly Caller[] = [];
    status: CallStatus = { kind: 'idle' };
    /** Goes up by one on every change (people or status). */
    version = 0;

    /** Everyone in the call, in the order they joined. Same array until something changes. */
    list(): readonly Caller[] {
        return this.snapshot;
    }

    get size(): number {
        return this.people.size;
    }

    get(id: string): Caller | undefined {
        return this.people.get(id);
    }

    /** Add someone (or update their name). Returns null for a blank name. */
    join(info: JoinInfo): Caller | null {
        const name = cleanName(info.name);
        if (!name) return null;
        const id = info.id?.trim() || `name:${name.toLowerCase()}`;
        const old = this.people.get(id);
        const next: Caller = { id, name, me: info.me ?? old?.me ?? false, source: info.source ?? old?.source ?? 'console' };
        if (old && old.name === next.name && old.me === next.me && old.source === next.source) return old;
        this.people.set(id, next);
        this.changed();
        return next;
    }

    /** Remove someone by ID or by name. */
    leave(idOrName: string): boolean {
        const key = this.people.has(idOrName) ? idOrName : this.findByName(idOrName)?.id;
        if (!key || !this.people.delete(key)) return false;
        this.changed();
        return true;
    }

    /** Remove everyone (or everyone from one source). */
    clear(source?: CallSource): void {
        let removed = false;
        for (const [id, c] of this.people) {
            if (source && c.source !== source) continue;
            this.people.delete(id);
            removed = true;
        }
        if (removed) this.changed();
    }

    setStatus(status: CallStatus): void {
        this.status = status;
        this.changed();
    }

    /** Called after every change. Returns a function that stops listening. */
    subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private findByName(name: string): Caller | undefined {
        const n = cleanName(name).toLowerCase();
        return [...this.people.values()].find((c) => c.name.toLowerCase() === n);
    }

    private changed() {
        this.version++;
        this.snapshot = [...this.people.values()];
        for (const fn of [...this.listeners]) {
            try {
                fn();
            } catch (e) {
                console.error('[ATV] A call listener failed:', e);
            }
        }
    }
}

export const call = new Roster();
