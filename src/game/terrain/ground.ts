import { bayer, fbm, hash, toU32, valueNoise, PixelCanvas, type Color } from '../kit';
import { FORECOURT, FOUNTAIN, KEEP_CLEAR, MEADOWS, PATHS, PLAZA, POND, PORTAL, SIDEWALK, TREES, type Area, type Box, type PathSpec } from './layout';

/**
 * The town's ground, painted once into one big texture: meadow grass with sunlit and shady patches,
 * tufts, clover and wildflowers; a cobbled plaza ring with a flower garden in the middle; dirt lanes
 * with grassy edges; sandstone and concrete aprons in front of the buildings; and a pond.
 */

/** Grass ramp: ATV-32 greens with a half-step between each pair, so big tonal patches stay soft. */
export const GREENS = ['#1e3d36', '#2c6a4a', '#358250', '#3e9a4f', '#55ad4d', '#6cbf4b', '#8ccf50', '#b4e05a'] as const;
const G = GREENS.map((c) => toU32(c));

const U = (c: Color) => toU32(c);

// Materials.
const GRASS = 0, DIRT = 1, COBBLE = 2, FLAG = 3, SANDSTONE = 4, WATER = 5, BANK = 6, SOIL = 7, SCORCH = 8, LANE = 9;
const STONY = (m: number) => m === COBBLE || m === FLAG || m === SANDSTONE || m === LANE;
const PAVED = (m: number) => m !== GRASS && m !== WATER && m !== BANK;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (t: number) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
};

/** Large-scale meadow tone (a continuous index into GREENS) at a world point. */
function meadowTone(x: number, y: number, TOWN: Box): number {
    const big = fbm(x, y, 260, 11, 3);
    const mid = fbm(x, y, 72, 23, 3);
    let L = 4.7 + (big - 0.5) * 3.3 + (mid - 0.5) * 1.1;
    // Tree shade.
    for (const t of TREES) {
        const dx = (x - t.x) / 30, dy = (y - t.y - 2) / 14;
        const d = dx * dx + dy * dy;
        if (d < 4) L -= 1.25 * Math.exp(-d * 1.4);
    }
    // Contact shade along building bases.
    for (const r of KEEP_CLEAR) {
        if (x < r.x0 + 4 || x > r.x1 - 4) continue;
        const below = y - (r.y1 - 6);
        if (below >= 0 && below < 12) L -= 0.9 * (1 - below / 12);
    }
    // Outside town the meadow deepens, framing the town like a clearing.
    const ox = Math.max(TOWN.left - x, x - TOWN.right, 0);
    const oy = Math.max(TOWN.top - y, y - TOWN.bottom, 0);
    const out = Math.hypot(ox, oy) + (fbm(x, y, 40, 37, 2) - 0.5) * 60;
    // Far out it settles to the outskirts tile's tone, so the painted ground melts into it.
    if (out > 0) {
        const w = smooth(out / 200);
        L = L * (1 - w) + (3.1 + (mid - 0.5) * 0.8) * w;
    }
    return L;
}

/** Pick a GREENS index from a continuous tone: solid bands with narrow ordered-dither seams. */
const quant = (L: number, x: number, y: number) => {
    const b = Math.floor(L);
    const f = clamp((L - b - 0.5) * 2.4 + 0.5, 0, 1);
    return Math.min(7, b + (f > bayer(x, y) ? 1 : 0));
};

type Pt = readonly [number, number];

/** Points along a Catmull-Rom spline through `pts`, about one per pixel. */
export function spline(pts: readonly Pt[]): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 1.4);
        for (let k = 0; k < n; k++) {
            const t = k / n, t2 = t * t, t3 = t2 * t;
            const f = (a: number, b: number, c: number, d: number) =>
                0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
            out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
    }
    out.push(pts[pts.length - 1]);
    return out;
}

export interface GroundArt {
    canvas: PixelCanvas;
    /** Material per pixel (row-major over GROUND), for placing decor. */
    isGrass: (wx: number, wy: number) => boolean;
    isWater: (wx: number, wy: number) => boolean;
}

/** Lily pads on the pond, relative to its centre. `f` = has a flower. */
export const LILIES = [
    { x: -44, y: 8, f: true }, { x: -36, y: 14, f: false }, { x: -52, y: 15, f: false },
    { x: 24, y: -6, f: false }, { x: 34, y: 2, f: true }, { x: 46, y: -4, f: false },
    { x: 6, y: 18, f: false }, { x: -10, y: -12, f: false },
] as const;

