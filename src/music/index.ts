import { isTyping } from '../game/commands';
import track from './arcade.mp3';

/** Background music: an 80s arcade loop made with Gemini. Browsers hold sound until the first click or key press, so it starts then. M mutes it. */
const music = new Audio(track);
music.loop = true;
music.volume = 0.35;

const start = () => {
    if (music.paused) music.play().catch(() => {});
};

start();
window.addEventListener('pointerdown', start, true);
window.addEventListener('keydown', (e) => {
    start();
    if ((e.key === 'm' || e.key === 'M') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping()) music.muted = !music.muted;
}, true);

// Handy from the browser console: atv.music.muted = true, ...
const w = window as unknown as { atv?: Record<string, unknown> };
w.atv = { ...w.atv, music };
