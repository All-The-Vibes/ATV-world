import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import { PALETTE } from '../game/kit/palette';
import { isTyping } from '../game/commands';
import { PHONE, useTouch } from '../touch/device';
import { areasVersion, onAreasChange, requestView, worldMap, type Area, type Box, type Point } from './world';
import './map.css';

/**
 * The live world map: every building, tree, and prop people placed, the named areas (click one to see who
 * made it), the townsfolk, you, and what the camera shows. Clicking anywhere else looks there.
 * The map button or N shows and hides it, and the choice sticks through reloads.
 */
const OPEN = 'atv:map';
const W = 240;
const H = 150;
/** Screen px of slack around an area for clicking and hovering. */
const SLOP = 4;

const bus = new EventTarget();
let open = (() => {
    try {
        const saved = localStorage.getItem(OPEN);
        if (saved) return saved === '1';
    } catch {
        // No storage: fall through to the default.
    }
    return !matchMedia(PHONE).matches;
})();

export function toggleMap() {
    open = !open;
    try {
        localStorage.setItem(OPEN, open ? '1' : '0');
    } catch {
        // No storage: the choice lasts until the next reload.
    }
    bus.dispatchEvent(new Event('open'));
}

const isOpen = () => open;
const onOpenChange = (fn: () => void) => {
    bus.addEventListener('open', fn);
    return () => bus.removeEventListener('open', fn);
};

window.addEventListener('keydown', (e) => {
    if ((e.key === 'n' || e.key === 'N') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping()) toggleMap();
});

/** World px → map px. */
interface Fit {
    s: number;
    ox: number;
    oy: number;
}

const fitOf = (world: Box): Fit => {
    const s = Math.min(W / Math.max(1, world.width), H / Math.max(1, world.height));
    return { s, ox: (W - world.width * s) / 2 - world.x * s, oy: (H - world.height * s) / 2 - world.y * s };
};

const contains = (b: Box, p: Point, pad = 0) =>
    p.x >= b.x - pad && p.x <= b.x + b.width + pad && p.y >= b.y - pad && p.y <= b.y + b.height + pad;

/** The area under a world point: the smallest one, so a plaza inside a district still gets picked. */
function areaAt(p: Point, pad: number): Area | undefined {
    let best: Area | undefined;
    let size = Infinity;
    for (const a of worldMap.areas.values()) {
        const b = a.bounds();
        if (contains(b, p, pad) && b.width * b.height < size) {
            best = a;
            size = b.width * b.height;
        }
    }
    return best;
}

function draw(ctx: CanvasRenderingContext2D, hover: string | null, selected: string | null, now: number) {
    const { world, view, player, walkers, features, areas } = worldMap;
    const { s, ox, oy } = fitOf(world);
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy + y * s;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = PALETTE.navy;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PALETTE.leaf;
    ctx.fillRect(X(world.x), Y(world.y), world.width * s, world.height * s);

    for (const f of features) {
        if (f.kind === 'tree') {
            ctx.fillStyle = PALETTE.forest;
            ctx.beginPath();
            ctx.arc(X(f.x + f.width / 2), Y(f.y + f.height * 0.4), Math.max(2, (f.width * s) / 2), 0, Math.PI * 2);
            ctx.fill();
        } else if (f.kind === 'building') {
            ctx.fillStyle = PALETTE.clay;
            ctx.fillRect(X(f.x), Y(f.y), Math.max(2, f.width * s), Math.max(2, f.height * s));
        } else {
            ctx.fillStyle = PALETTE.mist;
            ctx.fillRect(Math.round(X(f.x + f.width / 2)) - 1, Math.round(Y(f.y + f.height)) - 2, 2, 2);
        }
    }

    for (const a of areas.values()) {
        const b = a.bounds();
        const lit = a.id === hover || a.id === selected;
        ctx.globalAlpha = lit ? 0.6 : 0.35;
        ctx.fillStyle = a.color ?? PALETTE.sky;
        ctx.fillRect(X(b.x), Y(b.y), b.width * s, b.height * s);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = a.id === selected ? PALETTE.gold : lit ? PALETTE.yellow : (a.color ?? PALETTE.sky);
        ctx.lineWidth = lit ? 2 : 1;
        ctx.strokeRect(X(b.x) + 0.5, Y(b.y) + 0.5, Math.max(1, b.width * s - 1), Math.max(1, b.height * s - 1));
    }

    ctx.fillStyle = PALETTE.cream;
    for (const w of walkers) ctx.fillRect(Math.round(X(w.x)) - 1, Math.round(Y(w.y)) - 2, 2, 2);

    // What the camera shows, clipped to the world.
    const vx = Math.max(view.x, world.x), vy = Math.max(view.y, world.y);
    const vr = Math.min(view.x + view.width, world.x + world.width), vb = Math.min(view.y + view.height, world.y + world.height);
    if (vr > vx && vb > vy && (vr - vx < world.width - 1 || vb - vy < world.height - 1)) {
        ctx.strokeStyle = PALETTE.white;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(X(vx)) + 0.5, Math.round(Y(vy)) + 0.5, Math.max(1, Math.round((vr - vx) * s) - 1), Math.max(1, Math.round((vb - vy) * s) - 1));
    }

    if (player) {
        const px = Math.round(X(player.x)), py = Math.round(Y(player.y));
        ctx.fillStyle = PALETTE.ink;
        ctx.fillRect(px - 3, py - 4, 6, 6);
        ctx.fillStyle = Math.floor(now / 400) % 2 ? PALETTE.yellow : PALETTE.gold;
        ctx.fillRect(px - 2, py - 3, 4, 4);
    }
}

