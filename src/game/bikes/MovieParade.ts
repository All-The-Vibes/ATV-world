import Phaser from 'phaser';
import {
    PixelCanvas, addPixels, miniText, miniTextWidth, shadowTexture, speechArt, stripFrames, type Color,
} from '../kit';
import type { Burnable } from '../dragon/Dragon';
import { buildBikeRoute, type RouteSegment } from './BikeGang';

const W = 20;
const H = 26;
const FRAMES = 4;

type HeroId = 'et' | 'scream' | 'ironman' | 'hulk' | 'panda';

interface ParadeSpec {
    id: HeroId;
    name: string;
    labelBg: Color;
    labelColor: Color;
    quip: string;
}

const PARADE_SPECS: readonly ParadeSpec[] = [
    {
        id: 'et',
        name: 'ET',
        labelBg: 'earth',
        labelColor: 'yellow',
        quip: 'E.T. phone home... or push to main!',
    },
    {
        id: 'scream',
        name: 'Scream',
        labelBg: 'ink',
        labelColor: 'white',
        quip: 'What is your favorite scary merge conflict?',
    },
    {
        id: 'ironman',
        name: 'IronMan',
        labelBg: 'wine',
        labelColor: 'gold',
        quip: 'I am IronMan. Jarvis, deploy to production.',
    },
    {
        id: 'hulk',
        name: 'Hulk',
        labelBg: 'forest',
        labelColor: 'lime',
        quip: 'HULK SMASH BROKEN BUILDS!',
    },
    {
        id: 'panda',
        name: 'Kung fu Panda',
        labelBg: 'night',
        labelColor: 'gold',
        quip: 'There is no secret ingredient. Skadoosh!',
    },
];

