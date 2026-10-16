/** Tiny bus between the React UI and the game (e.g. the zoom buttons). */
export type Command = 'zoomIn' | 'zoomOut' | 'fit' | 'leaveHQ' | 'toggleNight' | 'toggleStranger' | 'pulse' | 'follow';

/** Screen px that UI panels cover along each edge (the panels keep it current), so the camera can frame things beside them. */
export const insets = { top: 0, right: 0, bottom: 0, left: 0 };

const bus = new EventTarget();

export const send = (command: Command) => bus.dispatchEvent(new Event(command));

/** Listen for a command. Returns a function that stops listening. */
export function on(command: Command, fn: () => void): () => void {
    bus.addEventListener(command, fn);
    return () => bus.removeEventListener(command, fn);
}

/** One switch for creator labels in every scene, including characters spawned later. Off until turned on in Settings; the choice sticks. */
const GITHUB_LABELS_KEY = 'atv-github-labels';
let githubLabels = (() => {
    try {
        return localStorage.getItem(GITHUB_LABELS_KEY) === '1';
    } catch {
        return false;
    }
})();
export const githubLabelsVisible = () => githubLabels;

export function toggleGithubLabels() {
    githubLabels = !githubLabels;
    try {
        localStorage.setItem(GITHUB_LABELS_KEY, githubLabels ? '1' : '0');
    } catch { /* Private mode: the switch still works for this visit. */ }
    bus.dispatchEvent(new Event('githubLabels'));
}

export function onGithubLabels(fn: () => void): () => void {
    bus.addEventListener('githubLabels', fn);
    return () => bus.removeEventListener('githubLabels', fn);
}

/** Whether Night View and Stranger Things (Upside Down) View are active. */
export interface ViewModes {
    night: boolean;
    stranger: boolean;
}

let viewModes: ViewModes = { night: false, stranger: false };

export const getViewModes = (): ViewModes => viewModes;

export function setViewModes(patch: Partial<ViewModes>) {
    const next: ViewModes = { ...viewModes, ...patch };
    if (next.night === viewModes.night && next.stranger === viewModes.stranger) return;
    viewModes = next;
    bus.dispatchEvent(new Event('viewModes'));
}

export function onViewModes(fn: () => void): () => void {
    bus.addEventListener('viewModes', fn);
    return () => bus.removeEventListener('viewModes', fn);
}

/** Whether the player is inside ATV HQ. The game sets it; the call panel only shows in there. */
let insideHQ = false;

export const isInsideHQ = () => insideHQ;

export function setInsideHQ(inside: boolean) {
    if (inside === insideHQ) return;
    insideHQ = inside;
    bus.dispatchEvent(new Event('insideHQ'));
}

/** Listen for the player going in or out of ATV HQ. Returns a function that stops listening. */
export function onInsideHQ(fn: () => void): () => void {
    bus.addEventListener('insideHQ', fn);
    return () => bus.removeEventListener('insideHQ', fn);
}

/** The free tokens the player has picked up from the flying cars' drops, kept through reloads. */
const TOKENS_KEY = 'atv-tokens';
let tokens = (() => {
    try {
        return Math.max(0, Number(localStorage.getItem(TOKENS_KEY)) || 0);
    } catch {
        return 0;
    }
})();

export const tokenCount = () => tokens;

export function addToken() {
    tokens++;
    try {
        localStorage.setItem(TOKENS_KEY, String(tokens));
    } catch { /* private mode: the count just won't stick */ }
    bus.dispatchEvent(new Event('tokens'));
}

/** A gremlin snatched one. Returns whether there was a token to take. */
export function removeToken(): boolean {
    if (tokens <= 0) return false;
    tokens--;
    try {
        localStorage.setItem(TOKENS_KEY, String(tokens));
    } catch { /* private mode: the count just won't stick */ }
    bus.dispatchEvent(new Event('tokens'));
    return true;
}

/** Listen for the player's token count changing. Returns a function that stops listening. */
export function onTokens(fn: () => void): () => void {
    bus.addEventListener('tokens', fn);
    return () => bus.removeEventListener('tokens', fn);
}

/** The on-screen joystick (src/touch/TouchControls.tsx): -1, 0 or 1 on each axis, like a held arrow key. */
const stick = { x: 0, y: 0 };

export function setStick(x: number, y: number) {
    stick.x = Math.sign(x);
    stick.y = Math.sign(y);
}

type HeldKeys = { left: { isDown: boolean }; right: { isDown: boolean }; up: { isDown: boolean }; down: { isDown: boolean } };

/** Which way the player wants to walk: the arrow keys and the touch stick together, -1, 0 or 1 on each axis. */
export function walkInput(keys?: HeldKeys): { dx: number; dy: number } {
    const held = (k?: { isDown: boolean }) => Number(!!k?.isDown);
    const axis = (v: number) => Math.max(-1, Math.min(1, v));
    return {
        dx: axis(held(keys?.right) - held(keys?.left) + stick.x),
        dy: axis(held(keys?.down) - held(keys?.up) + stick.y),
    };
}

/** The scene on top right now ('Preview', 'Library', 'Mars', ...), so the touch controls know what they drive. */
let scene = '';

export const activeScene = () => scene;

export function setActiveScene(key: string) {
    if (key === scene) return;
    scene = key;
    bus.dispatchEvent(new Event('scene'));
}

export function onActiveScene(fn: () => void): () => void {
    bus.addEventListener('scene', fn);
    return () => bus.removeEventListener('scene', fn);
}

/** True while a text field has focus, so game keys don't steal typing. */
export function isTyping(): boolean {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** Someone the character search lists. `here` is false while they're away from town (a visitor between visits). */
export interface CharacterInfo {
    id: string;
    name: string;
    kind: string;
    here: boolean;
}

let characterList: readonly CharacterInfo[] = [];

/** The roster for the character search (same array until it changes, so React can compare it). */
export const getCharacters = () => characterList;

export function setCharacters(list: readonly CharacterInfo[]) {
    const same = list.length === characterList.length
        && list.every((c, i) => c.id === characterList[i].id && c.name === characterList[i].name && c.here === characterList[i].here);
    if (same) return;
    characterList = list;
    bus.dispatchEvent(new Event('characters'));
}

/** Listen for the roster changing. Returns a function that stops listening. */
export function onCharacters(fn: () => void): () => void {
    bus.addEventListener('characters', fn);
    return () => bus.removeEventListener('characters', fn);
}

/** Ask the camera to zoom in on one character (from the character search). */
export const focusCharacter = (id: string) => bus.dispatchEvent(new CustomEvent('focusCharacter', { detail: id }));

/** Listen for focus requests. Returns a function that stops listening. */
export function onFocusCharacter(fn: (id: string) => void): () => void {
    const handler = (e: Event) => fn((e as CustomEvent<string>).detail);
    bus.addEventListener('focusCharacter', handler);
    return () => bus.removeEventListener('focusCharacter', handler);
}
