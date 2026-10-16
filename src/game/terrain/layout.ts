/**
 * Where the town's ground features sit, in world px. Matches the placements in scenes/Preview.ts:
 * house door (-305, -76), ATV HQ front door (0, -114 → sidewalk at -104), library steps (285, 225),
 * the hell portal (258, 79), the fountain (-150, 205), and Ollama's loop around (0, 90), each pushed out by
 * `sp` (see spread.ts) just like the placements themselves.
 */
import { sp } from '../spread';

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
export const PLAZA = { x: 0, y: sp(90), inner: 58, outer: 128 } as const;

/** A round paved court around the fountain. */
export const FOUNTAIN = { x: sp(-150), y: sp(205) - 2, r: 46 } as const;

/** Concrete sidewalk along the front of ATV HQ (HQ is 280 px wide, its front wall at y = -114). */
export const SIDEWALK = { x0: -150, x1: 150, y0: sp(-114) - 1, y1: sp(-114) + 15 } as const;

/** Sandstone forecourt at the foot of the library steps. */
export const FORECOURT = { x0: sp(285) - 43, x1: sp(285) + 43, y0: sp(225) - 1, y1: sp(225) + 23 } as const;

/** Scorched circle under the hell portal. */
export const PORTAL = { x: sp(258), y: sp(79) + 2, rx: 21, ry: 10 } as const;

/** The pond, out on the north edge of the map, up and right of the swimming pool (which sits at x 160-410, y -231 to -115). */
export const POND = { x: sp(480), y: sp(-345), rx: 74, ry: 32 } as const;

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
    { kind: 'cobble', hw: 13, points: [[sp(0), sp(-104)], [sp(0), sp(-40)], [sp(0), sp(34)]] },
    // Plaza → fountain court.
    { kind: 'cobble', hw: 10, points: [[sp(-62), sp(140)], [sp(-100), sp(172)], [sp(-138), sp(196)]] },
    // Plaza → house door: a winding dirt lane.
    { kind: 'dirt', hw: 9, points: [[sp(-112), sp(98)], [sp(-170), sp(72)], [sp(-232), sp(48)], [sp(-284), sp(10)], [sp(-302), sp(-40)], [sp(-305), sp(-72)]] },
    // Plaza → hell portal.
    { kind: 'dirt', hw: 7, points: [[sp(112), sp(82)], [sp(160), sp(76)], [sp(204), sp(84)], [sp(242), sp(82)]] },
    // Plaza → library forecourt, swinging around the library's west wing.
    { kind: 'dirt', hw: 9, points: [[sp(96), sp(128)], [sp(150), sp(160)], [sp(196), sp(206)], [sp(232), sp(236)], [sp(262), sp(238)]] },
    // Plaza → south, between the flowers and the bench, out of town.
    { kind: 'dirt', hw: 8, fade: true, points: [[sp(18), sp(150)], [sp(26), sp(200)], [sp(32), sp(262)], [sp(24), sp(330)], [sp(14), sp(400)], [sp(20), sp(470)]] },
    // Out west past the house.
    { kind: 'dirt', hw: 7, fade: true, points: [[sp(-284), sp(10)], [sp(-360), sp(30)], [sp(-430), sp(22)], [sp(-500), sp(30)]] },
];

/** Building footprints (world rects) that ground decor must stay clear of. */
export const KEEP_CLEAR = [
    { x0: sp(-305) - 55, y0: sp(-76) - 84, x1: sp(-305) + 55, y1: sp(-76) + 6 }, // house
    { x0: -146, y0: sp(-114) - 366, x1: 146, y1: sp(-114) + 16 }, // HQ (it grows upward)
    { x0: sp(285) - 69, y0: sp(225) - 165, x1: sp(285) + 69, y1: sp(225) + 15 }, // library
] as const;

/** Open meadows where wildflowers grow thickest. */
export const MEADOWS = [
    { x: sp(250), y: sp(340), rx: 130, ry: 70 },
    { x: sp(-130), y: sp(-200), rx: 90, ry: 50 },
    { x: sp(660), y: sp(60), rx: 110, ry: 70 },
    { x: sp(-420), y: sp(120), rx: 70, ry: 90 },
] as const;

/** Trees, for soft ground shade and fallen petals/leaves. */
export const TREES = [
    { x: sp(-375), y: sp(24), kind: 'oak' },
    { x: sp(-190), y: sp(-106), kind: 'cherry' },
    { x: sp(190), y: sp(-70), kind: 'autumn' },
    { x: sp(370), y: sp(112), kind: 'pine' },
] as const;
