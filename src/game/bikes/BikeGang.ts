import Phaser from 'phaser';
import {
    PixelCanvas, addPixels, darker, lighter, miniText, miniTextWidth, randomLook, shadowTexture, speechArt, stripFrames,
    type CharacterLook, type Color, type FullLook,
} from '../kit';
import type { Burnable } from '../dragon/Dragon';

const BIKE_W = 28;
const BIKE_H = 26;
const FRAMES = 4;

interface RiderSpec {
    name: string;
    frameColor: Color;
    look: CharacterLook;
}

const CREW: RiderSpec[] = [
    {
        name: 'Shahab Gemini 4 Argon',
        frameColor: 'red',
        look: { skin: 'peach', hair: 'ink', hairStyle: 'cap', hat: 'red', shirt: 'blue', pants: 'navy', shoes: 'white' },
    },
    {
        name: 'Dustin',
        frameColor: 'gold',
        look: { skin: 'peach', hair: 'earth', hairStyle: 'cap', hat: 'blue', shirt: 'red', pants: 'wood', shoes: 'white' },
    },
    {
        name: 'Lucas',
        frameColor: 'lime',
        look: { skin: 'wood', hair: 'ink', hairStyle: 'short', hat: 'forest', shirt: 'orange', pants: 'forest', shoes: 'white' },
    },
    {
        name: 'Will',
        frameColor: 'cyan',
        look: { skin: 'cream', hair: 'earth', hairStyle: 'short', hat: 'gold', shirt: 'gold', pants: 'navy', shoes: 'earth' },
    },
];

const QUIPS = [
    'Code Red! Do you copy?',
    "Friends don't lie... about prod.",
    'Heading to the Upside Down!',
    'Keep pedaling, Demogorgon ahead!',
];

/** Draw a 4-frame side-view retro 80s BMX bicycle + pedaling rider sprite sheet (facing right). */
function bikerSheet(look: FullLook, bikeColor: Color): PixelCanvas {
    const pc = new PixelCanvas(BIKE_W * FRAMES, BIKE_H);

    const S = look.skin, Ss = darker(S);
    const H = look.hair, Hl = lighter(H);
    const C = look.hat, Cs = darker(C), Cl = lighter(C);
    const T = look.shirt, Ts = darker(T), Tl = lighter(T);
    const P = look.pants, Ps = darker(P);
    const F = look.shoes;
    const B = bikeColor, Bs = darker(B), Bl = lighter(B);

    const wheelOffsets: [number, number][] = [
        [0, -3], [2, -2], [3, 0], [2, 2],
        [0, 3], [-2, 2], [-3, 0], [-2, -2],
    ];
    const pedalOffsets: [number, number][] = [
        [2, 0], [0, 2], [-2, 0], [0, -2],
    ];

    for (let f = 0; f < FRAMES; f++) {
        const ox = f * BIKE_W;
        const bob = f % 2 === 1 ? -1 : 0;
        const p = (x: number, y: number, c: Color) => pc.set(ox + x, y, c);
        const row = (y: number, x0: number, x1: number, c: Color) => {
            for (let x = x0; x <= x1; x++) p(x, y, c);
        };

        // Rear wheel (center 6, 20) & Front wheel (center 21, 20)
        for (const wx of [6, 21]) {
            const wy = 20;
            for (const [dx, dy] of wheelOffsets) {
                p(wx + dx, wy + dy, 'night');
                p(wx + Math.sign(dx) * Math.min(2, Math.abs(dx)), wy + Math.sign(dy) * Math.min(2, Math.abs(dy)), 'slate');
            }
            // Rotating spokes
            const s1 = wheelOffsets[f % 4];
            const s2 = wheelOffsets[(f + 2) % 4];
            p(wx + Math.sign(s1[0]), wy + Math.sign(s1[1]), 'mist');
            p(wx - Math.sign(s1[0]), wy - Math.sign(s1[1]), 'mist');
            p(wx + Math.sign(s2[0]), wy + Math.sign(s2[1]), 'steel');
            p(wx, wy, 'cloud');
        }

        // Crank / chainring at (12, 20)
        const cx = 12, cy = 20;
        const [pxF, pyF] = pedalOffsets[f];
        const [pxB, pyB] = pedalOffsets[(f + 2) % 4];

        // Back leg (behind frame)
        pc.line(ox + 10, 14 + bob, ox + cx + pxB, cy + pyB, Ps);
        p(cx + pxB, cy + pyB, F);
        p(cx + pxB + 1, cy + pyB, F);

        // BMX diamond frame & fork
        pc.line(ox + 6, 20, ox + 12, 20, Bs); // chainstay
        pc.line(ox + 6, 20, ox + 10, 14, B);  // seatstay
        pc.line(ox + 12, 20, ox + 10, 14, B); // seat tube
        pc.line(ox + 12, 20, ox + 18, 15, B); // down tube
        pc.line(ox + 10, 14, ox + 18, 14, Bl); // top tube
        pc.line(ox + 21, 20, ox + 18, 12, B); // front fork + stem
        p(12, 20, 'steel');

        // Banana seat + sissy bar
        row(13, 8, 11, 'bark');
        p(8, 12, 'earth');
        pc.line(ox + 7, 13, ox + 6, 19, 'steel');

        // High-rise chopper handlebars + retro headlight
        p(18, 11, 'cloud');
        p(17, 10, 'cloud');
        p(16, 10, 'red'); // grip
        // Stranger Things style bright bike headlight on the front bars
        p(20, 13, 'slate');
        p(21, 13, 'yellow');
        p(22, 13, 'white');

        // Rider torso (leaning slightly forward toward bars)
        for (let y = 9; y <= 13; y++) row(y + bob, 9, 13, T);
        row(13 + bob, 9, 13, Ts);
        p(10, 9 + bob, Tl); p(11, 9 + bob, Tl);
        // Backpack (classic Hawkins walkie-talkie pack!)
        for (let y = 9; y <= 12; y++) row(y + bob, 7, 8, Cs);
        p(7, 7 + bob, 'steel'); p(7, 8 + bob, 'steel'); // walkie-talkie antenna sticking out!

        // Rider hips & front pedaling leg
        row(14 + bob, 9, 12, P);
        const kneeX = 12 + (pxF > 0 ? 1 : 0);
        const kneeY = 16 + (pyF < 0 ? -1 : 0);
        pc.line(ox + 11, 14 + bob, ox + kneeX, kneeY, P);
        pc.line(ox + kneeX, kneeY, ox + cx + pxF, cy + pyF, P);
        p(cx + pxF, cy + pyF, F);
        p(cx + pxF + 1, cy + pyF, F);

        // Rider arm reaching to handlebar grip (16, 10)
        pc.line(ox + 12, 10 + bob, ox + 16, 10, Tl);
        p(16, 10, S);

        // Rider head
        row(2 + bob, 10, 14, S);
        for (let y = 3; y <= 7; y++) row(y + bob, 9, 15, S);
        row(8 + bob, 10, 14, S);
        p(16, 6 + bob, S); // nose
        p(13, 5 + bob, 'ink'); p(13, 6 + bob, 'ink'); // eye
        p(11, 6 + bob, Ss);

        // Hair / Cap
        const style = look.hairStyle;
        row(2 + bob, 10, 14, H);
        row(3 + bob, 9, 15, H);
        row(4 + bob, 9, 14, H);
        for (let y = 5; y <= 7; y++) row(y + bob, 9, 10, H);
        p(11, 2 + bob, Hl); p(12, 2 + bob, Hl);
        if (style === 'cap') {
            row(2 + bob, 10, 14, C);
            row(3 + bob, 9, 15, C);
            row(4 + bob, 9, 17, Cs);
            p(11, 2 + bob, Cl); p(12, 2 + bob, Cl);
        }
    }

    pc.outline('ink', false);
    return pc;
}

