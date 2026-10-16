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
/** Seconds each constellation is in the spotlight during a tour. */
const FEATURE = 7;

type Star = { x: number; y: number; color: number; alpha: number; size: number; phase: number; speed: number };

type Constellation = {
    name: string;
    caption: string;
    /** Where it sits in the sky: degrees round the pole and distance from it, or 'pole' to hang its first star on Polaris. */
    at: [number, number] | 'pole';
    stars: [number, number][];
    lines: [number, number][];
    /** Star indices drawn extra bright, and their colour. */
    bright?: Partial<Record<number, ColorName>>;
};

const CONSTELLATIONS: Constellation[] = [
    {
        name: 'BIG DIPPER',
        caption: 'FOLLOW ITS TWO END STARS UP TO POLARIS, THE NORTH STAR.',
        at: [200, 74],
        stars: [[0, 0], [14, 2], [26, 6], [36, 12], [40, 24], [56, 26], [58, 12]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    },
    {
        name: 'LITTLE DIPPER',
        caption: 'POLARIS IS THE TIP OF ITS HANDLE. THE WHOLE SKY TURNS AROUND IT.',
        at: 'pole',
        stars: [[0, 0], [-6, 10], [-8, 20], [-6, 30], [-18, 38], [-24, 30], [-14, 24]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    },
    {
        name: 'CASSIOPEIA',
        caption: 'THE QUEEN SITS ON HER THRONE. LOOK FOR THE BIG W.',
        at: [20, 74],
        stars: [[0, 0], [10, 12], [20, 4], [30, 14], [42, 6]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
    },
    {
        name: 'DRACO',
        caption: 'THE DRAGON COILS BETWEEN THE TWO DIPPERS. NO, NOT OUR DRAGON.',
        at: [120, 52],
        stars: [[0, 0], [7, -4], [11, 2], [4, 6], [16, 12], [26, 10], [34, 18], [38, 28], [48, 28], [56, 34]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]],
        bright: { 0: 'peach' },
    },
    {
        name: 'ORION',
        caption: 'THE HUNTER. HIS BELT IS THREE STARS IN A ROW. BETELGEUSE GLOWS RED.',
        at: [300, 165],
        stars: [[0, 0], [26, 4], [10, 22], [14, 24], [18, 26], [4, 44], [28, 42], [13, -8]],
        lines: [[0, 7], [7, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
        bright: { 0: 'orange', 6: 'ice' },
    },
    {
        name: 'TAURUS',
        caption: 'THE BULL, WITH RED ALDEBARAN FOR AN EYE AND THE SEVEN SISTERS ON HIS SHOULDER.',
        at: [322, 120],
        stars: [[0, 0], [6, 6], [12, 10], [6, 14], [18, 18], [-12, -10], [-4, 24], [-22, -22], [-20, -24], [-24, -23], [-21, -20], [-23, -25], [-19, -21]],
        lines: [[5, 0], [0, 1], [1, 2], [0, 3], [3, 6], [2, 4]],
        bright: { 3: 'orange' },
    },
    {
        name: 'GEMINI',
        caption: 'THE TWINS, CASTOR AND POLLUX, STANDING SIDE BY SIDE.',
        at: [272, 98],
        stars: [[0, 0], [10, -2], [2, 10], [12, 8], [4, 22], [14, 20], [6, 34], [16, 32]],
        lines: [[0, 2], [2, 4], [4, 6], [1, 3], [3, 5], [5, 7], [0, 1]],
        bright: { 0: 'ice', 1: 'peach' },
    },
    {
        name: 'CANIS MAJOR',
        caption: 'THE BIG DOG. SIRIUS, ON ITS NOSE, IS THE BRIGHTEST STAR IN THE NIGHT SKY.',
        at: [325, 205],
        stars: [[0, 0], [-6, 8], [4, 10], [2, 22], [-8, 26], [10, 30], [-2, -8]],
        lines: [[6, 0], [0, 1], [0, 2], [2, 3], [3, 4], [3, 5]],
        bright: { 0: 'ice' },
    },
    {
        name: 'LEO',
        caption: 'THE LION. THE BACKWARDS QUESTION MARK IS HIS MANE.',
        at: [250, 150],
        stars: [[0, 30], [2, 20], [8, 12], [4, 4], [-4, 4], [-6, 10], [30, 18], [44, 26], [30, 30]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 6], [6, 7], [7, 8], [8, 0]],
        bright: { 0: 'ice' },
    },
    {
        name: 'BOOTES',
        caption: 'THE HERDSMAN, A KITE IN THE SKY. ORANGE ARCTURUS SITS AT ITS TAIL.',
        at: [192, 145],
        stars: [[0, 24], [-4, 14], [4, 14], [-6, 4], [6, 2], [0, -6]],
        lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]],
        bright: { 0: 'orange' },
    },
    {
        name: 'CORONA BOREALIS',
        caption: 'THE NORTHERN CROWN: A LITTLE ARC OF JEWELS.',
        at: [160, 150],
        stars: [[0, 0], [5, 4], [11, 5], [17, 4], [21, 0], [23, -5], [-2, -5]],
        lines: [[6, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
        bright: { 2: 'white' },
    },
    {
        name: 'LYRA',
        caption: 'THE HARP. VEGA IS ONE OF THE BRIGHTEST STARS IN THE NIGHT SKY.',
        at: [130, 120],
        stars: [[0, 0], [6, 6], [4, 16], [12, 18], [14, 8]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
        bright: { 0: 'ice' },
    },
    {
        name: 'CYGNUS',
        caption: 'THE SWAN FLIES SOUTH ALONG THE MILKY WAY.',
        at: [95, 140],
        stars: [[0, 0], [12, 12], [20, 22], [30, 34], [2, 22], [22, 4]],
        lines: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]],
        bright: { 0: 'white' },
    },
    {
        name: 'AQUILA',
        caption: 'THE EAGLE. ALTAIR, VEGA AND DENEB MAKE THE SUMMER TRIANGLE.',
        at: [110, 190],
        stars: [[0, 0], [-6, -4], [6, 4], [-16, 8], [14, -10], [0, 16]],
        lines: [[1, 0], [0, 2], [0, 5], [1, 3], [2, 4]],
        bright: { 0: 'white' },
    },
    {
        name: 'PEGASUS',
        caption: 'THE WINGED HORSE. FIND THE GREAT SQUARE, THEN HIS NECK AND LEGS.',
        at: [38, 135],
        stars: [[0, 0], [24, 2], [22, 24], [-2, 22], [-14, 30], [-26, 28], [34, 32], [-10, 6]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [2, 6], [0, 7]],
    },
    {
        name: 'ANDROMEDA',
        caption: 'THE CHAINED PRINCESS. THAT FUZZY SMUDGE BY HER KNEE IS A WHOLE OTHER GALAXY.',
        at: [5, 112],
        stars: [[0, 0], [14, -4], [28, -6], [40, -12], [16, 8], [30, 12], [20, -14]],
        lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [2, 6]],
        bright: { 6: 'violet' },
    },
    {
        name: 'SCORPIUS',
        caption: 'ITS RED HEART IS ANTARES, A SUPERGIANT 700 TIMES WIDER THAN THE SUN.',
        at: [60, 190],
        stars: [[0, 0], [6, -6], [8, 4], [14, 10], [18, 18], [20, 28], [18, 38], [12, 44], [4, 44], [0, 38], [2, 32]],
        lines: [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]],
        bright: { 3: 'red' },
    },
    {
        name: 'SAGITTARIUS',
        caption: 'THE ARCHER, BETTER KNOWN AS THE TEAPOT. THE CENTRE OF OUR GALAXY IS IN ITS STEAM.',
        at: [22, 238],
        stars: [[0, 0], [12, -2], [20, 6], [14, 16], [2, 16], [-6, 8], [6, -10], [28, 14]],
        lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [6, 1], [2, 7], [7, 3]],
    },
    {
        name: 'CRUX',
        caption: 'THE SOUTHERN CROSS. SAILORS STEER BY IT SOUTH OF THE EQUATOR.',
        at: [272, 232],
        stars: [[0, 0], [0, 16], [-7, 7], [7, 6], [3, 11]],
        lines: [[0, 1], [2, 3]],
        bright: { 1: 'ice' },
    },
];

