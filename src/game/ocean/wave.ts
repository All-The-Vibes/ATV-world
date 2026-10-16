const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

export function waveAt(seconds: number, left: number, right: number) {
    const width = Math.max(480, (right - left) * 0.22);
    const front = right + width * 0.25 - (right - left + width * 1.3) * clamp(seconds / 20);
    return { front, width };
}

export function swellAt(x: number, { front, width }: ReturnType<typeof waveAt>) {
    const u = (x - front) / width;
    return smooth((u + 0.18) / 0.3) * (1 - smooth((u - 0.18) / 0.52));
}
