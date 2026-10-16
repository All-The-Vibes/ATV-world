import { isTyping } from './game/commands';

/**
 * Production only: a LIVE badge with the deployed commit. It checks version.json every 10 s and
 * reloads the page when someone's push goes live. Add ?noreload to the URL to turn reloading off.
 */
const REPO = 'https://github.com/All-The-Vibes/ATV-world';
const GUARD = 'atv:reload';
const POLL_MS = 10_000;
const COUNTDOWN = 5;

interface Version {
    sha?: string;
    message?: string;
    author?: string;
    time?: string;
}

const me = __ATV_BUILD__;
const autoReload = !new URLSearchParams(location.search).has('noreload');

function ago(time?: string): string {
    const t = Date.parse(time ?? '');
    if (!Number.isFinite(t)) return '';
    const m = Math.max(0, Math.round((Date.now() - t) / 60_000));
    return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}

function readGuard(): { sha: string; tries: number } | null {
    try {
        return JSON.parse(sessionStorage.getItem(GUARD) ?? 'null');
    } catch {
        return null;
    }
}

function writeGuard(value: { sha: string; tries: number } | null) {
    try {
        if (value) sessionStorage.setItem(GUARD, JSON.stringify(value));
        else sessionStorage.removeItem(GUARD);
    } catch {
        // Without storage there's no loop guard, but reloading still works.
    }
}

function start() {
    if (readGuard()?.sha === me.sha) writeGuard(null);

    const badge = document.createElement('a');
    badge.className = 'live';
    badge.target = '_blank';
    badge.rel = 'noopener';
    badge.href = `${REPO}/commit/${me.sha}`;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = '●';
    const text = document.createElement('span');
    badge.append(dot, text);
    document.body.append(badge);

    let pending: Version | null = null;
    let countdown = 0;
    let stuck = false;

    badge.addEventListener('click', (e) => {
        if (!pending) return;
        e.preventDefault();
        location.reload();
    });

    const render = () => {
        if (pending) {
            const who = pending.author ? `${pending.author}: ` : '';
            badge.classList.add('updating');
            badge.href = `${REPO}/commit/${pending.sha}`;
            text.textContent = stuck || !autoReload
                ? ` NEW · ${who}${pending.message ?? ''} · click to refresh`
                : ` ↻ ${who}${pending.message ?? ''} · reloading in ${countdown}`;
        } else {
            text.textContent = ` LIVE · ${me.message} · ${ago(me.time)}`;
        }
        badge.title = text.textContent ?? '';
    };

    const reload = () => {
        const guard = readGuard();
        const tries = guard?.sha === pending?.sha ? guard!.tries : 0;
        // Never loop: if the new version didn't stick after 3 tries, wait for a manual refresh.
        if (tries >= 3) {
            stuck = true;
            render();
            return;
        }
        writeGuard({ sha: pending!.sha!, tries: tries + 1 });
        location.reload();
    };

    const tick = () => {
        if (!pending || stuck || !autoReload) return;
        if (isTyping()) return render();
        countdown--;
        if (countdown <= 0) reload();
        else render();
    };

    const check = async () => {
        if (document.visibilityState !== 'visible') return;
        try {
            const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return;
            const v = (await res.json()) as Version;
            if (v.sha && v.sha !== me.sha && v.sha !== pending?.sha) {
                pending = v;
                countdown = COUNTDOWN;
                stuck = false;
            }
        } catch {
            // Offline or mid-deploy: try again next time.
        }
        render();
    };

    render();
    void check();
    setInterval(() => void check(), POLL_MS);
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => void check());
}

if (import.meta.env.PROD && me.sha !== 'dev') start();
