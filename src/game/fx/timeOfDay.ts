/**
 * The day/night clock. t runs 0 → 1 once per loop: dawn at 0, bright day around 0.35, sunset around 0.62,
 * deep night 0.76–0.95, then dawn again. Every look is a keyframe; in between they blend smoothly.
 */

export const DAY_LOOP_SECONDS = 360;

/** Named times for `?time=` and the T key. */
export const NAMED_TIMES: Record<string, number> = {
    dawn: 0.015,
    morning: 0.09,
    day: 0.33,
    noon: 0.33,
    afternoon: 0.5,
    sunset: 0.615,
    dusk: 0.655,
    night: 0.84,
    midnight: 0.84,
};

export interface Sky {
    /** Multiply colour for everything in the world (0..1 per channel). */
    ambient: [number, number, number];
    /** 0 = full day, 1 = full night: drives lamps, windows, fireflies. */
    night: number;
    /** Warm haze added over everything (golden hours). */
    haze: [number, number, number];
    hazeAlpha: number;
    vignette: number;
    vignetteColor: [number, number, number];
    /** Sun shafts and dust motes. */
    rays: number;
    rayColor: [number, number, number];
    /** Cloud shadow strength. */
    clouds: number;
    /** Moonlight wash (top-left), stars. */
    moon: number;
    /** Low sun glow raking across the town (rayColor), from the east (+1, mornings) or west (-1). */
    sun: number;
    sunSide: number;
    /** Split-tone grade over the final image: saturation, per-channel gain, a lift for darks and a push for brights. */
    sat: number;
    gain: V3;
    shadow: V3;
    hi: V3;
}

type V3 = [number, number, number];
const G = (sat: number, gain: V3, shadow: V3, hi: V3) => ({ sat, gain, shadow, hi });

type Key = [t: number, sky: Sky];

const rgb = (hex: number): [number, number, number] => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];

const k = (t: number, ambient: number, night: number, haze: number, hazeAlpha: number, vignette: number, vignetteColor: number,
    rays: number, rayColor: number, clouds: number, moon: number, sun: number, grade: ReturnType<typeof G>): Key => [t, {
    ambient: rgb(ambient), night, haze: rgb(haze), hazeAlpha, vignette, vignetteColor: rgb(vignetteColor),
    rays, rayColor: rgb(rayColor), clouds, moon, sun, sunSide: 1, ...grade,
}];

// Cool lifts in the shadows, warm pushes in the highlights: contrast instead of a flat tint.
const DAY = G(1.06, [1, 1, 1], [0, 0, 0.02], [0.01, 0.005, -0.01]);
const GOLD = G(1.12, [1, 1, 1], [0, 0.01, 0.05], [0.05, 0.02, -0.04]);
const NIGHT = G(1.1, [0.96, 1, 1.04], [-0.02, 0, 0.06], [0.06, 0.03, -0.03]);

