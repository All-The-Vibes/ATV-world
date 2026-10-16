import Phaser from 'phaser';
import { FLOWER_KINDS } from './folk';
import { Speaker, pick, still, type Feature } from './talk';

const LINES = [
    'What a curious weed!',
    "We can talk, when there's anybody worth talking to.",
    'Her petals are rather untidy.',
    'La la LAAAA!',
    'Mind where you put your roots!',
    "Is she a flower? She can't be. She MOVES.",
];

interface Fly {
    sprite: Phaser.GameObjects.Sprite;
    home: { x: number; y: number };
    to: { x: number; y: number };
    phase: number;
    retarget: number;
}

/**
 * The Garden of Live Flowers: a bed of flowers with faces that sway, burst into song when you come near (notes and
 * all), and pass rude remarks about you. Bread-and-butterflies flit about the place.
 */
export class Garden implements Feature {
    private readonly flowers: { sprite: Phaser.GameObjects.Sprite; key: string; speaker: Speaker }[] = [];
    private readonly flies: Fly[] = [];
    private singing = false;
    private noteIn = 0;
    private lineIn = 1;
    private time = 0;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number, private readonly roam: Phaser.Geom.Rectangle) {
        scene.add.image(x, y + 34, 'wl-tag-garden').setOrigin(0.5, 1).setDepth(y + 34);
        for (let row = 0; row < 3; row++) {
            for (let i = 0; i < 6; i++) {
                const fx = x - 60 + i * 24 + (row % 2) * 12 + Phaser.Math.Between(-3, 3), fy = y - 18 + row * 16;
                const key = `wl-flower-${FLOWER_KINDS[(i + row * 2) % FLOWER_KINDS.length]}`;
                const sprite = scene.add.sprite(fx, fy, key, 0).setOrigin(0.5, 1).setDepth(fy);
                if (!still()) {
                    scene.tweens.add({ targets: sprite, angle: { from: -5, to: 5 }, duration: Phaser.Math.Between(1100, 1700), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 900) });
                }
                this.flowers.push({ sprite, key, speaker: new Speaker(scene, () => ({ x: sprite.x, y: sprite.y - 22 })) });
            }
        }
        for (let i = 0; i < 7; i++) {
            const home = { x: x + Phaser.Math.Between(-80, 80), y: y + Phaser.Math.Between(-60, 20) };
            const sprite = scene.add.sprite(home.x, home.y, 'wl-bbfly', 0).setDepth(1e4);
            if (!still()) sprite.play({ key: 'wl-bbfly', startFrame: i % 2 });
            this.flies.push({ sprite, home, to: { ...home }, phase: Math.random() * 10, retarget: Phaser.Math.FloatBetween(2, 8) });
        }
    }

    update(dt: number, player: Phaser.GameObjects.Sprite) {
        this.time += dt;
        const near = Phaser.Math.Distance.Between(player.x, player.y, this.x, this.y) < 95;
        if (near !== this.singing) {
            this.singing = near;
            for (const f of this.flowers) {
                if (near && !still()) f.sprite.play({ key: `${f.key}-sing`, startFrame: Phaser.Math.Between(0, 1) });
                else f.sprite.stop().setFrame(0);
            }
        }
        if (near) {
            if ((this.noteIn -= dt) <= 0) {
                this.noteIn = 0.3;
                this.note(pick(this.flowers).sprite);
            }
            if ((this.lineIn -= dt) <= 0) {
                this.lineIn = Phaser.Math.FloatBetween(2.6, 4);
                pick(this.flowers).speaker.say(pick(LINES), 2.6);
            }
        }
        for (const f of this.flies) {
            if ((f.retarget -= dt) <= 0) {
                f.retarget = Phaser.Math.FloatBetween(4, 9);
                f.to = Math.random() < 0.5
                    ? { x: this.x + Phaser.Math.Between(-90, 90), y: this.y + Phaser.Math.Between(-70, 20) }
                    : { x: Phaser.Math.Between(this.roam.left, this.roam.right), y: Phaser.Math.Between(this.roam.top, this.roam.bottom) };
            }
            f.home.x += (f.to.x - f.home.x) * Math.min(1, dt * 0.35);
            f.home.y += (f.to.y - f.home.y) * Math.min(1, dt * 0.35);
            const t = this.time * 2 + f.phase;
            const px = f.sprite.x;
            f.sprite.setPosition(f.home.x + Math.cos(t) * 14, f.home.y + Math.sin(t * 1.7) * 8 - 10);
            f.sprite.setFlipX(f.sprite.x < px);
        }
    }

    private note(from: Phaser.GameObjects.Sprite) {
        if (still()) return;
        const n = this.scene.add.image(from.x, from.y - 22, Math.random() < 0.5 ? 'wl-note-a' : 'wl-note-b').setDepth(1e4);
        this.scene.tweens.add({ targets: n, x: n.x + Phaser.Math.Between(-10, 10), y: n.y - 26, alpha: 0, duration: 1400, onComplete: () => n.destroy() });
    }
}
