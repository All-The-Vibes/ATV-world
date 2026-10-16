import Phaser from 'phaser';
import { addToken, isTyping, walkInput } from '../commands';
import { blasterTextures, textTexture } from '../mars/blasterArt';
import type { Color } from '../kit';

/** The playfield, in pixels (the camera zooms it to fit the screen). */
const W = 176;
const H = 240;
const BEST_KEY = 'atv-blaster-best';
/** Seconds per wave; every fifth wave brings the mothership. */
const WAVE = 20;
const BOSS_EVERY = 5;
const SHIP_SPEED = 120;
const FIRE_EVERY = 0.15;
const MAX_LIVES = 5;
/** Gold tokens earned per this many points (at most TOKEN_CAP per game). */
const POINTS_PER_TOKEN = 500;
const TOKEN_CAP = 5;

type Kind = 'rock' | 'pebble' | 'saucer' | 'diver' | 'boss';
type Power = 0 | 1 | 2; // spread, shield, heart

interface Foe {
    kind: Kind;
    sprite: Phaser.GameObjects.Sprite;
    hp: number;
    maxHp: number;
    r: number;
    vx: number;
    vy: number;
    /** Seconds alive (drives the wobbles and dives). */
    t: number;
    /** Seconds until it fires. */
    fire: number;
    points: number;
    baseX: number;
}

interface Shot {
    sprite: Phaser.GameObjects.Image;
    vx: number;
    vy: number;
}

interface Drop {
    sprite: Phaser.GameObjects.Image;
    power: Power;
}

const POINTS: Record<Kind, number> = { rock: 20, pebble: 10, saucer: 50, diver: 40, boss: 1000 };

/**
 * MARS BLASTER: the arcade cabinet on Mars. Steer with the arrows (or the touch stick); the ship fires on its own.
 * Space drops a smart bomb (three per game) that clears the screen. Asteroids split, saucers shoot back,
 * gremlins dive at you, and every fifth wave the Mega Gremlin Mothership shows up. Grab S for a spread shot,
 * the shield for one free hit, and hearts for a life. Escape walks away from the cabinet.
 */
export class Blaster extends Phaser.Scene {
    private state: 'title' | 'play' | 'over' = 'title';
    private ship!: Phaser.GameObjects.Sprite;
    private shieldRing!: Phaser.GameObjects.Image;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private stars: { image: Phaser.GameObjects.Image; speed: number }[] = [];
    private foes: Foe[] = [];
    private shots: Shot[] = [];
    private zaps: Shot[] = [];
    private drops: Drop[] = [];
    private score = 0;
    private best = 0;
    private lives = 3;
    private bombs = 3;
    private wave = 1;
    private waveClock = 0;
    private spawnClock = 0;
    private fireClock = 0;
    private spread = 0;
    private shielded = false;
    /** Seconds of blinking invulnerability after a hit. */
    private safe = 0;
    private overAt = 0;
    private boss?: Foe;
    private bossBar!: Phaser.GameObjects.Graphics;
    private hud: Record<string, Phaser.GameObjects.Image> = {};
    private hudText: Record<string, string> = {};
    private title!: Phaser.GameObjects.Container;
    private overScreen!: Phaser.GameObjects.Container;
    private banners: Phaser.GameObjects.Image[] = [];
    private onKey = (e: KeyboardEvent) => this.key(e);

    constructor() {
        super('Blaster');
    }

    create() {
        this.state = 'title';
        this.stars = [];
        this.foes = [];
        this.shots = [];
        this.zaps = [];
        this.drops = [];
        this.hud = {};
        this.hudText = {};
        this.banners = [];
        this.boss = undefined;
        try {
            this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
        } catch { /* storage blocked */ }

        blasterTextures(this, W);
        this.cameras.main.setBackgroundColor('#0b0814');
        this.add.rectangle(0, 0, W, H, 0x14101e).setOrigin(0, 0).setDepth(-100);
        for (let i = 0; i < 70; i++) {
            const speed = Phaser.Math.Between(8, 60);
            const image = this.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'blaster-star')
                .setAlpha(speed / 70 + 0.15).setDepth(-90);
            this.stars.push({ image, speed });
        }
        this.add.image(0, H, 'blaster-planet').setOrigin(0, 1).setDepth(-80).setAlpha(0.9);

