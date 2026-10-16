import Phaser from 'phaser';
import { HEX, PixelCanvas, addPixels, bayer, hash, miniText, miniTextWidth, wrapWords, type ColorName } from '../kit';
import { isTyping } from '../commands';

/** The inside of the dome: a circle sitting on the horizon, with seats in front. */
const DOME = { x: 0, y: 95, r: 200 };
const HORIZON = 54;
/** The sky turns about this point (Polaris). */
const POLE = { x: 0, y: -40 };
/** Seconds for the sky to turn once. */
const TURN = 150;
/** Seconds each constellation is in the spotlight. */
const FEATURE = 9;

type Star = { x: number; y: number; color: number; alpha: number; size: number; phase: number; speed: number };

type Constellation = {
    name: string;
    caption: string;
    /** Where it sits in the sky: degrees round the pole, and distance from it. */
    at: [number, number];
    stars: [number, number][];
    lines: [number, number][];
    /** Star indices drawn extra bright, and their colour. */
    bright?: Partial<Record<number, ColorName>>;
};

const CONSTELLATIONS: Constellation[] = [
    {
        name: 'BIG DIPPER',
        caption: 'THE BIG DIPPER. FOLLOW ITS TWO END STARS UP TO POLARIS, THE NORTH STAR.',
        at: [200, 74],
        stars: [[0, 0], [14, 2], [26, 6], [36, 12], [40, 24], [56, 26], [58, 12]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    },
    {
        name: 'CASSIOPEIA',
        caption: 'CASSIOPEIA, THE QUEEN, SITS ON HER THRONE. LOOK FOR THE BIG W.',
        at: [20, 74],
        stars: [[0, 0], [10, 12], [20, 4], [30, 14], [42, 6]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
    },
    {
        name: 'ORION',
        caption: 'ORION THE HUNTER. HIS BELT IS THREE STARS IN A ROW. BETELGEUSE GLOWS RED.',
        at: [300, 165],
        stars: [[0, 0], [26, 4], [10, 22], [14, 24], [18, 26], [4, 44], [28, 42], [13, -8]],
        lines: [[0, 7], [7, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
        bright: { 0: 'orange', 6: 'ice' },
    },
    {
        name: 'LYRA',
        caption: 'LYRA, THE HARP. VEGA IS ONE OF THE BRIGHTEST STARS IN THE NIGHT SKY.',
        at: [130, 120],
        stars: [[0, 0], [6, 6], [4, 16], [12, 18], [14, 8]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
        bright: { 0: 'ice' },
    },
    {
        name: 'CYGNUS',
        caption: 'CYGNUS THE SWAN FLIES SOUTH ALONG THE MILKY WAY.',
        at: [95, 140],
        stars: [[0, 0], [12, 12], [20, 22], [30, 34], [2, 22], [22, 4]],
        lines: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]],
        bright: { 0: 'white' },
    },
    {
        name: 'SCORPIUS',
        caption: 'SCORPIUS. ITS RED HEART IS ANTARES, A SUPERGIANT STAR 700 TIMES WIDER THAN THE SUN.',
        at: [60, 190],
        stars: [[0, 0], [6, -6], [8, 4], [14, 10], [18, 18], [20, 28], [18, 38], [12, 44], [4, 44], [0, 38], [2, 32]],
        lines: [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]],
        bright: { 3: 'red' },
    },
    {
        name: 'LEO',
        caption: 'LEO THE LION. THE BACKWARDS QUESTION MARK IS HIS MANE.',
        at: [250, 150],
        stars: [[0, 30], [2, 20], [8, 12], [4, 4], [-4, 4], [-6, 10], [30, 18], [44, 26], [30, 30]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 6], [6, 7], [7, 8], [8, 0]],
        bright: { 0: 'ice' },
    },
];

const STAR_COLORS: ColorName[] = ['white', 'white', 'white', 'ice', 'ice', 'cyan', 'cloud', 'yellow', 'peach', 'sky'];

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Inside the planetarium: the lights go down, the star projector hums, and the sky turns slowly overhead
 * with the Milky Way, planets, shooting stars, and a guided tour of the constellations. Arrows, Esc,
 * or a tap step back outside.
 */
export class StarShow extends Phaser.Scene {
    private gfx!: Phaser.GameObjects.Graphics;
    private stars: Star[] = [];
    private milkyWay: Star[] = [];
    /** Each constellation's stars and centre, in sky coordinates around the pole. */
    private patterns: { pts: [number, number][]; centre: [number, number]; label: Phaser.GameObjects.Image }[] = [];
    private planets: { image: Phaser.GameObjects.Image; at: [number, number] }[] = [];
    private polaris!: Phaser.GameObjects.Image;
    private caption!: Phaser.GameObjects.Image;
    private clock = 0;
    private featured = -1;
    private featuredAt = -Infinity;
    private meteor?: { x: number; y: number; vx: number; vy: number; life: number };
    private nextMeteor = 3;
    private leaving = false;
    private openedAt = 0;
    private still = false;

    constructor() {
        super('StarShow');
    }

    create() {
        this.still = reducedMotion();
        this.clock = 0;
        this.featured = -1;
        this.featuredAt = -Infinity;
        this.meteor = undefined;
        this.nextMeteor = 3;
        this.leaving = false;
        this.openedAt = performance.now();

        this.add.image(-210, -110, addPixels(this, 'starshow-dome', domeArt())).setOrigin(0).setDepth(0);
        this.gfx = this.add.graphics().setDepth(1);
        this.makeSky();
        this.add.image(-24, 12, addPixels(this, 'starshow-projector', projectorArt())).setOrigin(0).setDepth(3);
        this.add.image(-220, 50, addPixels(this, 'starshow-seats', seatsArt())).setOrigin(0).setDepth(4);
        this.caption = this.add.image(0, 108, '__DEFAULT').setOrigin(0.5).setDepth(10).setAlpha(0);
        this.add.image(0, 132, addPixels(this, 'starshow-hint', label('ESC, ARROWS OR TAP TO STEP OUT', 'mist', 'ink')))
            .setOrigin(0.5).setDepth(10).setAlpha(0.8);

        const cam = this.cameras.main;
        cam.setBackgroundColor(HEX.ink).setRoundPixels(true);
        const fit = () => {
            const s = Math.min(this.scale.width / 400, this.scale.height / 280);
            cam.setZoom(s >= 1 ? Math.floor(s) : Math.max(0.5, Math.floor(s * 4) / 4));
            cam.centerOn(0, 0);
        };
        fit();
        this.scale.on('resize', fit);
        if (!this.still) cam.fadeIn(500, 20, 16, 30);

        // Window keys, so one tap counts once and the arrow you walked in on (now auto-repeating) doesn't.
        const onKey = (e: KeyboardEvent) => {
            if (e.repeat || isTyping() || !this.sys.isActive()) return;
            if (['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) this.leave();
        };
        window.addEventListener('keydown', onKey);
        this.input.on('pointerdown', () => this.leave());
        this.events.once('shutdown', () => {
            this.scale.off('resize', fit);
            window.removeEventListener('keydown', onKey);
        });
    }

    update(_time: number, dt: number) {
        const s = Math.min(dt, 50) / 1000;
        this.clock += s;
        const turn = (this.clock / (this.still ? TURN * 6 : TURN)) * Math.PI * 2;
        const cos = Math.cos(turn), sin = Math.sin(turn);
        const toScreen = (x: number, y: number): [number, number] => [POLE.x + x * cos - y * sin, POLE.y + x * sin + y * cos];
        this.gfx.clear();

        for (const star of this.milkyWay) {
            const [x, y] = toScreen(star.x, star.y);
            this.plot(x, y, star.color, star.alpha);
        }
        for (const star of this.stars) {
            const [x, y] = toScreen(star.x, star.y);
            const a = this.still ? star.alpha : star.alpha * (0.65 + 0.35 * Math.sin(this.clock * star.speed + star.phase));
            this.plot(x, y, star.color, a);
            if (star.size > 1) this.sparkle(x, y, star.color, a * 0.45);
        }

        // The constellation tour: spotlight the next one that's up, for a few seconds each.
        if (this.clock - this.featuredAt > FEATURE) this.feature(toScreen);
        const since = this.clock - this.featuredAt;
        const spot = Math.min(1, since / 1.2, Math.max(0, (FEATURE - since) / 1.2));
        CONSTELLATIONS.forEach((c, i) => {
            const pattern = this.patterns[i];
            const pts = pattern.pts.map(([x, y]) => toScreen(x, y));
            const lit = i === this.featured ? spot : 0;
            for (const [a, b] of c.lines) this.dashTo(pts[a], pts[b], HEX.cyan, 0.16 + 0.6 * lit);
            pts.forEach(([x, y], k) => {
                const color = HEX[c.bright?.[k] ?? 'white'];
                this.plot(x, y, color, 1);
                this.sparkle(x, y, color, c.bright?.[k] ? 0.8 : 0.35 + 0.4 * lit);
            });
            const top = pts.reduce((m, p) => (p[1] < m[1] ? p : m));
            const [cx] = toScreen(...pattern.centre);
            pattern.label.setPosition(Math.round(cx), Math.round(top[1] - 8)).setAlpha(this.visible(cx, top[1] - 8) ? lit : 0);
        });

        // Polaris stays put at the pole.
        this.plot(POLE.x, POLE.y, HEX.white, 1);
        this.sparkle(POLE.x, POLE.y, HEX.ice, 0.9);
        this.polaris.setAlpha(0.45);

        for (const planet of this.planets) {
            const [x, y] = toScreen(...planet.at);
            planet.image.setPosition(Math.round(x), Math.round(y)).setVisible(this.visible(x, y, 6));
        }

        if (!this.still) this.shootingStar(s);
        this.caption.setAlpha(spot);
    }

    /** Pick the next constellation that's well above the horizon, and put up its caption. */
    private feature(toScreen: (x: number, y: number) => [number, number]) {
        for (let k = 1; k <= CONSTELLATIONS.length; k++) {
            const i = (this.featured + k) % CONSTELLATIONS.length;
            const [x, y] = toScreen(...this.patterns[i].centre);
            if (y < HORIZON - 30 && this.visible(x, y, 30)) {
                this.featured = i;
                this.featuredAt = this.clock;
                this.caption.setTexture(`starshow-caption-${i}`);
                return;
            }
        }
        this.featuredAt = this.clock - FEATURE + 1;
    }

    /** Stars, the Milky Way, the planets, and the constellations, all placed in sky coordinates round the pole. */
    private makeSky() {
        const rnd = new Phaser.Math.RandomDataGenerator(['atv-planetarium']);
        this.stars = [];
        for (let i = 0; i < 420; i++) {
            const r = 250 * Math.sqrt(rnd.frac());
            const a = rnd.frac() * Math.PI * 2;
            const mag = rnd.frac();
            this.stars.push({
                x: Math.cos(a) * r,
                y: Math.sin(a) * r,
                color: HEX[STAR_COLORS[rnd.between(0, STAR_COLORS.length - 1)]],
                alpha: 0.25 + mag * 0.75,
                size: mag > 0.96 ? 2 : 1,
                phase: rnd.frac() * Math.PI * 2,
                speed: 1 + rnd.frac() * 3,
            });
        }

        // The Milky Way: a soft, lumpy band of faint light across the sky.
        this.milkyWay = [];
        const dir = [Math.cos(1.1), Math.sin(1.1)];
        const normal = [-dir[1], dir[0]];
        for (let i = 0; i < 900; i++) {
            const t = (rnd.frac() * 2 - 1) * 260;
            const spread = (rnd.frac() + rnd.frac() + rnd.frac() - 1.5) * 26 * (1 + 0.4 * Math.sin(t / 30));
            const off = 30 + spread + 8 * Math.sin(t / 45);
            const pick = rnd.frac();
            this.milkyWay.push({
                x: dir[0] * t + normal[0] * off,
                y: dir[1] * t + normal[1] * off,
                color: HEX[pick < 0.45 ? 'plum' : pick < 0.8 ? 'violet' : pick < 0.95 ? 'steel' : 'ice'],
                alpha: 0.3 + rnd.frac() * 0.35 * (1 - Math.abs(spread) / 40),
                size: 1,
                phase: 0,
                speed: 0,
            });
        }

        this.patterns = CONSTELLATIONS.map((c, i) => {
            const n = c.stars.length;
            const mx = c.stars.reduce((sum, [x]) => sum + x, 0) / n;
            const my = c.stars.reduce((sum, [, y]) => sum + y, 0) / n;
            const a = (c.at[0] * Math.PI) / 180;
            const ox = Math.cos(a) * c.at[1];
            const oy = Math.sin(a) * c.at[1];
            const key = addPixels(this, `starshow-label-${i}`, label(c.name, 'ice'));
            addPixels(this, `starshow-caption-${i}`, captionArt(c.caption));
            return {
                pts: c.stars.map(([x, y]) => [ox + x - mx, oy + y - my] as [number, number]),
                centre: [ox, oy] as [number, number],
                label: this.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(2).setAlpha(0),
            };
        });
        this.polaris = this.add.image(POLE.x, POLE.y - 5, addPixels(this, 'starshow-polaris', label('POLARIS', 'mist')))
            .setOrigin(0.5, 1).setDepth(2);

        this.planets = [
            { key: 'starshow-moon', art: moonArt(), at: 175, d: 120 },
            { key: 'starshow-saturn', art: saturnArt(), at: 40, d: 150 },
            { key: 'starshow-jupiter', art: jupiterArt(), at: 330, d: 110 },
            { key: 'starshow-mars', art: new PixelCanvas(3, 3).rect(0, 0, 3, 3, 'orange').set(0, 0, 'peach').set(2, 2, 'red'), at: 265, d: 190 },
        ].map(({ key, art, at, d }) => {
            const a = (at * Math.PI) / 180;
            return {
                image: this.add.image(0, 0, addPixels(this, key, art)).setDepth(2),
                at: [Math.cos(a) * d, Math.sin(a) * d] as [number, number],
            };
        });
    }

    /** A shooting star now and then, streaking down across the dome. */
    private shootingStar(s: number) {
        this.nextMeteor -= s;
        if (!this.meteor && this.nextMeteor <= 0) {
            const a = Phaser.Math.FloatBetween(0.3, 0.9) * (Math.random() < 0.5 ? 1 : -1);
            const speed = Phaser.Math.Between(180, 260);
            this.meteor = {
                x: Phaser.Math.Between(-150, 150),
                y: Phaser.Math.Between(-90, -30),
                vx: Math.sin(a) * speed,
                vy: Math.cos(a) * speed * 0.6,
                life: 0.6,
            };
            this.nextMeteor = Phaser.Math.FloatBetween(4, 10);
        }
        const m = this.meteor;
        if (!m) return;
        m.x += m.vx * s;
        m.y += m.vy * s;
        m.life -= s;
        const len = Math.hypot(m.vx, m.vy);
        const fade = Math.min(1, m.life / 0.25);
        for (let i = 0; i < 16; i++) {
            const k = i / 16;
            this.plot(m.x - (m.vx / len) * i, m.y - (m.vy / len) * i, i < 2 ? HEX.white : HEX.ice, fade * (1 - k));
        }
        if (m.life <= 0) this.meteor = undefined;
    }

    private visible(x: number, y: number, margin = 3) {
        return y < HORIZON && Math.hypot(x - DOME.x, y - DOME.y) < DOME.r - margin;
    }

    private plot(x: number, y: number, color: number, alpha: number) {
        const px = Math.round(x), py = Math.round(y);
        if (alpha <= 0.02 || !this.visible(px, py)) return;
        this.gfx.fillStyle(color, Math.min(1, alpha)).fillRect(px, py, 1, 1);
    }

    /** The four-point glint round a bright star. */
    private sparkle(x: number, y: number, color: number, alpha: number) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.plot(x + dx, y + dy, color, alpha);
    }

    /** A star-chart line between two stars, stopping short of each and drawn every other pixel. */
    private dashTo([x0, y0]: [number, number], [x1, y1]: [number, number], color: number, alpha: number) {
        const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
        for (let i = 3; i <= n - 3; i++) {
            if (i % 2) continue;
            const t = i / n;
            this.plot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color, alpha);
        }
    }

    /** Fade out and wake the town back up. */
    private leave() {
        if (this.leaving || performance.now() - this.openedAt < 500) return;
        this.leaving = true;
        const done = () => {
            this.scene.wake('Preview', { from: 'planetarium' });
            this.scene.stop();
        };
        if (this.still) return done();
        const cam = this.cameras.main;
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, done);
        cam.fadeOut(300, 20, 16, 30);
    }
}

