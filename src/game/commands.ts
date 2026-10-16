/** Tiny bus between the React UI and the game (e.g. the zoom buttons). */
export type Command = 'zoomIn' | 'zoomOut' | 'fit';

const bus = new EventTarget();

export const send = (command: Command) => bus.dispatchEvent(new Event(command));

/** Listen for a command. Returns a function that stops listening. */
export function on(command: Command, fn: () => void): () => void {
    bus.addEventListener(command, fn);
    return () => bus.removeEventListener(command, fn);
}

/** True while a text field has focus, so game keys don't steal typing. */
export function isTyping(): boolean {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
