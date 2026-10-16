import Phaser from 'phaser';
import { ensurePixels } from '../kit';
import { breakerArt, surferArt, surfSign, WATER } from './art';
import { SurfClock } from './cycle';
import { Riders, SURF_DEPTH, type Rider } from './riders';

interface OceanOptions {
    bounds: () => Phaser.Geom.Rectangle;
    riders: () => Rider[];
    setSurfing: (value: boolean) => void;
}
const smooth = (n: number) => Phaser.Math.SmoothStep(n, 0, 1);
const FACE_COLORS = [WATER.foam, WATER.ice, WATER.turquoise, WATER.teal, WATER.blue, WATER.deep];

export class Ocean {
    private clock = new SurfClock();
    private cast = new Riders();
    private water?: Phaser.GameObjects.Graphics;
    private wave?: Phaser.GameObjects.Graphics;
    private floats?: Phaser.GameObjects.Graphics;
    private barrel?: Phaser.GameObjects.Image;
    private surfer?: Phaser.GameObjects.Image;
    private sign?: Phaser.GameObjects.Image;
    private sky: { part: Phaser.GameObjects.Image; visible: boolean }[] = [];
    private interactions: { part: Phaser.GameObjects.GameObject; enabled: boolean }[] = [];
    private tweenSpeed = 1;
    private timerSpeed = 1;
    private disposed = false;
    private motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    constructor(private scene: Phaser.Scene, private opts: OceanOptions) {
        scene.events.on('sleep', this.cancel, this);
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
        this.interactions = this.scene.children.list.filter(part => part.input)
            .map(part => ({ part, enabled: part.input!.enabled }));
        for (const { part } of this.interactions) part.input!.enabled = false;
        this.sky = this.scene.children.list
            .filter((o): o is Phaser.GameObjects.Image => 'depth' in o && Number(o.depth) >= 1e6 && 'visible' in o)
            .map(part => ({ part, visible: part.visible }));
        this.sky.forEach(({ part }) => part.setVisible(false));
        ensurePixels(this.scene, 'ocean-barrel', breakerArt);
        for (let i = 0; i < 3; i++) ensurePixels(this.scene, `ocean-surfer-${i}`, () => surferArt(i));
        ensurePixels(this.scene, 'ocean-sign', surfSign);
        this.water = this.scene.add.graphics().setDepth(-9e8).setName('surf-water');
        this.wave = this.scene.add.graphics().setDepth(SURF_DEPTH).setName('surf-wave');
        this.floats = this.scene.add.graphics().setDepth(SURF_DEPTH + 8).setName('surf-floats');
        this.barrel = this.scene.add.image(0, 0, 'ocean-barrel').setOrigin(0.5, 1).setDepth(SURF_DEPTH + 1).setScale(2).setName('surf-barrel');
        this.surfer = this.scene.add.image(0, 0, 'ocean-surfer-1').setOrigin(0.5, 1).setScale(2).setDepth(SURF_DEPTH + 20).setName('surf-surfer');
        this.sign = this.scene.add.image(0, 0, 'ocean-sign').setScale(2).setDepth(SURF_DEPTH + 21).setName('surf-sign');
    }

