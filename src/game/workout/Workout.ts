import Phaser from 'phaser';
import { PixelCanvas, addPixels, miniText, miniTextWidth, shadowTexture, speechArt, toHexNumber, type Color } from '../kit';
import type { Burnable } from '../dragon/Dragon';
import { MAT_H, MAT_W, boomboxTexture, christianSheet, matTexture } from './art';

/** Anyone who can be pulled into the class: they stand still while held and are walked about by the instructor. */
export interface Person {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    label?: Phaser.GameObjects.Image;
    /** Keep them from walking off on their own for this many seconds. */
    hold(seconds: number): void;
}

export interface WorkoutOptions {
    bounds: () => Phaser.Geom.Rectangle;
    open: (x: number, y: number) => boolean;
    people: () => Person[];
    player: () => Phaser.GameObjects.Sprite | undefined;
}

type Phase = 'idle' | 'jog' | 'gather' | 'workout' | 'disperse' | 'leave';
type Move = 'march' | 'jacks' | 'lunge' | 'step' | 'stretch';

interface Member {
    p: Person;
    slot: { x: number; y: number };
    home: { x: number; y: number };
    depth: number;
    arrived: boolean;
    speed: number;
    base: { x: number; y: number };
}

const BEAT = 60 / 128;
const REGIME: { name: string; beats: number; move: Move }[] = [
    { name: 'WARM-UP MARCH!', beats: 16, move: 'march' },
    { name: 'JUMPING JACKS!', beats: 16, move: 'jacks' },
    { name: 'SIDE LUNGES!', beats: 16, move: 'lunge' },
    { name: 'STEP TOUCH!', beats: 16, move: 'step' },
    { name: 'STRETCH IT OUT!', beats: 12, move: 'stretch' },
];
const TOTAL_BEATS = REGIME.reduce((n, s) => n + s.beats, 0);
const CHEERS = [
    'You are doing GREAT!', 'Sparkle with every step!', 'Look at you go, superstars!', 'Smile! Smiling burns extra!',
    'Hips, knees, joy!', 'Every wiggle counts, my loves!', 'Dance like you are in the kitchen!', 'Stronger than yesterday!',
    'Shake it out, sunshine!', 'Nobody is watching. Everybody is cheering!', 'Breathe in the good vibes!', 'You are a golden star!',
    'Feel that happy burn!', 'Tokens are earned with sparkle!', 'Even the dragon is impressed!', 'No gremlin can catch this energy!',
    'Five more! Okay, ten more!', 'Elbows up, spirits higher!', 'Give me your biggest smile!', 'I believe in every one of you!',
    'You showed up. That is the hard part!', 'Do not stop now, glitter legs!', 'Go, go, you gorgeous goofballs!', 'Sweat is just sparkle leaving!',
    'Move it like the music loves you!', 'Look how far you have come!', 'Fabulous! Absolutely fabulous!', 'Hug your inner superstar!',
];
const CALLS = ['Come on, everybody!', 'Class is starting!', 'Follow me, friends!', 'Let us get moving!', 'Hurry, hurry, my loves!', 'Grab a spot, superstars!', 'Everyone is welcome here!'];
const SKY = 1e6;
const SLOT_GAP = 24;
const ROW_GAP = 26;
const FRAMES = ['side-1', 'side-0', 'side-2', 'side-0'];

/**
 * Christian, a sparkly aerobics instructor, jogs around town, picks an open spot, rolls out a mat,
 * gathers whoever is nearby, lines them up in rows, and leads a beat-matched workout before everyone
 * heads back to what they were doing. Call `update(dt)` from the scene's update.
 */
export class Workout {
    private phase: Phase = 'idle';
    private timer = 20;
    private clock = 0;
    private lastBeat = -1;
    private lastSeg = -1;
    private sayLeft = 0;
    private sayCd = 0;
    private route: { x: number; y: number }[] = [];
    private spot = new Phaser.Math.Vector2();
    private members: Member[] = [];
    private phaseTime = 0;
    private sprite?: Phaser.GameObjects.Sprite;
    private shadow?: Phaser.GameObjects.Image;
    private label?: Phaser.GameObjects.Image;
    private bubble?: Phaser.GameObjects.Image;
    private mat?: Phaser.GameObjects.Image;
    private box?: Phaser.GameObjects.Sprite;
    private playerCheered = false;
    private lastCheer = '';

