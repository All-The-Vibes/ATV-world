import Phaser from 'phaser';
import { shadowTexture, type Color } from '../kit';
import { MOLE_H, MOLE_W, PATCH_H, PATCH_W, holeSpots, moleTexture, patchTexture, popTexture, signTexture, starTexture } from './art';

const ROUND = 30;
const BEST_KEY = 'atv-moles-best';
/** How close the player's feet must be to a hole to bonk what's in it. */
const REACH_X = 10;
const REACH_Y = 7;
const FX = 1e6;

type State = 'down' | 'rising' | 'up' | 'sinking' | 'bonked';

interface Hole {
    x: number;
    y: number;
    mole: Phaser.GameObjects.Sprite;
    state: State;
    /** 0 (hidden) to 1 (all the way out). */
    rise: number;
    /** Seconds left in the current state (how long it stays up, or how long it stays dazed). */
    left: number;
    golden: boolean;
}

/**
 * Whack-a-Mole: a fenced patch of nine holes. Walk in to start a 30-second round; moles pop up faster and
 * faster, and stepping on one (or clicking it) bonks it. Golden moles are worth 5. Best score is kept.
 * Between rounds a mole peeks out now and then, just to taunt you.
 */
export class Moles {
    /** What the world's bounds should include. */
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    readonly area: Phaser.Geom.Rectangle;
    private readonly holes: Hole[];
    private readonly sign: Phaser.GameObjects.Image;
    private playing = false;
    private timeLeft = 0;
    private score = 0;
    private best = 0;
    private nextPop = 2;
    /** The player has to step out and back in to play again. */
    private wasInside = false;
    private signText = '';

