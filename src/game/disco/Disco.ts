import Phaser from 'phaser';
import { music } from '../../music';
import {
    DISCO_COLORS, DISCO_TILE_H, DISCO_TILE_W, addPixels, dancerSheet, discoBeamArt, discoFloorArt, discoGlowArt, discoRigArt,
    discoSparkleArt, discoSpeckArt, discoTileArt, ensurePixels, glitterBallArt, hash, lookKey, randomLook, shadowTexture,
    type DiscoColor,
} from '../kit';
import type { Burnable } from '../dragon/Dragon';

/** The background track's tempo and first beat, measured from arcade.mp3, so the dancing lands on the music. */
const BPM = 134.7;
const FIRST_BEAT = 0.068;
const BEAT = 60 / BPM;

const COLS = 11;
const ROWS = 6;
const RIG_H = 96;
/** Floor sits under shadows (-1e8); the ball's reflections sit just above them. */
const FLOOR = -1e8 - 2;
const SPECKS = -1e8 + 1;
const BALL_FRAMES = 6;
/** The ball turns once every this many seconds; its reflections sweep round with it. */
const SPIN = 14;

/** Dance moves: a frame per beat, looped. `sway` nudges them side to side, `flip` mirrors them on those beats. */
const MOVES: { frames: string[]; sway?: number[]; flip?: boolean[] }[] = [
    { frames: ['point-l', 'down-0', 'point-r', 'down-0'] },
    { frames: ['cheer-1', 'cheer-0', 'cheer-2', 'cheer-0'] },
    { frames: ['down-1', 'down-0', 'down-2', 'down-0'], sway: [-1, 0, 1, 0] },
    { frames: ['down-0', 'side-0', 'up-0', 'side-0'], flip: [false, false, false, true] },
    { frames: ['side-1', 'side-0', 'side-2', 'side-0'], sway: [-1, -2, -1, 0], flip: [true, true, false, false] },
    { frames: ['point-l', 'point-l', 'point-r', 'point-r'], sway: [0, -1, 0, 1] },
];

type Dancer = {
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    x: number;
    y: number;
    seed: number;
    /** Seconds left standing still (after the dragon's had a go at them). */
    rest: number;
};

type Speck = { image: Phaser.GameObjects.Image; angle: number; radius: number };

/**
 * A disco: a light-up dance floor under a glitter ball on a lighting rig, with spotlights, reflections sweeping
 * the ground, and people dancing. It all moves on the background music's beat (or its own, until the music starts).
 * The player dances too when they stand still on the floor.
 */
export class Disco {
    /** The dance floor, where standing still means dancing. */
    readonly floor: Phaser.Geom.Rectangle;
    /** What the world's bounds should include. */
    readonly parts: { getBounds: () => Phaser.Geom.Rectangle }[] = [];
    private readonly tiles: Phaser.GameObjects.Image[] = [];
    private readonly dancers: Dancer[] = [];
    private readonly specks: Speck[] = [];
    private readonly beams: Phaser.GameObjects.Image[] = [];
    private readonly ball: Phaser.GameObjects.Sprite;
    private readonly shine: Phaser.GameObjects.Image;
    private readonly sparkle: Phaser.GameObjects.Image;
    private readonly still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    /** Our own beat clock, used until the music is playing. */
    private clock = 0;
    private lastBeat = NaN;

