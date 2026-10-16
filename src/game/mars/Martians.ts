import Phaser from 'phaser';
import { addPixels, shadowTexture, speechArt } from '../kit';
import { MARTIAN_LOOKS } from './art';

const LINES = [
    'Take me to your leader!',
    'Greetings, Earthling!',
    'Nice rocket. Is it electric?',
    'We come in peace. Mostly.',
    'You have only TWO eyes? Cute.',
    'Do Earthlings vibe code too?',
    'Got any spare tokens?',
    'Red dirt, best dirt.',
    'Beep boop. Just kidding.',
    'Our wifi is 140M miles away.',
] as const;

const SPEED = 26;
const GREET_RANGE = 40;

type Martian = {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Image;
    look: number;
    target: Phaser.Math.Vector2;
    /** Seconds to stand still before picking the next spot. */
    rest: number;
    /** Seconds left on the current speech bubble / wave. */
    talk: number;
    /** Seconds until this Martian will greet the player again. */
    cooldown: number;
};

/** Little Martians wandering the plain; they wave and say hello when the player walks up. */
export class Martians {
    private crew: Martian[] = [];

    constructor(
        private scene: Phaser.Scene,
        private area: Phaser.Geom.Rectangle,
        /** Spots Martians shouldn't stand on (the landing pad, the dome). */
        private avoid: Phaser.Geom.Rectangle[],
        count = 6,
    ) {
        LINES.forEach((line, i) => addPixels(scene, `martian-say-${i}`, speechArt(line)));
        for (let i = 0; i < count; i++) {
            const { x, y } = this.spot();
            const look = i % MARTIAN_LOOKS.length;
            const shadow = scene.add.image(x, y, shadowTexture(scene, 10)).setAlpha(0.3);
            const sprite = scene.add.sprite(x, y, `martian-${look}`, 0).setOrigin(0.5, 1);
            const bubble = scene.add.image(x, y - 22, 'martian-say-0').setOrigin(0.5, 1).setDepth(1e5).setVisible(false);
            this.crew.push({ sprite, shadow, bubble, look, target: this.spot(), rest: Math.random() * 3, talk: 0, cooldown: 0 });
        }
        this.crew.forEach((m) => this.place(m));
    }

    get count() {
        return this.crew.length;
    }

    update(s: number, player?: { x: number; y: number; visible: boolean }) {
        for (const m of this.crew) {
            m.cooldown = Math.max(0, m.cooldown - s);
            if (m.talk > 0) {
                m.talk -= s;
                if (m.talk <= 0) {
                    m.bubble.setVisible(false);
                    m.sprite.setFrame(0);
                }
            } else if (player?.visible && !m.cooldown
                && Phaser.Math.Distance.Between(m.sprite.x, m.sprite.y, player.x, player.y) < GREET_RANGE) {
                this.greet(m, player.x);
            } else {
                this.wander(m, s);
            }
            this.place(m);
        }
    }

    /** Stop, face the player, wave, and say something. */
    greet(m: Martian, towardX = m.sprite.x + 1) {
        m.talk = 3;
        m.cooldown = 10;
        m.sprite.stop().setFrame(2).setFlipX(towardX < m.sprite.x);
        m.bubble.setTexture(`martian-say-${Phaser.Math.Between(0, LINES.length - 1)}`).setVisible(true);
    }

    private wander(m: Martian, s: number) {
        if (m.rest > 0) {
            m.rest -= s;
            m.sprite.stop().setFrame(0);
            return;
        }
        const dx = m.target.x - m.sprite.x;
        const dy = m.target.y - m.sprite.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) {
            m.rest = Phaser.Math.FloatBetween(1, 4);
            m.target = this.spot();
            return;
        }
        const step = Math.min(d, SPEED * s);
        m.sprite.x += (dx / d) * step;
        m.sprite.y += (dy / d) * step;
        if (Math.abs(dx) > 0.5) m.sprite.setFlipX(dx < 0);
        if (!m.sprite.anims.isPlaying) m.sprite.play(`martian-${m.look}`);
    }

    private place(m: Martian) {
        const { x, y } = m.sprite;
        // A little hop in their step: Martians bounce in the low gravity.
        const hop = m.sprite.anims.isPlaying ? Math.abs(Math.sin(this.scene.time.now / 120)) * 2 : 0;
        m.sprite.setDepth(y).setDisplayOrigin(m.sprite.width / 2, m.sprite.height + hop);
        m.shadow.setPosition(x, y).setDepth(y - 0.5);
        m.bubble.setPosition(x, y - 22 - hop);
    }

    private spot() {
        const inner = new Phaser.Geom.Rectangle(this.area.x + 24, this.area.y + 30, this.area.width - 48, this.area.height - 40);
        for (let i = 0; i < 20; i++) {
            const p = inner.getRandomPoint(new Phaser.Math.Vector2());
            if (!this.avoid.some((r) => r.contains(p.x, p.y))) return p;
        }
        return new Phaser.Math.Vector2(inner.right - 10, inner.bottom - 10);
    }
}