    constructor(private readonly scene: Phaser.Scene, x: number, y: number) {
        const left = Math.round(x - PATCH_W / 2);
        const top = Math.round(y - PATCH_H / 2);
        this.area = new Phaser.Geom.Rectangle(left, top, PATCH_W, PATCH_H);
        try {
            this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
        } catch { /* storage blocked */ }

        moleTexture(scene);
        starTexture(scene);
        this.parts.push(scene.add.image(left, top, patchTexture(scene)).setOrigin(0, 0).setDepth(-1e8 - 1));
        this.sign = scene.add.image(left - 8, top + 4, signTexture(scene, this.lines())).setOrigin(1, 1).setDepth(top + 4);
        this.parts.push(this.sign);
        scene.add.image(left - 8 - 33, top + 4, shadowTexture(scene, 14)).setAlpha(0.25).setDepth(-1e8);

        this.holes = holeSpots().map((s) => {
            const hx = left + s.x;
            const hy = top + s.y;
            const mole = scene.add.sprite(hx, hy, 'moles-mole', 0).setOrigin(0.5, 1).setDepth(hy).setVisible(false);
            const hole: Hole = { x: hx, y: hy, mole, state: 'down', rise: 0, left: 0, golden: false };
            // A click (not a drag: dragging looks around) bonks it, or starts a round.
            mole.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
                if (p.getDistance() >= 6) return;
                if (!this.playing) this.start();
                else this.bonk(hole);
            });
            return hole;
        });
        this.drawSign();
    }

    /** Start a round right away (handy from the console). */
    start() {
        if (this.playing) return;
        this.playing = true;
        this.timeLeft = ROUND;
        this.score = 0;
        this.nextPop = 0.4;
        for (const h of this.holes) if (h.state !== 'down') h.state = 'sinking';
        this.pop(this.area.centerX, this.area.top - 2, 'GO!', 'lime');
        this.drawSign();
    }

    update(dt: number, player?: { x: number; y: number }) {
        dt = Math.min(dt, 0.1);
        const inside = !!player && this.area.contains(player.x, player.y);
        if (inside && !this.wasInside && !this.playing) this.start();
        this.wasInside = inside;

        if (this.playing) {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) this.finish();
        }

        // Faster and fiercer as the round goes on.
        const heat = this.playing ? 1 - this.timeLeft / ROUND : 0;
        this.nextPop -= dt;
        if (this.nextPop <= 0) {
            this.nextPop = this.playing ? Phaser.Math.Linear(0.95, 0.4, heat) * Phaser.Math.FloatBetween(0.7, 1.3) : Phaser.Math.FloatBetween(2.5, 5);
            const busy = this.holes.filter((h) => h.state !== 'down').length;
            const free = this.holes.filter((h) => h.state === 'down');
            if (free.length && busy < (this.playing ? 2 + Math.round(heat * 2) : 1)) {
                const h = Phaser.Utils.Array.GetRandom(free);
                h.state = 'rising';
                h.golden = this.playing && Math.random() < 0.12;
                h.left = this.playing ? Phaser.Math.Linear(1.2, 0.6, heat) : 1.4;
            }
        }

        for (const h of this.holes) {
            if (h.state === 'rising') {
                h.rise = Math.min(1, h.rise + dt * 9);
                if (h.rise === 1) h.state = 'up';
            } else if (h.state === 'up') {
                h.left -= dt;
                if (h.left <= 0) h.state = 'sinking';
            } else if (h.state === 'bonked') {
                h.left -= dt;
                if (h.left <= 0) h.state = 'sinking';
            } else if (h.state === 'sinking') {
                h.rise = Math.max(0, h.rise - dt * 6);
                if (h.rise === 0) h.state = 'down';
            }
            if (this.playing && player && (h.state === 'up' || h.state === 'rising') && h.rise > 0.4 &&
                Math.abs(player.x - h.x) <= REACH_X && Math.abs(player.y - h.y) <= REACH_Y) this.bonk(h);
            this.place(h);
        }
        this.drawSign();
    }

    /** Show the top `rise` of the mole, sitting in its hole. */
    private place(h: Hole) {
        const shown = Math.round(h.rise * MOLE_H);
        if (shown <= 0) {
            h.mole.setVisible(false);
            return;
        }
        if (h.state !== 'bonked') h.mole.setFrame(h.golden ? 2 : 0);
        h.mole.setVisible(true).setCrop(0, 0, MOLE_W, shown).setY(h.y + MOLE_H - shown);
    }

    private bonk(h: Hole) {
        if (h.state !== 'up' && h.state !== 'rising') return;
        const points = h.golden ? 5 : 1;
        this.score += points;
        h.state = 'bonked';
        h.left = 0.35;
        h.rise = Math.max(h.rise, 0.6);
        h.mole.setFrame(h.golden ? 3 : 1);
        this.scene.tweens.add({ targets: h.mole, scaleY: 0.7, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
        this.pop(h.x, h.y - MOLE_H, h.golden ? '+5' : 'BONK!', h.golden ? 'yellow' : 'white');
        for (let i = 0; i < 5; i++) {
            const star = this.scene.add.image(h.x, h.y - MOLE_H + 2, 'moles-star').setDepth(FX);
            const a = -Math.PI * (0.15 + 0.7 * i / 4);
            this.scene.tweens.add({
                targets: star, x: h.x + Math.cos(a) * 14, y: star.y + Math.sin(a) * 12, alpha: 0, angle: 180,
                duration: 380, ease: 'Quad.easeOut', onComplete: () => star.destroy(),
            });
        }
        if (h.golden) this.scene.cameras.main.shake(90, 0.002);
    }

    private finish() {
        this.playing = false;
        this.timeLeft = 0;
        this.nextPop = 3;
        const record = this.score > this.best;
        if (record) {
            this.best = this.score;
            try {
                localStorage.setItem(BEST_KEY, String(this.best));
            } catch { /* storage blocked */ }
            this.scene.cameras.main.flash(200, 247, 181, 56, false);
            this.pop(this.area.centerX, this.area.top - 2, 'NEW BEST!', 'yellow');
        } else {
            this.pop(this.area.centerX, this.area.top - 2, 'TIME!', 'cream');
        }
        for (const h of this.holes) if (h.state === 'up' || h.state === 'rising') h.state = 'sinking';
    }

    private lines(): [string, string, string] {
        if (this.playing) return ['WHACK-A-MOLE', `SCORE ${this.score}`, `TIME ${Math.ceil(this.timeLeft)}`];
        return ['WHACK-A-MOLE', this.score ? `LAST ${this.score} BEST ${this.best}` : `BEST ${this.best}`, 'WALK IN TO PLAY'];
    }

    private drawSign() {
        const lines = this.lines();
        const text = lines.join('|');
        if (text === this.signText) return;
        this.signText = text;
        this.sign.setTexture(signTexture(this.scene, lines));
    }

    private pop(x: number, y: number, text: string, color: Color) {
        const word = this.scene.add.image(x, y, popTexture(this.scene, text, color)).setOrigin(0.5, 1).setDepth(FX + 1);
        this.scene.tweens.add({ targets: word, y: y - 14, alpha: 0, duration: 800, delay: 150, ease: 'Quad.easeOut', onComplete: () => word.destroy() });
    }
}