interface Biker {
    name: string;
    lead: boolean;
    sprite: Phaser.GameObjects.Sprite;
    shadow: Phaser.GameObjects.Image;
    beam: Phaser.GameObjects.Image;
    label?: Phaser.GameObjects.Image;
    anim: string;
    laneOffset: number;
}

/**
 * Shahab and 3 friends riding bicycles in single-file ("serial") formation across town,
 * Stranger Things style—complete with BMX bikes, headlight beams, backpack antennas, and radio quips.
 */
export class BikeGang {
    private readonly bikers: Biker[] = [];
    private readonly bubble: Phaser.GameObjects.Image;
    private readonly quipKeys: string[] = [];
    private leadX = -180;
    private readonly baseY = 142;
    private dir = 1;
    private readonly speed = 58;
    private readonly spacing = 36;
    private clock = 0;
    private rest = 0;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly bounds: () => Phaser.Geom.Rectangle,
    ) {
        // Headlight cone texture
        const beamCanvas = new PixelCanvas(26, 12);
        for (let y = 0; y < 12; y++) {
            for (let x = 0; x < 26; x++) {
                const t = x / 25;
                const halfH = 1 + t * 4.8;
                const dy = Math.abs(y - 5.5);
                if (dy <= halfH) {
                    beamCanvas.set(x, y, t < 0.35 ? 'white' : t < 0.7 ? 'yellow' : 'gold');
                }
            }
        }
        addPixels(scene, 'bikegang-beam', beamCanvas);

        QUIPS.forEach((q, i) => {
            const k = `bikegang-quip-${i}`;
            addPixels(scene, k, speechArt(q));
            this.quipKeys.push(k);
        });

        CREW.forEach((spec, idx) => {
            const look = randomLook(spec.name, spec.look);
            const key = `bikegang-rider-${spec.name}`;
            addPixels(scene, key, bikerSheet(look, spec.frameColor), stripFrames(FRAMES, BIKE_W, BIKE_H));
            const anim = `${key}-ride`;
            if (!scene.anims.exists(anim)) {
                scene.anims.create({
                    key: anim,
                    frames: Array.from({ length: FRAMES }, (_, frame) => ({ key, frame })),
                    frameRate: 11,
                    repeat: -1,
                });
            }

            const laneOffset = (idx % 2 === 0 ? -1 : 1) * 2;
            const y = this.baseY + laneOffset;
            const x = this.leadX - idx * this.spacing;

            const shadow = scene.add.image(x, y, shadowTexture(scene, 20)).setAlpha(0.28).setDepth(-1e8);
            const beam = scene.add.image(x + 12, y - 9, 'bikegang-beam')
                .setOrigin(0, 0.5)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setAlpha(0.32)
                .setDepth(y - 0.5);
            const sprite = scene.add.sprite(x, y, key, fStart(idx)).setOrigin(0.5, 1).setDepth(y).play(anim);
            sprite.setName(spec.name);

            // Show Shahab's prominent nameplate (and friend labels)
            const isLead = idx === 0;
            const labelKey = `bikegang-label-${spec.name}`;
            const canvas = new PixelCanvas(miniTextWidth(spec.name) + 6, 9);
            canvas.rect(0, 0, canvas.width, 9, isLead ? 'wine' : 'ink');
            if (isLead) canvas.rect(0, 0, canvas.width, 1, 'red');
            miniText(canvas, 3, 2, spec.name, isLead ? 'yellow' : 'cream');
            addPixels(scene, labelKey, canvas);
            const label = scene.add.image(x, y - 28, labelKey).setOrigin(0.5, 1).setDepth(y + 1);

            this.bikers.push({
                name: spec.name,
                lead: isLead,
                sprite,
                shadow,
                beam,
                label,
                anim,
                laneOffset,
            });
        });

        this.bubble = scene.add.image(this.leadX, this.baseY - 40, this.quipKeys[0])
            .setOrigin(0.5, 1)
            .setDepth(1e5)
            .setVisible(false);

        this.update(0);
        scene.events.once('shutdown', () => this.destroy());
    }

    /** Let the dragon toast the bike riders too. */
    burnables(): Burnable[] {
        return this.bikers.map((b) => ({
            sprite: b.sprite,
            headroom: 40,
            hold: (seconds: number) => {
                this.rest = Math.max(this.rest, seconds);
            },
        }));
    }

    /** Sprites so flying-car tokens can also be picked up by the bike crew. */
    sprites(): Phaser.GameObjects.Sprite[] {
        return this.bikers.map((b) => b.sprite);
    }

    update(dt: number) {
        const step = Math.min(dt, 0.1);
        this.clock += step;

        const b = this.bounds();
        const tailSpan = (this.bikers.length - 1) * this.spacing;
        const leftLimit = b.left + 20 + tailSpan;
        const rightLimit = Math.max(leftLimit + 40, b.right - 20 - tailSpan);

        if (this.rest > 0) {
            this.rest -= step;
            for (const rider of this.bikers) {
                if (rider.sprite.anims.isPlaying) rider.sprite.stop();
            }
        } else {
            this.leadX += this.dir * this.speed * step;
            if (this.dir > 0 && this.leadX >= rightLimit) {
                this.leadX = rightLimit;
                this.dir = -1;
            } else if (this.dir < 0 && this.leadX <= leftLimit) {
                this.leadX = leftLimit;
                this.dir = 1;
            }
            for (const rider of this.bikers) {
                if (!rider.sprite.anims.isPlaying) rider.sprite.play(rider.anim);
            }
        }

        const flip = this.dir < 0;
        this.bikers.forEach((rider, idx) => {
            // Serial formation: Shahab leads in front, the 3 friends trail right behind in single file
            const x = Math.round(this.leadX - this.dir * idx * this.spacing);
            const wave = Math.round(Math.sin(this.clock * 4.2 - idx * 0.9) * 2.5);
            const y = this.baseY + rider.laneOffset + wave;

            rider.sprite.setPosition(x, y).setDepth(y).setFlipX(flip);
            rider.shadow.setPosition(x, y);
            rider.beam
                .setPosition(x + this.dir * 11, y - 10)
                .setFlipX(flip)
                .setOrigin(flip ? 1 : 0, 0.5)
                .setDepth(y - 0.5)
                .setAlpha(0.28 + Math.sin(this.clock * 9 + idx) * 0.06);
            rider.label?.setPosition(x, y - 28).setDepth(y + 1);
        });

        // Periodic walkie-talkie speech bubble over the lead rider (Shahab)
        const lead = this.bikers[0];
        const cycle = this.clock % 14;
        if (lead && cycle < 3.6 && this.rest <= 0) {
            const qIdx = Math.floor(this.clock / 14) % this.quipKeys.length;
            const key = this.quipKeys[qIdx];
            if (this.bubble.texture.key !== key) this.bubble.setTexture(key);
            this.bubble.setPosition(lead.sprite.x, lead.sprite.y - 39).setVisible(true);
        } else {
            this.bubble.setVisible(false);
        }
    }

    destroy() {
        for (const b of this.bikers) {
            b.sprite.destroy();
            b.shadow.destroy();
            b.beam.destroy();
            b.label?.destroy();
        }
        this.bubble.destroy();
    }
}

const fStart = (i: number) => i % FRAMES;