/** A line of mini text, optionally on a plate. */
function label(text: string, color: ColorName, plate?: ColorName): PixelCanvas {
    const pc = new PixelCanvas(miniTextWidth(text) + 6, 9);
    if (plate) pc.rect(0, 0, pc.width, pc.height, plate);
    miniText(pc, 3, 2, text, color);
    return pc;
}

/** The narrator's caption: a dark plate with a few lines of text. */
function captionArt(text: string): PixelCanvas {
    const lines = wrapWords(text, 46);
    const w = Math.max(...lines.map(miniTextWidth)) + 10;
    const pc = new PixelCanvas(w, lines.length * 7 + 7);
    pc.rect(0, 0, w, pc.height, 'plum').rect(1, 1, w - 2, pc.height - 2, 'ink');
    lines.forEach((line, i) => miniText(pc, Math.floor((w - miniTextWidth(line)) / 2), 4 + i * 7, line, 'cream'));
    return pc;
}

/** The dome's inside: deep night overhead, a violet glow round the horizon, and a slate rim. */
function domeArt(): PixelCanvas {
    const pc = new PixelCanvas(420, 174);
    const ox = -210, oy = -110;
    const span = HORIZON - (DOME.y - DOME.r);
    for (let j = 0; j < pc.height; j++) {
        for (let i = 0; i < pc.width; i++) {
            const x = i + ox, y = j + oy;
            const d = Math.hypot(x + 0.5 - DOME.x, y + 0.5 - DOME.y) / DOME.r;
            if (d >= 1.02) continue;
            if (d >= 1) {
                pc.set(i, j, 'night');
                continue;
            }
            if (d >= 0.985) {
                pc.set(i, j, 'slate');
                continue;
            }
            const h = (HORIZON - y) / span;
            const b = bayer(i, j);
            pc.set(i, j, h > 0.6 ? 'ink' : h > 0.22 ? (b < (h - 0.22) / 0.38 ? 'ink' : 'night') : h > 0.1 ? 'night'
                : h > 0.04 ? (b < (h - 0.04) / 0.06 ? 'night' : 'plum') : h > 0.015 ? 'plum' : 'violet');
        }
    }
    return pc;
}