type ActKind = 'tour' | 'aurora' | 'meteors' | 'comet' | 'galaxy' | 'supernova' | 'warp';

const ACTS: Record<Exclude<ActKind, 'tour'>, { title: string; caption: string }> = {
    aurora: { title: 'AURORA BOREALIS', caption: 'CHARGED PARTICLES FROM THE SUN HIT THE AIR HIGH UP AND MAKE IT GLOW GREEN AND VIOLET.' },
    meteors: { title: 'PERSEID METEOR SHOWER', caption: 'EARTH PLOWS THROUGH OLD COMET DUST. EVERY STREAK IS A GRAIN OF SAND BURNING UP.' },
    comet: { title: 'A COMET RETURNS', caption: 'A DIRTY SNOWBALL FROM THE EDGE OF THE SOLAR SYSTEM. ITS TAIL ALWAYS POINTS AWAY FROM THE SUN.' },
    galaxy: { title: 'THE ANDROMEDA GALAXY', caption: 'A TRILLION STARS, 2.5 MILLION LIGHT YEARS AWAY, AND HEADED OUR WAY.' },
    supernova: { title: 'SUPERNOVA!', caption: 'A GIANT STAR RUNS OUT OF FUEL AND BLOWS UP, OUTSHINING ITS WHOLE GALAXY FOR A FEW WEEKS.' },
    warp: { title: 'WARP SPEED', caption: 'HOLD ON TO YOUR SEATS. NEXT STOP: THE EDGE OF THE UNIVERSE.' },
};