/** A round cobbled court (like the fountain's); `garden` plants a flower bed in its middle. */
export interface Court {
    x: number;
    y: number;
    r: number;
    garden?: boolean;
}

/** Ground features that depend on where teammates' buildings ended up (the town's park, lanes to its roads). */
export interface Extras {
    paths: PathSpec[];
    courts: Court[];
}

export function paintGround(GROUND: Area, TOWN: Box, extra: Extras = { paths: [], courts: [] }): GroundArt {
    const W = GROUND.w, H = GROUND.h, X0 = GROUND.x, Y0 = GROUND.y;
    const N = W * H;
    const pc = new PixelCanvas(W, H);
    const px = pc.px;
    const mat = new Uint8Array(N);
    const sid = new Int32Array(N);
    const tone = new Uint8Array(N);

    // Paths: a signed distance field (px from the path edge) built by stamping discs along each spline.
    const sd = new Float32Array(N).fill(99);
    const pkind = new Uint8Array(N);
    const pfade = new Float32Array(N);
    const COURTS: Court[] = [FOUNTAIN, ...extra.courts];
    [...PATHS, ...extra.paths].forEach((p) => {
        const r = Math.ceil(p.hw + 4);
        const pts = spline(p.points);
        pts.forEach(([cx, cy], n) => {
            // Lanes that wander off into the meadow get patchy and crumble away into the grass.
            const left = (pts.length - 1 - n) / pts.length;
            const fade = p.fade ? clamp((0.35 - left) / 0.35, 0, 1) : 0;
            const hw = p.hw * (1 - fade * 0.3);
            const ix = Math.round(cx - X0), iy = Math.round(cy - Y0);
            for (let j = -r; j <= r; j++) {
                const y = iy + j;
                if (y < 0 || y >= H) continue;
                for (let i = -r; i <= r; i++) {
                    const x = ix + i;
                    if (x < 0 || x >= W) continue;
                    const d = Math.hypot(x + X0 + 0.5 - cx, y + Y0 + 0.5 - cy) - hw;
                    const k = y * W + x;
                    if (d < sd[k]) {
                        sd[k] = d;
                        pkind[k] = p.kind === 'cobble' ? LANE : DIRT;
                        pfade[k] = fade;
                    }
                }
            }
        });
    });

    // Pass 1: what each pixel is.
    for (let y = 0; y < H; y++) {
        const wy = y + Y0 + 0.5;
        for (let x = 0; x < W; x++) {
            const wx = x + X0 + 0.5;
            const k = y * W + x;
            let m = GRASS;
            let id = 0;

            const pdx = (wx - POND.x) / POND.rx, pdy = (wy - POND.y) / POND.ry;
            if (pdx > -1.4 && pdx < 1.4 && pdy > -1.5 && pdy < 1.5) {
                const rp = Math.hypot(pdx, pdy) + (fbm(wx, wy, 26, 51, 2) - 0.5) * 0.24;
                if (rp < 1) m = WATER;
                else if (rp < 1.1) m = BANK;
            }
            if (m === GRASS && wx >= SIDEWALK.x0 && wx < SIDEWALK.x1 && wy >= SIDEWALK.y0 && wy < SIDEWALK.y1) {
                // Corners rounded off a little.
                const cx = Math.max(SIDEWALK.x0 + 4 - wx, wx - (SIDEWALK.x1 - 4), 0);
                const cy = Math.max(wy - (SIDEWALK.y1 - 4), 0);
                if (Math.hypot(cx, cy) < 4.2) {
                    m = FLAG;
                    const row = Math.floor((wy - SIDEWALK.y0) / 8);
                    id = 3e6 + row * 1000 + Math.floor((wx - SIDEWALK.x0 + (row % 2) * 8) / 16);
                }
            }
            if (m === GRASS && wx >= FORECOURT.x0 - 4 && wx < FORECOURT.x1 + 4 && wy >= FORECOURT.y0 && wy < FORECOURT.y1 + 4) {
                const cx = Math.max(FORECOURT.x0 + 6 - wx, wx - (FORECOURT.x1 - 6), 0);
                const cy = Math.max(wy - (FORECOURT.y1 - 6), 0);
                if (Math.hypot(cx, cy) < 6.5) {
                    m = SANDSTONE;
                    const row = Math.floor((wy - FORECOURT.y0) / 7);
                    const off = Math.floor(hash(row, 3, 9) * 16);
                    id = 4e6 + row * 1000 + Math.floor((wx - FORECOURT.x0 + off) / 16);
                }
            }
            if (m === GRASS && Math.abs(wx - PLAZA.x) < PLAZA.outer && Math.abs(wy - PLAZA.y) * 2 < PLAZA.outer) {
                const dx = wx - PLAZA.x, dy = (wy - PLAZA.y) * 2;
                const rr = Math.hypot(dx, dy);
                if (rr < PLAZA.outer) {
                    const th = Math.atan2(dy, dx);
                    if (rr >= PLAZA.outer - 6) {
                        m = COBBLE;
                        id = 1e6 + Math.floor((th + Math.PI) * PLAZA.outer / 13);
                    } else if (rr >= PLAZA.inner + 5) {
                        m = COBBLE;
                        const course = Math.floor((rr - PLAZA.inner - 5) / 6.4);
                        const mid = PLAZA.inner + 5 + (course + 0.5) * 6.4;
                        id = 1.1e6 + course * 4000 + Math.floor((th + Math.PI) * mid / 8 + course * 0.5);
                    } else if (rr >= PLAZA.inner) {
                        m = COBBLE;
                        id = 1.5e6 + Math.floor((th + Math.PI) * PLAZA.inner / 11);
                    } else if (rr >= 34 && rr < 46) {
                        m = SOIL;
                    }
                }
            }
            for (let ci = 0; m === GRASS && ci < COURTS.length; ci++) {
                const c = COURTS[ci];
                if (Math.abs(wx - c.x) >= c.r || Math.abs(wy - c.y) * 2 >= c.r) continue;
                const dx = wx - c.x, dy = (wy - c.y) * 2;
                const rr = Math.hypot(dx, dy);
                if (rr >= c.r) continue;
                const th = Math.atan2(dy, dx);
                const base = 2.5e6 + ci * 1e5;
                if (c.garden && rr < c.r * 0.42) {
                    m = rr < c.r * 0.42 - 4 ? SOIL : COBBLE;
                    id = base + Math.floor((th + Math.PI) * c.r * 0.42 / 9);
                } else if (rr >= c.r - 6) {
                    m = COBBLE;
                    id = base + Math.floor((th + Math.PI) * c.r / 12);
                } else {
                    m = COBBLE;
                    const course = Math.floor(rr / 6.4);
                    const mid = (course + 0.5) * 6.4;
                    id = base + 5e4 + course * 4000 + Math.floor((th + Math.PI) * mid / 8 + course * 0.5);
                }
            }
            if (m === GRASS && Math.abs(wx - PORTAL.x) < PORTAL.rx * 1.3 && Math.abs(wy - PORTAL.y) < PORTAL.ry * 1.3) {
                const dx = (wx - PORTAL.x) / PORTAL.rx, dy = (wy - PORTAL.y) / PORTAL.ry;
                if (dx * dx + dy * dy < 1.6) {
                    const r = Math.hypot(dx, dy) + (fbm(wx, wy, 6, 81, 2) - 0.5) * 0.5;
                    if (r < 1) m = SCORCH;
                }
            }
            if (m === GRASS && sd[k] < 4) {
                const kind = pkind[k];
                if (kind === LANE) {
                    if (sd[k] < 0) {
                        m = LANE;
                        const row = Math.floor(wy / 4);
                        id = 5e6 + (row & 1023) * 2048 + (Math.floor((wx + 800 + (row & 1) * 4) / 8) & 2047);
                    }
                } else {
                    const edge = (valueNoise(wx, wy, 4, 71) - 0.5) * 3.2 + (valueNoise(wx, wy, 14, 72) - 0.5) * 3;
                    const f = pfade[k];
                    if (sd[k] < edge && (f === 0 || valueNoise(wx, wy, 3.5, 73) * 0.8 + hash(x, y, 74) * 0.2 > f * 0.9 + 0.05)) m = DIRT;
                }
            }
            mat[k] = m;
            sid[k] = id;
        }
    }

    const M = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? GRASS : mat[y * W + x]);
    const S = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : sid[y * W + x]);

    // The meadow's broad tone is smooth, so sample it every 4 px and interpolate.
    const CW = Math.ceil(W / 4) + 2, CH = Math.ceil(H / 4) + 2;
    const coarse = new Float32Array(CW * CH);
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) coarse[j * CW + i] = meadowTone(X0 + i * 4, Y0 + j * 4, TOWN);
    const toneAt = (x: number, y: number) => {
        const fx = x / 4, fy = y / 4, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
        const a = coarse[j * CW + i], b = coarse[j * CW + i + 1], c = coarse[(j + 1) * CW + i], d = coarse[(j + 1) * CW + i + 1];
        return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };

    // Pass 2: colour.
    const C = {
        ink: U('ink'), night: U('night'), slate: U('slate'), steel: U('steel'), mist: U('mist'), cloud: U('cloud'), white: U('white'),
        bark: U('bark'), earth: U('earth'), wood: U('wood'), clay: U('clay'), sand: U('sand'), cream: U('cream'),
        navy: U('navy'), blue: U('blue'), sky: U('sky'), cyan: U('cyan'), ice: U('ice'),
        wine: U('wine'), red: U('red'), orange: U('orange'), gold: U('gold'), plum: U('plum'), violet: U('violet'),
    };
    const DUST = [C.earth, C.wood, C.clay, C.sand];
    for (let y = 0; y < H; y++) {
        const wy = y + Y0 + 0.5;
        for (let x = 0; x < W; x++) {
            const wx = x + X0 + 0.5;
            const k = y * W + x;
            const m = mat[k];
            if (m === GRASS || m === SOIL) {
                let L = toneAt(x, y) + (valueNoise(wx, wy, 5, 29) - 0.5) * 0.45;
                // The garden in the plaza is lush and sunlit.
                const pr = Math.hypot(wx - PLAZA.x, (wy - PLAZA.y) * 2);
                if (pr < PLAZA.inner) L = Math.max(L, 5.1) + 0.25;
                let t = quant(clamp(L, 1.05, 6.6), x, y);
                // Grass lip: the edge just below a path or plaza reads as the turf's front face.
                if (m === GRASS && PAVED(M(x, y - 1)) && M(x, y - 1) !== SOIL) t = Math.max(1, t - 1);
                tone[k] = t;
                if (m === SOIL) {
                    const up = M(x, y - 1) !== SOIL, down = M(x, y + 1) !== SOIL;
                    px[k] = up ? C.bark : down ? C.wood : (fbm(wx, wy, 5, 91, 2) > 0.55 ? C.wood : C.earth);
                    continue;
                }
                // Fine grain: short dark blades all through the meadow.
                const g = hash(x, y >> 1, 5);
                if (g < 0.05 && t > 1) t -= 1;
                else if (g > 0.985 && t < 7) t += 1;
                px[k] = G[t];
                continue;
            }
            if (m === WATER) {
                const above1 = M(x, y - 1) !== WATER, above2 = M(x, y - 2) !== WATER, above3 = M(x, y - 3) !== WATER;
                const below = M(x, y + 1) !== WATER;
                const side = M(x - 1, y) !== WATER || M(x + 1, y) !== WATER;
                if (above1) px[k] = C.earth;
                else if (above2) px[k] = C.bark;
                else if (above3) px[k] = C.navy;
                else if (below) px[k] = C.cyan;
                else if (side) px[k] = C.sky;
                else {
                    const rp = Math.hypot((wx - POND.x) / POND.rx, (wy - POND.y) / POND.ry) + (fbm(wx, wy, 18, 94, 2) - 0.5) * 0.3;
                    // Deep middle, lighter shallows; a few calm reflections of the sky.
                    const streak = valueNoise(wx * 0.25, wy * 2.2, 6, 93);
                    if (rp < 0.45) px[k] = clamp((0.38 - rp) * 9 + 0.5, 0, 1) > bayer(x, y) ? C.navy : C.blue;
                    else if (rp > 0.82) px[k] = (rp - 0.82) * 6 > bayer(x, y) ? C.sky : C.blue;
                    else px[k] = streak > 0.78 && rp > 0.55 ? C.sky : C.blue;
                }
                continue;
            }
            if (m === BANK) {
                const south = wy > POND.y + 4;
                const n = fbm(wx, wy, 4, 95, 2);
                if (M(x, y + 1) === WATER && !south) px[k] = C.wood;
                else if (south) px[k] = n > 0.56 ? C.cream : n > 0.38 ? C.sand : C.clay;
                else px[k] = n > 0.55 ? C.clay : n > 0.4 ? C.wood : C.earth;
                if (hash(x, y, 97) < 0.05) px[k] = C.mist;
                continue;
            }
            if (m === DIRT || m === SCORCH) {
                if (m === SCORCH) {
                    const r = Math.hypot((wx - PORTAL.x) / PORTAL.rx, (wy - PORTAL.y) / PORTAL.ry);
                    const n = fbm(wx, wy, 5, 83, 2);
                    let c = r < 0.55 ? C.ink : r < 0.8 ? (n > 0.5 ? C.bark : C.ink) : (n > 0.45 ? C.earth : C.bark);
                    const e = hash(x, y, 85);
                    if (e < 0.03) c = C.red;
                    else if (e < 0.04) c = C.orange;
                    else if (e < 0.06 && r > 0.6) c = C.wine;
                    px[k] = c;
                    continue;
                }
                const s = sd[k];
                const n = fbm(wx, wy, 12, 87, 2);
                let lv = 1.75 + (n - 0.5) * 2.2 + Math.min(0.6, -s * 0.07);
                if (s > -1.8) lv -= 0.7;
                const lb = Math.floor(lv);
                let li = clamp(lb + (clamp((lv - lb - 0.5) * 3 + 0.5, 0, 1) > bayer(x, y) ? 1 : 0), 0, 3);
                // Shadow cast by the grass lip above.
                const up1 = M(x, y - 1), up2 = M(x, y - 2);
                if (up1 === GRASS) li = 0;
                else if (up2 === GRASS) li = Math.min(li, 1);
                px[k] = DUST[li];
                const pb = hash(x, y, 89);
                if (pb < 0.012 && li > 0) {
                    px[k] = C.mist;
                } else if (pb < 0.02 && li > 1 && x > 0 && px[k - 1] === C.mist) px[k] = C.wood;
                continue;
            }
            // Stone: mortar on each stone's bottom/right edge, a highlight on its top/left.
            const id = sid[k];
            const mortar = S(x + 1, y) !== id || S(x, y + 1) !== id;
            const lit = S(x - 1, y) !== id || S(x, y - 1) !== id;
            const h = hash(id, 7, 99);
            let body: number, hi: number, lo: number, joint: number;
            if (m === SANDSTONE) {
                body = h < 0.18 ? C.clay : C.sand; hi = C.cream; lo = C.clay; joint = C.clay;
            } else if (m === FLAG) {
                body = h < 0.3 ? C.steel : C.mist; hi = h < 0.3 ? C.mist : C.cloud; lo = C.steel; joint = C.slate;
            } else {
                const curb = id < 1.1e6 || (id >= 1.5e6 && id < 1.6e6) || (id >= 2.5e6 && id < 5e6 && (id - 2.5e6) % 1e5 < 5e4);
                if (curb) {
                    body = C.steel; hi = C.mist; lo = C.slate; joint = C.night;
                } else if (h < 0.16) {
                    body = C.steel; hi = C.mist; lo = C.slate; joint = C.slate;
                } else if (h > 0.975) {
                    body = C.sand; hi = C.cream; lo = C.clay; joint = C.slate;
                } else {
                    body = C.mist; hi = C.cloud; lo = C.steel; joint = h < 0.5 ? C.slate : C.steel;
                }
                if (m === LANE) joint = C.slate;
            }
            let c = mortar ? joint : lit ? hi : body;
            // Worn speckle inside big stones, and moss creeping along joints.
            if (!mortar && !lit && hash(x, y, 101) < 0.04) c = lo;
            if (mortar && fbm(wx, wy, 11, 103, 2) > 0.72 && hash(x, y, 105) < 0.6) c = hash(x, y, 106) < 0.5 ? G[3] : G[2];
            // The grass lip above throws a 1px shadow onto the stones.
            if (M(x, y - 1) === GRASS || M(x, y - 1) === BANK) c = lo === C.slate ? C.slate : lo;
            px[k] = c;
        }
    }

    const setW = (wx: number, wy: number, c: number) => {
        const x = Math.round(wx - X0), y = Math.round(wy - Y0);
        if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = c;
    };
    const matW = (wx: number, wy: number) => M(Math.round(wx - X0), Math.round(wy - Y0));
    const toneW = (wx: number, wy: number) => {
        const x = Math.round(wx - X0), y = Math.round(wy - Y0);
        return x >= 0 && y >= 0 && x < W && y < H ? tone[y * W + x] : 4;
    };
    const allGrass = (wx: number, wy: number, w: number, h: number) => {
        for (let j = -h; j <= 1; j++) for (let i = -w; i <= w; i++) if (matW(wx + i, wy + j) !== GRASS) return false;
        return true;
    };

    // Pass 3: overhanging blades at path and plaza edges (turf spilling a pixel or two over the edge).
    for (let y = 1; y < H - 2; y++) {
        for (let x = 1; x < W - 1; x++) {
            const k = y * W + x;
            const m = mat[k];
            if (m === GRASS || m === WATER || m === SOIL) continue;
            const hx = hash(x, 0, 111);
            if (mat[k - W] === GRASS && hx < 0.45) {
                const t = tone[k - W];
                px[k] = G[Math.max(1, t - 1)];
                if (hx < 0.14 && mat[k + W] !== GRASS) px[k + W] = G[Math.max(1, t - 2)];
            } else if (mat[k + W] === GRASS && hx > 0.7) {
                px[k] = G[tone[k + W]];
            } else if ((mat[k - 1] === GRASS || mat[k + 1] === GRASS) && hash(x, y, 113) < 0.35) {
                px[k] = G[Math.max(1, tone[mat[k - 1] === GRASS ? k - 1 : k + 1] - 1)];
            }
        }
    }

    // Pass 4: tufts, clover, wildflowers, fallen petals and leaves.
    // Each tuft is its own little shape: 2-4 blades of random height and lean.
    const tuftAt = (wx: number, wy: number, seed: number) => {
        const t = toneW(wx, wy);
        const dark = G[Math.max(0, t - 2)], mid = G[Math.max(1, t - 1)], tip = G[Math.min(7, t + 1)];
        const n = 2 + Math.floor(hash(seed, 1, 127) * 3);
        let bx = -Math.floor(n / 2) * 2;
        for (let i = 0; i < n; i++) {
            const h = 1 + Math.floor(hash(seed, i, 128) * 3.4);
            const lean = bx < 0 ? -1 : bx > 0 ? 1 : 0;
            for (let j = 0; j <= h; j++) {
                const x = wx + bx + (j === h && h > 1 ? lean : 0);
                setW(x, wy - j, j === h ? tip : j === 0 ? dark : mid);
            }
            bx += 1 + Math.floor(hash(seed, i, 129) * 2);
        }
    };
    for (let cy = Y0; cy < Y0 + H; cy += 6) {
        for (let cx = X0; cx < X0 + W; cx += 7) {
            const r = hash(cx, cy, 121);
            const wx = cx + Math.floor(hash(cx, cy, 122) * 7), wy = cy + Math.floor(hash(cx, cy, 123) * 6);
            const ox = Math.max(TOWN.left - wx, wx - TOWN.right, TOWN.top - wy, wy - TOWN.bottom, 0);
            // Tufts gather in patches rather than sprinkling evenly.
            const dens = 0.03 + Math.min(0.3, ox / 300) + Math.max(0, fbm(wx, wy, 60, 125, 2) - 0.48) * 1.6;
            if (r > dens) continue;
            if (!allGrass(wx, wy, 4, 4)) continue;
            tuftAt(wx, wy, Math.floor(hash(cx, cy, 124) * 1e6));
        }
    }
    // Clover patches.
    for (let cy = Y0; cy < Y0 + H; cy += 5) {
        for (let cx = X0; cx < X0 + W; cx += 5) {
            const wx = cx + Math.floor(hash(cx, cy, 131) * 5), wy = cy + Math.floor(hash(cx, cy, 132) * 5);
            if (fbm(wx, wy, 46, 133, 2) < 0.64 || hash(cx, cy, 134) > 0.5) continue;
            if (!allGrass(wx, wy, 2, 2)) continue;
            const t = toneW(wx, wy);
            const leaf = G[Math.min(7, t + 1)], core = G[Math.max(1, t - 1)];
            setW(wx, wy - 1, leaf); setW(wx - 1, wy, leaf); setW(wx + 1, wy, leaf); setW(wx, wy, core); setW(wx, wy + 1, core);
            if (hash(cx, cy, 135) < 0.12) setW(wx, wy - 1, C.white);
        }
    }
    // Wildflower clusters, each one kind of flower.
    type Flower = (wx: number, wy: number, stem: number) => void;
    const FLOWERS: Flower[] = [
        (x, y, s) => { setW(x, y - 1, C.white); setW(x - 1, y, C.white); setW(x + 1, y, C.white); setW(x, y, C.gold); setW(x, y + 1, s); }, // daisy
        (x, y, s) => { setW(x, y, U('yellow')); setW(x + 1, y, C.gold); setW(x, y + 1, s); }, // buttercup
        (x, y, s) => { setW(x, y, U('pink')); setW(x, y - 1, U('peach')); setW(x, y + 1, s); }, // pink clover
        (x, y, s) => { setW(x, y, C.sky); setW(x + 1, y, C.ice); setW(x, y + 1, s); }, // forget-me-not
        (x, y, s) => { setW(x, y, C.violet); setW(x, y - 1, U('pink')); setW(x, y + 1, s); }, // violet
        (x, y, s) => { setW(x, y, C.white); setW(x, y + 1, s); }, // tiny white
        (x, y, s) => { setW(x, y, C.orange); setW(x, y - 1, U('yellow')); setW(x, y + 1, s); }, // marigold
    ];
    for (let cy = Y0; cy < Y0 + H; cy += 36) {
        for (let cx = X0; cx < X0 + W; cx += 44) {
            const r = hash(cx, cy, 141);
            const mx = cx + hash(cx, cy, 144) * 44, my = cy + hash(cx, cy, 145) * 36;
            const bloom = MEADOWS.reduce((m, f) => Math.max(m, 1 - Math.hypot((mx - f.x) / f.rx, (my - f.y) / f.ry)), 0);
            if (r > 0.42 + (fbm(cx, cy, 200, 142, 2) - 0.5) + bloom) continue;
            const kind = Math.floor(hash(cx, cy, 143) * FLOWERS.length);
            const count = Math.round((4 + Math.floor(hash(cx, cy, 146) * 10)) * (1 + bloom * 1.5));
            const spread = 6 + hash(cx, cy, 147) * 9;
            for (let i = 0; i < count; i++) {
                const a = hash(i, cx, cy) * Math.PI * 2, d = Math.sqrt(hash(cx, i, cy)) * spread;
                const fx = Math.round(mx + Math.cos(a) * d), fy = Math.round(my + Math.sin(a) * d * 0.6);
                if (!allGrass(fx, fy, 2, 2)) continue;
                FLOWERS[kind](fx, fy, G[Math.max(1, toneW(fx, fy) - 2)]);
            }
        }
    }
    // Petals under the cherry tree, leaves under the autumn tree.
    for (const t of TREES) {
        const colors = t.kind === 'cherry' ? [U('pink'), U('peach'), U('pink'), C.white] : t.kind === 'autumn' ? [C.orange, C.gold, C.red, C.orange] : null;
        if (!colors) continue;
        for (let i = 0; i < 70; i++) {
            const a = hash(i, 1, 151) * Math.PI * 2, d = Math.sqrt(hash(i, 2, 151));
            const fx = Math.round(t.x + Math.cos(a) * d * 46), fy = Math.round(t.y + 4 + Math.sin(a) * d * 20);
            if (matW(fx, fy) !== GRASS) continue;
            setW(fx, fy, colors[i % colors.length]);
            if (i % 5 === 0) setW(fx + 1, fy, colors[(i + 1) % colors.length]);
        }
    }

    // Plaza garden: two planted rings of flowers on the soil, in bands of colour.
    const BLOOMS: [number, number][] = [
        [U('pink'), U('peach')], [U('yellow'), U('cream')], [C.white, C.white], [C.violet, U('pink')],
        [C.red, C.orange], [C.sky, C.ice], [C.orange, U('yellow')], [U('pink'), C.white],
    ];
    for (const [rr, step, off, band] of [[37.5, 5, 0, 0], [43, 5, 2.5, 4]] as const) {
        const n = Math.round((Math.PI * 2 * rr) / step);
        for (let i = 0; i < n; i++) {
            const th = (i / n) * Math.PI * 2 + off / rr;
            const fx = Math.round(PLAZA.x + Math.cos(th) * rr), fy = Math.round(PLAZA.y + (Math.sin(th) * rr) / 2);
            const sector = Math.floor((((th + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 8);
            const [c, hi] = BLOOMS[(sector + band) % BLOOMS.length];
            setW(fx - 1, fy + 1, G[3]); setW(fx + 1, fy + 1, G[2]); setW(fx, fy + 1, G[2]); setW(fx - 1, fy, G[4]); setW(fx + 2, fy, G[3]);
            setW(fx, fy, c); setW(fx + 1, fy, c); setW(fx, fy - 1, hi); setW(fx + 1, fy - 1, c);
        }
    }

    for (const c of extra.courts) {
        if (!c.garden) continue;
        // Fill the bed with blooms on a loose grid.
        const R = c.r * 0.42 - 4;
        for (let fy = -R / 2 + 1; fy < R / 2; fy += 2) {
            for (let fx = -R + 1; fx < R; fx += 2) {
                if (Math.hypot(fx, fy * 2) > R - 2) continue;
                const x = Math.round(c.x + fx + (Math.round(fy) & 1)), y = Math.round(c.y + fy);
                const band = Math.floor(((Math.atan2(fy * 2, fx) + Math.PI) / (Math.PI * 2)) * 6);
                const [col, hi] = BLOOMS[(band * 3) % BLOOMS.length];
                setW(x, y + 1, G[3]); setW(x, y, col); setW(x + 1, y, hash(x, y, 171) < 0.4 ? hi : G[4]);
            }
        }
    }

    // Lily pads.
    for (const l of LILIES) {
        const lx = POND.x + l.x, ly = POND.y + l.y;
        for (let j = -2; j <= 2; j++) {
            for (let i = -4; i <= 4; i++) {
                const nx = i / 4.2, ny = j / 2.3;
                if (nx * nx + ny * ny > 1) continue;
                if (i > 0 && j === 0) continue; // the notch
                setW(lx + i, ly + j, j === 2 || (i === 4) ? G[1] : nx + ny < -0.6 ? G[6] : G[4]);
            }
        }
        setW(lx - 1, ly - 1, G[6]);
        if (l.f) {
            setW(lx - 1, ly - 1, U('pink')); setW(lx, ly - 2, U('pink')); setW(lx - 2, ly - 2, U('peach'));
            setW(lx - 1, ly - 2, C.white); setW(lx - 1, ly - 3, U('pink'));
        }
    }

    // Rune stones set flat around the portal's scorch.
    for (let i = 0; i < 8; i++) {
        const th = (i / 8) * Math.PI * 2 + 0.2;
        const fx = Math.round(PORTAL.x + Math.cos(th) * (PORTAL.rx + 4)), fy = Math.round(PORTAL.y + Math.sin(th) * (PORTAL.ry + 3));
        for (let j = -1; j <= 1; j++) for (let ii = -2; ii <= 2; ii++) setW(fx + ii, fy + j, j === 1 ? C.night : C.slate);
        setW(fx - 2, fy - 1, C.steel); setW(fx - 1, fy - 1, C.steel);
        setW(fx, fy, i % 2 ? C.violet : C.red);
        for (let ii = -2; ii <= 2; ii++) if (matW(fx + ii, fy + 2) === GRASS) setW(fx + ii, fy + 2, G[2]);
    }

    // Dissolve the outer rim into the tiled outskirts underneath.
    const RIM = 72;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const e = Math.min(x, y, W - 1 - x, H - 1 - y);
            if (e >= RIM) {
                if (x === RIM && y >= RIM && y < H - RIM) x = W - RIM - 1;
                continue;
            }
            const t = e / RIM + (valueNoise(x, y, 9, 161) - 0.5) * 0.5;
            if (t < bayer(x, y)) px[y * W + x] = 0;
        }
    }

    return {
        canvas: pc,
        isGrass: (wx, wy) => matW(wx, wy) === GRASS,
        isWater: (wx, wy) => matW(wx, wy) === WATER,
    };
}

