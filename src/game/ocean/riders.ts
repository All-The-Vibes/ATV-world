import type Phaser from 'phaser';

type Part = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.TileSprite | Phaser.GameObjects.Text;
export interface Rider {
    sprite: Part;
    carry?: Part[];
    hide?: Part[];
    anchor?: { x: number; y: number };
    /** Only avatars may temporarily become visible (including the indoor player). */
    reveal?: boolean;
}
const state = (p: Part) => ({ x: p.x, y: p.y, depth: p.depth, visible: p.visible, alpha: p.alpha });
type Saved = ReturnType<typeof state>;
const alive = (p: Part) => p.active && !!p.scene;
const place = (p: Part, { depth, ...rest }: Saved) => {
    Object.assign(p, rest);
    if (p.depth !== depth) p.depth = depth;
};
const restore = (p: Part, saved: Saved) => { if (alive(p)) place(p, saved); };
const animation = (p: Part) => 'anims' in p ? p.anims : undefined;
export const SURF_DEPTH = 2e6;
interface Ride {
    home: Saved;
    anchor: { x: number; y: number };
    reveal: boolean;
    resume: boolean;
    parts: { part: Part; home: Saved; hide: boolean }[];
}

/** Own only temporary presentation, never identity, call membership, scores, or indoor state. */
export class Riders {
    private saved = new Map<Part, Ride>();

    position(sprite: Part) { return this.saved.get(sprite)?.home ?? sprite; }

    sync(riders: Rider[]) {
        const here = new Set(riders.map(r => r.sprite));
        for (const [sprite, saved] of this.saved) {
            if (!here.has(sprite) || !alive(sprite)) {
                this.release(sprite, saved);
                this.saved.delete(sprite);
            }
        }
        const arriving = riders.filter(r => !this.saved.has(r.sprite) && alive(r.sprite))
            .sort((a, b) => a.sprite.depth - b.sprite.depth);
        for (const { sprite, carry = [], hide = [], anchor, reveal = true } of arriving) {
            if (this.saved.has(sprite) || !alive(sprite)) continue;
            const anim = animation(sprite);
            const resume = !!anim?.isPlaying && !anim.isPaused;
            this.saved.set(sprite, {
                home: state(sprite), anchor: anchor ?? { x: sprite.x, y: sprite.y }, reveal, resume,
                parts: [...carry.map(part => ({ part, home: state(part), hide: false })),
                    ...hide.map(part => ({ part, home: state(part), hide: true }))],
            });
            if (resume) anim!.pause();
        }
    }

    pose(project: (x: number, y: number, index: number) => { x: number; y: number; wet?: boolean }) {
        let index = 0;
        for (const [sprite, { home, anchor, reveal, parts }] of this.saved) {
            if (!alive(sprite)) continue;
            const at = project(anchor.x, anchor.y, index++);
            const wet = at.wet !== false;
            const dx = at.x - anchor.x, dy = at.y - anchor.y;
            place(sprite, {
                x: home.x + dx, y: home.y + dy,
                depth: wet ? SURF_DEPTH + 10 + (reveal ? 100 : 0) + index / 1000 : home.depth,
                visible: wet && reveal ? true : home.visible, alpha: wet && reveal ? 1 : home.alpha,
            });
            for (const { part, home: h, hide } of parts) {
                if (!alive(part)) continue;
                if (!wet) restore(part, h);
                else if (hide) part.visible = false;
                else place(part, {
                    x: h.x + dx, y: h.y + dy,
                    depth: sprite.depth + 0.01, visible: reveal ? true : h.visible, alpha: reveal ? 1 : h.alpha,
                });
            }
        }
    }

    restore() {
        for (const [sprite, saved] of this.saved) this.release(sprite, saved);
        this.saved.clear();
    }

    private release(sprite: Part, saved: Ride) {
        restore(sprite, saved.home);
        if (alive(sprite) && saved.resume) animation(sprite)?.resume();
        for (const { part, home } of saved.parts) restore(part, home);
    }
}
