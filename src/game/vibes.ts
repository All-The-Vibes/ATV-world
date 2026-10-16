export interface VibeState {
    active: boolean;
    collected: number;
    total: number;
    score: number;
    streak: number;
    round: number;
    rush: boolean;
    message: string;
}

let state: VibeState = {
    active: false,
    collected: 0,
    total: 0,
    score: 0,
    streak: 0,
    round: 1,
    rush: false,
    message: '',
};

const listeners = new Set<() => void>();

export const getVibes = () => state;

export function publishVibes(next: VibeState) {
    state = next;
    listeners.forEach((listener) => listener());
}

export function onVibes(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
