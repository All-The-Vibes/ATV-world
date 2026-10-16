import Phaser from 'phaser';
import { setCharacters } from './commands';

/** A character the search can list and the camera can zoom in on. */
export interface DirectoryEntry {
    id: string;
    name: string;
    kind: string;
    /** Where they are right now (their middle), or nothing while they're away from town. */
    locate: () => { x: number; y: number } | undefined;
}

/** The middle of a sprite, if it's in the world and showing. */
export function spotOf(sprite: Phaser.GameObjects.Sprite | undefined | null): { x: number; y: number } | undefined {
    return sprite?.active && sprite.visible ? { x: sprite.x, y: sprite.y - 10 } : undefined;
}

/** Find a game object's sprite without every character class having to publish one. */
export function spriteOf(owner: unknown): Phaser.GameObjects.Sprite | undefined {
    const s = owner ? Reflect.get(owner as object, 'sprite') : undefined;
    return s instanceof Phaser.GameObjects.Sprite ? s : undefined;
}

/**
 * Everyone worth finding in town. Features register their characters with `add` (a one-liner each);
 * the roster is published to the character search a couple of times a second, and `ping` rings
 * whoever the camera just zoomed in on so they're easy to spot.
 */
export class Directory {
    private readonly entries: DirectoryEntry[] = [];
    private clock = 0;
    private ring?: Phaser.GameObjects.Ellipse;
    private ringStop?: () => void;

    constructor(private readonly scene: Phaser.Scene) {
        scene.events.once('shutdown', () => this.destroy());
    }

    add(entry: DirectoryEntry) {
        this.entries.push(entry);
    }

    locate(id: string) {
        return this.entries.find((e) => e.id === id)?.locate();
    }

    update(dt: number) {
        this.clock -= dt;
        if (this.clock > 0) return;
        this.clock = 0.4;
        setCharacters(this.entries.map((e) => ({ id: e.id, name: e.name, kind: e.kind, here: !!e.locate() })));
    }

    /** Pulse a gold ring under someone for a few seconds. */
    ping(id: string) {
        this.ringStop?.();
        const entry = this.entries.find((e) => e.id === id);
        if (!entry?.locate()) return;
        const ring = this.scene.add.ellipse(0, 0, 30, 12).setStrokeStyle(2, 0xf7b538).setDepth(1e6 + 3);
        const tween = this.scene.tweens.add({ targets: ring, scaleX: 1.5, scaleY: 1.5, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
        let left = 4;
        const follow = (_t: number, dtMs: number) => {
            const at = entry.locate();
            left -= dtMs / 1000;
            if (!at || left <= 0) {
                this.ringStop?.();
                return;
            }
            ring.setPosition(at.x, at.y + 11);
        };
        this.scene.events.on('update', follow);
        this.ring = ring;
        this.ringStop = () => {
            this.scene.events.off('update', follow);
            tween.remove();
            ring.destroy();
            this.ring = undefined;
            this.ringStop = undefined;
        };
        follow(0, 0);
    }

    destroy() {
        this.ringStop?.();
        setCharacters([]);
    }
}
