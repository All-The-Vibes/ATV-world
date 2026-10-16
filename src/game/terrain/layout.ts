/**
 * Where the town's ground features sit, in world px. Matches the placements in scenes/Preview.ts:
 * house door (-305, -76), ATV HQ front door (0, -114 → sidewalk at -104), library steps (285, 225),
 * the hell portal (258, 79), the fountain (-150, 205), and Ollama's loop around (0, 90).
 */

/** A world rect: the painted area, and the town (Preview's worldBounds) the meadow darkens away from. */
export interface Area {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/**
 * The plaza: a ring of cobbles that Ollama walks around. Distances are measured in "plaza space",
 * where y counts double (so circles there are 2:1 ellipses on screen, like the llama's loop).
 */
export const PLAZA = { x: 0, y: 90, inner: 58, outer: 128 } as const;

/** A round paved court around the fountain. */
export const FOUNTAIN = { x: -150, y: 203, r: 46 } as const;

/** Concrete sidewalk along the front of ATV HQ (HQ is 280 px wide, its front wall at y = -114). */
export const SIDEWALK = { x0: -150, x1: 150, y0: -115, y1: -99 } as const;

/** Sandstone forecourt at the foot of the library steps. */
export const FORECOURT = { x0: 242, x1: 328, y0: 224, y1: 248 } as const;

/** Scorched circle under the hell portal. */
export const PORTAL = { x: 258, y: 81, rx: 21, ry: 10 } as const;

/** The pond, out on the north edge of the map, up and right of the swimming pool (which sits at x 160-410, y -231 to -115). */
export const POND = { x: 480, y: -345, rx: 74, ry: 32 } as const;

export type PathKind = 'dirt' | 'cobble';

export interface PathSpec {
    kind: PathKind;
    /** Half width in px. */
    hw: number;
    /** Control points (a Catmull-Rom spline passes through all of them). */
    points: readonly (readonly [number, number])[];
    /** Narrow away to nothing at the last point (lanes leading off into the meadow). */
    fade?: boolean;
}

export const PATHS: readonly PathSpec[] = [
    // HQ front door → north edge of the plaza.
    { kind: 'cobble', hw: 13, points: [[0, -104], [0, -40], [0, 34]] },
    // Plaza → fountain court.
    { kind: 'cobble', hw: 10, points: [[-62, 140], [-100, 172], [-138, 196]] },
    // Plaza → house door: a winding dirt lane.
    { kind: 'dirt', hw: 9, points: [[-112, 98], [-170, 72], [-232, 48], [-284, 10], [-302, -40], [-305, -72]] },
    // Plaza → hell portal.
    { kind: 'dirt', hw: 7, points: [[112, 82], [160, 76], [204, 84], [242, 82]] },
    // Plaza → library forecourt, swinging around the library's west wing.
    { kind: 'dirt', hw: 9, points: [[96, 128], [150, 160], [196, 206], [232, 236], [262, 238]] },
    // Plaza → south, between the flowers and the bench, out of town.
    { kind: 'dirt', hw: 8, fade: true, points: [[18, 150], [26, 200], [32, 262], [24, 330], [14, 400], [20, 470]] },
    // Out west past the house.
    { kind: 'dirt', hw: 7, fade: true, points: [[-284, 10], [-360, 30], [-430, 22], [-500, 30]] },
];

/** Building footprints (world rects) that ground decor must stay clear of. */
export const KEEP_CLEAR = [
    { x0: -360, y0: -160, x1: -250, y1: -70 }, // house
    { x0: -146, y0: -480, x1: 146, y1: -98 }, // HQ (it grows upward)
    { x0: 216, y0: 60, x1: 354, y1: 240 }, // library
] as const;

/** Open meadows where wildflowers grow thickest. */
export const MEADOWS = [
    { x: 250, y: 340, rx: 130, ry: 70 },
    { x: -130, y: -200, rx: 90, ry: 50 },
    { x: 660, y: 60, rx: 110, ry: 70 },
    { x: -420, y: 120, rx: 70, ry: 90 },
] as const;

/** Trees, for soft ground shade and fallen petals/leaves. */
export const TREES = [
    { x: -375, y: 24, kind: 'oak' },
    { x: -190, y: -106, kind: 'cherry' },
    { x: 190, y: -70, kind: 'autumn' },
    { x: 370, y: 112, kind: 'pine' },
] as const;
