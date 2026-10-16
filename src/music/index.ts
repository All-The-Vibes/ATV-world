import { isTyping } from '../game/commands';
import track from './arcade.mp3';

/**
 * Background music: an 80s arcade loop made with Gemini. Browsers hold sound until the first click or key press,
 * so it starts then. The speaker button or M turns it off and on, and the choice sticks through the LIVE badge's reloads.
 */
const MUTED = 'atv:muted';

export const music = new Audio(track);
music.loop = true;
music.volume = 0.35;
try {
    music.muted = localStorage.getItem(MUTED) === '1';
} catch {
    // No storage: sound starts on.
}

export function toggleSound() {
    music.muted = !music.muted;
    try {
        localStorage.setItem(MUTED, music.muted ? '1' : '0');
    } catch {
        // No storage: the choice lasts until the next reload.
    }
}

/** Listen for the sound going off or on. Returns a function that stops listening. */
export function onSoundChange(fn: () => void): () => void {
    music.addEventListener('volumechange', fn);
    return () => music.removeEventListener('volumechange', fn);
}

const start = () => {
    if (music.paused) music.play().catch(() => {});
};

start();
window.addEventListener('pointerdown', start, true);
window.addEventListener('keydown', (e) => {
    start();
    if ((e.key === 'm' || e.key === 'M') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping()) toggleSound();
}, true);

// Handy from the browser console: atv.music.volume = 0.5, ...
const w = window as unknown as { atv?: Record<string, unknown> };
w.atv = { ...w.atv, music };