/** The running order, in seconds per act. It loops. */
const PROGRAM: [ActKind, number][] = [
    ['tour', 35], ['aurora', 18], ['meteors', 15], ['tour', 28], ['comet', 18],
    ['galaxy', 18], ['tour', 28], ['supernova', 14], ['warp', 11],
];

const STAR_COLORS: ColorName[] = ['white', 'white', 'white', 'ice', 'ice', 'cyan', 'cloud', 'yellow', 'peach', 'sky'];

type Meteor = { x: number; y: number; vx: number; vy: number; life: number; len: number };
type Dot = { a: number; r: number; color: number; alpha: number };

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Inside the planetarium: the lights go down, the star projector hums, and the sky turns slowly overhead.
 * The show loops through acts: constellation tours (lines drawing themselves in), the northern lights,
 * a meteor shower, a comet, the Andromeda galaxy, a supernova, and a jump to warp speed.
 * Arrows, Esc, or a tap step back outside. `?show=aurora` (or any act) starts on that act.
 */
export class StarShow extends Phaser.Scene {
    private gfx!: Phaser.GameObjects.Graphics;
    private stars: Star[] = [];
    private milkyWay: Star[] = [];
    /** Each constellation's stars and centre, in sky coordinates around the pole. */
    private patterns: { pts: [number, number][]; centre: [number, number]; label: Phaser.GameObjects.Image }[] = [];
    private planets: { image: Phaser.GameObjects.Image; at: [number, number] }[] = [];
    private galaxy: Dot[] = [];
    private remnant: Dot[] = [];
    private warp: { a: number; d: number; color: number }[] = [];
    private polaris!: Phaser.GameObjects.Image;
    private caption!: Phaser.GameObjects.Image;
    private clock = 0;
    private act = 0;
    private actAt = 0;
    private flashed = false;
    private featured = -1;
    private featuredAt = -Infinity;
    private meteors: Meteor[] = [];
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
        this.meteors = [];
        this.nextMeteor = 3;
        this.leaving = false;
        this.openedAt = performance.now();

        this.add.image(-210, -110, addPixels(this, 'starshow-dome', domeArt())).setOrigin(0).setDepth(0);
        this.gfx = this.add.graphics().setDepth(1);
        this.makeSky();
        this.add.image(-24, 12, addPixels(this, 'starshow-projector', projectorArt())).setOrigin(0).setDepth(3);
        this.add.image(-220, 50, addPixels(this, 'starshow-seats', seatsArt())).setOrigin(0).setDepth(4);
        this.caption = this.add.image(0, 84, '__DEFAULT').setOrigin(0.5).setDepth(10).setAlpha(0);
        this.add.image(0, 132, addPixels(this, 'starshow-hint', label('ESC, ARROWS OR TAP TO STEP OUT', 'mist', 'ink')))
            .setOrigin(0.5).setDepth(10).setAlpha(0.8);
        for (const [kind, { title, caption }] of Object.entries(ACTS)) addPixels(this, `starshow-act-${kind}`, captionArt(title, caption));

        const asked = new URLSearchParams(location.search).get('show');
        this.startAct(Math.max(0, PROGRAM.findIndex(([kind]) => kind === asked)));

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