    constructor(private readonly scene: Phaser.Scene, readonly x: number, readonly y: number) {
        const floorArt = discoFloorArt(COLS, ROWS);
        const w = floorArt.width;
        const h = ROWS * DISCO_TILE_H + 1;
        const left = Math.round(x - w / 2);
        const top = Math.round(y - h / 2);
        this.floor = new Phaser.Geom.Rectangle(left, top, w, h);

        addPixels(scene, 'disco-floor', floorArt);
        for (const c of [null, ...DISCO_COLORS]) addPixels(scene, `disco-tile-${c ?? 'off'}`, discoTileArt(c));
        this.parts.push(scene.add.image(left, top, 'disco-floor').setOrigin(0, 0).setDepth(FLOOR));
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const tile = scene.add.image(left + 1 + c * DISCO_TILE_W, top + 1 + r * DISCO_TILE_H, 'disco-tile-off').setOrigin(0, 0).setDepth(FLOOR + 1);
                this.tiles.push(tile);
            }
        }

        // The rig's towers stand either side of the floor, halfway back, so it's drawn by depth like anyone there.
        const span = w + 12;
        const rig = discoRigArt(span, RIG_H);
        addPixels(scene, 'disco-rig', rig.canvas);
        const rigTop = y - RIG_H;
        const rigLeft = Math.round(x - span / 2);
        this.parts.push(scene.add.image(rigLeft, rigTop, 'disco-rig').setOrigin(0, 0).setDepth(y));

        const ballArt = glitterBallArt(BALL_FRAMES);
        addPixels(scene, 'disco-ball', ballArt.canvas, ballArt.frames);
        addPixels(scene, 'disco-shine', discoGlowArt('ice', 18));
        addPixels(scene, 'disco-sparkle', discoSparkleArt());
        const bx = rigLeft + rig.info.ball.x + 0.5;
        const by = rigTop + rig.info.ball.y;
        this.shine = scene.add.image(bx, by + 9, 'disco-shine').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(y + 0.4);
        this.ball = scene.add.sprite(bx, by, 'disco-ball', 0).setOrigin(0.5, 0).setDepth(y + 0.5);
        this.sparkle = scene.add.image(bx, by + 9, 'disco-sparkle').setDepth(y + 0.6).setScale(0);

        const reach = Math.round(y - (rigTop + 11) + h / 2);
        for (const c of DISCO_COLORS) addPixels(scene, `disco-beam-${c}`, discoBeamArt(c, 40, reach));
        rig.info.cans.forEach((can, i) => {
            this.beams.push(scene.add.image(rigLeft + can.x, rigTop + can.y, `disco-beam-${DISCO_COLORS[i * 3]}`)
                .setOrigin(0.5, 0)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setAlpha(0.22)
                .setDepth(this.floor.bottom + 8));
        });

        for (const c of ['white', ...DISCO_COLORS] as const) addPixels(scene, `disco-speck-${c}`, discoSpeckArt(c));
        for (let i = 0; i < 64; i++) {
            const c = i % 3 ? 'white' : DISCO_COLORS[i % DISCO_COLORS.length];
            const image = scene.add.image(x, y, `disco-speck-${c}`).setBlendMode(Phaser.BlendModes.ADD).setDepth(SPECKS);
            this.specks.push({ image, angle: hash(i, 1, 51) * Math.PI * 2, radius: 0.15 + Math.sqrt(hash(i, 2, 51)) * 0.85 });
        }

        const spots = [
            [0.12, 0.18], [0.36, 0.14], [0.62, 0.2], [0.88, 0.16],
            [0.24, 0.44], [0.5, 0.4], [0.76, 0.46],
            [0.1, 0.68], [0.38, 0.7], [0.64, 0.66], [0.9, 0.72],
            [0.22, 0.94], [0.5, 0.92], [0.8, 0.96],
        ];
        spots.forEach(([fx, fy], i) => this.dancer(i, Math.round(left + fx * w), Math.round(top + 6 + fy * (h - 4))));
        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    private dancer(i: number, x: number, y: number) {
        const look = randomLook(`disco-${i}`);
        const key = `disco|${lookKey(look)}`;
        ensurePixels(this.scene, key, () => dancerSheet(look));
        const shadow = this.scene.add.image(x, y, shadowTexture(this.scene, 10)).setAlpha(0.3).setDepth(-1e8);
        const sprite = this.scene.add.sprite(x, y, key, 'down-0').setOrigin(0.5, 1).setDepth(y);
        this.dancers.push({ sprite, shadow, x, y, seed: i * 7 + 3, rest: 0 });
    }

    /** Beats since the track started (or since we did), as a float. */
    private beats(): number {
        if (!music.paused && music.currentTime > 0) return (music.currentTime - FIRST_BEAT) / BEAT;
        return this.clock / BEAT;
    }

    /** Someone's move on this beat: everyone changes it up every two bars. */
    private move(seed: number, beat: number) {
        const m = MOVES[Math.floor(hash(seed, Math.floor(beat / 8), 13) * MOVES.length)];
        const step = ((beat % 4) + 4) % 4;
        return { frame: m.frames[step], sway: m.sway?.[step] ?? 0, flip: m.flip?.[step] ?? false };
    }

    /** Put someone in the dance: the player, while they stand still on the floor. */
    groove(sprite: Phaser.GameObjects.Sprite) {
        const { frame, flip } = this.move(99, Math.floor(this.beats()));
        sprite.setFrame(frame).setFlipX(flip);
    }

    contains(x: number, y: number) {
        return this.floor.contains(x, y);
    }

    /** Dancers the dragon can toast: they stop dancing while they're smouldering. */
    burnables(): Burnable[] {
        return this.dancers.map((d) => ({
            sprite: d.sprite,
            headroom: 24,
            hold: (seconds: number) => { d.rest = Math.max(d.rest, seconds); },
        }));
    }

    update(dt: number) {
        this.clock += Math.min(dt, 0.1);
        const t = this.beats();
        const beat = Math.floor(t);
        const frac = t - beat;

        if (beat !== this.lastBeat) {
            this.lastBeat = beat;
            this.lightFloor(this.still ? Math.floor(beat / 4) * 4 : beat);
            if (!this.still) this.twinkle(beat);
            this.beams.forEach((b, i) => b.setTexture(`disco-beam-${DISCO_COLORS[(((Math.floor(beat / 4) + i * 3) % DISCO_COLORS.length) + DISCO_COLORS.length) % DISCO_COLORS.length]}`));
        }

        const turn = this.still ? 0 : (this.clock / SPIN) % 1;
        this.ball.setFrame(Math.floor(turn * 14 * BALL_FRAMES) % BALL_FRAMES);
        this.shine.setAlpha(0.22 + (1 - frac) * 0.18);
        this.beams.forEach((b, i) => b.setAngle(this.still ? (i ? -12 : 12) : Math.sin(this.clock * 0.9 + i * 2.4) * 28));

        const spread = this.floor.width * 0.95;
        for (const s of this.specks) {
            const a = s.angle - turn * Math.PI * 2;
            s.image.setPosition(Math.round(this.x + Math.cos(a) * s.radius * spread), Math.round(this.y + Math.sin(a) * s.radius * spread * 0.5));
            s.image.setAlpha((1 - s.radius * 0.6) * (0.55 + (1 - frac) * 0.45));
        }

        const hop = this.still ? 0 : Math.round(Math.sin(frac * Math.PI) * 2);
        for (const d of this.dancers) {
            if (d.rest > 0) {
                d.rest -= dt;
                d.sprite.setFrame('down-0').setFlipX(false).setPosition(d.x, d.y);
                d.shadow.setPosition(d.x, d.y);
                continue;
            }
            const { frame, sway, flip } = this.move(d.seed, beat);
            d.sprite.setFrame(frame).setFlipX(flip).setPosition(d.x + sway, d.y - hop);
            d.shadow.setPosition(d.x + sway, d.y);
        }
    }

    /** Light the floor for this beat, in one of a few patterns that take turns every two bars. */
    private lightFloor(beat: number) {
        const pattern = ((Math.floor(beat / 8) % 4) + 4) % 4;
        const color = (n: number): DiscoColor => DISCO_COLORS[((n % DISCO_COLORS.length) + DISCO_COLORS.length) % DISCO_COLORS.length];
        const on = (n: number, m: number) => ((n % m) + m) % m;
        this.tiles.forEach((tile, i) => {
            const c = i % COLS, r = Math.floor(i / COLS);
            let lit: DiscoColor | null;
            if (pattern === 0) lit = on(c + r + beat, 2) ? color(Math.floor(beat / 2)) : color(Math.floor(beat / 2) + 3);
            else if (pattern === 1) lit = on(c - beat, 4) < 2 ? color(c + Math.floor(beat / 4)) : null;
            else if (pattern === 2) {
                const ring = Math.round(Math.max(Math.abs(c - (COLS - 1) / 2), Math.abs(r - (ROWS - 1) / 2) * 1.5));
                lit = on(ring - beat, 3) === 0 ? color(ring + Math.floor(beat / 3)) : null;
            } else lit = hash(c, r, beat) > 0.45 ? color(Math.floor(hash(r, c, beat) * DISCO_COLORS.length)) : null;
            tile.setTexture(`disco-tile-${lit ?? 'off'}`);
        });
    }

    /** A glint pops somewhere on the ball's lit side. */
    private twinkle(beat: number) {
        this.scene.tweens.killTweensOf(this.sparkle);
        const dx = Math.round((hash(beat, 1, 9) - 0.75) * 10);
        const dy = Math.round((hash(beat, 2, 9) - 0.6) * 10);
        this.sparkle.setPosition(this.ball.x + dx, this.ball.y + 9 + dy).setScale(0).setAngle(0);
        this.scene.tweens.add({ targets: this.sparkle, scale: 1, angle: 45, duration: BEAT * 300, yoyo: true, ease: 'Quad.easeOut' });
    }

    destroy() {
        this.scene.tweens.killTweensOf(this.sparkle);
    }
}
