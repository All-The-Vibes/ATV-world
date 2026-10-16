import type Phaser from 'phaser';
import { insets, isTyping, on } from './commands';

/** Zoom steps for +/-, the wheel and the buttons. Zooming out stops at "fit". */
const LADDER = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
const SAVE = 'atv:view';
/** Screen px kept clear when fitting: the banner on top, the badges at the bottom. */
const MARGIN = { top: 96, bottom: 64, side: 24 };

type Mode = 'fit' | 'free' | 'follow';

interface Saved {
    mode: Mode;
    cx: number;
    cy: number;
    zoom: number;
    player?: { x: number; y: number };
}

export interface ViewOptions {
    /** The part of the world F shows. Read every frame, so it can grow. */
    bounds: () => Phaser.Geom.Rectangle;
    /** The camera follows it once it moves while zoomed in. Reloads put it back where it was. */
    player?: { x: number; y: number };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const insetsKey = () => `${insets.top},${insets.right},${insets.bottom},${insets.left}`;

/** Keep a view `span` wide inside [lo, hi]. A world smaller than the view sits in the middle. */
const keepOn = (c: number, lo: number, hi: number, span: number) =>
    hi - lo <= span ? (lo + hi) / 2 : clamp(c, lo + span / 2, hi - span / 2);

function load(): Saved | null {
    try {
        const s = JSON.parse(sessionStorage.getItem(SAVE) ?? 'null') as Saved | null;
        if (!s || !['fit', 'free', 'follow'].includes(s.mode) || ![s.cx, s.cy, s.zoom].every(Number.isFinite)) return null;
        return s;
    } catch {
        return null;
    }
}

/**
 * The camera: F (or FIT) shows the whole world, +/-, the wheel and the buttons zoom, dragging looks
 * around, and the camera follows the player once it walks while zoomed in. The view survives
 * reloads, so the live page reloading after each push doesn't jump around.
 */
export class WorldView {
    private mode: Mode = 'fit';
    private cx = 0;
    private cy = 0;
    private zoomLevel = 1;
    private drag: { x: number; y: number; moved: boolean } | null = null;
    private lastWheel = 0;
    private lastSave = 0;
    private playerAt = { x: NaN, y: NaN };
    /** True while the view is still where show() put it (nobody has zoomed, dragged, or walked since). */
    private shown = false;
    private shownArea = { x: 0, y: 0, width: 1, height: 1 };
    private shownInsets = '';

    constructor(private readonly scene: Phaser.Scene, private readonly opts: ViewOptions) {
        const saved = load();
        if (saved && saved.mode !== 'fit') {
            this.mode = saved.mode;
            this.cx = saved.cx;
            this.cy = saved.cy;
            this.zoomLevel = clamp(saved.zoom, 0.1, 8);
        }
        const p = opts.player;
        if (p && saved?.player && Number.isFinite(saved.player.x) && Number.isFinite(saved.player.y)) {
            const b = opts.bounds();
            p.x = clamp(saved.player.x, b.left, b.right);
            p.y = clamp(saved.player.y, b.top, b.bottom);
        }

        const input = scene.input;
        // A plain window listener: Phaser's 'keydown' can repeat an event when several keys land in one frame.
        const onKey = (e: KeyboardEvent) => {
            if (!scene.sys.isActive() || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
            if (e.key === '+' || e.key === '=') this.zoom(1);
            else if (e.key === '-' || e.key === '_') this.zoom(-1);
            else if (e.key === 'f' || e.key === 'F') this.fit();
        };
        const onWheel = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
            // Trackpads send a stream of small wheel events: one zoom step per gesture.
            const now = performance.now();
            if (Math.abs(dy) < 2 || now - this.lastWheel < 120) return;
            this.lastWheel = now;
            this.zoom(dy < 0 ? 1 : -1, pointer.x, pointer.y);
        };
        const onDown = (pointer: Phaser.Input.Pointer) => {
            this.drag = { x: pointer.x, y: pointer.y, moved: false };
        };
        const onMove = (pointer: Phaser.Input.Pointer) => {
            const d = this.drag;
            if (!d || !pointer.isDown) return;
            const dx = pointer.x - d.x;
            const dy = pointer.y - d.y;
            // A small wobble is still a click.
            if (!d.moved && Math.hypot(dx, dy) < 4) return;
            d.moved = true;
            d.x = pointer.x;
            d.y = pointer.y;
            if (this.mode === 'fit') return;
            this.cx -= dx / this.zoomLevel;
            this.cy -= dy / this.zoomLevel;
            this.mode = 'free';
            this.shown = false;
        };
        const onUp = () => {
            this.drag = null;
        };
        const save = () => this.save();
        const off = [
            on('zoomIn', () => this.zoom(1)),
            on('zoomOut', () => this.zoom(-1)),
            on('fit', () => this.fit()),
        ];
        window.addEventListener('keydown', onKey);
        input.on('wheel', onWheel);
        input.on('pointerdown', onDown);
        input.on('pointermove', onMove);
        input.on('pointerup', onUp);
        input.on('pointerupoutside', onUp);
        scene.events.on('postupdate', this.apply, this);
        window.addEventListener('pagehide', save);

        let done = false;
        const stop = () => {
            if (done) return;
            done = true;
            off.forEach((f) => f());
            window.removeEventListener('keydown', onKey);
            input.off('wheel', onWheel);
            input.off('pointerdown', onDown);
            input.off('pointermove', onMove);
            input.off('pointerup', onUp);
            input.off('pointerupoutside', onUp);
            scene.events.off('postupdate', this.apply, this);
            window.removeEventListener('pagehide', save);
        };
        scene.events.once('shutdown', stop);
        scene.events.once('destroy', stop);

        this.apply(0, 0);
    }