function drawParadeSheet(id: HeroId): PixelCanvas {
    const pc = new PixelCanvas(W * FRAMES, H);

    for (let f = 0; f < FRAMES; f++) {
        const ox = f * W;
        const step = f === 1 ? -1 : f === 3 ? 1 : 0;
        const bob = f % 2 === 1 ? -1 : 0;
        const p = (x: number, y: number, c: Color) => pc.set(ox + x, y, c);
        const row = (y: number, x0: number, x1: number, c: Color) => {
            for (let x = x0; x <= x1; x++) p(x, y, c);
        };

        if (id === 'et') {
            // E.T. the Extra-Terrestrial: wide flat brown head, large sky-blue eyes, long neck, squat body, glowing finger
            for (let y = 7; y <= 11; y++) row(y + bob, 5, 14, 'wood');
            row(6 + bob, 6, 13, 'clay');
            // Big glowing blue eyes
            p(11, 8 + bob, 'white'); p(12, 8 + bob, 'sky'); p(13, 8 + bob, 'blue');
            p(11, 9 + bob, 'sky'); p(12, 9 + bob, 'ink');
            // Thin telescoped neck
            row(12 + bob, 8, 10, 'earth');
            row(13 + bob, 8, 10, 'wood');
            // Rounded belly / torso with glowing red heart-light
            for (let y = 14; y <= 19; y++) row(y + bob, 6, 13, 'wood');
            for (let y = 15; y <= 18; y++) row(y + bob, 8, 12, 'clay');
            p(11, 15 + bob, f % 2 === 0 ? 'red' : 'orange'); // glowing heart light
            p(11, 16 + bob, 'gold');
            // Long outstretched arm + glowing fingertip!
            pc.line(ox + 11, 15 + bob, ox + 16, 13 + bob, 'wood');
            p(17, 12 + bob, f % 2 === 0 ? 'yellow' : 'red');
            p(17, 13 + bob, 'gold');
            // Short waddling feet
            row(20, 6 + step, 8 + step, 'earth');
            row(21, 6 + step, 9 + step, 'wood');
            row(20, 11 - step, 13 - step, 'earth');
            row(21, 11 - step, 14 - step, 'wood');
        } else if (id === 'scream') {
            // Ghostface (Scream): black hooded shroud, elongated white mask, hollow eyes & screaming mouth, silver blade
            // Black hood
            row(2 + bob, 6, 13, 'ink');
            for (let y = 3; y <= 11; y++) row(y + bob, 5, 14, 'ink');
            // White elongated ghost mask
            row(3 + bob, 8, 13, 'white');
            for (let y = 4; y <= 8; y++) row(y + bob, 8, 14, 'white');
            row(9 + bob, 9, 13, 'white');
            row(10 + bob, 10, 12, 'cloud');
            row(11 + bob, 10, 12, 'white');
            // Hollow dark eyes & long screaming 'O' mouth
            p(9, 5 + bob, 'ink'); p(10, 5 + bob, 'ink'); p(9, 6 + bob, 'ink');
            p(12, 5 + bob, 'ink'); p(13, 5 + bob, 'ink'); p(13, 6 + bob, 'ink');
            for (let y = 8; y <= 10; y++) row(y + bob, 11, 12, 'ink');
            // Flowing black robe
            for (let y = 12; y <= 20; y++) {
                const flare = Math.floor((y - 12) / 3);
                row(y + bob, 6 - flare, 13 + flare, y % 3 === 0 ? 'night' : 'ink');
            }
            // Raised arm holding glinting silver knife
            pc.line(ox + 12, 13 + bob, ox + 16, 11 + bob, 'ink');
            p(16, 11 + bob, 'white');
            pc.line(ox + 16, 10 + bob, ox + 18, 6 + bob, 'cloud');
            p(18, 6 + bob, 'white');
            // Boots under robe
            row(21, 6 + step, 8 + step, 'ink');
            row(21, 11 - step, 13 - step, 'ink');
        } else if (id === 'ironman') {
            // Iron Man: crimson & gold armor, glowing cyan eyes + arc reactor, repulsor palm + boot thrusters
            row(2 + bob, 7, 12, 'red');
            for (let y = 3; y <= 9; y++) row(y + bob, 6, 13, 'red');
            // Gold faceplate
            for (let y = 4; y <= 8; y++) row(y + bob, 9, 13, 'gold');
            row(4 + bob, 10, 12, 'yellow');
            // Glowing cyan slit eyes
            p(10, 5 + bob, 'cyan'); p(11, 5 + bob, 'white');
            p(13, 5 + bob, 'cyan');
            row(7 + bob, 10, 12, 'red');
            // Red & gold armored torso + glowing chest Arc Reactor
            for (let y = 10; y <= 16; y++) row(y + bob, 6, 13, 'red');
            row(11 + bob, 6, 7, 'gold'); row(14 + bob, 7, 9, 'gold');
            p(11, 12 + bob, 'white'); p(12, 12 + bob, 'cyan');
            p(11, 13 + bob, 'cyan'); p(12, 13 + bob, 'sky');
            // Outstretched repulsor arm
            pc.line(ox + 11, 12 + bob, ox + 16, 12 + bob, 'red');
            p(14, 12 + bob, 'gold');
            p(17, 12 + bob, f % 2 === 0 ? 'white' : 'cyan');
            // Armored legs + boot thruster flames
            row(17, 7 + step, 9 + step, 'gold');
            row(18, 7 + step, 9 + step, 'red');
            row(19, 7 + step, 10 + step, 'red');
            p(8 + step, 20, f % 2 === 0 ? 'cyan' : 'yellow');
            row(17, 10 - step, 12 - step, 'gold');
            row(18, 10 - step, 12 - step, 'red');
            row(19, 10 - step, 13 - step, 'red');
            p(11 - step, 20, f % 2 === 1 ? 'cyan' : 'orange');
        } else if (id === 'hulk') {
            // The Incredible Hulk: massive muscular green body, messy black hair, ripped purple shorts
            row(1 + bob, 6, 13, 'ink');
            row(2 + bob, 5, 14, 'ink');
            p(6, 3 + bob, 'ink'); p(9, 3 + bob, 'ink'); p(12, 3 + bob, 'ink');
            for (let y = 3; y <= 8; y++) row(y + bob, 6, 13, 'grass');
            row(4 + bob, 10, 13, 'forest'); // heavy brow
            p(11, 5 + bob, 'ink'); p(13, 5 + bob, 'ink');
            row(7 + bob, 10, 12, 'white'); // gritted teeth
            // Huge broad green chest & shoulders
            for (let y = 9; y <= 15; y++) row(y + bob, 3, 16, 'grass');
            for (let y = 10; y <= 14; y++) {
                p(3, y + bob, 'leaf'); p(16, y + bob, 'lime');
            }
            row(12 + bob, 6, 13, 'leaf'); // pecs shading
            // Massive swinging green arms & fists
            for (let y = 10; y <= 15; y++) {
                row(y + bob, 2, 4, 'leaf');
                row(y + bob, 15, 17, 'grass');
            }
            row(15 + bob, 15, 18, 'lime');
            // Torn purple shorts
            for (let y = 16; y <= 18; y++) row(y, 5, 14, y === 18 ? 'violet' : 'plum');
            // Big green feet
            row(19, 5 + step, 8 + step, 'grass');
            row(20, 5 + step, 9 + step, 'leaf');
            row(19, 11 - step, 14 - step, 'grass');
            row(20, 11 - step, 15 - step, 'grass');
        } else {
            // Kung Fu Panda (Po): black ears, white head with black eye patches, round white belly, black vest/band, tan kung-fu pants
            // Round black ears
            row(1 + bob, 5, 7, 'ink'); row(2 + bob, 5, 7, 'ink');
            row(1 + bob, 12, 14, 'ink'); row(2 + bob, 12, 14, 'ink');
            // White panda head
            row(2 + bob, 7, 12, 'white');
            for (let y = 3; y <= 8; y++) row(y + bob, 6, 14, 'white');
            // Black eye patches + bright eyes + black nose
            row(4 + bob, 9, 10, 'ink'); row(5 + bob, 9, 10, 'ink'); p(10, 4 + bob, 'white');
            row(4 + bob, 12, 13, 'ink'); row(5 + bob, 12, 13, 'ink'); p(12, 4 + bob, 'white');
            p(14, 6 + bob, 'ink'); p(13, 7 + bob, 'ink');
            // Black shoulders / upper arms
            row(9 + bob, 5, 14, 'ink');
            row(10 + bob, 4, 15, 'ink');
            // Round white panda belly
            for (let y = 11; y <= 16; y++) row(y + bob, 4, 15, 'white');
            for (let y = 12; y <= 15; y++) row(y + bob, 6, 14, 'cloud');
            // Kung fu black & red-gold sash belt
            row(16 + bob, 4, 15, 'red');
            row(17 + bob, 4, 15, 'gold');
            // Kung fu stance black paws
            row(11 + bob, 15, 17, 'ink');
            row(12 + bob, 15, 17, 'ink');
            // Tan/brown kung fu pants + leg wraps
            row(18, 5 + step, 8 + step, 'wood');
            row(19, 5 + step, 8 + step, 'cream');
            row(20, 5 + step, 9 + step, 'ink');
            row(18, 11 - step, 14 - step, 'wood');
            row(19, 11 - step, 14 - step, 'cream');
            row(20, 11 - step, 15 - step, 'ink');
        }
    }

    pc.outline('ink', false);
    return pc;
}

