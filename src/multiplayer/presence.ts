/** Who else is here right now: Multiplayer.ts writes it, the players panel reads it. */

export interface Presence {
    id: string;
    name: string;
    character: number;
}

let snapshot: readonly Presence[] = [];
let live = false;
const listeners = new Set<() => void>();

export const getPresence = () => snapshot;
export const isLive = () => live;

export function setPresence(players: Presence[], connected: boolean) {
    const same =
        connected === live &&
        players.length === snapshot.length &&
        players.every((p, i) => p.id === snapshot[i].id && p.name === snapshot[i].name && p.character === snapshot[i].character);
    if (same) return;
    snapshot = players;
    live = connected;
    listeners.forEach((fn) => fn());
}

export function onPresence(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