    private draw() {
        const t = this.clock.age / 1000;
        const still = this.motion.matches;
        const b = this.opts.bounds();
        const view = this.scene.cameras.main.worldView;
        const left = Math.floor(Math.min(b.left, view.left) / 24) * 24 - 48;
        const right = Math.ceil(Math.max(b.right, view.right) / 24) * 24 + 48;
        const top = Math.floor(Math.min(b.top, view.top)) - 160;
        const bottom = Math.ceil(Math.max(b.bottom, view.bottom)) + 200;
        const fill = smooth(t / 4);
        const drain = smooth((t - 14) / 6);
        const wetTop = top + (bottom - top) * drain;
        const wetBottom = top + (bottom - top) * fill;
        const water = this.water!.clear();
        for (let x = left; x < right; x += 24) {
            const chop = Math.round(Math.sin(x / 55 + (still ? 0 : t * 2)) * 3) * 2;
            const y = Math.floor(wetTop + (drain > 0 ? chop : 0));
            const end = Math.floor(wetBottom + (fill < 1 ? chop : 0));
            if (end <= y) continue;
            water.fillStyle(WATER.deep).fillRect(x, y, 24, end - y);
            water.fillStyle(WATER.turquoise).fillRect(x, drain > 0 ? y : end - 5, 24, 5);
            water.fillStyle(WATER.foam).fillRect(x + 2, drain > 0 ? y : end - 3, 17, 3);
        }
        const phase = still ? 0 : Math.floor(t * 8);
        for (let y = Math.ceil(wetTop / 32) * 32 + 8; y < wetBottom - 10; y += 32) {
            for (let x = left; x < right; x += 64) {
                const rx = x + ((y * 7 + phase) % 42);
                const ry = y + Math.round(Math.sin(x + (still ? 0 : t)) * 2);
                water.fillStyle((x + y) % 3 ? WATER.blue : WATER.teal).fillRect(rx, ry, 24, 3);
                water.fillStyle(WATER.turquoise).fillRect(rx + 9, ry - 2, 10, 2);
            }
        }

        const travel = smooth((t - 2) / 12);
        const front = still ? b.centerY : b.top - 100 + (b.height + 300) * travel;
        const envelope = smooth(t / 3) * (1 - drain);
        const visible = t >= 2 && t < 17;
        const wave = this.wave!.clear();
        if (visible) {
            for (let x = left; x < right; x += 12) {
                const lip = Math.round(front + Math.sin(x / 90 + (still ? 0 : t * 1.8)) * 9);
                for (let row = 0; row < 9; row++) {
                    wave.fillStyle(FACE_COLORS[Math.min(5, Math.floor(row * 0.65))])
                        .fillRect(x, lip + row * 12, 12, 12);
                }
                if (!still && (x / 12 + Math.floor(t * 10)) % 7 === 0) wave.fillStyle(WATER.foam).fillRect(x, lip - 16, 4, 7);
            }
        }
        const carve = still ? 0 : Math.sin(t * 1.7) * 54;
        const sx = b.centerX + carve;
        const sy = front - 92 + (still ? 0 : Math.round(Math.sin(t * 3) * 3));
        this.barrel!.setPosition(sx - 32, front + 130).setVisible(visible);
        this.surfer!.setPosition(sx, sy)
            .setTexture(`ocean-surfer-${still ? 1 : Math.floor(t * 3) % 3}`).setVisible(visible)
            .setAngle(still ? 0 : Math.round(Math.sin(t * 2.4) * 7));
        this.sign!.setPosition(sx, sy - 112).setVisible(visible);
        const floats = this.floats!.clear();
        if (visible) {
            for (let i = 0; i < 12; i++) {
                floats.fillStyle(i % 2 ? WATER.foam : WATER.ice)
                    .fillRect(sx - 20 - i * 9, sy - 1 + i * 3 + (still ? 0 : Math.floor(t * 8 + i) % 4), 12 - i / 2, 3);
            }
        }
        this.cast.sync(this.opts.riders());
        this.cast.pose((x, y, i) => {
            const drift = Phaser.Math.Clamp(front - b.centerY, -52, 120);
            const at = still ? { x, y } : {
                x: Math.round(x + (Math.sin(t * 1.5) * 18 + carve * 0.5) * envelope),
                y: Math.round(y + (drift + Math.sin(t * 3 + i * 1.8) * 5) * envelope),
            };
            floats.fillStyle(WATER.turquoise).fillRect(at.x - 13, at.y - 2, 26, 4)
                .fillStyle(WATER.foam).fillRect(at.x - 9, at.y + 2, 18, 2);
            return at;
        });
    }

    private finish() {
        if (!this.water) return;
        this.cast.restore();
        for (const { part, visible } of this.sky) if (part.active && part.scene) part.setVisible(visible);
        this.sky = [];
        for (const { part, enabled } of this.interactions) if (part.scene && part.input) part.input.enabled = enabled;
        this.interactions = [];
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
        this.scene.events.off('shutdown', this.destroy, this);
        this.scene.events.off('destroy', this.destroy, this);
    }
}
