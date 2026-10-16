import type { RoleId } from './roles';

/** Tiny bus between the Agent Factory panel (React) and the factory in the world (Phaser). */
export interface AgentInfo {
    id: number;
    role: RoleId;
    /** e.g. DEV-1 */
    name: string;
}

export interface FactoryState {
    /** The role picker is showing. */
    open: boolean;
    agents: readonly AgentInfo[];
}

let state: FactoryState = { open: false, agents: [] };
const listeners = new Set<() => void>();
const spawnHandlers = new Set<(role: RoleId) => void>();
const dismissHandlers = new Set<(id?: number) => void>();

const set = (next: FactoryState) => {
    state = next;
    listeners.forEach((fn) => fn());
};

export const getFactory = () => state;

export function subscribeFactory(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function setFactoryOpen(open: boolean) {
    if (open !== state.open) set({ ...state, open });
}

export const setFactoryAgents = (agents: readonly AgentInfo[]) => set({ ...state, agents });

/** Ask the world to build an agent. Does nothing when the factory isn't in the world. */
export const requestSpawn = (role: RoleId) => spawnHandlers.forEach((fn) => fn(role));

/** Send one agent (or, with no id, all of them) home. */
export const requestDismiss = (id?: number) => dismissHandlers.forEach((fn) => fn(id));

export function onSpawn(fn: (role: RoleId) => void): () => void {
    spawnHandlers.add(fn);
    return () => spawnHandlers.delete(fn);
}

export function onDismiss(fn: (id?: number) => void): () => void {
    dismissHandlers.add(fn);
    return () => dismissHandlers.delete(fn);
}
