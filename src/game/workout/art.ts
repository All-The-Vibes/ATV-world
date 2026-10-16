import type Phaser from 'phaser';
import { PixelCanvas, dancerSheet, ensurePixels, randomLook, stripFrames, type FullLook } from '../kit';

export const MAT_W = 150;
export const MAT_H = 90;
export const BOOMBOX_W = 18;
export const BOOMBOX_H = 11;

/**
 * Christian, the workout instructor: sparkly pink tank, red shorts, orange curls and a white
 * headband, on the dancer sheet so he has arms-up and pointing poses for the routine.
 */
export function christianSheet() {
    const look: FullLook = randomLook('christian', { skin: 'peach', hair: 'orange', hairStyle: 'spiky', hat: 'pink', shirt: 'pink', pants: 'red', shoes: 'white' });
    const sheet = dancerSheet(look);
    const pc = sheet.canvas;
    for (const f of sheet.frames) {
        const name = String(f.name);
        if (name.startsWith('side')) {
            for (let y = 6; y <= 9; y++) pc.set(f.x + 3, y, 'orange').set(f.x + 2, y, 'ink');
            continue;
        }
        for (let x = 3; x <= 12; x++) pc.set(f.x + x, 6, 'white');
        for (let y = 5; y <= 8; y++) pc.set(f.x + 2, y, 'orange').set(f.x + 13, y, 'orange').set(f.x + 1, y, 'ink').set(f.x + 14, y, 'ink');
        pc.set(f.x + 6, 14, 'yellow').set(f.x + 9, 15, 'white').set(f.x + 5, 16, 'cyan');
    }
    return { look, canvas: pc, frames: sheet.frames };
}

/** The exercise mat that rolls out where the class gathers. */
export function matTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'workout-mat', () => {
        const pc = new PixelCanvas(MAT_W, MAT_H);
        for (let y = 0; y < MAT_H; y += 10) {
            for (let x = 0; x < MAT_W; x += 10) pc.rect(x, y, 10, 10, ((x + y) / 10) % 2 ? 'pink' : 'cream');
        }
        pc.rect(0, 0, MAT_W, 2, 'white').rect(0, MAT_H - 2, MAT_W, 2, 'white').rect(0, 0, 2, MAT_H, 'white').rect(MAT_W - 2, 0, 2, MAT_H, 'white');
        return pc.outline('wine');
    });
}

/** A boombox that thumps on the beat: two frames with the speakers lit or dark. */
export function boomboxTexture(scene: Phaser.Scene): string {
    return ensurePixels(scene, 'workout-boombox', () => {
        const pc = new PixelCanvas(BOOMBOX_W * 2, BOOMBOX_H);
        for (let f = 0; f < 2; f++) {
            const b = new PixelCanvas(BOOMBOX_W, BOOMBOX_H);
            b.rect(1, 2, 16, 8, 'slate').rect(1, 2, 16, 1, 'steel').rect(5, 0, 8, 2, 'steel');
            b.ellipse(5, 6.5, 2.8, 2.8, f ? 'cyan' : 'night').ellipse(13, 6.5, 2.8, 2.8, f ? 'cyan' : 'night');
            b.ellipse(5, 6.5, 1.2, 1.2, f ? 'white' : 'steel').ellipse(13, 6.5, 1.2, 1.2, f ? 'white' : 'steel');
            b.rect(8, 5, 2, 3, 'red');
            b.outline('ink');
            pc.blit(b, f * BOOMBOX_W, 0);
        }
        return { canvas: pc, frames: stripFrames(2, BOOMBOX_W, BOOMBOX_H) };
    });
}