/** The map button beside the zoom buttons. N does the same thing. */
export function MapButton() {
    const shown = useSyncExternalStore(onOpenChange, isOpen);
    return (
        // preventDefault on mousedown keeps keyboard focus on the game.
        <button type="button" className="map-toggle" title={`World map ${shown ? 'on' : 'off'} (N)`} aria-label="World map" aria-pressed={shown} onMouseDown={(e) => e.preventDefault()} onClick={toggleMap}>
            <svg viewBox="0 0 12 12" width="18" height="18" shapeRendering="crispEdges" aria-hidden="true">
                <path fill="currentColor" d="M0 2h1v9H0zM1 1h3v1H1zM4 2h1v9H4zM5 1h3v1H5zM8 2h1v9H8zM9 1h3v1H9zM11 2h1v9h-1zM1 10h3v1H1zM5 10h3v1H5zM9 10h2v1H9zM2 4h1v1H2zM6 6h1v1H6zM9 4h1v1H9z" />
            </svg>
        </button>
    );
}

/** The live world map panel, above the zoom buttons. */
export function MiniMap() {
    const shown = useSyncExternalStore(onOpenChange, isOpen);
    const touch = useTouch();
    useSyncExternalStore(onAreasChange, areasVersion);
    const [selected, setSelected] = useState<string | null>(null);
    const [hover, setHover] = useState<string | null>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const lit = useRef({ hover, selected });
    lit.current = { hover, selected };

    const area = selected ? worldMap.areas.get(selected) : undefined;
    const hovered = hover ? worldMap.areas.get(hover) : undefined;
    const places = [...worldMap.areas.values()].sort((a, b) => a.name.localeCompare(b.name));

    useEffect(() => {
        const el = canvas.current;
        if (!shown || !el) return;
        const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
        el.width = W * dpr;
        el.height = H * dpr;
        const ctx = el.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        let frame = 0;
        const tick = (now: number) => {
            draw(ctx, lit.current.hover, lit.current.selected, now);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [shown]);

    useEffect(() => {
        if (!selected) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelected(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected]);

    if (!shown) return null;

    const toWorld = (e: PointerEvent<HTMLCanvasElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const { s, ox, oy } = fitOf(worldMap.world);
        const k = W / r.width;
        return { at: { x: ((e.clientX - r.left) * k - ox) / s, y: ((e.clientY - r.top) * k - oy) / s }, pad: SLOP / s };
    };

    const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
        const { at, pad } = toWorld(e);
        setHover(areaAt(at, pad)?.id ?? null);
    };

    const onClick = (e: PointerEvent<HTMLCanvasElement>) => {
        const { at, pad } = toWorld(e);
        const hit = areaAt(at, pad);
        if (hit) {
            setSelected(hit.id === selected ? null : hit.id);
        } else {
            setSelected(null);
            if (contains(worldMap.world, at)) requestView(at);
        }
    };

    return (
        <section className="minimap" aria-label="World map">
            {area && (
                <div className="minimap-card" role="dialog" aria-label={area.name}>
                    <h2 style={{ borderColor: area.color }}>{area.name}</h2>
                    <p className="minimap-by">by <b>{area.by}</b></p>
                    <p>{area.about}</p>
                    <div className="minimap-actions">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => requestView({ area: area.id })}>Go look</button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSelected(null)}>Close</button>
                    </div>
                </div>
            )}
            <div className="minimap-frame">
                <div className="minimap-head">
                    <span>WORLD MAP</span>
                    <span className="minimap-count">{places.length} {places.length === 1 ? 'place' : 'places'}</span>
                </div>
                <canvas
                    ref={canvas}
                    style={{ width: W, height: H, cursor: hovered ? 'pointer' : 'crosshair' }}
                    role="img"
                    aria-label={`Map of ATV World: ${places.map((p) => p.name).join(', ') || 'nothing named yet'}`}
                    onPointerMove={onMove}
                    onPointerLeave={() => setHover(null)}
                    onPointerUp={onClick}
                />
                <p className="minimap-hint">{hovered ? `${hovered.name}, by ${hovered.by}` : `${touch ? 'Tap' : 'Click'} a place for info`}</p>
                {/* The same places as buttons, for keyboards and screen readers. */}
                <ul className="minimap-places">
                    {places.map((p) => (
                        <li key={p.id}>
                            <button type="button" onClick={() => setSelected(p.id)}>{p.name}, by {p.by}</button>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
