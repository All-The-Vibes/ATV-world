/**
 * How far apart the plaza's landmarks sit. Every hand-placed spot in the middle of the world is
 * written at its original, tighter position and pushed out from the origin by this factor, so
 * raising it spaces everything out evenly without changing the layout.
 */
export const SPREAD = 1.35;

/** One plaza coordinate, pushed out by `SPREAD`. */
export const sp = (v: number) => Math.round(v * SPREAD);
