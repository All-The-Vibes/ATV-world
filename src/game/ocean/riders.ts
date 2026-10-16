import type Phaser from 'phaser';

type Part = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
export interface Rider {
    sprite: Phaser.GameObjects.Sprite;
    carry?: Part[];
    hide?: Part[];
}
const state = (p: Part) => ({ x: p.x, y: p.y, depth: p.depth, visible: p.visible, alpha: p.alpha });
type Saved = ReturnType<typeof state>;
const alive = (p: Part) => p.active && !!p.scene;
const restore = (p: Part, saved: Saved) => { if (alive(p)) Object.assign(p, saved); };
export const SURF_DEPTH = 2e6;

/** Own only temporary presentation, never identity, call membership, scores, or indoor state. */
export class Riders {
    private saved = new Map<Phaser.GameObjects.Sprite, {
        home: Saved;
        resume: boolean;
        parts: { part: Part; home: Saved; hide: boolean }[];
    }>();

    position(sprite: Phaser.GameObjects.Sprite) { return this.saved.get(sprite)?.home ?? sprite; }

    sync(riders: Rider[]) {
        const here = new Set(riders.map(r => r.sprite));
        for (const [sprite, saved] of this.saved) {
            if (!here.has(sprite) || !alive(sprite)) {
                this.release(sprite, saved);
                this.saved.delete(sprite);
            }
        }
        for (const { sprite, carry = [], hide = [] } of riders) {
            if (this.saved.has(sprite) || !alive(sprite)) continue;
            const resume = sprite.anims.isPlaying && !sprite.anims.isPaused;
            this.saved.set(sprite, {
                home: state(sprite), resume,
                parts: [...carry.map(part => ({ part, home: state(part), hide: false })),
                    ...hide.map(part => ({ part, home: state(part), hide: true }))],
            });
            if (resume) sprite.anims.pause();
        }
    }

    pose(project: (x: number, y: number, index: number) => { x: number; y: number }) {
        let index = 0;
        for (const [sprite, { home, parts }] of this.saved) {
            if (!alive(sprite)) continue;
            const at = project(home.x, home.y, index++);
            Object.assign(sprite, at, { depth: SURF_DEPTH + 10 + index / 100, visible: true, alpha: 1 });
            for (const { part, home: h, hide } of parts) {
                if (!alive(part)) continue;
                if (hide) part.visible = false;
                else Object.assign(part, {
                    x: h.x + (at.x - home.x), y: h.y + (at.y - home.y),
                    depth: sprite.depth + 0.01, visible: true, alpha: 1,
                });
            }
        }
    }

    restore() {
        for (const [sprite, saved] of this.saved) this.release(sprite, saved);
        this.saved.clear();
    }

    private release(sprite: Phaser.GameObjects.Sprite, saved: {
        home: Saved; resume: boolean; parts: { part: Part; home: Saved }[];
    }) {
        restore(sprite, saved.home);
        if (alive(sprite) && saved.resume) sprite.anims.resume();
        for (const { part, home } of saved.parts) restore(part, home);
    }
}
