/**
 * Player chat: the log the chat box shows, and the hook the game's Multiplayer uses to send lines.
 *
 * Two channels: `world` reaches everyone on the site, `nearby` (proximity chat) only reaches players within
 * NEARBY_RADIUS world pixels of the speaker. Lines also pop up as speech bubbles over whoever said them.
 */

export type ChatChannel = 'world' | 'nearby';

/** How close (in world pixels) someone has to stand to hear a nearby line. */
export const NEARBY_RADIUS = 220;
export const MAX_CHAT = 140;
const KEEP = 60;
const MIN_GAP_MS = 700;

export interface ChatLine {
    key: number;
    from: string;
    text: string;
    channel: ChatChannel;
    mine: boolean;
    /** A note from the game itself (offline, too fast...). */
    system?: boolean;
    at: number;
}

export interface ChatState {
    lines: ChatLine[];
    online: boolean;
}

type Sender = (text: string, channel: ChatChannel) => void;

let state: ChatState = { lines: [], online: false };
let nextKey = 1;
let sender: Sender | undefined;
let lastSent = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

export const cleanChat = (raw: string) => raw.replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT);

export function onChat(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

export const chatState = (): ChatState => state;

export function pushChat(line: Omit<ChatLine, 'key' | 'at'>) {
    const lines = [...state.lines, { ...line, key: nextKey++, at: Date.now() }];
    state = { ...state, lines: lines.slice(-KEEP) };
    emit();
}

export function setChatOnline(online: boolean) {
    if (state.online === online) return;
    state = { ...state, online };
    emit();
}

/** The game registers how to put a line on the wire (and over the player's head). */
export function setChatSender(fn: Sender | undefined) {
    sender = fn;
}

/** Say something. Returns false (and leaves a note in the log) when it couldn't be said. */
export function sendChat(raw: string, channel: ChatChannel): boolean {
    const text = cleanChat(raw);
    if (!text) return false;
    const now = Date.now();
    if (now - lastSent < MIN_GAP_MS) {
        pushChat({ from: '', text: 'Slow down a little.', channel, mine: false, system: true });
        return false;
    }
    if (!sender) {
        pushChat({ from: '', text: 'Chat works in town. Head back to talk.', channel, mine: false, system: true });
        return false;
    }
    lastSent = now;
    sender(text, channel);
    return true;
}