    private startAct(i: number) {
        this.act = i % PROGRAM.length;
        // Warp speed and a supernova's flash are a lot; skip warp for anyone who'd rather things stay still.
        if (this.still && PROGRAM[this.act][0] === 'warp') this.act = (this.act + 1) % PROGRAM.length;
        this.actAt = this.clock;
        this.flashed = false;
        const [kind] = PROGRAM[this.act];
        if (kind === 'tour') this.featuredAt = -Infinity;
        else this.caption.setTexture(`starshow-act-${kind}`);
        if (kind === 'warp') {
            for (const w of this.warp) w.d = 2 + Math.random() * 120;
        }
    }

    update(_time: number, dt: number) {
        const s = Math.min(dt, 50) / 1000;
        this.clock += s;
        const [kind, seconds] = PROGRAM[this.act];
        const t = this.clock - this.actAt;
        if (t > seconds) {
            this.startAct(this.act + 1);
            return;
        }
        // How far into its act we are: rises over 2s, holds, and falls over the last 2s.
        const env = clamp01(Math.min(t / 2, (seconds - t) / 2));

        const turn = (this.clock / (this.still ? TURN * 6 : TURN)) * Math.PI * 2;
        const cos = Math.cos(turn), sin = Math.sin(turn);
        const toScreen = (x: number, y: number): [number, number] => [POLE.x + x * cos - y * sin, POLE.y + x * sin + y * cos];
        this.gfx.clear();

        // Warp speed fades the sky away while the stars stream past.
        const sky = kind === 'warp' ? 1 - env : 1;
        for (const star of this.milkyWay) {
            const [x, y] = toScreen(star.x, star.y);
            this.plot(x, y, star.color, star.alpha * sky);
        }
        for (const star of this.stars) {
            const [x, y] = toScreen(star.x, star.y);
            const a = (this.still ? star.alpha : star.alpha * (0.65 + 0.35 * Math.sin(this.clock * star.speed + star.phase))) * sky;
            this.plot(x, y, star.color, a);
            if (star.size > 1) this.sparkle(x, y, star.color, a * 0.45);
        }

        // Constellation tours: spotlight the next one that's up, and draw its lines in star by star.
        let spot = 0;
        if (kind === 'tour') {
            if (this.clock - this.featuredAt > FEATURE && seconds - t > 3) this.feature(toScreen);
            const since = this.clock - this.featuredAt;
            spot = clamp01(Math.min(since / 1, (FEATURE - since) / 1, (seconds - t) / 1));
            this.caption.setAlpha(spot);
        } else {
            this.caption.setAlpha(env);
        }
        const since = this.clock - this.featuredAt;
        let poleLit = 0;
        CONSTELLATIONS.forEach((c, i) => {
            const pattern = this.patterns[i];
            const pts = pattern.pts.map(([x, y]) => toScreen(x, y));
            const lit = kind === 'tour' && i === this.featured ? spot : 0;
            if (c.at === 'pole') poleLit = lit;
            const drawn = clamp01(since / 2.5) * c.lines.length;
            c.lines.forEach(([a, b], k) => {
                this.dashTo(pts[a], pts[b], HEX.cyan, 0.14 * sky);
                if (lit) this.dashTo(pts[a], pts[b], HEX.ice, 0.75 * lit, clamp01(drawn - k));
            });
            pts.forEach(([x, y], k) => {
                const color = HEX[c.bright?.[k] ?? 'white'];
                this.plot(x, y, color, sky);
                this.sparkle(x, y, color, (c.bright?.[k] ? 0.8 : 0.3 + 0.5 * lit) * sky);
            });
            const top = pts.reduce((m, p) => (p[1] < m[1] ? p : m));
            const [cx] = toScreen(...pattern.centre);
            pattern.label.setPosition(Math.round(cx), Math.round(top[1] - 8)).setAlpha(this.visible(cx, top[1] - 8) ? lit : 0);
        });

        // Polaris stays put at the pole.
        this.plot(POLE.x, POLE.y, HEX.white, sky);
        this.sparkle(POLE.x, POLE.y, HEX.ice, 0.9 * sky);
        this.polaris.setAlpha(0.45 * sky * (1 - poleLit));

        const planetAlpha = sky * (kind === 'galaxy' ? 1 - env : 1);
        for (const planet of this.planets) {
            const [x, y] = toScreen(...planet.at);
            planet.image.setPosition(Math.round(x), Math.round(y)).setVisible(this.visible(x, y, 6)).setAlpha(planetAlpha);
        }

        if (kind === 'aurora') this.aurora(t, env);
        else if (kind === 'meteors') this.shower(s, env);
        else if (kind === 'comet') this.comet(t / seconds, env);
        else if (kind === 'galaxy') this.andromeda(t, env);
        else if (kind === 'supernova') this.supernova(t, env);
        else if (kind === 'warp') this.warpSpeed(s, env);
        if (kind === 'tour' && !this.still) {
            this.nextMeteor -= s;
            if (this.nextMeteor <= 0) {
                const a = Phaser.Math.FloatBetween(0.3, 0.9) * (Math.random() < 0.5 ? 1 : -1);
                const speed = Phaser.Math.Between(180, 260);
                this.meteors.push({
                    x: Phaser.Math.Between(-150, 150), y: Phaser.Math.Between(-90, -30),
                    vx: Math.sin(a) * speed, vy: Math.cos(a) * speed * 0.6, life: 0.6, len: 16,
                });
                this.nextMeteor = Phaser.Math.FloatBetween(4, 10);
            }
        }
        this.flyMeteors(s);
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
        for (let i = 0; i < 1100; i++) {
            const r = 260 * Math.sqrt(rnd.frac());
            const a = rnd.frac() * Math.PI * 2;
            const mag = rnd.frac() ** 2;
            this.stars.push({
                x: Math.cos(a) * r,
                y: Math.sin(a) * r,
                color: HEX[STAR_COLORS[rnd.between(0, STAR_COLORS.length - 1)]],
                alpha: 0.2 + mag * 0.8,
                size: mag > 0.93 ? 2 : 1,
                phase: rnd.frac() * Math.PI * 2,
                speed: 1 + rnd.frac() * 3,
            });
        }

        // The Milky Way: a soft, lumpy band of faint light across the sky, with a few dark dust lanes.
        this.milkyWay = [];
        const dir = [Math.cos(1.1), Math.sin(1.1)];
        const normal = [-dir[1], dir[0]];
        for (let i = 0; i < 1800; i++) {
            const t = (rnd.frac() * 2 - 1) * 270;
            const spread = (rnd.frac() + rnd.frac() + rnd.frac() - 1.5) * 26 * (1 + 0.4 * Math.sin(t / 30));
            const off = 30 + spread + 8 * Math.sin(t / 45);
            if (Math.abs(spread - 6 * Math.sin(t / 20)) < 3 && rnd.frac() < 0.8) continue;
            const pick = rnd.frac();
            this.milkyWay.push({
                x: dir[0] * t + normal[0] * off,
                y: dir[1] * t + normal[1] * off,
                color: HEX[pick < 0.4 ? 'plum' : pick < 0.75 ? 'violet' : pick < 0.9 ? 'steel' : pick < 0.97 ? 'ice' : 'pink'],
                alpha: 0.3 + rnd.frac() * 0.35 * (1 - Math.abs(spread) / 40),
                size: 1,
                phase: 0,
                speed: 0,
            });
        }

        this.patterns = CONSTELLATIONS.map((c, i) => {
            const n = c.stars.length;
            let dx = -c.stars[0][0], dy = -c.stars[0][1];
            if (c.at !== 'pole') {
                const a = (c.at[0] * Math.PI) / 180;
                dx = Math.cos(a) * c.at[1] - c.stars.reduce((sum, [x]) => sum + x, 0) / n;
                dy = Math.sin(a) * c.at[1] - c.stars.reduce((sum, [, y]) => sum + y, 0) / n;
            }
            const pts = c.stars.map(([x, y]) => [x + dx, y + dy] as [number, number]);
            const key = addPixels(this, `starshow-label-${i}`, label(c.name, 'ice'));
            addPixels(this, `starshow-caption-${i}`, captionArt(`TONIGHT'S SKY: ${c.name}`, c.caption));
            return {
                pts,
                centre: [pts.reduce((sum, [x]) => sum + x, 0) / n, pts.reduce((sum, [, y]) => sum + y, 0) / n] as [number, number],
                label: this.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(2).setAlpha(0),
            };
        });
        this.polaris = this.add.image(POLE.x, POLE.y - 5, addPixels(this, 'starshow-polaris', label('POLARIS', 'mist')))
            .setOrigin(0.5, 1).setDepth(2);

        this.planets = [
            { key: 'starshow-moon', art: moonArt(), at: 178, d: 104 },
            { key: 'starshow-saturn', art: saturnArt(), at: 58, d: 160 },
            { key: 'starshow-jupiter', art: jupiterArt(), at: 345, d: 92 },
            { key: 'starshow-mars', art: new PixelCanvas(3, 3).rect(0, 0, 3, 3, 'orange').set(0, 0, 'peach').set(2, 2, 'red'), at: 240, d: 196 },
        ].map(({ key, art, at, d }) => {
            const a = (at * Math.PI) / 180;
            return {
                image: this.add.image(0, 0, addPixels(this, key, art)).setDepth(2),
                at: [Math.cos(a) * d, Math.sin(a) * d] as [number, number],
            };
        });

        // Andromeda: two spiral arms of blue-white stars round a warm, dense core.
        this.galaxy = [];
        for (let i = 0; i < 1100; i++) {
            const core = i < 260;
            const arm = i % 2;
            const u = core ? rnd.frac() ** 2 * 0.25 : rnd.frac();
            const pick = rnd.frac();
            this.galaxy.push({
                a: core ? rnd.frac() * Math.PI * 2 : arm * Math.PI + u * 3.4 * Math.PI + (rnd.frac() - 0.5) * 0.7,
                r: u * 52 + (rnd.frac() - 0.5) * 5,
                color: HEX[core ? (pick < 0.5 ? 'cream' : pick < 0.8 ? 'yellow' : 'white')
                    : pick < 0.35 ? 'ice' : pick < 0.6 ? 'cyan' : pick < 0.8 ? 'violet' : pick < 0.92 ? 'pink' : 'white'],
                alpha: core ? 0.7 + rnd.frac() * 0.3 : 0.25 + rnd.frac() * 0.6 * (1 - u * 0.6),
            });
        }
        this.remnant = Array.from({ length: 320 }, () => {
            const pick = rnd.frac();
            return {
                a: rnd.frac() * Math.PI * 2,
                r: 0.35 + rnd.frac() ** 0.6 * 0.65,
                color: HEX[pick < 0.3 ? 'pink' : pick < 0.55 ? 'orange' : pick < 0.8 ? 'violet' : 'cyan'],
                alpha: 0.3 + rnd.frac() * 0.5,
            };
        });
        this.warp = Array.from({ length: 240 }, () => {
            const pick = rnd.frac();
            return { a: rnd.frac() * Math.PI * 2, d: 2 + rnd.frac() * 120, color: HEX[pick < 0.6 ? 'white' : pick < 0.85 ? 'ice' : 'violet'] };
        });
    }

