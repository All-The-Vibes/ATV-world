import Phaser from 'phaser';
import { ensurePixels } from '../kit';
import { breakerArt, surferArt, surfSign, WATER } from './art';
import { SurfClock } from './cycle';
import { Riders, SURF_DEPTH, type Rider } from './riders';
import { smooth, swellAt, waveAt } from './wave';

interface OceanOptions {
    bounds: () => Phaser.Geom.Rectangle;
    riders: () => Rider[];
    scenery: () => Rider[];
    setSurfing: (value: boolean) => void;
}
const FACE = [WATER.foam, WATER.ice, WATER.turquoise, WATER.teal, WATER.blue, WATER.deep];

export class Ocean {
    private clock = new SurfClock();
    private cast = new Riders();
    private water?: Phaser.GameObjects.Graphics;
    private wave?: Phaser.GameObjects.Graphics;
    private floats?: Phaser.GameObjects.Graphics;
    private barrel?: Phaser.GameObjects.Image;
    private surfer?: Phaser.GameObjects.Image;
    private sign?: Phaser.GameObjects.Image;
    private interactions = new Map<Phaser.GameObjects.GameObject, boolean>();
    private extent = { left: 0, right: 0 };
    private tweenSpeed = 1;
    private timerSpeed = 1;
    private disposed = false;
    private motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    constructor(private scene: Phaser.Scene, private opts: OceanOptions) {
        scene.events.on('sleep', this.cancel, this);
        scene.events.on('surf:rebase', this.rebase, this);
        scene.events.once('shutdown', this.destroy, this);
        scene.events.once('destroy', this.destroy, this);
    }

    get active() { return this.clock.active; }
    position(sprite: Phaser.GameObjects.Sprite) { return this.cast.position(sprite); }

    /** Development console only: atv.game.scene.getScene('Preview').ocean.trigger(). */
    trigger(): boolean {
        if (!import.meta.env.DEV || this.disposed || !this.scene.sys.isActive() || document.hidden || !this.clock.start()) return false;
        this.begin();
        this.draw();
        return true;
    }

    update(delta: number) {
        if (this.disposed || document.hidden) return;
        const was = this.active;
        this.clock.update(delta);
        if (!was && this.active) this.begin();
        if (was && !this.active) this.finish();
        if (this.active) this.draw();
    }

    private begin() {
        this.opts.setSurfing(true);
        this.tweenSpeed = this.scene.tweens.timeScale;
        this.timerSpeed = this.scene.time.timeScale;
        this.scene.tweens.timeScale = 0;
        this.scene.time.timeScale = 0;
        const b = this.opts.bounds(), view = this.scene.cameras.main.worldView;
        // Camera controls may move during the ride; they must not reverse the travelling wave.
        this.extent = { left: Math.min(b.left, view.left) - 80, right: Math.max(b.right, view.right) + 80 };
        for (let i = 0; i < 4; i++) ensurePixels(this.scene, `ocean-barrel-${i}`, () => breakerArt(i));
        for (let i = 0; i < 3; i++) ensurePixels(this.scene, `ocean-surfer-${i}`, () => surferArt(i));
        ensurePixels(this.scene, 'ocean-sign', surfSign);
        this.water = this.scene.add.graphics().setDepth(-9e7).setName('surf-water');
        this.wave = this.scene.add.graphics().setDepth(SURF_DEPTH).setName('surf-wave');
        this.floats = this.scene.add.graphics().setDepth(SURF_DEPTH + 200).setName('surf-floats');
        this.barrel = this.scene.add.image(0, 0, 'ocean-barrel-0').setOrigin(0.5, 1)
            .setFlipX(true).setDepth(SURF_DEPTH + 1).setName('surf-barrel');
        this.surfer = this.scene.add.image(0, 0, 'ocean-surfer-1').setOrigin(0.5, 1)
            .setFlipX(true).setDepth(SURF_DEPTH + 210).setName('surf-surfer');
        this.sign = this.scene.add.image(0, 0, 'ocean-sign').setDepth(SURF_DEPTH + 211).setName('surf-sign');
    }