        this.ship = this.add.sprite(W / 2, H - 30, 'blaster-ship', 0).setDepth(10).play('blaster-ship');
        this.shieldRing = this.add.image(0, 0, 'blaster-shield').setDepth(11).setVisible(false);
        this.bossBar = this.add.graphics().setDepth(50);
        this.cursors = this.input.keyboard!.createCursorKeys();

        this.title = this.screen([
            ['MARS BLASTER', 'yellow', 2],
            ['', 'cream', 1],
            ['ARROWS MOVE - AUTO FIRE', 'cream', 1],
            ['SPACE: SMART BOMB', 'cream', 1],
            ['GRAB S, SHIELDS AND HEARTS', 'cream', 1],
            ['', 'cream', 1],
            [`BEST ${this.best}`, 'orange', 1],
            ['', 'cream', 1],
            ['PRESS SPACE OR TAP', 'lime', 1],
            ['ESC TO LEAVE', 'mist', 1],
        ], 'blaster-title');
        this.overScreen = this.screen([], 'blaster-over').setVisible(false);
        this.tweens.add({ targets: this.title.list[9], alpha: 0.3, duration: 450, yoyo: true, repeat: -1 });

        window.addEventListener('keydown', this.onKey);
        this.input.on('pointerdown', () => this.press());
        const fit = () => {
            const cam = this.cameras.main;
            const s = Math.min(this.scale.width / (W + 8), this.scale.height / (H + 8));
            const zoom = s >= 1 ? Math.floor(s) : Math.max(0.5, Math.floor(s * 4) / 4);
            // Clip the camera to the playfield, so nothing shows outside the arcade screen.
            const vw = Math.min(this.scale.width, Math.round(W * zoom));
            const vh = Math.min(this.scale.height, Math.round(H * zoom));
            cam.setViewport(Math.round((this.scale.width - vw) / 2), Math.round((this.scale.height - vh) / 2), vw, vh);
            cam.setZoom(zoom).centerOn(W / 2, H / 2);
        };
        fit();
        this.scale.on('resize', fit);
        this.events.once('shutdown', () => {
            this.scale.off('resize', fit);
            window.removeEventListener('keydown', this.onKey);
        });
        this.cameras.main.fadeIn(250, 11, 8, 20);
        this.drawHud();
    }

    update(_time: number, dt: number) {
        const s = Math.min(dt, 50) / 1000;
        for (const star of this.stars) {
            star.image.y += star.speed * s * (this.state === 'play' ? 1.6 : 0.6);
            if (star.image.y > H) star.image.setPosition(Phaser.Math.Between(0, W), 0);
        }
        if (this.state === 'play') this.play(s);
        else {
            this.moveFoes(s);
            this.moveShots(s);
        }
        this.drawHud();
    }

    /** Start a new game right away (handy from the console). */
    start() {
        for (const f of this.foes) f.sprite.destroy();
        for (const list of [this.shots, this.zaps]) for (const x of list) x.sprite.destroy();
        for (const d of this.drops) d.sprite.destroy();
        this.foes = [];
        this.shots = [];
        this.zaps = [];
        this.drops = [];
        this.boss = undefined;
        this.score = 0;
        this.lives = 3;
        this.bombs = 3;
        this.wave = 1;
        this.waveClock = 0;
        this.spawnClock = 1;
        this.fireClock = 0;
        this.spread = 0;
        this.shielded = false;
        this.safe = 1.5;
        this.ship.setPosition(W / 2, H - 30).setVisible(true).setAlpha(1);
        this.title.setVisible(false);
        this.overScreen.setVisible(false);
        this.state = 'play';
        this.banner('WAVE 1', 'yellow');
    }

    /** Walk away from the cabinet, back onto Mars. */
    leave() {
        const cam = this.cameras.main;
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.wake('Mars');
            this.scene.stop();
        });
        cam.fadeOut(200, 11, 8, 20);
    }

    private key(e: KeyboardEvent) {
        if (!this.sys.isActive() || e.repeat || isTyping()) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.leave();
        } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            if (this.state === 'play') {
                if (e.key !== 'Enter') this.bomb();
            } else this.press();
        }
    }

    private press() {
        if (this.state === 'title') this.start();
        else if (this.state === 'over' && this.time.now - this.overAt > 900) this.start();
    }

    private play(s: number) {
        const { dx, dy } = walkInput(this.cursors);
        const len = Math.hypot(dx, dy) || 1;
        this.ship.x = Phaser.Math.Clamp(this.ship.x + (dx / Math.max(1, len)) * SHIP_SPEED * s, 8, W - 8);
        this.ship.y = Phaser.Math.Clamp(this.ship.y + (dy / Math.max(1, len)) * SHIP_SPEED * s, 24, H - 10);
        this.safe = Math.max(0, this.safe - s);
        this.ship.setAlpha(this.safe > 0 && Math.floor(this.safe * 12) % 2 ? 0.3 : 1);
        this.shieldRing.setPosition(this.ship.x, this.ship.y).setVisible(this.shielded).setAngle(this.time.now / 8);
        this.spread = Math.max(0, this.spread - s);

        this.fireClock -= s;
        if (this.fireClock <= 0) {
            this.fireClock = FIRE_EVERY;
            const angles = this.spread > 0 ? [-0.22, 0, 0.22] : [0];
            for (const a of angles) this.shoot(this.ship.x + (a ? Math.sign(a) * 4 : 0), this.ship.y - 8, Math.sin(a) * 280, -Math.cos(a) * 280);
        }

        if (!this.boss) {
            this.waveClock += s;
            if (this.waveClock >= WAVE) {
                this.waveClock = 0;
                this.wave++;
                if (this.wave % BOSS_EVERY === 0) this.spawnBoss();
                else this.banner(`WAVE ${this.wave}`, 'yellow');
            }
        }
        this.spawnClock -= s;
        if (this.spawnClock <= 0) {
            const heat = Math.min(1, (this.wave - 1) / 10);
            this.spawnClock = (this.boss ? 2.2 : Phaser.Math.Linear(1.1, 0.35, heat)) * Phaser.Math.FloatBetween(0.7, 1.3);
            this.spawn();
        }

        this.moveFoes(s);
        this.moveShots(s);
        this.moveDrops(s);
        this.collide();
    }

    private spawn() {
        const roll = Math.random();
        const w = this.wave;
        if (this.boss || roll < Math.max(0.3, 0.6 - w * 0.05)) this.addFoe('rock', Phaser.Math.Between(12, W - 12), -10);
        else if (roll < 0.8) this.addFoe('diver', Phaser.Math.Between(16, W - 16), -8);
        else this.addFoe('saucer', Phaser.Math.Between(20, W - 20), -8);
        if (w >= 3 && Math.random() < 0.25) {
            const x = Phaser.Math.Between(24, W - 24);
            for (let i = -1; i <= 1; i++) this.addFoe('diver', x + i * 16, -8 - Math.abs(i) * 10);
        }
    }

    private addFoe(kind: Kind, x: number, y: number) {
        const key = kind === 'pebble' ? 'blaster-pebble' : `blaster-${kind}`;
        const sprite = this.add.sprite(x, y, key, kind === 'pebble' ? undefined : 0).setDepth(kind === 'boss' ? 6 : 5);
        if (kind === 'saucer' || kind === 'diver') sprite.play(`blaster-${kind}`);
        if (kind === 'rock') sprite.setFrame(Phaser.Math.Between(0, 1));
        const speed = 1 + Math.min(1, this.wave / 12);
        const hp = { rock: 3, pebble: 1, saucer: 3, diver: 1, boss: 60 + this.wave * 8 }[kind];
        const foe: Foe = {
            kind, sprite, hp, maxHp: hp,
            r: { rock: 7, pebble: 4, saucer: 8, diver: 6, boss: 28 }[kind],
            vx: kind === 'rock' || kind === 'pebble' ? Phaser.Math.FloatBetween(-20, 20) : 0,
            vy: { rock: 34, pebble: 50, saucer: 26, diver: 46, boss: 18 }[kind] * (kind === 'boss' ? 1 : speed),
            t: Math.random() * 3,
            fire: Phaser.Math.FloatBetween(0.8, 2),
            points: POINTS[kind],
            baseX: x,
        };
        this.foes.push(foe);
        return foe;
    }

    private spawnBoss() {
        this.boss = this.addFoe('boss', W / 2, -20);
        this.banner('MOTHERSHIP!', 'pink');
        this.cameras.main.shake(300, 0.006);
    }

    private moveFoes(s: number) {
        for (const f of this.foes) {
            f.t += s;
            const sp = f.sprite;
            switch (f.kind) {
                case 'rock':
                case 'pebble':
                    sp.x += f.vx * s;
                    sp.y += f.vy * s;
                    sp.angle += f.vx * s * 6;
                    break;
                case 'saucer':
                    sp.y = Math.min(sp.y + f.vy * s, 40 + (f.baseX % 50));
                    sp.x = f.baseX + Math.sin(f.t * 1.6) * 40;
                    if (f.t > 9) sp.y += 60 * s;
                    break;
                case 'diver': {
                    sp.y += f.vy * s * (f.t > 1.2 ? 1.8 : 1);
                    if (f.t > 1.2 && this.state === 'play') sp.x += Math.sign(this.ship.x - sp.x) * Math.min(Math.abs(this.ship.x - sp.x), 50 * s);
                    break;
                }
                case 'boss':
                    sp.y = Math.min(sp.y + f.vy * s, 44);
                    sp.x = W / 2 + Math.sin(f.t * 0.7) * (W / 2 - 38);
                    break;
            }
            if (this.state !== 'play') continue;
            if (f.kind === 'saucer' || f.kind === 'boss') {
                f.fire -= s;
                if (f.fire <= 0 && sp.y > 0) {
                    if (f.kind === 'saucer') {
                        f.fire = Phaser.Math.FloatBetween(1.2, 2.2) / Math.min(2, 1 + this.wave * 0.08);
                        this.aim(sp.x, sp.y + 6, 90);
                    } else {
                        f.fire = f.hp < f.maxHp / 2 ? 0.8 : 1.2;
                        const n = f.hp < f.maxHp / 2 ? 7 : 5;
                        for (let i = 0; i < n; i++) {
                            const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.28;
                            this.zap(sp.x, sp.y + 12, Math.cos(a) * 80, Math.sin(a) * 80);
                        }
                        if (Math.random() < 0.5) this.aim(sp.x - 21, sp.y + 12, 110);
                    }
                }
            }
        }
        this.foes = this.foes.filter((f) => {
            const out = f.sprite.y > H + 20 || f.sprite.x < -30 || f.sprite.x > W + 30;
            if (out) f.sprite.destroy();
            return !out;
        });
    }

    private shoot(x: number, y: number, vx: number, vy: number) {
        this.shots.push({ sprite: this.add.image(x, y, 'blaster-shot').setDepth(8).setRotation(Math.atan2(vx, -vy)), vx, vy });
    }

    private zap(x: number, y: number, vx: number, vy: number) {
        this.zaps.push({ sprite: this.add.image(x, y, 'blaster-zap').setDepth(9), vx, vy });
    }

    private aim(x: number, y: number, speed: number) {
        const a = Math.atan2(this.ship.y - y, this.ship.x - x);
        this.zap(x, y, Math.cos(a) * speed, Math.sin(a) * speed);
    }

    private moveShots(s: number) {
        const step = (list: Shot[]) => list.filter((b) => {
            b.sprite.x += b.vx * s;
            b.sprite.y += b.vy * s;
            const out = b.sprite.y < -8 || b.sprite.y > H + 8 || b.sprite.x < -8 || b.sprite.x > W + 8;
            if (out) b.sprite.destroy();
            return !out;
        });
        this.shots = step(this.shots);
        this.zaps = step(this.zaps);
    }

    private moveDrops(s: number) {
        this.drops = this.drops.filter((d) => {
            d.sprite.y += 30 * s;
            d.sprite.setScale(1 + Math.sin(this.time.now / 120) * 0.1);
            if (Phaser.Math.Distance.Between(d.sprite.x, d.sprite.y, this.ship.x, this.ship.y) < 11) {
                this.collect(d.power, d.sprite.x, d.sprite.y);
                d.sprite.destroy();
                return false;
            }
            if (d.sprite.y > H + 8) {
                d.sprite.destroy();
                return false;
            }
            return true;
        });
    }

    private collide() {
        for (const b of this.shots) {
            for (const f of this.foes) {
                if (f.hp <= 0 || !b.sprite.active) continue;
                const dx = Math.abs(b.sprite.x - f.sprite.x);
                const dy = Math.abs(b.sprite.y - f.sprite.y);
                const hit = f.kind === 'boss' ? dx < 32 && dy < 12 : dx * dx + dy * dy < (f.r + 2) ** 2;
                if (!hit) continue;
                b.sprite.destroy();
                this.hurt(f, 1);
            }
        }
        this.shots = this.shots.filter((b) => b.sprite.active);
        this.foes = this.foes.filter((f) => f.sprite.active);

        if (this.safe > 0) return;
        for (const z of this.zaps) {
            if (Phaser.Math.Distance.Between(z.sprite.x, z.sprite.y, this.ship.x, this.ship.y + 1) < 5) {
                z.sprite.destroy();
                this.hit();
                break;
            }
        }
        this.zaps = this.zaps.filter((z) => z.sprite.active);
        if (this.safe > 0 || this.state !== 'play') return;
        for (const f of this.foes) {
            const near = f.kind === 'boss'
                ? Math.abs(f.sprite.x - this.ship.x) < 32 && Math.abs(f.sprite.y - this.ship.y) < 14
                : Phaser.Math.Distance.Between(f.sprite.x, f.sprite.y, this.ship.x, this.ship.y) < f.r + 4;
            if (!near) continue;
            if (f.kind !== 'boss') this.hurt(f, 99);
            this.hit();
            break;
        }
        this.foes = this.foes.filter((f) => f.sprite.active);
    }

    private hurt(f: Foe, damage: number) {
        f.hp -= damage;
        if (f.hp > 0) {
            f.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
            this.time.delayedCall(50, () => f.sprite.active && f.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY));
            return;
        }
        this.score += f.points;
        this.boom(f.sprite.x, f.sprite.y, f.kind === 'boss' ? 3 : f.kind === 'pebble' ? 0.6 : 1);
        if (f.kind === 'rock') {
            for (const side of [-1, 1]) {
                const p = this.addFoe('pebble', f.sprite.x + side * 4, f.sprite.y);
                p.vx = side * Phaser.Math.FloatBetween(20, 40);
            }
        }
        if (f.kind === 'boss') {
            this.boss = undefined;
            this.waveClock = 0;
            this.wave++;
            this.bombs = Math.min(5, this.bombs + 1);
            this.banner('MOTHERSHIP DOWN! +1 BOMB', 'lime');
            this.cameras.main.shake(500, 0.01);
            this.cameras.main.flash(300, 247, 181, 56);
            const { x, y } = f.sprite;
            for (let i = 0; i < 6; i++) {
                this.time.delayedCall(i * 120, () => this.boom(x + Phaser.Math.Between(-28, 28), y + Phaser.Math.Between(-8, 8), 1.5));
            }
            this.dropPower(f.sprite.x - 12, f.sprite.y, 2);
            this.dropPower(f.sprite.x + 12, f.sprite.y, 0);
        } else if (Math.random() < (f.kind === 'saucer' ? 0.35 : 0.06)) {
            this.dropPower(f.sprite.x, f.sprite.y, Phaser.Utils.Array.GetRandom<Power>([0, 0, 1, 1, 2]));
        }
        this.popText(f.sprite.x, f.sprite.y - 6, `${f.points}`, f.kind === 'boss' ? 'yellow' : 'cream');
        f.sprite.destroy();
    }

    private hit() {
        if (this.shielded) {
            this.shielded = false;
            this.safe = 1;
            this.popText(this.ship.x, this.ship.y - 12, 'SHIELD!', 'cyan');
            return;
        }
        this.lives--;
        this.boom(this.ship.x, this.ship.y, 1.4);
        this.cameras.main.shake(250, 0.012);
        this.spread = 0;
        if (this.lives <= 0) {
            this.gameOver();
            return;
        }
        this.safe = 2;
    }

    private bomb() {
        if (this.bombs <= 0) return;
        this.bombs--;
        this.cameras.main.flash(250, 244, 244, 239);
        this.cameras.main.shake(200, 0.008);
        for (const z of this.zaps) z.sprite.destroy();
        this.zaps = [];
        for (const f of [...this.foes]) {
            if (f.sprite.y < -4) continue;
            this.hurt(f, f.kind === 'boss' ? 20 : 99);
        }
        this.foes = this.foes.filter((f) => f.sprite.active);
        this.banner('SMART BOMB!', 'white');
    }

    private dropPower(x: number, y: number, power: Power) {
        this.drops.push({ sprite: this.add.image(x, y, 'blaster-powerups', power).setDepth(7), power });
    }

    private collect(power: Power, x: number, y: number) {
        if (power === 0) {
            this.spread = 10;
            this.popText(x, y - 8, 'SPREAD!', 'orange');
        } else if (power === 1) {
            this.shielded = true;
            this.popText(x, y - 8, 'SHIELD', 'cyan');
        } else {
            if (this.lives < MAX_LIVES) this.lives++;
            else this.score += 250;
            this.popText(x, y - 8, this.lives < MAX_LIVES ? '+1 LIFE' : '+250', 'pink');
        }
    }

    private gameOver() {
        this.state = 'over';
        this.overAt = this.time.now;
        this.ship.setVisible(false);
        this.shieldRing.setVisible(false);
        for (const b of this.banners) b.destroy();
        this.banners = [];
        const record = this.score > this.best;
        if (record) {
            this.best = this.score;
            try {
                localStorage.setItem(BEST_KEY, String(this.best));
            } catch { /* storage blocked */ }
        }
        const earned = Math.min(TOKEN_CAP, Math.floor(this.score / POINTS_PER_TOKEN));
        for (let i = 0; i < earned; i++) addToken();
        this.overScreen.destroy();
        this.overScreen = this.screen([
            ['GAME OVER', 'red', 2],
            ['', 'cream', 1],
            [`SCORE ${this.score}`, 'cream', 1],
            [record ? 'NEW BEST!' : `BEST ${this.best}`, record ? 'yellow' : 'orange', 1],
            [`WAVE ${this.wave}`, 'cream', 1],
            [earned ? `+${earned} GOLD TOKEN${earned > 1 ? 'S' : ''}` : '500 PTS = 1 TOKEN', earned ? 'gold' : 'mist', 1],
            ['', 'cream', 1],
            ['SPACE OR TAP: AGAIN', 'lime', 1],
            ['ESC TO LEAVE', 'mist', 1],
        ], 'blaster-over');
        if (record) this.cameras.main.flash(300, 247, 181, 56);
    }

    private boom(x: number, y: number, scale: number) {
        const b = this.add.sprite(x, y, 'blaster-boom', 0).setDepth(20).setScale(scale).play('blaster-boom');
        b.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => b.destroy());
    }

    private popText(x: number, y: number, text: string, color: Color) {
        const key = `blaster-pop-${text}-${color}`;
        if (!this.textures.exists(key)) textTexture(this, key, text, color);
        const img = this.add.image(x, y, key).setDepth(30);
        this.tweens.add({ targets: img, y: y - 12, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
    }

    private banner(text: string, color: Color) {
        const key = `blaster-banner-${text}-${color}`;
        if (!this.textures.exists(key)) textTexture(this, key, text, color);
        const img = this.add.image(W / 2, H / 2 - 20, key).setDepth(40).setScale(2).setAlpha(0);
        this.banners.push(img);
        this.tweens.add({
            targets: img, alpha: 1, duration: 150, yoyo: true, hold: 1100,
            onComplete: () => {
                img.destroy();
                this.banners = this.banners.filter((b) => b !== img);
            },
        });
    }

    /** A centered block of lines (title and game-over screens). */
    private screen(lines: [string, Color, number][], prefix: string) {
        const c = this.add.container(0, 0).setDepth(60);
        if (lines.length) c.add(this.add.rectangle(W / 2, 112, W - 16, 128, 0x14101e, 0.82));
        let y = 56;
        lines.forEach(([text, color, scale], i) => {
            if (text) {
                const key = textTexture(this, `${prefix}-${i}`, text, color);
                c.add(this.add.image(W / 2, y, key).setOrigin(0.5, 0).setScale(scale));
            } else c.add(this.add.rectangle(0, 0, 1, 1, 0, 0));
            y += 7 * scale + 4;
        });
        return c;
    }

    private drawHud() {
        const set = (id: string, x: number, y: number, text: string, color: Color, originX = 0) => {
            if (this.hudText[id] === text && this.hud[id]) return;
            this.hudText[id] = text;
            const key = textTexture(this, `blaster-hud-${id}`, text, color);
            if (this.hud[id]) this.hud[id].setTexture(key);
            else this.hud[id] = this.add.image(x, y, key).setOrigin(originX, 0).setDepth(70);
        };
        const playing = this.state !== 'title';
        set('score', 3, 3, playing ? `${this.score}` : '', 'white');
        set('best', W - 3, 3, `HI ${Math.max(this.best, this.score)}`, 'orange', 1);
        set('lives', 3, H - 10, playing ? `SHIPS ${Math.max(0, this.lives)}` : '', 'pink');
        set('bombs', W - 3, H - 10, playing ? `BOMBS ${this.bombs}` : '', 'cyan', 1);
        set('wave', W / 2, 3, playing ? `WAVE ${this.wave}` : '', 'yellow', 0.5);

        this.bossBar.clear();
        if (this.boss && this.state === 'play') {
            const w = 100;
            const x = (W - w) / 2;
            this.bossBar.fillStyle(0x14101e).fillRect(x - 1, 12, w + 2, 5);
            this.bossBar.fillStyle(0xe26fa6).fillRect(x, 13, (w * Math.max(0, this.boss.hp)) / this.boss.maxHp, 3);
        }
    }
}
