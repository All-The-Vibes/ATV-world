import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { send, setStick } from '../game/commands';
import { useTouch } from './device';
import './touch.css';

/** Below this share of the stick's reach it's still standing; past sin(22.5°) on an axis it walks that way (eight directions, like the arrows). */
const DEAD = 0.22;
const AXIS = 0.38;

/**
 * Thumb controls for phones and tablets: a stick bottom-left that walks like the arrow keys, and a Pulse
 * button bottom-right that does what Space does. Keyboards don't need them, so they only show for touch.
 */
export function TouchControls({ walk, pulse }: { walk: boolean; pulse: boolean }) {
    const touch = useTouch();
    if (!touch || (!walk && !pulse)) return null;
    return (
        <div className="touch-controls">
            {walk && <Stick />}
            {pulse && (
                <button type="button" className="touch-pulse" aria-label="Vibe pulse" onClick={() => send('pulse')}>
                    <span className="touch-pulse-gem" aria-hidden="true">✦</span>
                    <span aria-hidden="true">PULSE</span>
                </button>
            )}
        </div>
    );
}

function Stick() {
    const base = useRef<HTMLDivElement>(null);
    const finger = useRef<number | null>(null);
    const followed = useRef(false);
    const [knob, setKnob] = useState({ x: 0, y: 0, on: false });

    const release = () => {
        finger.current = null;
        followed.current = false;
        setKnob({ x: 0, y: 0, on: false });
        setStick(0, 0);
    };

    // Let go if the page hides or the stick goes away mid-walk, so nobody keeps walking on their own.
    useEffect(() => {
        const hide = () => { if (document.hidden) release(); };
        document.addEventListener('visibilitychange', hide);
        window.addEventListener('blur', release);
        return () => {
            document.removeEventListener('visibilitychange', hide);
            window.removeEventListener('blur', release);
            setStick(0, 0);
        };
    }, []);

    const steer = (e: PointerEvent<HTMLDivElement>) => {
        const r = base.current!.getBoundingClientRect();
        const reach = r.width / 2;
        let x = e.clientX - (r.left + reach);
        let y = e.clientY - (r.top + reach);
        const len = Math.hypot(x, y);
        const max = reach * 0.62;
        if (len > max) {
            x = (x / len) * max;
            y = (y / len) * max;
        }
        setKnob({ x, y, on: true });
        if (len < reach * DEAD) return setStick(0, 0);
        const nx = x / Math.hypot(x, y), ny = y / Math.hypot(x, y);
        setStick(Math.abs(nx) > AXIS ? nx : 0, Math.abs(ny) > AXIS ? ny : 0);
        // The first push brings the camera to the player (and in from the whole-world view).
        if (!followed.current) {
            followed.current = true;
            send('follow');
        }
    };

    return (
        <div
            ref={base}
            className="touch-stick"
            data-on={knob.on || undefined}
            aria-hidden="true"
            onPointerDown={(e) => {
                if (finger.current !== null) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                finger.current = e.pointerId;
                steer(e);
            }}
            onPointerMove={(e) => { if (e.pointerId === finger.current) steer(e); }}
            onPointerUp={(e) => { if (e.pointerId === finger.current) release(); }}
            onPointerCancel={(e) => { if (e.pointerId === finger.current) release(); }}
            onLostPointerCapture={(e) => { if (e.pointerId === finger.current) release(); }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <span className="touch-stick-arrow" data-dir="up" />
            <span className="touch-stick-arrow" data-dir="right" />
            <span className="touch-stick-arrow" data-dir="down" />
            <span className="touch-stick-arrow" data-dir="left" />
            <span className="touch-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
    );
}
