import { useSyncExternalStore } from 'react';

/** Phones (and short landscape screens): the HUD packs into compact stacks. Keep in step with the CSS media queries. */
export const PHONE = '(max-width: 600px), (max-height: 500px)';

const bus = new EventTarget();

/**
 * Whether someone is playing by touch: a coarse pointer, or any touch at all (a laptop with a touchscreen).
 * It sets `data-touch` on <html> so the CSS can grow tap targets and swap keyboard hints.
 */
let touch = matchMedia('(pointer: coarse)').matches;

function mark() {
    document.documentElement.toggleAttribute('data-touch', touch);
}
mark();

window.addEventListener('touchstart', () => {
    if (touch) return;
    touch = true;
    mark();
    bus.dispatchEvent(new Event('touch'));
}, { passive: true, capture: true });

export const isTouch = () => touch;

export function onTouch(fn: () => void): () => void {
    bus.addEventListener('touch', fn);
    return () => bus.removeEventListener('touch', fn);
}

export const useTouch = () => useSyncExternalStore(onTouch, isTouch);