    /** Curtains of light rippling over the horizon. */
    private aurora(t: number, env: number) {
        const ramp: [number, number, number][] = [[HEX.lime, 0, 0.12], [HEX.grass, 0.12, 0.35], [HEX.cyan, 0.35, 0.6], [HEX.violet, 0.6, 0.85], [HEX.plum, 0.85, 1]];
        const g = this.gfx;
        for (let x = -196; x <= 196; x++) {
            const top = DOME.y - Math.sqrt(Math.max(0, DOME.r ** 2 - x * x)) + 3;
            const fold = Math.sin(x / 23 + t * 0.7) + 0.5 * Math.sin(x / 9 - t * 1.3) + 0.3 * Math.sin(x / 4 + t * 2.1);
            const base = HORIZON - 14 - 10 * Math.sin(x / 50 + t * 0.4) - 4 * fold;
            const h = 34 + 22 * Math.sin(x / 31 - t * 0.5) + 8 * fold;
            const bright = env * clamp01(0.3 + 0.25 * fold + 0.25 * Math.sin(x / 6 + t * 3.1));
            if (bright <= 0.02) continue;
            for (const [color, from, to] of ramp) {
                const y0 = Math.max(top, Math.round(base - h * to));
                const y1 = Math.round(base - h * from);
                if (y1 <= y0) continue;
                g.fillStyle(color, bright * (1 - from * 0.8) * 0.75).fillRect(x, y0, 1, y1 - y0);
            }
        }
    }

