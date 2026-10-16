import Phaser from 'phaser';
import { LibraryBridge } from '../../library/bridge';
import {
    PixelCanvas, PROPS, addPixels, bayer, buildingArt, characterSheet, fbm, libraryArt, lookKey, paintProp, randomLook,
    shadowTexture, stripFrames, treeArt, type BuildingSpec, type Facing, type PropOptions,
} from '../kit';
import { isTyping, on, setInsideHQ } from '../commands';
import { HQ } from '../hq/HQ';
import { WorldView } from '../view';

/** The world on the live screen: a little street built with the pixel-art kit. */
export class Preview extends Phaser.Scene {
    private walkers: { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; dir: number; speed: number }[] = [];
    private ground?: Phaser.GameObjects.TileSprite;
    private player?: {
        sprite: Phaser.GameObjects.Sprite;
        shadow: Phaser.GameObjects.Image;
        marker: Phaser.GameObjects.Image;
    };
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private playerFacing: Facing = 'down';
    private contentBounds?: Phaser.Geom.Rectangle;
    private readonly worldBounds = new Phaser.Geom.Rectangle(-390, -220, 780, 540);
    /** The camera: F fits the world, +/-/wheel zoom, drag looks around (see ../view.ts). */
    private view?: WorldView;
    /** ATV HQ: everyone on the call, coding (see ../hq). It grows a floor at a time. */
    private hq?: HQ;
    /** The player is inside HQ (hidden indoors, with the call panel open). */
    private insideHQ = false;
    /** The library's front door. Standing by it offers "Enter library" (E or the prompt button). */
    private entrance?: Phaser.Math.Vector2;

    constructor(private bridge: LibraryBridge) {
        super('Preview');
    }

    create() {
        this.grass();
        const buildings = [
            { x: -305, y: -76, spec: { w: 6, h: 5, style: 'house', roof: 'red', wall: 'cream', seed: 2 } },
        ] satisfies { x: number; y: number; spec: BuildingSpec }[];
        buildings.forEach(({ x, y, spec }) => this.building(x, y, spec));
        this.library(285, 225);
        // Set well back from the plaza, seven tiles behind where the old ATV shop stood.
        this.hq = new HQ(this, 0, -114);
        this.hq.onResize = () => {
            this.fitWorld();
            if (this.view?.showing) this.visitHQ();
        };
        this.hq.onClick = () => this.enterHQ();
        this.fitWorld();
        [
            { x: -375, y: 24, kind: 'oak' },
            { x: -190, y: -106, kind: 'cherry' },
            { x: 190, y: -70, kind: 'autumn' },
            { x: 370, y: 112, kind: 'pine' },
        ].forEach(({ x, y, kind }, i) => this.tree(x, y, kind, i + 1));
        this.prop('fountain', -150, 205);
        this.prop('lamp', -210, 133);
        this.prop('lamp', 116, 148);
        this.prop('flowers', -12, 245, { colors: ['pink', 'yellow', 'white'] });
        this.prop('bench', 74, 230);
        for (let i = 0; i < 6; i++) this.walker(i);
        this.createPlayer();
        this.view = new WorldView(this, { bounds: () => this.worldBounds, player: this.player?.sprite });
        this.events.on('wake', () => this.input.keyboard?.resetKeys());

        // Go into HQ by walking in the door, clicking the building, or pressing H. Inside, the call panel
        // shows who's there; a fresh press of down or sideways (or the panel's Step out) walks you back out.
        // A window listener, so quick taps count and the key you walked in on (now auto-repeating) doesn't.
        // It sits out while this scene sleeps under the library.
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey || isTyping() || !this.sys.isActive()) return;
            if (e.key === 'h' || e.key === 'H') this.enterHQ();
            else if (this.insideHQ && !e.repeat && ['ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) this.leaveHQ();
        };
        const off = on('leaveHQ', () => this.leaveHQ());
        window.addEventListener('keydown', onKey);
        const stop = () => {
            off();
            window.removeEventListener('keydown', onKey);
            setInsideHQ(false);
        };
        this.events.once('shutdown', stop);
        this.events.once('destroy', stop);
        // Teams (and ?hq) open inside, and so does a reload while you were inside.
        const q = new URLSearchParams(location.search);
        const p = this.player?.sprite;
        if (q.has('teams') || q.has('hq') || (p && this.hq.contains(p.x, p.y))) this.enterHQ();
    }