/** The far-off meadow beyond the painted ground: a seamless 64px tile matching the ground's outer edge. */
export function paintOutskirts(): PixelCanvas {
    const S = 64;
    const pc = new PixelCanvas(S, S);
    const tone = new Uint8Array(S * S);
    const TAU = Math.PI * 2;
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            // Periodic noise from a few sines, so the tile wraps cleanly.
            const n = Math.sin((x / S) * TAU + 1.3) * 0.5 + Math.sin(((x + y) / S) * TAU * 2 + 0.4) * 0.3 +
                Math.sin(((y - 2 * x) / S) * TAU + 2.1) * 0.3 + Math.sin((y / S) * TAU * 3) * 0.15;
            const L = 3.1 + n * 0.45 + (hash(x >> 1, y >> 1, 7) - 0.5) * 0.35;
            let t = quant(L, x, y);
            tone[y * S + x] = t;
            const g = hash(x, y >> 1, 5);
            if (g < 0.05 && t > 1) t -= 1;
            pc.set(x, y, GREENS[t]);
        }
    }
    for (let i = 0; i < 26; i++) {
        const x = Math.floor(hash(i, 0, 9) * S), y = Math.floor(hash(i, 1, 9) * S);
        const t = tone[y * S + x];
        const dark = GREENS[Math.max(0, t - 2)], tip = GREENS[Math.min(7, t + 1)];
        const w = (dx: number, dy: number, c: string) => pc.set((x + dx + S) % S, (y + dy + S) % S, c);
        w(-2, 0, dark); w(-2, -1, tip); w(0, 0, dark); w(0, -1, dark); w(0, -2, tip); w(2, 0, dark); w(2, -1, tip);
    }
    return pc;
}
