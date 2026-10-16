import { fbm } from '../kit/noise';

/** World grid. Everything in plot code is measured in tiles of 16px. */
export const TILE = 16;
/** A lot is 24x16 tiles; roads between lots are 4 tiles wide. */
export const LOT_W = 24;
export const LOT_H = 16;
export const ROAD = 4;
export const PITCH_W = LOT_W + ROAD;
export const PITCH_H = LOT_H + ROAD;
/** Tiles of meadow, beach, and sea around the town. */
export const MARGIN = 26;

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Tile rect of a `w × h`-lot plot at lot (lx, ly). Multi-lot plots include the roads between their lots. */
export const lotRect = (lx: number, ly: number, w = 1, h = 1): Rect => ({
    x: lx * PITCH_W,
    y: ly * PITCH_H,
    w: w * PITCH_W - ROAD,
    h: h * PITCH_H - ROAD,
});

export interface Claim {
    slug: string;
    lx: number;
    ly: number;
    w: number;
    h: number;
}

/** Who owns which lot. Lots can be anywhere: negative, far away, any size. */
export class Lots {
    private owners = new Map<string, Claim>();
    readonly claims = new Map<string, Claim>();

    private static key(x: number, y: number) {
        return `${x},${y}`;
    }

    owner(lx: number, ly: number): Claim | undefined {
        return this.owners.get(Lots.key(lx, ly));
    }

    isFree(lx: number, ly: number, w = 1, h = 1): boolean {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.owners.has(Lots.key(lx + i, ly + j))) return false;
        return true;
    }

    claim(c: Claim): void {
        for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) this.owners.set(Lots.key(c.lx + i, c.ly + j), c);
        this.claims.set(c.slug, c);
    }

    /** Closest free spot to (lx, ly), searching outward ring by ring (deterministic). */
    nearestFree(lx: number, ly: number, w = 1, h = 1): [number, number] {
        for (let r = 0; r < 256; r++) {
            const ring: [number, number][] = [];
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([dx, dy]);
            }
            ring.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2) || a[1] - b[1] || a[0] - b[0]);
            for (const [dx, dy] of ring) if (this.isFree(lx + dx, ly + dy, w, h)) return [lx + dx, ly + dy];
        }
        return [lx, ly + 256];
    }

    /** The claim whose area (including inner roads of multi-lot plots) covers tile (tx, ty). */
    claimAtTile(tx: number, ty: number): Claim | undefined {
        const c = this.owner(Math.floor(tx / PITCH_W), Math.floor(ty / PITCH_H));
        if (!c) return undefined;
        const r = lotRect(c.lx, c.ly, c.w, c.h);
        return tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h ? c : undefined;
    }
}

export interface TownLayout {
    /** Inclusive lot range of the town, including a ring of free lots around every claim. */
    minLX: number;
    maxLX: number;
    minLY: number;
    maxLY: number;
    /** Tile rect of the town, including the roads around its edge. */
    town: Rect;
    /** Tile rect of the whole world (town + island + sea). Grows if anything is placed outside. */
    world: Rect;
}

export function computeTown(claims: Iterable<Claim>): TownLayout {
    let minLX = -1, maxLX = 1, minLY = -1, maxLY = 1;
    for (const c of claims) {
        minLX = Math.min(minLX, c.lx);
        maxLX = Math.max(maxLX, c.lx + c.w - 1);
        minLY = Math.min(minLY, c.ly);
        maxLY = Math.max(maxLY, c.ly + c.h - 1);
    }
    minLX--; maxLX++; minLY--; maxLY++;
    const town: Rect = {
        x: minLX * PITCH_W - ROAD,
        y: minLY * PITCH_H - ROAD,
        w: (maxLX - minLX + 1) * PITCH_W + ROAD,
        h: (maxLY - minLY + 1) * PITCH_H + ROAD,
    };
    const world: Rect = { x: town.x - MARGIN, y: town.y - MARGIN, w: town.w + MARGIN * 2, h: town.h + MARGIN * 2 };
    return { minLX, maxLX, minLY, maxLY, town, world };
}

/** Distance in tiles from the town edge (0 inside), with a wobbly coastline. */
export function wildsDistance(tx: number, ty: number, town: Rect): number {
    const dx = Math.max(town.x - tx - 0.5, 0, tx + 0.5 - (town.x + town.w));
    const dy = Math.max(town.y - ty - 0.5, 0, ty + 0.5 - (town.y + town.h));
    if (dx === 0 && dy === 0) return 0;
    return Math.hypot(dx, dy) + (fbm(tx, ty, 10, 77, 3) - 0.5) * 7;
}

export type Wilds = 'grass' | 'sand' | 'water' | 'deep';

export function wildsKind(d: number): Wilds {
    if (d < 10) return 'grass';
    if (d < 13) return 'sand';
    if (d < 21) return 'water';
    return 'deep';
}