    /** Frame ATV HQ and the sidewalk out front, where people walk in. */
    private visitHQ() {
        if (!this.hq || !this.view) return;
        const b = this.hq.bounds();
        this.view.show({ x: b.x, y: b.y, width: b.width, height: b.height + 22 });
    }

    /** Go inside HQ: the player steps through the door, the camera frames the building, the call panel opens. */
    private enterHQ() {
        if (!this.hq || !this.player) return;
        if (!this.insideHQ) {
            this.insideHQ = true;
            const { sprite, shadow, marker } = this.player;
            const at = this.hq.doorway.inside;
            sprite.stop().setPosition(at.x, at.y).setFlipX(false).setFrame('up-0');
            this.playerFacing = 'up';
            [sprite, shadow, marker].forEach((o) => o.setVisible(false));
            setInsideHQ(true);
        }
        this.visitHQ();
    }

    /** Walk back out the front door onto the sidewalk. */
    private leaveHQ() {
        if (!this.hq || !this.player || !this.insideHQ) return;
        this.insideHQ = false;
        const { sprite, shadow, marker } = this.player;
        const at = this.hq.doorway.outside;
        sprite.setPosition(at.x, at.y).setFlipX(false).setFrame('down-0').setDepth(at.y);
        shadow.setPosition(at.x, at.y).setDepth(at.y - 1);
        marker.setPosition(at.x, at.y - 34).setDepth(at.y + 1);
        this.playerFacing = 'down';
        [sprite, shadow, marker].forEach((o) => o.setVisible(true));
        this.view?.trackPlayer();
        setInsideHQ(false);
    }