    constructor(private scene: Phaser.Scene, private opts: WorkoutOptions) {
        const sheet = christianSheet();
        addPixels(scene, 'workout-christian', sheet.canvas, sheet.frames);
        matTexture(scene);
        boomboxTexture(scene);
        const make = (key: string, frames: string[], frameRate: number) => {
            if (!scene.anims.exists(key)) {
                scene.anims.create({ key, frames: frames.map((frame) => ({ key: 'workout-christian', frame })), frameRate, repeat: -1 });
            }
        };
        make('workout-christian-run', FRAMES, 14);
        make('workout-christian-walk', FRAMES, 9);
        const name = new PixelCanvas(miniTextWidth('CHRISTIAN') + 6, 9);
        name.rect(0, 0, name.width, 9, 'ink');
        miniText(name, 3, 2, 'CHRISTIAN', 'pink');
        addPixels(scene, 'workout-christian-label', name);
        scene.events.once('shutdown', () => this.destroy());
    }

    /** Start a class right now (atv.game.scene.getScene('Preview').workout.start()). */
    start() {
        if (this.phase !== 'idle') return;
        const b = this.opts.bounds();
        const x = Math.random() < 0.5 ? b.left - 14 : b.right + 14;
        const y = Phaser.Math.Between(Math.round(b.top + 100), Math.round(b.bottom - 100));
        this.shadow = this.scene.add.image(x, y, shadowTexture(this.scene, 12)).setAlpha(0.3).setDepth(-1e8 + 1);
        this.sprite = this.scene.add.sprite(x, y, 'workout-christian', 'side-0').setOrigin(0.5, 1).setDepth(y).play('workout-christian-run');
        this.label = this.scene.add.image(x, y - 26, 'workout-christian-label').setOrigin(0.5, 1).setDepth(y + 1);
        this.spot.copy(this.pickSpot());
        this.route = [this.randomPoint(), { x: this.spot.x, y: this.spot.y }];
        this.phase = 'jog';
        this.sayCd = 0;
    }

    /** Whether the dragon may toast the instructor (he only gets sooty). */
    burnables(): Burnable[] {
        return this.sprite ? [{ sprite: this.sprite, headroom: 40, hold: () => undefined }] : [];
    }

    update(dt: number) {
        dt = Math.min(dt, 0.1);
        if (this.phase === 'idle') {
            this.timer -= dt;
            if (this.timer <= 0) this.start();
            return;
        }
        this.phaseTime += dt;
        this.sayCd -= dt;
        if (this.bubble) {
            this.sayLeft -= dt;
            if (this.sayLeft <= 0) {
                this.bubble.destroy();
                this.bubble = undefined;
            }
        }
        for (const m of this.members) m.p.hold(0.3);

        switch (this.phase) {
            case 'jog': this.jog(dt); break;
            case 'gather': this.gather(dt); break;
            case 'workout': this.workout(dt); break;
            case 'disperse': this.disperse(dt); break;
            case 'leave': this.leave(dt); break;
        }
        this.follow();
    }

    private jog(dt: number) {
        const target = this.route[0];
        if (this.moveTo(target.x, target.y, 100, dt)) {
            this.route.shift();
            if (!this.route.length) {
                this.beginGather();
                return;
            }
        }
        if (this.sayCd <= 0) {
            this.say(Phaser.Utils.Array.GetRandom(CALLS));
            this.sayCd = 3.5;
        }
    }

