const CADENCE = 120_000;
const DURATION = 20_000;

/** Only small, foreground scene updates count. No wall-clock timers or catch-up queue. */
export class SurfClock {
    private elapsed = 0;
    private next = CADENCE;
    private began: number | undefined;

    get active() { return this.began !== undefined; }
    get age() { return this.began === undefined ? 0 : this.elapsed - this.began; }

    update(ms: number) {
        if (!Number.isFinite(ms) || ms <= 0 || ms > 250) return;
        this.elapsed += ms;
        if (this.active && this.age >= DURATION) this.cancel();
        if (!this.active && this.elapsed >= this.next) this.start();
    }

    start(): boolean {
        if (this.active) return false;
        this.began = this.elapsed;
        this.next = this.elapsed + CADENCE;
        return true;
    }

    cancel() { this.began = undefined; }
}