    private gather() {
        const explicit = [...this.opts.scenery(), ...this.opts.riders()];
        const owned = new Set(explicit.flatMap(r => [r.sprite, ...(r.carry ?? []), ...(r.hide ?? [])]));
        const scenery: Rider[] = [];
        for (const part of this.scene.children.list) {
            if (part.name.startsWith('surf-')) continue;
            if (part.input && !this.interactions.has(part)) {
                this.interactions.set(part, part.input.enabled);
                part.input.enabled = false;
            }
            if (!(part instanceof Phaser.GameObjects.Image || part instanceof Phaser.GameObjects.Sprite
                || part instanceof Phaser.GameObjects.TileSprite || part instanceof Phaser.GameObjects.Text)) continue;
            const home = this.cast.position(part);
            if (owned.has(part) || home.depth <= -1e8 || home.depth >= SURF_DEPTH
                || part.name === 'creator-nametag' || part.name === 'token-count'
                || part.scrollFactorX !== 1 || part.scrollFactorY !== 1) continue;
            scenery.push({ sprite: part, reveal: false });
        }
        return [...scenery, ...explicit];
    }

    private draw() {
        const t = this.clock.age / 1000;
        const still = this.motion.matches;
        const b = this.opts.bounds(), view = this.scene.cameras.main.worldView;
        const top = Math.floor(Math.min(b.top, view.top) / 12) * 12 - 200;
        const bottom = Math.ceil(Math.max(b.bottom, view.bottom) / 12) * 12 + 200;
        const span = this.extent.right - this.extent.left;
        const pulse = still ? { front: this.extent.left + span * 0.22, width: span * 1.3 }
            : waveAt(t, this.extent.left, this.extent.right);
        const { front, width } = pulse;
        const phase = still ? 0 : Math.floor(t * 8);
        const water = this.water!.clear(), wave = this.wave!.clear(), floats = this.floats!.clear();
        const opacity = still ? smooth(t / 2) * smooth((20 - t) / 2) : 1;
        for (const part of [water, wave, floats, this.barrel!, this.surfer!, this.sign!]) part.setAlpha(opacity);
        const flowTime = still ? 0 : t;
        const chop = (y: number) => Math.round(Math.sin(y / 130 + flowTime * 1.7) * 22
            + Math.sin(y / 43 - flowTime * 2.3) * 9);
        for (let y = top; y < bottom; y += 12) {
            const lip = front + chop(y);
            const lead = Math.round(lip - width * 0.18);
            const tail = Math.round(front + width * 0.7 + Math.sin(y / 27 + flowTime * 3) * 20);
            water.fillStyle(WATER.deep).fillRect(lead, y, tail - lead, 12);
            for (let band = 0; band < 20; band++) {
                const x = Math.round(lead + band / 20 * (tail - lead));
                const bandW = Math.ceil((tail - lead) / 20) + 1;
                const color = band < 3 ? FACE[band] : FACE[Math.min(5, 2 + Math.floor(band / 4))];
                wave.fillStyle(color).fillRect(x, y, bandW, 12);
            }
            if ((Math.floor(y / 12) + phase) % 4 === 0) {
                wave.fillStyle(WATER.foam).fillRect(lead - 12, y - 4, 24, 8);
                wave.fillStyle(WATER.ice).fillRect(tail - 18, y + 3, 26, 4);
            }
            wave.fillStyle(WATER.teal).fillRect(tail - 10, y, 10, 12);
            if (Math.floor(y / 12) % 3) wave.fillStyle(WATER.foam).fillRect(tail - 5, y + 2, 11, 4);
        }
        for (let y = top; y < bottom; y += 40) {
            for (let i = 0; i < 8; i++) {
                const flow = Phaser.Math.Wrap(i * 0.113 - phase * 0.021 + Math.sin(y) * 0.04, 0, 0.8);
                const x = Math.round(front + (flow - 0.13) * width + chop(y));
                const yy = y + Math.round(Math.sin(i * 2 + t * (still ? 0 : 3)) * 7);
                const color = i % 3 ? WATER.turquoise : WATER.ice;
                wave.fillStyle(color).fillRect(x, yy, 22 + i * 3, 4)
                    .fillRect(x - 6, yy + 4, 9, 5).fillRect(x + 4, yy + 9, 16, 3);
            }
            if (!still) {
                const spray = (phase + Math.floor(y / 40)) % 5;
                wave.fillStyle(WATER.foam).fillRect(Math.round(front - width * 0.18 - spray * 9), y - spray * 6, 6, 9);
            }
        }
        for (let y = top; y < bottom; y += 180) {
            const cy = y + 60;
            const cx = front - width * 0.08 + chop(cy);
            for (let i = 0; i < 24; i++) {
                const a = i / 24 * Math.PI * 1.7 + flowTime * 0.7;
                const radius = 18 + i * 1.2;
                const x = Math.round(cx + Math.cos(a) * radius);
                const yy = Math.round(cy + Math.sin(a) * radius * 1.3);
                wave.fillStyle(i % 3 ? WATER.foam : WATER.ice).fillRect(x, yy, 10, 8);
            }
        }
        const scale = Phaser.Math.Clamp(width / 190, 2, 4);
        const carve = still ? 0 : Math.sin(t * 1.8) * 24;
        const by = b.centerY + 80 + carve;
        const bx = front + width * 0.13;
        this.barrel!.setPosition(Math.round(bx), Math.round(by)).setScale(scale)
            .setTexture(`ocean-barrel-${phase % 4}`);
        const sx = bx - 18 * scale;
        const sy = by - 119 * scale + (still ? 0 : Math.sin(t * 4) * 4);
        this.surfer!.setPosition(Math.round(sx), Math.round(sy)).setScale(scale)
            .setTexture(`ocean-surfer-${still ? 1 : phase % 3}`).setAngle(still ? 0 : Math.round(Math.sin(t * 3) * 9));
        this.sign!.setPosition(Math.round(sx), Math.round(sy - 58 * scale)).setScale(Math.min(3, scale));
        for (let i = 0; i < 16; i++) {
            floats.fillStyle(i % 2 ? WATER.foam : WATER.ice)
                .fillRect(sx + 18 + i * 10, sy - 3 + i * 3 + (still ? 0 : (phase + i) % 5), 15 - i / 2, 4);
        }
        this.cast.sync(this.gather());
        this.cast.pose((x, y) => {
            const lift = swellAt(x, pulse);
            const wet = lift > 0.001;
            const at = still ? { x, y } : {
                x: x - Math.round(66 * lift),
                y: y - Math.round((100 + Math.sin(t * 4 + x / 75) * 7) * lift),
            };
            if (wet) floats.fillStyle(WATER.turquoise).fillRect(at.x - 14, at.y, 28, 4)
                .fillStyle(WATER.foam).fillRect(at.x - 10, at.y + 3, 20, 3);
            return { ...at, wet };
        });
    }

    private rebase() { this.cast.restore(); }

    private finish() {
        if (!this.water) return;
        this.cast.restore();
        for (const [part, enabled] of this.interactions) if (part.scene && part.input) part.input.enabled = enabled;
        this.interactions.clear();
        this.scene.tweens.timeScale = this.tweenSpeed;
        this.scene.time.timeScale = this.timerSpeed;
        this.opts.setSurfing(false);
        for (const part of [this.water, this.wave, this.floats, this.barrel, this.surfer, this.sign]) part?.destroy();
        this.water = this.wave = this.floats = undefined;
        this.barrel = this.surfer = this.sign = undefined;
    }

    private cancel() {
        this.clock.cancel();
        this.finish();
    }

    destroy() {
        if (this.disposed) return;
        this.cancel();
        this.disposed = true;
        this.scene.events.off('sleep', this.cancel, this);
        this.scene.events.off('surf:rebase', this.rebase, this);
        this.scene.events.off('shutdown', this.destroy, this);
        this.scene.events.off('destroy', this.destroy, this);
    }
}