    /** Show the whole world. It stays fitted as the world grows or the window resizes. */
    fit() {
        this.mode = 'fit';
        this.shown = false;
    }

    /** Whether the view is still on whatever show() last framed. */
    get showing(): boolean {
        return this.shown && this.mode === 'free';
    }

    /** The player was just moved by code (into a building, say): don't take it as walking off. */
    trackPlayer() {
        const p = this.opts.player;
        if (p) this.playerAt = { x: p.x, y: p.y };
    }

    /**
     * Zoom in on one part of the world (a building, say) as close as fits beside the UI. It stays framed
     * while UI panels come and go, until someone zooms, drags, or walks.
     */
    show(area: { x: number; y: number; width: number; height: number }) {
        const cam = this.scene.cameras.main;
        const left = MARGIN.side + insets.left, right = MARGIN.side + insets.right;
        const top = MARGIN.top + insets.top, bottom = MARGIN.bottom + insets.bottom;
        const w = Math.max(1, cam.width - left - right) / Math.max(1, area.width);
        const h = Math.max(1, cam.height - top - bottom) / Math.max(1, area.height);
        const zoom = clamp(Math.min(w, h) * 0.92, 0.1, 8);
        // The biggest zoom step that fits keeps pixels crisp (or as crisp as it gets).
        const step = [...LADDER].reverse().find((l) => l <= zoom + 1e-3) ?? zoom;
        this.zoomLevel = Math.max(step, this.fitZoom());
        this.cx = area.x + area.width / 2 - (left - right) / 2 / this.zoomLevel;
        this.cy = area.y + area.height / 2 - (top - bottom) / 2 / this.zoomLevel;
        this.mode = 'free';
        this.shown = true;
        this.shownArea = { ...area };
        this.shownInsets = insetsKey();
        this.trackPlayer();
    }

    /** Step along the zoom ladder, keeping screen point (sx, sy) still (the middle if omitted). */
    zoom(dir: 1 | -1, sx?: number, sy?: number) {
        const z = this.zoomLevel;
        const next = dir > 0 ? LADDER.find((l) => l > z + 1e-3) : [...LADDER].reverse().find((l) => l < z - 1e-3);
        if (next === undefined || next < this.fitZoom() - 1e-3) {
            if (dir < 0) this.fit();
            return;
        }
        const cam = this.scene.cameras.main;
        if (sx !== undefined && sy !== undefined && this.mode !== 'follow') {
            const dx = sx - cam.width / 2;
            const dy = sy - cam.height / 2;
            this.cx += dx / z - dx / next;
            this.cy += dy / z - dy / next;
        }
        this.zoomLevel = next;
        if (this.mode === 'fit') this.mode = 'free';
        this.shown = false;
    }

    private fitZoom() {
        const b = this.opts.bounds();
        const { width, height } = this.scene.cameras.main;
        const w = Math.max(1, width - MARGIN.side * 2 - insets.left - insets.right) / Math.max(1, b.width);
        const h = Math.max(1, height - MARGIN.top - MARGIN.bottom - insets.top - insets.bottom) / Math.max(1, b.height);
        return clamp(Math.min(w, h), 0.1, 8);
    }

    // Runs after the scene's update, right before the frame is drawn.
    private apply(_time: number, delta: number) {
        const cam = this.scene.cameras.main;
        const b = this.opts.bounds();
        // A panel opened, closed, or grew while something was framed: frame it again beside the panel.
        if (this.showing && insetsKey() !== this.shownInsets) this.show(this.shownArea);
        const fit = this.fitZoom();
        const p = this.opts.player;
        if (p) {
            const moved = Math.abs(p.x - this.playerAt.x) > 0.01 || Math.abs(p.y - this.playerAt.y) > 0.01;
            if (moved && this.mode === 'free' && Number.isFinite(this.playerAt.x)) this.mode = 'follow';
            this.playerAt = { x: p.x, y: p.y };
        }
        if (this.zoomLevel < fit - 1e-3) this.mode = 'fit';

        if (this.mode === 'fit') {
            this.zoomLevel = fit;
            this.cx = b.centerX - (insets.left - insets.right) / 2 / fit;
            this.cy = b.centerY - (MARGIN.top + insets.top - MARGIN.bottom - insets.bottom) / 2 / fit;
        } else {
            if (this.mode === 'follow' && p) {
                const k = delta > 0 ? 1 - Math.exp(-delta / 120) : 1;
                this.cx += (p.x - this.cx) * k;
                this.cy += (p.y - this.cy) * k;
            }
            this.cx = keepOn(this.cx, b.left, b.right, cam.width / this.zoomLevel);
            this.cy = keepOn(this.cy, b.top, b.bottom, cam.height / this.zoomLevel);
        }
        cam.setZoom(this.zoomLevel).centerOn(this.cx, this.cy);

        const now = performance.now();
        if (now - this.lastSave > 500) this.save(now);
    }

    private save(now = performance.now()) {
        this.lastSave = now;
        const p = this.opts.player;
        const saved: Saved = { mode: this.mode, cx: this.cx, cy: this.cy, zoom: this.zoomLevel, player: p && { x: p.x, y: p.y } };
        try {
            sessionStorage.setItem(SAVE, JSON.stringify(saved));
        } catch {
            // Storage can be off (private mode): the view just won't survive reloads.
        }
    }
}