    /** The Perseids: streaks fanning out from one point in the sky. */
    private shower(s: number, env: number) {
        if (this.still) return;
        const radiant = { x: 70, y: -78 };
        this.plot(radiant.x, radiant.y, HEX.ice, 0.4 * env);
        let n = s * 9 * env;
        while (n > 0) {
            if (Math.random() < n) {
                const a = Math.random() * Math.PI * 2;
                const start = 6 + Math.random() * 40;
                const speed = 140 + Math.random() * 140;
                this.meteors.push({
                    x: radiant.x + Math.cos(a) * start, y: radiant.y + Math.sin(a) * start,
                    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                    life: 0.35 + Math.random() * 0.45, len: 8 + Math.random() * 14,
                });
            }
            n -= 1;
        }
    }

    private flyMeteors(s: number) {
        for (const m of this.meteors) {
            m.x += m.vx * s;
            m.y += m.vy * s;
            m.life -= s;
            const speed = Math.hypot(m.vx, m.vy);
            const fade = Math.min(1, m.life / 0.25);
            for (let i = 0; i < m.len; i++) {
                this.plot(m.x - (m.vx / speed) * i, m.y - (m.vy / speed) * i, i < 2 ? HEX.white : i < m.len / 2 ? HEX.ice : HEX.cyan, fade * (1 - i / m.len));
            }
        }
        this.meteors = this.meteors.filter((m) => m.life > 0);
    }

