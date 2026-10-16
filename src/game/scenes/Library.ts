import Phaser from 'phaser';
import { booksOn, shelves, type ShelfId } from '../../library/books';
import { LibraryBridge } from '../../library/bridge';
import {
    PixelCanvas, READING_ROOM, addPixels, bayer, hash, readingRoomArt, shadowTexture, shaftPoint,
    type Facing, type RoomLamp,
} from '../kit';

type RoomArt = ReturnType<typeof readingRoomArt>;
let art: RoomArt | undefined;
/** Painted once per page load: the room never changes, only the player moves through it. */
const roomArt = (): RoomArt =>
    (art ??= readingRoomArt(shelves.map((shelf) => ({ plaque: shelf.plaque, books: booksOn(shelf.id) }))));

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Inside the Tower Library: walk to a bookcase to browse it, or to the card catalog to search. */
export class Library extends Phaser.Scene {
    private player!: Phaser.GameObjects.Sprite;
    private shadow!: Phaser.GameObjects.Image;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private facing: Facing = 'up';
    private blocks: Phaser.Geom.Rectangle[] = [];
    /** The bookcase, catalog, or door the player is standing at (it acts on arrival, not again until they step away). */
    private at: string | null = null;

    constructor(private bridge: LibraryBridge) {
        super('Library');
    }

    create() {
        this.at = null;
        this.bridge.update({ inside: true });
        const { room, pieces, lamps } = roomArt();
        addPixels(this, 'library-room', room);
        this.add.image(0, 0, 'library-room').setOrigin(0).setDepth(-1000);
        this.blocks = pieces.map(({ name, canvas, x, y, foot }) => {
            addPixels(this, `library-${name}`, canvas);
            this.add.image(x, y, `library-${name}`).setOrigin(0).setDepth(foot.y + foot.h);
            return new Phaser.Geom.Rectangle(foot.x, foot.y, foot.w, foot.h);
        });
        this.lamps(lamps);
        this.motes();

        const { start } = READING_ROOM;
        this.facing = 'up';
        this.shadow = this.add.image(start.x, start.y, shadowTexture(this, 12)).setAlpha(0.3);
        this.player = this.add.sprite(start.x, start.y, 'preview-player', 'up-0').setOrigin(0.5, 1);
        this.place();
        this.cursors = this.input.keyboard!.createCursorKeys();

        const fit = () => {
            const cam = this.cameras.main;
            const s = Math.min(this.scale.width / 368, this.scale.height / 296);
            cam.setZoom(s >= 1 ? Math.floor(s) : Math.max(0.5, Math.floor(s * 4) / 4));
            cam.centerOn(READING_ROOM.width / 2, READING_ROOM.height / 2).setRoundPixels(true);
        };
        fit();
        if (!reducedMotion()) this.cameras.main.fadeIn(280, 20, 16, 30);
        this.scale.on('resize', fit);
        this.bridge.leave = () => {
            this.bridge.update({ inside: false, open: false });
            this.scene.wake('Preview');
            this.scene.stop();
        };
        this.events.once('shutdown', () => {
            this.scale.off('resize', fit);
            this.bridge.leave = undefined;
        });
    }