    update(_t: number, dtMs: number) {
        const dt = dtMs / 1000;

        const walkerLeft = this.worldBounds.left + 24;
        const walkerRight = this.worldBounds.right - 24;
        for (const w of this.walkers) {
            w.sprite.x += w.dir * w.speed * dt;
            if (w.sprite.x <= walkerLeft || w.sprite.x >= walkerRight) {
                w.sprite.x = Phaser.Math.Clamp(w.sprite.x, walkerLeft, walkerRight);
                w.dir *= -1;
            }
            w.sprite.setFlipX(w.dir < 0);
            w.shadow.setPosition(w.sprite.x, w.sprite.y);
        }
        this.movePlayer(dt);
        if (this.player && this.entrance) {
            const near = !this.insideHQ
                && Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, this.entrance.x, this.entrance.y) < 34;
            this.bridge.setPrompt(near ? 'Enter library' : '', near ? () => {
                this.player!.sprite.setPosition(this.entrance!.x, this.entrance!.y + 15).stop();
                this.bridge.setPrompt('');
                this.scene.launch('Library');
                this.scene.sleep();
            } : undefined);
        }
    }

    private grass() {
        const pc = new PixelCanvas(64, 64);
        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) pc.mix(x, y, 'grass', 'leaf', fbm(x, y, 16, 3) * 0.9 - 0.15);
        }
        for (let i = 0; i < 40; i++) pc.set((i * 37) % 64, (i * 23) % 64, 'lime');
        addPixels(this, 'preview-grass', pc);
        this.ground = this.add.tileSprite(0, 0, 2048, 2048, 'preview-grass').setDepth(-1e9);
    }

    private building(x: number, y: number, spec: BuildingSpec) {
        const { canvas } = buildingArt(spec);
        const key = `preview-building-${x}`;
        addPixels(this, key, canvas);
        const image = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
        this.includeInWorld(image);
    }

    /** The enterable library, with its door as the entrance and softly breathing porch lanterns. */
    private library(x: number, y: number) {
        const { canvas, info } = libraryArt();
        addPixels(this, 'preview-library', canvas);
        const image = this.add.image(x, y, 'preview-library').setOrigin(0.5, 1).setDepth(y);
        this.includeInWorld(image);
        const left = x - canvas.width / 2;
        const top = y - canvas.height;
        if (info.door) this.entrance = new Phaser.Math.Vector2(left + info.door.x + info.door.w / 2, y + 3);

        const glow = new PixelCanvas(15, 15);
        for (let j = 0; j < 15; j++) {
            for (let i = 0; i < 15; i++) {
                const d = Math.hypot(i - 7, j - 7) / 7.5;
                if (d < 1 && (1 - d) ** 1.5 > bayer(i, j)) glow.set(i, j, d < 0.35 ? 'yellow' : 'gold');
            }
        }
        addPixels(this, 'preview-library-glow', glow);
        const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        for (const lx of [54, 74]) {
            const light = this.add.image(left + lx + 0.5, top + 125.5, 'preview-library-glow')
                .setBlendMode(Phaser.BlendModes.ADD)
                .setAlpha(0.35)
                .setDepth(y + 0.5);
            if (!still) {
                this.tweens.add({
                    targets: light,
                    alpha: { from: 0.22, to: 0.42 },
                    duration: 900 + lx * 4,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                });
            }
        }
    }

    private tree(x: number, y: number, kind: string, seed: number) {
        const { canvas } = treeArt(kind, seed);
        const key = `preview-tree-${kind}-${seed}`;
        addPixels(this, key, canvas);
        this.add.image(x, y, shadowTexture(this, 18)).setAlpha(0.25).setDepth(-1e8);
        const image = this.add.image(x, y + 2, key).setOrigin(0.5, 1).setDepth(y);
        this.includeInWorld(image);
    }

    private prop(name: string, x: number, y: number, opts: PropOptions = {}) {
        const p = paintProp(PROPS[name], opts);
        const key = `preview-prop-${name}`;
        addPixels(this, key, p.canvas, stripFrames(p.frames, p.frameW, p.frameH));
        if (p.shadow) this.add.image(x, y, shadowTexture(this, p.shadow)).setAlpha(0.25).setDepth(-1e8);
        const s = this.add.sprite(x, y + 1, key, 0).setOrigin(0.5, 1).setDepth(y);
        this.includeInWorld(s);
        if (p.frames > 1) {
            if (!this.anims.exists(key)) {
                this.anims.create({ key, frames: Array.from({ length: p.frames }, (_, frame) => ({ key, frame })), frameRate: p.fps, repeat: -1 });
            }
            s.play(key);
        }
    }

    private walker(i: number) {
        const look = randomLook(`preview-${i}`);
        const key = lookKey(look);
        const sheet = characterSheet(look);
        addPixels(this, key, sheet.canvas, sheet.frames);
        const anim = `${key}-walk`;
        if (!this.anims.exists(anim)) {
            this.anims.create({ key: anim, frames: ['side-1', 'side-0', 'side-2', 'side-0'].map((frame) => ({ key, frame })), frameRate: 8, repeat: -1 });
        }
        const y = [62, 124, 184, 96, 154, 42][i];
        const shadow = this.add.image(0, y, shadowTexture(this, 10)).setAlpha(0.25).setDepth(-1e8);
        const sprite = this.add.sprite(-310 + i * 120, y, key, 'side-0').setOrigin(0.5, 1).setDepth(y).play(anim);
        this.walkers.push({ sprite, shadow, dir: i % 2 ? -1 : 1, speed: 18 + (i % 3) * 8 });
    }

    private createPlayer() {
        const look = randomLook('player', {
            skin: 'peach',
            hair: 'earth',
            hairStyle: 'cap',
            hat: 'gold',
            shirt: 'blue',
            pants: 'navy',
            shoes: 'white',
        });
        const key = 'preview-player';
        const sheet = characterSheet(look);
        addPixels(this, key, sheet.canvas, sheet.frames);

        for (const facing of ['down', 'up', 'side'] as const) {
            const anim = `${key}-${facing}-walk`;
            if (!this.anims.exists(anim)) {
                this.anims.create({
                    key: anim,
                    frames: [`${facing}-1`, `${facing}-0`, `${facing}-2`, `${facing}-0`].map((frame) => ({ key, frame })),
                    frameRate: 9,
                    repeat: -1,
                });
            }
        }

        const markerCanvas = new PixelCanvas(17, 16);
        markerCanvas
            .rect(5, 0, 7, 7, 'gold')
            .rect(7, 1, 3, 6, 'yellow')
            .rect(1, 6, 15, 3, 'gold')
            .rect(3, 9, 11, 2, 'yellow')
            .rect(5, 11, 7, 2, 'gold')
            .rect(7, 13, 3, 2, 'yellow')
            .set(8, 15, 'cream')
            .outline('ink', true);
        addPixels(this, 'preview-player-marker', markerCanvas);

        const x = 0, y = 158;
        const shadow = this.add.image(x, y, shadowTexture(this, 12)).setAlpha(0.35).setDepth(y - 1);
        const sprite = this.add.sprite(x, y, key, 'down-0').setOrigin(0.5, 1).setDepth(y);
        const marker = this.add.image(x, y - 34, 'preview-player-marker').setOrigin(0.5, 1).setDepth(y + 1);
        this.player = { sprite, shadow, marker };

        this.cursors = this.input.keyboard?.createCursorKeys();
        this.input.keyboard?.addCapture([
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ]);
    }

    private includeInWorld(object: { getBounds: () => Phaser.Geom.Rectangle }) {
        const bounds = object.getBounds();
        if (!this.contentBounds) {
            this.contentBounds = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
        } else {
            const left = Math.min(this.contentBounds.left, bounds.left);
            const top = Math.min(this.contentBounds.top, bounds.top);
            const right = Math.max(this.contentBounds.right, bounds.right);
            const bottom = Math.max(this.contentBounds.bottom, bounds.bottom);
            this.contentBounds.setTo(left, top, right - left, bottom - top);
        }
        this.fitWorld();
    }

    /** The world is everything placed so far plus ATV HQ (which grows and shrinks with the call), with a margin. */
    private fitWorld() {
        const parts = [this.contentBounds, this.hq?.bounds()].filter((r): r is Phaser.Geom.Rectangle => !!r);
        if (!parts.length) return;
        const left = Math.min(...parts.map((r) => r.left));
        const top = Math.min(...parts.map((r) => r.top));
        const right = Math.max(...parts.map((r) => r.right));
        const bottom = Math.max(...parts.map((r) => r.bottom));
        const padding = 64;
        this.worldBounds.setTo(left - padding, top - padding, right - left + padding * 2, bottom - top + padding * 2);
        this.ground
            ?.setPosition(this.worldBounds.centerX, this.worldBounds.centerY)
            .setSize(Math.max(2048, this.worldBounds.width + 512), Math.max(2048, this.worldBounds.height + 512));
        // HQ lost floors: bring back a player who was standing in the sky it left behind.
        const p = this.player;
        if (p && !this.insideHQ) {
            const x = Phaser.Math.Clamp(p.sprite.x, this.worldBounds.left + 12, this.worldBounds.right - 12);
            const y = Phaser.Math.Clamp(p.sprite.y, this.worldBounds.top + 12, this.worldBounds.bottom - 12);
            if (x !== p.sprite.x || y !== p.sprite.y) {
                p.sprite.setPosition(x, y).setDepth(y);
                p.shadow.setPosition(x, y).setDepth(y - 1);
                p.marker.setPosition(x, y - 34).setDepth(y + 1);
                this.view?.trackPlayer();
            }
        }
    }

    private movePlayer(dt: number) {
        if (!this.player || !this.cursors) return;
        const { sprite, shadow, marker } = this.player;
        const dx = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const dy = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
        const moving = dx !== 0 || dy !== 0;

        if (this.insideHQ) return;

        if (moving) {
            const length = Math.hypot(dx, dy);
            const speed = 92;
            sprite.x = Phaser.Math.Clamp(sprite.x + dx / length * speed * dt, this.worldBounds.left + 12, this.worldBounds.right - 12);
            sprite.y = Phaser.Math.Clamp(sprite.y + dy / length * speed * dt, this.worldBounds.top + 12, this.worldBounds.bottom - 12);

            if (Math.abs(dx) > Math.abs(dy)) {
                this.playerFacing = 'side';
                sprite.setFlipX(dx < 0);
            } else {
                this.playerFacing = dy < 0 ? 'up' : 'down';
                sprite.setFlipX(false);
            }

            const anim = `preview-player-${this.playerFacing}-walk`;
            if (sprite.anims.currentAnim?.key !== anim) sprite.play(anim);
        } else {
            sprite.stop();
            sprite.setFrame(`${this.playerFacing}-0`);
        }

        shadow.setPosition(sprite.x, sprite.y).setDepth(sprite.y - 1);
        const markerBob = Math.round(Math.sin(this.time.now / 150) * 2);
        marker.setPosition(sprite.x, sprite.y - 34 + markerBob).setDepth(sprite.y + 1);
        sprite.setDepth(sprite.y);
        // Walked into HQ (through the door, or any wall, since nothing here is solid): go in.
        if (moving && this.hq?.contains(sprite.x, sprite.y)) this.enterHQ();
    }
}
