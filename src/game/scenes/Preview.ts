import Phaser from 'phaser';
import {
    PixelCanvas, PROPS, addPixels, buildingArt, characterSheet, fbm, lookKey, paintProp, randomLook,
    shadowTexture, stripFrames, treeArt, type BuildingSpec, type PropOptions,
} from '../kit';

/** Placeholder scene: a little street showing off the pixel-art kit until the real world lands. */
export class Preview extends Phaser.Scene {
    private walkers: { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; dir: number; speed: number }[] = [];

    constructor() {
        super('Preview');
    }

    create() {
        this.grass();
        this.building(-150, -12, { w: 6, h: 5, style: 'house', roof: 'red', wall: 'cream', seed: 2 });
        this.building(-40, -12, { w: 7, h: 5, style: 'shop', roof: 'blue', sign: 'ATV', seed: 5 });
        this.building(80, -12, { w: 5, h: 6, style: 'tower', wall: 'stone', seed: 9 });
        [-200, -95, 135, 190].forEach((x, i) => this.tree(x, 4 + (i % 2) * 6, ['oak', 'cherry', 'autumn', 'pine'][i], i + 1));
        this.prop('fountain', 0, 52);
        [-70, 70].forEach((x) => this.prop('lamp', x, 40));
        this.prop('flowers', -30, 66, { colors: ['pink', 'yellow', 'white'] });
        this.prop('bench', 36, 70);
        for (let i = 0; i < 6; i++) this.walker(i);

        const cam = this.cameras.main;
        // Largest whole-number zoom that still fits the ~520x330 street.
        const fit = () => cam.setZoom(Math.max(1, Math.floor(Math.min(this.scale.width / 520, this.scale.height / 330)))).centerOn(0, -20);
        fit();
        this.scale.on('resize', fit);
    }

    update(_t: number, dtMs: number) {
        const dt = dtMs / 1000;
        for (const w of this.walkers) {
            w.sprite.x += w.dir * w.speed * dt;
            if (Math.abs(w.sprite.x) > 230) w.dir *= -1;
            w.sprite.setFlipX(w.dir < 0);
            w.shadow.setPosition(w.sprite.x, w.sprite.y);
        }
    }

    private grass() {
        const pc = new PixelCanvas(64, 64);
        for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 64; x++) pc.mix(x, y, 'grass', 'leaf', fbm(x, y, 16, 3) * 0.9 - 0.15);
        }
        for (let i = 0; i < 40; i++) pc.set((i * 37) % 64, (i * 23) % 64, 'lime');
        addPixels(this, 'preview-grass', pc);
        this.add.tileSprite(0, 0, 2048, 2048, 'preview-grass').setDepth(-1e9);
    }

    private building(x: number, y: number, spec: BuildingSpec) {
        const { canvas } = buildingArt(spec);
        const key = `preview-building-${x}`;
        addPixels(this, key, canvas);
        this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    }

    private tree(x: number, y: number, kind: string, seed: number) {
        const { canvas } = treeArt(kind, seed);
        const key = `preview-tree-${kind}-${seed}`;
        addPixels(this, key, canvas);
        this.add.image(x, y, shadowTexture(this, 18)).setAlpha(0.25).setDepth(-1e8);
        this.add.image(x, y + 2, key).setOrigin(0.5, 1).setDepth(y);
    }

    private prop(name: string, x: number, y: number, opts: PropOptions = {}) {
        const p = paintProp(PROPS[name], opts);
        const key = `preview-prop-${name}`;
        addPixels(this, key, p.canvas, stripFrames(p.frames, p.frameW, p.frameH));
        if (p.shadow) this.add.image(x, y, shadowTexture(this, p.shadow)).setAlpha(0.25).setDepth(-1e8);
        const s = this.add.sprite(x, y + 1, key, 0).setOrigin(0.5, 1).setDepth(y);
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
        const y = 86 + (i % 3) * 14;
        const shadow = this.add.image(0, y, shadowTexture(this, 10)).setAlpha(0.25).setDepth(-1e8);
        const sprite = this.add.sprite(-200 + i * 75, y, key, 'side-0').setOrigin(0.5, 1).setDepth(y).play(anim);
        this.walkers.push({ sprite, shadow, dir: i % 2 ? -1 : 1, speed: 18 + (i % 3) * 8 });
    }
}
