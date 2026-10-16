import { PixelCanvas, buildingArt, stripFrames, type BuildingInfo } from '../kit';

const GEAR_TEETH = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]] as const;

function gear(pc: PixelCanvas, cx: number, cy: number, r: number) {
    for (const [dx, dy] of GEAR_TEETH) pc.rect(cx + Math.round(dx * (r + 1)) - 1, cy + Math.round(dy * (r + 1)) - 1, 3, 3, 'gold');
    pc.ellipse(cx, cy, r, r, 'gold').ellipse(cx - 1, cy - 1, r - 2, r - 2, 'yellow').ellipse(cx, cy, 3, 3, 'night');
}

function robotHead(pc: PixelCanvas, x: number, y: number) {
    pc.rect(x + 7, y - 6, 2, 6, 'steel').rect(x + 6, y - 8, 4, 3, 'red').set(x + 7, y - 8, 'orange');
    pc.rect(x, y, 16, 13, 'cloud').rect(x, y, 16, 1, 'white').rect(x, y + 12, 16, 1, 'mist').rect(x + 15, y, 1, 13, 'mist');
    pc.rect(x + 3, y + 3, 4, 4, 'ink').rect(x + 9, y + 3, 4, 4, 'ink');
    pc.rect(x + 4, y + 4, 2, 2, 'cyan').rect(x + 10, y + 4, 2, 2, 'cyan');
    pc.rect(x + 4, y + 9, 8, 2, 'ink');
    for (let i = 5; i < 12; i += 2) pc.rect(x + i, y + 9, 1, 2, 'steel');
    pc.rect(x - 2, y + 4, 2, 5, 'steel').rect(x + 16, y + 4, 2, 5, 'steel');
}

/** The Agent Factory: a brick works with a robot on the roof, a cog, and a smokestack. */
export function factoryArt(): { canvas: PixelCanvas; info: BuildingInfo } {
    return buildingArt({
        w: 8, h: 7, style: 'brick', wall: 'stone', roof: 'dark', trim: 'cloud', doorColor: 'gold',
        chimney: true, sign: 'AGENT FACTORY', seed: 11,
        draw: (pc, info) => {
            gear(pc, 24, 30, 8);
            robotHead(pc, Math.round(info.W / 2) - 8, 22);
        },
    });
}

/** Four frames of a conveyor belt whose chevrons crawl along. */
export function beltArt(w = 40, h = 8, frames = 4) {
    const pc = new PixelCanvas(w * frames, h);
    for (let f = 0; f < frames; f++) {
        const ox = f * w;
        pc.rect(ox, 1, w, h - 2, 'slate').rect(ox, 1, w, 1, 'steel').rect(ox, h - 2, w, 1, 'night');
        for (let x = 2; x < w - 4; x += 8) {
            const cx = ox + ((x + f * 2) % (w - 6)) + 1;
            pc.set(cx, 3, 'yellow').set(cx + 1, 4, 'yellow').set(cx, 5, 'yellow');
        }
        pc.rect(ox, 0, 3, h, 'steel').rect(ox + w - 3, 0, 3, h, 'steel').rect(ox + 1, 2, 1, h - 4, 'mist').rect(ox + w - 2, 2, 1, h - 4, 'mist');
    }
    return {
        canvas: pc.outline('ink'),
        frames: stripFrames(frames, w, h),
    };
}
