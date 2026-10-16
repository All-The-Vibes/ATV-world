import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isTyping } from '../game/commands';
import { MAX_CHAT, chatState, onChat, sendChat, type ChatChannel } from './chat';
import './chat.css';

const RECENT_MS = 15_000;
const SHOW_CLOSED = 5;
const SHOW_OPEN = 12;

/**
 * The chat box: Enter (or the chat button) opens it, Enter sends, Escape closes, Tab flips between World chat
 * (everyone on the site) and Nearby chat (only players standing close to you). While it's closed, the last few
 * lines linger for a bit and then fade away.
 */
export function ChatBox({ hidden, onFocusChange }: { hidden?: boolean; onFocusChange?: (focused: boolean) => void }) {
    const { lines, online } = useSyncExternalStore(onChat, chatState);
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [channel, setChannel] = useState<ChatChannel>('world');
    const [, setTick] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const log = useRef<HTMLOListElement>(null);

    useEffect(() => {
        if (hidden) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping()) return;
            e.preventDefault();
            setOpen(true);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [hidden]);

    useEffect(() => {
        if (open) input.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!hidden) return;
        setOpen(false);
        onFocusChange?.(false);
    }, [hidden, onFocusChange]);

    // Re-render now and then so old lines fade out of the closed view.
    useEffect(() => {
        if (open) return;
        const t = window.setInterval(() => setTick((n) => n + 1), 2000);
        return () => window.clearInterval(t);
    }, [open]);

    useEffect(() => {
        log.current?.scrollTo({ top: log.current.scrollHeight });
    }, [lines, open]);

    if (hidden) return null;

    const now = Date.now();
    const shown = open ? lines.slice(-SHOW_OPEN) : lines.slice(-SHOW_CLOSED).filter((l) => now - l.at < RECENT_MS);
    const close = () => {
        setOpen(false);
        setText('');
        input.current?.blur();
    };

    return (
        <div className="chat" data-open={open || undefined}>
            {shown.length > 0 && (
                <ol className="chat-log" ref={log} aria-live="polite" aria-label="Chat messages">
                    {shown.map((l) => (
                        <li key={l.key} className="chat-line" data-channel={l.channel} data-mine={l.mine || undefined} data-system={l.system || undefined}>
                            {l.system ? (
                                <span className="chat-text">{l.text}</span>
                            ) : (
                                <>
                                    {l.channel === 'nearby' && <span className="chat-tag">NEARBY</span>}
                                    <span className="chat-from">{l.from}:</span> <span className="chat-text">{l.text}</span>
                                </>
                            )}
                        </li>
                    ))}
                </ol>
            )}
            {open ? (
                <form
                    className="chat-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (text.trim()) sendChat(text, channel);
                        close();
                    }}
                >
                    <button
                        type="button"
                        className="chat-channel"
                        data-channel={channel}
                        title="Switch between World and Nearby chat (Tab)"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setChannel((c) => (c === 'world' ? 'nearby' : 'world'))}
                    >
                        {channel === 'world' ? 'WORLD' : 'NEARBY'}
                    </button>
                    <input
                        ref={input}
                        type="text"
                        value={text}
                        maxLength={MAX_CHAT}
                        placeholder={channel === 'world' ? 'Say something to everyone...' : 'Say something to people near you...'}
                        aria-label={channel === 'world' ? 'World chat message' : 'Nearby chat message'}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setText(e.target.value)}
                        onFocus={() => onFocusChange?.(true)}
                        onBlur={() => {
                            onFocusChange?.(false);
                            setOpen(false);
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Escape') close();
                            else if (e.key === 'Tab') {
                                e.preventDefault();
                                setChannel((c) => (c === 'world' ? 'nearby' : 'world'));
                            }
                        }}
                        onKeyUp={(e) => e.stopPropagation()}
                    />
                </form>
            ) : (
                <button
                    type="button"
                    className="chat-open"
                    title="Chat (Enter)"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setOpen(true)}
                >
                    💬 CHAT{!online && <span className="chat-offline"> · OFFLINE</span>}
                </button>
            )}
        </div>
    );
}