/** Rows of seats curving round the room, with a few heads tipped back to watch. */
function seatsArt(): PixelCanvas {
    const W = 440, H = 90;
    const pc = new PixelCanvas(W, H);
    const curve = (x: number) => ((x - W / 2) / (W / 2)) ** 2 * 12;
    for (let x = 0; x < W; x++) for (let y = Math.max(0, Math.floor(8 - curve(x))); y < H; y++) pc.set(x, y, 'ink');
    for (let row = 0; row < 3; row++) {
        const w = 8 + row * 3, h = 6 + row * 3, gap = 4 + row;
        const base = 16 + row * 22;
        for (let x0 = (row % 2) * 6 - 4; x0 < W; x0 += w + gap) {
            const y0 = Math.round(base - curve(x0 + w / 2) - h);
            for (let y = y0; y < y0 + h; y++) {
                for (let x = x0; x < x0 + w; x++) {
                    const round = (y === y0 && (x === x0 || x === x0 + w - 1));
                    if (!round) pc.set(x, y, y <= y0 + 1 ? 'slate' : 'night');
                }
            }
            if (hash(x0, row, 3) < 0.3) {
                const r = 2 + row * 0.8;
                const hx = x0 + w / 2, hy = y0 - r + 2;
                pc.ellipse(hx, hy, r, r, (_x, _y, nx, ny) => (ny < -0.4 && nx < 0.3 ? 'slate' : 'ink'));
            }
            if (row < 3 && hash(x0, row, 5) < 0.15) pc.set(x0 + w + 1, base - Math.round(curve(x0)) + 3, 'violet');
        }
    }
    return pc;
}