    update(_time: number, dt: number) {
        if (this.bridge.getSnapshot().open) {
            this.idle();
            return;
        }
        const dx = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const dy = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
        if (dx || dy) {
            const step = (Math.min(dt, 50) / 1000) * 92 / Math.hypot(dx, dy);
            const { walk } = READING_ROOM;
            const nx = Phaser.Math.Clamp(this.player.x + dx * step, walk.left, walk.right);
            if (this.canStand(nx, this.player.y)) this.player.x = nx;
            const ny = Phaser.Math.Clamp(this.player.y + dy * step, walk.top, walk.bottom);
            if (this.canStand(this.player.x, ny)) this.player.y = ny;
            if (Math.abs(dx) > Math.abs(dy)) {
                this.facing = 'side';
                this.player.setFlipX(dx < 0);
            } else {
                this.facing = dy < 0 ? 'up' : 'down';
                this.player.setFlipX(false);
            }
            const anim = `preview-player-${this.facing}-walk`;
            if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying) this.player.play(anim);
        } else {
            this.idle();
        }
        this.place();
        this.arrive();
    }

    private idle() {
        this.player.stop();
        this.player.setFrame(`${this.facing}-0`);
    }

    private place() {
        const { x, y } = this.player;
        this.player.setDepth(y);
        this.shadow.setPosition(x, y).setDepth(y - 0.5);
    }

    private canStand(x: number, y: number) {
        return !this.blocks.some((r) => x + 6 > r.left && x - 6 < r.right && y > r.top && y - 5 < r.bottom);
    }

    /** Walking up to a bookcase or the card catalog opens it, and walking out the door leaves. Each spot acts once per visit. */
    private arrive() {
        const spot = this.spot();
        if (spot === this.at) return;
        this.at = spot;
        if (spot === 'door') this.bridge.leave?.();
        else if (spot === 'catalog') this.bridge.update({ open: true, view: { kind: 'catalog' } });
        else if (spot) this.bridge.update({ open: true, view: { kind: 'shelf', shelf: spot } });
    }

    private spot(): 'door' | 'catalog' | ShelfId | null {
        const { x, y } = this.player;
        const { door, catalog, cases } = READING_ROOM;
        if (y > 244 && Math.abs(x - door.x) < 24) return 'door';
        if (x >= catalog.left && x <= catalog.right && y >= catalog.top && y <= catalog.bottom) return 'catalog';
        if (y < 128) {
            const i = cases.findIndex((c) => x >= c.x + 2 && x <= c.x + c.w - 2);
            if (shelves[i]) return shelves[i].id;
        }
        return null;
    }

    /** Soft pools of lamplight that breathe slowly (held still for reduced motion). */
    private lamps(lamps: readonly RoomLamp[]) {
        const still = reducedMotion();
        lamps.forEach((lamp, i) => {
            const key = lamp.size === 'wide' ? this.glow('library-glow-wide', 41, 21) : this.glow('library-glow-round', 29, 29);
            const light = this.add.image(lamp.x + 0.5, lamp.y + 0.5, key)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setAlpha(0.3)
                .setDepth(lamp.depth);
            if (!still) {
                this.tweens.add({
                    targets: light,
                    alpha: { from: 0.22, to: 0.4 },
                    duration: 1100 + i * 170,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                });
            }
        });
    }

    private glow(key: string, w: number, h: number) {
        if (this.textures.exists(key)) return key;
        const pc = new PixelCanvas(w, h);
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const d = Math.hypot((i - (w - 1) / 2) / (w / 2), (j - (h - 1) / 2) / (h / 2));
                if (d < 1 && (1 - d) ** 1.5 > bayer(i, j)) pc.set(i, j, d < 0.35 ? 'yellow' : 'gold');
            }
        }
        return addPixels(this, key, pc);
    }

    /** Dust drifting in the sunbeams. */
    private motes() {
        if (reducedMotion()) return;
        if (!this.textures.exists('library-mote')) addPixels(this, 'library-mote', new PixelCanvas(1, 1).set(0, 0, 'cream'));
        for (let i = 0; i < 14; i++) {
            const p = shaftPoint(i % 2, hash(i, 1, 5), hash(i, 2, 5) * 0.8);
            const mote = this.add.image(Math.round(p.x), Math.round(p.y - hash(i, 3, 5) * 30), 'library-mote')
                .setDepth(4000)
                .setAlpha(0);
            this.tweens.add({
                targets: mote,
                x: mote.x + 4,
                y: mote.y - 8,
                alpha: { from: 0, to: 0.7 },
                duration: 2600 + hash(i, 4, 5) * 2200,
                delay: hash(i, 5, 5) * 2000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });
        }
    }
}
