import Phaser from 'phaser';
import {
    PixelCanvas, PROPS, addPixels, buildingArt, characterSheet, fbm, lookKey, paintProp, randomLook,
    shadowTexture, stripFrames, treeArt, type BuildingSpec, type Facing, type PropOptions,
} from '../kit';

/** Placeholder scene: a little street showing off the pixel-art kit until the real world lands. */
export class Preview extends Phaser.Scene {
    private walkers: { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; dir: number; speed: number }[] = [];
    private ground?: Phaser.GameObjects.TileSprite;
    private player?: {
        sprite: Phaser.GameObjects.Sprite;
        shadow: Phaser.GameObjects.Image;
        marker: Phaser.GameObjects.Image;
    };
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private zoomInKey?: Phaser.Input.Keyboard.Key;
    private zoomOutKey?: Phaser.Input.Keyboard.Key;
    private playerFacing: Facing = 'down';
    private contentBounds?: Phaser.Geom.Rectangle;
    private readonly worldBounds = new Phaser.Geom.Rectangle(-390, -220, 780, 540);
    private readonly zoomLevels = [1, 2, 3, 4] as const;
    private overviewZoom = 1;
    private userAdjustedZoom = false;
    private cameraReady = false;

    constructor() {
        super('Preview');
    }

    create() {
        this.grass();
        const buildings = [
            { x: -305, y: -76, spec: { w: 6, h: 5, style: 'house', roof: 'red', wall: 'cream', seed: 2 } },
            { x: 0, y: -2, spec: { w: 7, h: 5, style: 'shop', roof: 'blue', sign: 'ATV', seed: 5 } },
            { x: 285, y: 225, spec: { w: 5, h: 6, style: 'tower', wall: 'stone', seed: 9 } },
        ] satisfies { x: number; y: number; spec: BuildingSpec }[];
        buildings.forEach(({ x, y, spec }) => this.building(x, y, spec));
        [
            { x: -375, y: 24, kind: 'oak' },
            { x: -160, y: -106, kind: 'cherry' },
            { x: 150, y: -70, kind: 'autumn' },
            { x: 370, y: 112, kind: 'pine' },
        ].forEach(({ x, y, kind }, i) => this.tree(x, y, kind, i + 1));
        this.prop('fountain', -150, 205);
        this.prop('lamp', -210, 133);
        this.prop('lamp', 116, 148);
        this.prop('flowers', -12, 245, { colors: ['pink', 'yellow', 'white'] });
        this.prop('bench', 74, 230);
        for (let i = 0; i < 6; i++) this.walker(i);
        this.createPlayer();
        this.setupCamera();
    }

    update(_t: number, dtMs: number) {
        const dt = dtMs / 1000;
        if (this.zoomInKey && Phaser.Input.Keyboard.JustDown(this.zoomInKey)) this.adjustZoom(1);
        if (this.zoomOutKey && Phaser.Input.Keyboard.JustDown(this.zoomOutKey)) this.adjustZoom(-1);

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
            Phaser.Input.Keyboard.KeyCodes.PLUS,
            Phaser.Input.Keyboard.KeyCodes.MINUS,
        ]);
    }

    private setupCamera() {
        this.cameraReady = true;
        this.zoomInKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
        this.zoomOutKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
        this.input.on('wheel', (
            _pointer: Phaser.Input.Pointer,
            _gameObjects: Phaser.GameObjects.GameObject[],
            _deltaX: number,
            deltaY: number,
        ) => this.adjustZoom(deltaY < 0 ? 1 : -1));

        const fit = () => this.fitCamera();
        fit();
        this.scale.on('resize', fit);
    }

    private fitCamera() {
        const cam = this.cameras.main;
        this.overviewZoom = 1;
        cam.setRoundPixels(true);
        if (!this.userAdjustedZoom) cam.setZoom(this.overviewZoom);
        this.updateCameraMode();
    }

    private adjustZoom(direction: -1 | 1) {
        const cam = this.cameras.main;
        const currentIndex = this.zoomLevels.reduce(
            (best, level, i) => Math.abs(level - cam.zoom) < Math.abs(this.zoomLevels[best] - cam.zoom) ? i : best,
            0,
        );
        const nextIndex = Phaser.Math.Clamp(currentIndex + direction, 0, this.zoomLevels.length - 1);
        const zoom = this.zoomLevels[nextIndex];
        if (zoom === cam.zoom) return;
        this.userAdjustedZoom = true;
        cam.setZoom(zoom);
        this.updateCameraMode();
    }

    private updateCameraMode() {
        const cam = this.cameras.main;
        const worldFits = this.worldBounds.width * cam.zoom <= this.scale.width
            && this.worldBounds.height * cam.zoom <= this.scale.height;
        if (this.player && (cam.zoom > this.overviewZoom || !worldFits)) {
            cam.startFollow(this.player.sprite, true, 1, 1);
        } else {
            cam.stopFollow();
            cam.centerOn(this.worldBounds.centerX, this.worldBounds.centerY);
        }
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

        const content = this.contentBounds;
        const padding = 64;
        this.worldBounds.setTo(
            content.left - padding,
            content.top - padding,
            content.width + padding * 2,
            content.height + padding * 2,
        );
        this.ground
            ?.setPosition(this.worldBounds.centerX, this.worldBounds.centerY)
            .setSize(Math.max(2048, this.worldBounds.width + 512), Math.max(2048, this.worldBounds.height + 512));
        if (this.cameraReady) this.fitCamera();
    }

    private movePlayer(dt: number) {
        if (!this.player || !this.cursors) return;
        const { sprite, shadow, marker } = this.player;
        const dx = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const dy = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
        const moving = dx !== 0 || dy !== 0;

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
    }
}