/** The star projector: two starry globes on a tilted bar, on a pedestal. */
function projectorArt(): PixelCanvas {
    const pc = new PixelCanvas(48, 50);
    pc.rect(20, 26, 8, 24, 'slate').rect(20, 26, 2, 24, 'steel').rect(16, 46, 16, 4, 'slate');
    for (let t = 0; t <= 30; t++) pc.rect(9 + t, 9 + Math.round(t * 0.6), 2, 3, 'steel').set(9 + t, 9 + Math.round(t * 0.6), 'mist');
    for (const [cx, cy] of [[10, 10], [38, 27]] as const) {
        pc.ellipse(cx, cy, 8, 8, (_x, _y, nx, ny) => (nx + ny < -0.7 ? 'steel' : 'slate'));
        for (let k = 0; k < 9; k++) {
            const a = k * 2.4;
            const r = 2 + (k % 3) * 2;
            pc.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), k % 3 ? 'cyan' : 'white');
        }
    }
    pc.outline('ink');
    return pc;
}

function moonArt(): PixelCanvas {
    const pc = new PixelCanvas(11, 11);
    pc.ellipse(5.5, 5.5, 5.5, 5.5, (_x, _y, nx, ny) => (nx > 0.35 ? 'steel' : nx + ny < -0.6 ? 'white' : 'cloud'));
    pc.set(3, 4, 'mist').set(4, 4, 'mist').set(6, 7, 'mist').set(3, 7, 'mist').set(5, 2, 'mist');
    return pc;
}

function saturnArt(): PixelCanvas {
    const pc = new PixelCanvas(15, 9);
    pc.ellipse(7.5, 4.5, 4, 4, (_x, y) => (y === 3 || y === 6 ? 'clay' : 'sand'));
    pc.line(0, 6, 14, 2, 'cream').line(1, 6, 13, 3, 'gold');
    pc.set(6, 4, 'sand').set(7, 4, 'sand').set(8, 4, 'sand');
    return pc;
}

function jupiterArt(): PixelCanvas {
    const pc = new PixelCanvas(7, 7);
    pc.ellipse(3.5, 3.5, 3.5, 3.5, (_x, y) => (y === 2 || y === 4 ? 'clay' : 'cream'));
    pc.set(4, 4, 'red');
    return pc;
}