const KEYS: Key[] = [
    //  t      ambient   night haze      hA     vig   vigColor  rays rayColor  clouds moon  sun   grade
    k(0.000, 0xc8a0b8, 0.50, 0xffa0bc, 0.120, 0.48, 0x2a1440, 0.35, 0xffa898, 0.10, 0.20, 0.60, G(1.12, [1, 0.97, 0.98], [0, 0.03, 0.09], [0.06, 0.02, -0.02])), // dawn: rose mist
    k(0.045, 0xecbc9c, 0.15, 0xffa060, 0.080, 0.38, 0x3a1a20, 0.90, 0xffc080, 0.45, 0.00, 0.60, GOLD), // golden morning
    k(0.120, 0xfde4c4, 0.00, 0xffc890, 0.040, 0.30, 0x40281c, 0.70, 0xffe0a8, 0.65, 0.00, 0.20, G(1.08, [1, 1, 1], [0, 0, 0.03], [0.02, 0.01, -0.02])),
    k(0.220, 0xfff6e8, 0.00, 0xfff0d0, 0.020, 0.24, 0x3a2a20, 0.45, 0xfff2d0, 0.80, 0.00, 0.00, DAY), // bright day
    k(0.460, 0xfff4e2, 0.00, 0xfff0d0, 0.020, 0.24, 0x3a2a20, 0.45, 0xfff2d0, 0.80, 0.00, 0.00, DAY),
    k(0.560, 0xffd8a8, 0.00, 0xffa850, 0.060, 0.32, 0x3c2014, 0.90, 0xffc070, 0.60, 0.00, 0.35, GOLD), // golden afternoon
    k(0.615, 0xf0a080, 0.25, 0xff6038, 0.100, 0.45, 0x3a0c24, 0.70, 0xff8a48, 0.35, 0.00, 0.85, G(1.15, [1.02, 0.97, 0.95], [-0.02, 0.02, 0.10], [0.08, 0.02, -0.05])), // sunset
    k(0.660, 0x9c94b4, 0.66, 0xd0509a, 0.050, 0.55, 0x180c34, 0.10, 0xff7050, 0.15, 0.35, 0.75, G(1.25, [0.98, 0.98, 1.02], [-0.03, 0.04, 0.13], [0.11, 0.03, -0.07])), // dusk
    k(0.720, 0x3848a0, 0.94, 0x1c2472, 0.120, 0.58, 0x080a26, 0.00, 0x000000, 0.00, 0.85, 0.00, NIGHT),
    k(0.780, 0x34449e, 1.00, 0x1c2472, 0.120, 0.60, 0x060820, 0.00, 0x000000, 0.00, 1.00, 0.00, NIGHT), // deep blue night
    k(0.930, 0x34449e, 1.00, 0x1c2472, 0.120, 0.60, 0x060820, 0.00, 0x000000, 0.00, 1.00, 0.00, NIGHT),
    k(0.965, 0x6060ac, 0.85, 0x6048b0, 0.120, 0.56, 0x140c30, 0.05, 0xff90a0, 0.05, 0.70, 0.25, G(1.2, [1, 1, 1.02], [-0.02, 0.01, 0.08], [0.06, 0.02, -0.02])), // first light
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
    [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function skyAt(t: number): Sky {
    t = ((t % 1) + 1) % 1;
    let i = KEYS.length - 1;
    for (let j = 0; j < KEYS.length; j++) if (KEYS[j][0] <= t) i = j;
    const [t0, a] = KEYS[i];
    const [t1raw, b] = KEYS[(i + 1) % KEYS.length];
    const t1 = t1raw <= t0 ? t1raw + 1 : t1raw;
    const span = t1 - t0;
    let f = span > 0 ? (t - t0) / span : 0;
    f = f * f * (3 - 2 * f);
    return {
        ambient: lerp3(a.ambient, b.ambient, f),
        night: lerp(a.night, b.night, f),
        haze: lerp3(a.haze, b.haze, f),
        hazeAlpha: lerp(a.hazeAlpha, b.hazeAlpha, f),
        vignette: lerp(a.vignette, b.vignette, f),
        vignetteColor: lerp3(a.vignetteColor, b.vignetteColor, f),
        rays: lerp(a.rays, b.rays, f),
        rayColor: lerp3(a.rayColor, b.rayColor, f),
        clouds: lerp(a.clouds, b.clouds, f),
        moon: lerp(a.moon, b.moon, f),
        sun: lerp(a.sun, b.sun, f),
        sunSide: t < 0.3 || t > 0.9 ? 1 : -1,
        sat: lerp(a.sat, b.sat, f),
        gain: lerp3(a.gain, b.gain, f),
        shadow: lerp3(a.shadow, b.shadow, f),
        hi: lerp3(a.hi, b.hi, f),
    };
}

/** `?time=night|dusk|dawn|day|…` or `?time=0..1` freezes the clock. Returns undefined when absent. */
export function frozenTime(search = location.search): number | undefined {
    const raw = new URLSearchParams(search).get('time');
    if (raw === null) return undefined;
    const named = NAMED_TIMES[raw.toLowerCase()];
    if (named !== undefined) return named;
    const n = Number(raw);
    return Number.isFinite(n) ? ((n % 1) + 1) % 1 : undefined;
}

export const toHex = (c: [number, number, number]) =>
    (Math.round(Math.min(1, Math.max(0, c[0])) * 255) << 16) | (Math.round(Math.min(1, Math.max(0, c[1])) * 255) << 8) | Math.round(Math.min(1, Math.max(0, c[2])) * 255);

const W = [0.299, 0.587, 0.114];

/** The grade as a Phaser ColorMatrix (4x5, offsets in 0..255): out = gain·saturate(in) + shadow·(1-L) + hi·L. */
export function gradeMatrix(sky: Sky): number[] {
    const m: number[] = [];
    for (let c = 0; c < 3; c++) {
        for (let j = 0; j < 3; j++) {
            const sat = (1 - sky.sat) * W[j] + (c === j ? sky.sat : 0);
            m.push(sky.gain[c] * sat + (sky.hi[c] - sky.shadow[c]) * W[j]);
        }
        m.push(0, sky.shadow[c] * 255);
    }
    m.push(0, 0, 0, 1, 0);
    return m;
}
