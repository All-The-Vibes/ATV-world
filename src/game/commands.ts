/** Tiny bus between the React UI and the game (e.g. the zoom buttons). */
export type Command = 'zoomIn' | 'zoomOut' | 'fit' | 'leaveHQ';

/** Screen px that UI panels cover along each edge (the panels keep it current), so the camera can frame things beside them. */
export const insets = { top: 0, right: 0, bottom: 0, left: 0 };

const bus = new EventTarget();

export const send = (command: Command) => bus.dispatchEvent(new Event(command));

/** Listen for a command. Returns a function that stops listening. */
export function on(command: Command, fn: () => void): () => void {
    bus.addEventListener(command, fn);
    return () => bus.removeEventListener(command, fn);
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

/** True while a text field has focus, so game keys don't steal typing. */
export function isTyping(): boolean {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