interface ParadeWalker {
    spec: ParadeSpec;
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Image;
    bubble: Phaser.GameObjects.Image;
    anim: string;
    laneOffset: number;
}

/**
 * ET, Scream, IronMan, Hulk, and Kung fu Panda walking in a single-file group
 * one behind another along the same track as the bicycle team.
 */
export class MovieParade {
    private readonly members: ParadeWalker[] = [];
    private readonly segments: RouteSegment[];
    private readonly totalLength: number;
    private distance = 680; // Offset along the track so they march as their own group
    private readonly speed = 44;
    private readonly spacing = 30;
    private clock = 0;
    private rest = 0;

    constructor(
        private readonly scene: Phaser.Scene,
        opts: { townLeft?: number; campusRight?: number } = {},
    ) {
        const route = buildBikeRoute(opts.townLeft ?? 451, opts.campusRight ?? -475);
        this.segments = route.segments;
        this.totalLength = route.totalLength;

        PARADE_SPECS.forEach((spec, idx) => {
            const key = `movie-parade-${spec.id}`;
            addPixels(scene, key, drawParadeSheet(spec.id), stripFrames(FRAMES, W, H));
            const anim = `${key}-walk`;
            if (!scene.anims.exists(anim)) {
                scene.anims.create({
                    key: anim,
                    frames: Array.from({ length: FRAMES }, (_, frame) => ({ key, frame })),
                    frameRate: 8,
                    repeat: -1,
                });
            }

            const laneOffset = (idx % 2 === 0 ? -1 : 1) * 2;
            const pt = this.sampleRoute(this.distance - idx * this.spacing);
            const x = Math.round(pt.x);
            const y = Math.round(pt.y + laneOffset);

            const shadow = scene.add.image(x, y, shadowTexture(scene, spec.id === 'hulk' || spec.id === 'panda' ? 16 : 12))
                .setAlpha(0.28)
                .setDepth(-1e8);
            const sprite = scene.add.sprite(x, y, key, idx % FRAMES).setOrigin(0.5, 1).setDepth(y).play(anim);
            sprite.setName(spec.name);

            const labelKey = `movie-parade-label-${spec.id}`;
            const labelCanvas = new PixelCanvas(miniTextWidth(spec.name) + 6, 9);
            labelCanvas.rect(0, 0, labelCanvas.width, 9, spec.labelBg)
                .rect(0, 0, labelCanvas.width, 1, spec.labelColor);
            miniText(labelCanvas, 3, 2, spec.name, spec.labelColor);
            addPixels(scene, labelKey, labelCanvas);
            const label = scene.add.image(x, y - 26, labelKey).setOrigin(0.5, 1).setDepth(y + 1);

            const quipKey = `movie-parade-quip-${spec.id}`;
            addPixels(scene, quipKey, speechArt(spec.quip, 24));
            const bubble = scene.add.image(x, y - 37, quipKey).setOrigin(0.5, 1).setDepth(1e5).setVisible(false);

            this.members.push({
                spec,
                sprite,
                shadow,
                label,
                bubble,
                anim,
                laneOffset,
            });
        });

        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    private sampleRoute(d: number): { x: number; y: number; dir: 1 | -1 } {
        const wrapped = ((d % this.totalLength) + this.totalLength) % this.totalLength;
        let seg = this.segments[0];
        for (let i = 0; i < this.segments.length; i++) {
            const candidate = this.segments[i];
            if (wrapped >= candidate.cum && wrapped <= candidate.cum + candidate.len) {
                seg = candidate;
                break;
            }
        }
        const t = seg.len > 0 ? (wrapped - seg.cum) / seg.len : 0;
        const x = seg.x0 + (seg.x1 - seg.x0) * t;
        const y = seg.y0 + (seg.y1 - seg.y0) * t;
        const dir: 1 | -1 = seg.dx < 0 ? -1 : 1;
        return { x, y, dir };
    }

    burnables(): Burnable[] {
        return this.members.map((m) => ({
            sprite: m.sprite,
            headroom: 38,
            hold: (seconds: number) => {
                this.rest = Math.max(this.rest, seconds);
            },
        }));
    }

    sprites(): Phaser.GameObjects.Sprite[] {
        return this.members.map((m) => m.sprite);
    }

    update(dt: number) {
        const step = Math.min(dt, 0.1);
        this.clock += step;

        if (this.rest > 0) {
            this.rest -= step;
            for (const m of this.members) {
                if (m.sprite.anims.isPlaying) m.sprite.stop();
            }
        } else {
            this.distance = (this.distance + this.speed * step) % this.totalLength;
            for (const m of this.members) {
                if (!m.sprite.anims.isPlaying) m.sprite.play(m.anim);
            }
        }

        const activeSpeaker = Math.floor(this.clock / 4.5) % this.members.length;
        const showTalk = (this.clock % 4.5) < 3.0 && this.rest <= 0;

        this.members.forEach((m, idx) => {
            const pt = this.sampleRoute(this.distance - idx * this.spacing);
            const flip = pt.dir < 0;
            const x = Math.round(pt.x);
            const y = Math.round(pt.y + m.laneOffset);

            m.sprite.setPosition(x, y).setDepth(y).setFlipX(flip);
            m.shadow.setPosition(x, y);
            m.label.setPosition(x, y - 26).setDepth(y + 1);
            m.bubble.setPosition(x, y - 37).setVisible(showTalk && idx === activeSpeaker);
        });
    }

    destroy() {
        for (const m of this.members) {
            m.sprite.destroy();
            m.shadow.destroy();
            m.label.destroy();
            m.bubble.destroy();
        }
    }
}