    private beginGather() {
        const s = this.sprite!;
        s.stop().setFrame('cheer-0').setFlipX(false);
        this.phase = 'gather';
        this.phaseTime = 0;
        this.mat = this.scene.add.image(this.spot.x, this.spot.y - 14, matTexture(this.scene)).setOrigin(0.5, 0).setDepth(-5e8).setAlpha(0).setScale(0.3, 1);
        this.scene.tweens.add({ targets: this.mat, alpha: 1, scaleX: 1, duration: 600, ease: 'Back.easeOut' });
        this.box = this.scene.add.sprite(this.spot.x - MAT_W / 2 + 14, this.spot.y + 6, boomboxTexture(this.scene), 0).setOrigin(0.5, 1).setDepth(this.spot.y + 6);
        this.sparkle(this.spot.x, this.spot.y - 20, 'pink');
        this.say('WORKOUT TIME!');

        const pool = this.opts.people().filter((p) => p.sprite.active && p.sprite.visible);
        pool.sort((a, b) => Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, this.spot.x, this.spot.y) - Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, this.spot.x, this.spot.y));
        const chosen = pool.slice(0, Phaser.Math.Between(5, 8));
        const rows = chosen.length > 5 ? 2 : 1;
        const perRow = Math.ceil(chosen.length / rows);
        this.members = chosen.map((p, i) => {
            const row = Math.floor(i / perRow);
            const inRow = row === rows - 1 ? chosen.length - perRow * row : perRow;
            const col = i - row * perRow;
            return {
                p,
                slot: { x: this.spot.x + (col - (inRow - 1) / 2) * SLOT_GAP, y: this.spot.y + 28 + row * ROW_GAP },
                home: { x: p.sprite.x, y: p.sprite.y },
                depth: p.sprite.depth,
                arrived: false,
                base: { x: p.sprite.scaleX, y: p.sprite.scaleY },
                speed: Math.max(66, Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, this.spot.x, this.spot.y) / 8),
            };
        });
        this.playerCheered = false;
    }

    private gather(dt: number) {
        const s = this.sprite!;
        s.setFrame(this.phaseTime % 0.8 < 0.4 ? 'cheer-0' : 'cheer-1');
        if (this.sayCd <= 0 && this.phaseTime > 2.5) {
            this.say(Phaser.Utils.Array.GetRandom(CALLS));
            this.sayCd = 3.5;
        }
        let all = true;
        for (const m of this.members) {
            if (!m.arrived) m.arrived = this.walk(m, m.slot.x, m.slot.y, m.speed, dt);
            if (!m.arrived) all = false;
        }
        if (all || this.phaseTime > 14) {
            for (const m of this.members) {
                m.arrived = true;
                m.p.sprite.setPosition(m.slot.x, m.slot.y);
                this.place(m, 0, 1, 1, 0, 'down-0');
            }
            this.phase = 'workout';
            this.clock = 0;
            this.lastBeat = -1;
            this.lastSeg = -1;
        }
    }

    private workout(dt: number) {
        this.clock += dt;
        const beat = this.clock / BEAT;
        if (beat >= TOTAL_BEATS) {
            this.phase = 'disperse';
            this.phaseTime = 0;
            this.say('GREAT JOB, EVERYBODY!');
            this.members.forEach((m, i) => this.sparkle(m.slot.x, m.slot.y - 16, i % 2 ? 'yellow' : 'pink'));
            if (this.mat) this.scene.tweens.add({ targets: this.mat, alpha: 0, duration: 1600, delay: 600 });
            return;
        }
        let seg = 0;
        let start = 0;
        while (start + REGIME[seg].beats <= beat) start += REGIME[seg++].beats;
        const move = REGIME[seg].move;
        const bi = Math.floor(beat);
        if (seg !== this.lastSeg) {
            this.lastSeg = seg;
            this.say(REGIME[seg].name);
        }
        if (bi !== this.lastBeat) {
            this.lastBeat = bi;
            this.box?.setFrame(bi % 2);
            this.mat?.setTint(bi % 2 ? 0xffffff : 0xffd9ec);
            if (bi - start >= 4 && (bi - start) % 5 === 4) this.cheer();
            if (bi % 3 === 0 && this.members.length) {
                const m = Phaser.Utils.Array.GetRandom(this.members);
                this.pixel(m.p.sprite.x + Phaser.Math.Between(-4, 4), m.p.sprite.y - 20, 'cyan', m.p.sprite.x + Phaser.Math.Between(-9, 9), m.p.sprite.y - 6, 600);
            }
            if (bi % 8 === 0) this.sparkle(this.sprite!.x, this.sprite!.y - 24, 'pink');
        }
        const lead = this.pose(move, beat, true);
        this.sprite!.setFrame(lead.frame).setScale(lead.sx * 1.04, lead.sy * 1.04).setAngle(lead.ang).setFlipX(false);
        this.sprite!.x = this.spot.x + lead.dx;
        for (const m of this.members) {
            const p = this.pose(move, beat, false);
            this.place(m, p.dx, p.sx, p.sy, p.ang, p.frame);
        }

        const player = this.opts.player();
        if (player && !this.playerCheered && this.mat && Math.abs(player.x - this.spot.x) < MAT_W / 2 && player.y > this.spot.y - 14 && player.y < this.spot.y + MAT_H - 14) {
            this.playerCheered = true;
            this.say('Yes! Join in, superstar!');
            this.sparkle(player.x, player.y - 30, 'yellow');
        }
    }

    private disperse(dt: number) {
        const s = this.sprite!;
        s.setFrame(this.phaseTime % 0.8 < 0.4 ? 'cheer-0' : 'cheer-1').setScale(1).setAngle(0);
        let all = true;
        for (const m of this.members) {
            m.p.sprite.setScale(m.base.x, m.base.y).setAngle(0);
            if (!this.walk(m, m.home.x, m.home.y, Math.max(62, m.speed), dt)) all = false;
        }
        if (all || this.phaseTime > 14) {
            for (const m of this.members) {
                m.p.sprite.setPosition(m.home.x, m.home.y).setScale(m.base.x, m.base.y).setAngle(0).setDepth(m.depth);
                m.p.shadow.setPosition(m.home.x, m.home.y);
            }
            this.members = [];
            this.mat?.destroy();
            this.mat = undefined;
            this.box?.destroy();
            this.box = undefined;
            this.phase = 'leave';
            this.phaseTime = 0;
        }
    }

    private leave(dt: number) {
        const s = this.sprite!;
        const b = this.opts.bounds();
        const out = s.x - b.left < b.right - s.x ? b.left - 50 : b.right + 50;
        s.setScale(1).setAngle(0);
        if (!s.anims.isPlaying) s.play('workout-christian-walk');
        if (this.moveTo(out, s.y, 64, dt) || s.x < b.left - 30 || s.x > b.right + 30) this.finish();
    }

    private finish() {
        this.sprite?.destroy();
        this.shadow?.destroy();
        this.label?.destroy();
        this.bubble?.destroy();
        this.sprite = this.shadow = this.label = this.bubble = undefined;
        this.phase = 'idle';
        this.timer = Phaser.Math.FloatBetween(55, 90);
    }

    /** Frame, offset, squash and tilt for one move at a point in the routine. The lead uses arms-up poses. */
    private pose(move: Move, beat: number, lead: boolean) {
        const bi = Math.floor(beat);
        const odd = bi % 2 === 1;
        const pulse = Math.sin(Math.PI * (beat - bi));
        let frame = 'down-0';
        let dx = 0;
        let sx = 1;
        let sy = 1;
        let ang = 0;
        switch (move) {
            case 'march':
                frame = odd ? (lead ? 'cheer-1' : 'down-1') : (lead ? 'cheer-2' : 'down-2');
                sy = 1 + 0.06 * pulse;
                break;
            case 'jacks':
                frame = odd ? (lead ? 'cheer-0' : 'down-1') : 'down-0';
                sx = odd ? 1.12 : 1;
                sy = 1 + 0.12 * pulse;
                break;
            case 'lunge':
                frame = odd ? (lead ? 'point-l' : 'down-1') : (lead ? 'point-r' : 'down-2');
                dx = (odd ? -1 : 1) * 5 * pulse;
                sy = 1 - 0.08 * pulse;
                break;
            case 'step':
                dx = 4 * Math.sin(Math.PI * beat);
                frame = dx < 0 ? (lead ? 'point-l' : 'down-1') : (lead ? 'point-r' : 'down-2');
                break;
            case 'stretch':
                frame = lead ? 'cheer-0' : 'down-0';
                ang = 6 * Math.sin((beat * Math.PI) / 2);
                sy = 1 + 0.03 * Math.sin(beat);
                break;
        }
        return { frame, dx, sx, sy, ang };
    }

    /** Put a member at their slot with a pose, and keep their shadow, name tag and depth in step. */
    private place(m: Member, dx: number, sx: number, sy: number, ang: number, frame: string) {
        const s = m.p.sprite;
        if (s.texture.has(frame)) s.setFrame(frame);
        s.setPosition(m.slot.x + dx, m.slot.y).setScale(sx * m.base.x, sy * m.base.y).setAngle(ang).setFlipX(false).setDepth(m.slot.y);
        m.p.shadow.setPosition(s.x, m.slot.y);
        m.p.label?.setPosition(s.x, m.slot.y - 26).setDepth(m.slot.y + 1);
    }

    /** Walk a member toward a spot with their own walking frames. Returns whether they're there. */
    private walk(m: Member, tx: number, ty: number, speed: number, dt: number): boolean {
        const s = m.p.sprite;
        const dx = tx - s.x;
        const dy = ty - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) {
            s.setPosition(tx, ty);
            if (s.texture.has('down-0')) s.setFrame('down-0');
            return true;
        }
        const step = Math.min(d, speed * dt);
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        const frame = FRAMES[Math.floor(this.phaseTime * 8) % 4];
        if (s.texture.has(frame)) s.setFrame(frame);
        s.setFlipX(dx < 0).setDepth(s.y);
        m.p.shadow.setPosition(s.x, s.y);
        m.p.label?.setPosition(s.x, s.y - 26).setDepth(s.y + 1);
        return false;
    }

    private moveTo(tx: number, ty: number, speed: number, dt: number): boolean {
        const s = this.sprite!;
        const dx = tx - s.x;
        const dy = ty - s.y;
        const d = Math.hypot(dx, dy);
        if (d < 3) return true;
        const step = Math.min(d, speed * dt);
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        if (Math.abs(dx) > 1) s.setFlipX(dx < 0);
        if (!s.anims.isPlaying) s.play(this.phase === 'jog' ? 'workout-christian-run' : 'workout-christian-walk');
        return false;
    }

    private follow() {
        const s = this.sprite;
        if (!s) return;
        this.shadow?.setPosition(this.phase === 'workout' ? this.spot.x : s.x, s.y);
        s.setDepth(s.y);
        this.label?.setPosition(s.x, s.y - 26).setDepth(s.y + 1);
        this.bubble?.setPosition(Math.round(s.x), Math.round(s.y - 44)).setDepth(SKY + 2);
    }

    /** Something upbeat, never the same line twice in a row. */
    private cheer() {
        let line = Phaser.Utils.Array.GetRandom(CHEERS);
        while (line === this.lastCheer) line = Phaser.Utils.Array.GetRandom(CHEERS);
        this.lastCheer = line;
        this.say(line);
    }

    private say(text: string) {
        const key = `workout-say-${text}`;
        addPixels(this.scene, key, speechArt(text, 20));
        this.bubble?.destroy();
        const s = this.sprite!;
        this.bubble = this.scene.add.image(s.x, s.y - 44, key).setOrigin(0.5, 1).setDepth(SKY + 2);
        this.sayLeft = 2.4;
    }

    /** Footprints of the scenery on the map (buildings, fences, signs), so the mat doesn't roll out over them. */
    private blockers(): Phaser.Geom.Rectangle[] {
        const out: Phaser.Geom.Rectangle[] = [];
        for (const o of this.scene.children.list) {
            if (!(o instanceof Phaser.GameObjects.Image) || !o.visible || !o.active) continue;
            if (o.depth <= -1e7 || o.depth >= 1e5 || o === this.mat || o === this.label || o === this.bubble || o === this.shadow) continue;
            if (o.displayWidth * o.displayHeight < 100) continue;
            out.push(Phaser.Geom.Rectangle.Inflate(o.getBounds(), 6, 6));
        }
        return out;
    }

    /** An open patch big enough for the mat, close to where most people are so the class fills up quickly. */
    private pickSpot(): { x: number; y: number } {
        const b = this.opts.bounds();
        const people = this.opts.people().filter((p) => p.sprite.active && p.sprite.visible);
        const blockers = this.blockers();
        const area = new Phaser.Geom.Rectangle();
        let best: { x: number; y: number } | undefined;
        let bestScore = Infinity;
        for (let i = 0; i < 80; i++) {
            const x = Phaser.Math.Between(Math.round(b.left + 100), Math.round(b.right - 100));
            const y = Phaser.Math.Between(Math.round(b.top + 100), Math.round(b.bottom - 120));
            area.setTo(x - MAT_W / 2 - 8, y - 36, MAT_W + 16, MAT_H + 30);
            if (blockers.some((r) => Phaser.Geom.Rectangle.Overlaps(r, area))) continue;
            let ok = true;
            for (let gx = -MAT_W / 2; gx <= MAT_W / 2 && ok; gx += 15) {
                for (let gy = -14; gy <= MAT_H - 14 && ok; gy += 15) ok = this.opts.open(x + gx, y + gy);
            }
            if (!ok) continue;
            const nearest = people.map((p) => Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, x, y)).sort((a, c) => a - c).slice(0, 6);
            const score = nearest.reduce((n, d) => n + d, 0);
            if (score < bestScore) {
                best = { x, y };
                bestScore = score;
            }
        }
        return best ?? { x: b.centerX, y: b.centerY };
    }

    private randomPoint(): { x: number; y: number } {
        const b = this.opts.bounds();
        for (let i = 0; i < 10; i++) {
            const x = Phaser.Math.Between(Math.round(b.left + 30), Math.round(b.right - 30));
            const y = Phaser.Math.Between(Math.round(b.top + 70), Math.round(b.bottom - 30));
            if (this.opts.open(x, y)) return { x, y };
        }
        return { x: b.centerX, y: b.centerY };
    }

    private pixel(x: number, y: number, color: Color, tx: number, ty: number, duration: number) {
        const p = this.scene.add.rectangle(x, y, 2, 2, toHexNumber(color)).setDepth(SKY + 1);
        this.scene.tweens.add({ targets: p, x: tx, y: ty, alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
    }

    private sparkle(x: number, y: number, color: Color) {
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            this.pixel(x, y, color, x + Math.cos(a) * 16, y + Math.sin(a) * 11 - 6, 700);
        }
    }

    destroy() {
        for (const m of this.members) m.p.sprite.setScale(m.base.x, m.base.y).setAngle(0);
        this.members = [];
        this.mat?.destroy();
        this.box?.destroy();
        this.finish();
    }
}
