/**
 * What the live world map (MiniMap.tsx) shows. The world scene (src/game/scenes/Preview.ts) fills it in:
 * every building, tree, and prop it places, plus the named areas people made, each with its creator.
 * The map reads it every frame, so live things (the player, the townsfolk, the camera) can be shared by reference.
 */

export interface Point {
    x: number;
    y: number;
}

export interface Box extends Point {
    width: number;
    height: number;
}

/** A place on the map: click it to see who made it and what it is. */
export interface AreaInfo {
    /** Unique id, e.g. `atv-hq`. */
    id: string;
    name: string;
    /** Who made it. */
    by: string;
    /** A sentence or two about it. */
    about: string;
    /** Its color on the map: any CSS color. */
    color?: string;
}

export interface Area extends AreaInfo {
    /** Where it is in world px. Read every frame, so it can grow (like ATV HQ does). */
    bounds: () => Box;
}

export type FeatureKind = 'building' | 'tree' | 'prop';

/** Anything placed in the world, named or not, so the map shows everything people built. */
export interface Feature extends Box {
    kind: FeatureKind;
}

export const worldMap = {
    world: { x: 0, y: 0, width: 1, height: 1 } as Box,
    /** The part of the world the camera shows right now. */
    view: { x: 0, y: 0, width: 0, height: 0 } as Box,
    player: undefined as Point | undefined,
    walkers: [] as readonly Point[],
    features: [] as Feature[],
    areas: new Map<string, Area>(),
};

const bus = new EventTarget();
let version = 0;

const changed = () => {
    version++;
    bus.dispatchEvent(new Event('areas'));
};

/** Put a place on the map. Adding the same id again replaces it. */
export function addArea(info: AreaInfo, bounds: () => Box) {
    worldMap.areas.set(info.id, { ...info, bounds });
    changed();
}

export function addFeature(kind: FeatureKind, { x, y, width, height }: Box) {
    worldMap.features.push({ kind, x, y, width, height });
}

/** Forget everything (the world scene starts over). */
export function resetMap() {
    worldMap.areas.clear();
    worldMap.features.length = 0;
    worldMap.player = undefined;
    worldMap.walkers = [];
    changed();
}

export const areasVersion = () => version;

/** Listen for areas coming and going. Returns a function that stops listening. */
export function onAreasChange(fn: () => void): () => void {
    bus.addEventListener('areas', fn);
    return () => bus.removeEventListener('areas', fn);
}

/** What the map asks the camera to do: frame an area, or look at a spot. */
export type MapRequest = { area: string } | Point;

export function requestView(req: MapRequest) {
    bus.dispatchEvent(new CustomEvent<MapRequest>('request', { detail: req }));
}

/** The world scene listens for the map's requests. Returns a function that stops listening. */
export function onMapRequest(fn: (req: MapRequest) => void): () => void {
    const listener = (e: Event) => fn((e as CustomEvent<MapRequest>).detail);
    bus.addEventListener('request', listener);
    return () => bus.removeEventListener('request', listener);
}