    /** A comet drifting across the dome, its two tails streaming away from the sun below the horizon. */
    private comet(u: number, env: number) {
        const hx = -160 + 300 * u;
        const hy = 30 - 72 * Math.sin(Math.PI * u);
        // The sun is down below the horizon to the lower left, so the tails stream up and to the right.
        let dx = hx + 320, dy = hy - 150;
        const d = Math.hypot(dx, dy);
        dx /= d;
        dy /= d;
        const flick = Math.floor(this.clock * 10);
        // Ion tail: straight and blue.
        for (let i = 0; i < 80; i++) {
            const k = i / 80;
            const w = Math.floor(i / 30);
            for (let j = -w; j <= w; j++) {
                const a = env * (1 - k) * (j ? 0.45 : 0.95) * (0.7 + 0.3 * hash(i, j, flick));
                this.plot(hx + dx * i - dy * j, hy + dy * i + dx * j, i < 10 ? HEX.ice : HEX.cyan, a);
            }
        }
        // Dust tail: wider, curving, and gold.
        for (let i = 0; i < 64; i++) {
            const k = i / 64;
            const bend = i * i * 0.006;
            const w = Math.floor(i / 10);
            for (let j = -w; j <= w; j++) {
                const a = env * (1 - k) * 0.7 * (1 - Math.abs(j) / (w + 1)) * (0.6 + 0.4 * hash(i, j, flick + 1));
                const ox = j + bend;
                this.plot(hx + dx * i - dy * ox, hy + dy * i + dx * ox, i < 8 ? HEX.cream : HEX.gold, a);
            }
        }
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
            const r = Math.hypot(i, j);
            if (r <= 2.3) this.plot(hx + i, hy + j, r < 1 ? HEX.white : HEX.ice, env * (r < 1 ? 1 : 0.5));
        }
    }

    /** The Andromeda galaxy swims up out of the dark and slowly turns. */
    private andromeda(t: number, env: number) {
        const cx = 100, cy = -34;
        const grow = 1 - (1 - clamp01(t / 5)) ** 3;
        const scale = 0.25 + 0.75 * grow;
        const tilt = -0.45, tc = Math.cos(tilt), ts = Math.sin(tilt);
        for (const p of this.galaxy) {
            const a = p.a + t * 0.35 * (1.3 - p.r / 60);
            const lx = Math.cos(a) * p.r * scale;
            const ly = Math.sin(a) * p.r * scale * 0.4;
            this.plot(cx + lx * tc - ly * ts, cy + lx * ts + ly * tc, p.color, p.alpha * env);
        }
        this.plot(cx, cy, HEX.white, env);
        this.sparkle(cx, cy, HEX.yellow, env * 0.8);
    }

    /** A star swells, flashes, and blows a glowing shell out into space, leaving a pulsar spinning at its heart. */
    private supernova(t: number, env: number) {
        const cx = -80, cy = -58;
        const boom = 3.5;
        if (t < boom) {
            const grow = t / boom;
            const r = Math.round(grow * 3);
            const wobble = 0.6 + 0.4 * Math.sin(t * (6 + grow * 20));
            for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
                if (Math.hypot(i, j) <= r + 0.3) this.plot(cx + i, cy + j, grow > 0.6 ? HEX.white : HEX.peach, wobble * env);
            }
            this.sparkle(cx, cy, HEX.yellow, env);
            return;
        }
        if (!this.flashed) {
            this.flashed = true;
            if (!this.still) {
                this.cameras.main.flash(350, 255, 240, 220);
                this.cameras.main.shake(250, 0.004);
            }
        }
        const u = t - boom;
        const r = 4 + 70 * (1 - Math.exp(-u / 2.6));
        const fresh = Math.exp(-u / 2);
        const n = Math.round(Math.PI * 2 * r);
        for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const jitter = (hash(k, 0, 7) - 0.5) * (2 + r * 0.06);
            const color = [HEX.white, HEX.yellow, HEX.orange, HEX.pink, HEX.cyan][Math.min(4, Math.floor(u * 0.8 + hash(k, 1, 7) * 2))];
            this.plot(cx + Math.cos(a) * (r + jitter), cy + Math.sin(a) * (r + jitter) * 0.92, color, env * (0.55 + 0.45 * fresh));
            if (hash(k, 2, 7) < 0.5) this.plot(cx + Math.cos(a) * (r + jitter - 2), cy + Math.sin(a) * (r + jitter - 2) * 0.92, color, env * 0.35);
        }
        for (const p of this.remnant) {
            const rr = p.r * r * 0.85;
            this.plot(cx + Math.cos(p.a) * rr, cy + Math.sin(p.a) * rr * 0.92, p.color, p.alpha * env * clamp01(u / 1.5));
        }
        const flare = 3 * fresh;
        for (let i = -Math.round(flare * 6); i <= Math.round(flare * 6); i++) {
            this.plot(cx + i, cy, HEX.white, env * fresh);
            this.plot(cx, cy + i, HEX.white, env * fresh);
        }
        const pulse = Math.sin(this.clock * 26) > 0.4;
        this.plot(cx, cy, HEX.white, env);
        if (pulse) this.sparkle(cx, cy, HEX.ice, env);
    }

    /** Stars stream out of the middle of the dome as the room jumps to light speed. */
    private warpSpeed(s: number, env: number) {
        const cx = 0, cy = -24;
        const speed = env * env * 2.6;
        for (const w of this.warp) {
            w.d += (w.d * speed + 10 * env) * s;
            if (w.d > 240) w.d = 2 + Math.random() * 18;
            const len = Math.min(26, w.d * speed * 0.12);
            const dx = Math.cos(w.a), dy = Math.sin(w.a);
            const a = clamp01(w.d / 60) * env;
            for (let i = 0; i <= len; i++) this.plot(cx + dx * (w.d + i), cy + dy * (w.d + i), w.color, a * (0.4 + 0.6 * (i / Math.max(1, len))));
        }
        this.plot(cx, cy, HEX.white, env);
        this.sparkle(cx, cy, HEX.violet, env * 0.6);
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

    /** A star-chart line between two stars, stopping short of each and drawn every other pixel; `upTo` draws only part of it. */
    private dashTo([x0, y0]: [number, number], [x1, y1]: [number, number], color: number, alpha: number, upTo = 1) {
        if (alpha <= 0.02 || upTo <= 0) return;
        const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
        for (let i = 3; i <= n - 3; i++) {
            if (i % 2 || i / n > upTo) continue;
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

/** The narrator's caption: a dark plate with a gold title over a few lines of text. */
function captionArt(title: string, text: string): PixelCanvas {
    const lines = wrapWords(text, 46);
    const w = Math.max(miniTextWidth(title), ...lines.map(miniTextWidth)) + 10;
    const pc = new PixelCanvas(w, lines.length * 7 + 15);
    pc.rect(0, 0, w, pc.height, 'plum').rect(1, 1, w - 2, pc.height - 2, 'ink');
    miniText(pc, Math.floor((w - miniTextWidth(title)) / 2), 4, title, 'gold');
    lines.forEach((line, i) => miniText(pc, Math.floor((w - miniTextWidth(line)) / 2), 12 + i * 7, line, 'cream'));
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
