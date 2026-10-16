import type Phaser from 'phaser';
import { PixelCanvas } from './pixels';

export interface FrameRect {
    name: string | number;
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Hand a PixelCanvas to Phaser as a texture, optionally slicing it into named frames.
 * Existing keys are kept unless `replace` is true (so repeat calls are cheap).
 */
export function addPixels(scene: Phaser.Scene, key: string, pc: PixelCanvas, frames: FrameRect[] = [], replace = false): string {
    const tm = scene.textures;
    if (tm.exists(key)) {
        if (!replace) return key;
        tm.remove(key);
    }
    const tex = tm.addCanvas(key, pc.flush());
    if (tex) for (const f of frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
    return key;
}

/** Draw a texture only the first time its key is needed. */
export function ensurePixels(scene: Phaser.Scene, key: string, draw: () => PixelCanvas | { canvas: PixelCanvas; frames: FrameRect[] }): string {
    if (scene.textures.exists(key)) return key;
    const out = draw();
    return out instanceof PixelCanvas ? addPixels(scene, key, out) : addPixels(scene, key, out.canvas, out.frames);
}

/** Equal-width frames laid out left to right. */
export const stripFrames = (count: number, w: number, h: number): FrameRect[] =>
    Array.from({ length: count }, (_, i) => ({ name: i, x: i * w, y: 0, w, h }));

/** Soft oval shadow drawn under trees, people, and props (used with alpha ~0.3). */
export function shadowTexture(scene: Phaser.Scene, w: number): string {
    const width = Math.max(4, Math.round(w));
    const h = Math.max(3, Math.round(width * 0.38));
    return ensurePixels(scene, `shadow-${width}`, () => new PixelCanvas(width, h).ellipse(width / 2, h / 2, width / 2, h / 2, 'ink'));
}
