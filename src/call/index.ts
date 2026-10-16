/**
 * Fills the call roster: from Teams (?teams, which the Teams app's URLs carry), from the meeting the
 * website mirrors (everyone else, if it's set up: see api/hq), from the URL (?call=Ana,Ben), or a demo
 * (?call=demo for the eight agents, ?call=crowd for a 48-person call). From the browser console:
 * atv.call.join('Ana'), atv.call.leave('Ana'), atv.call.demo('crowd'), atv.call.clear(), atv.call.list().
 */
import { endDemo, startDemo, type DemoSize } from './demo';
import { followMirror } from './relay';
import { call } from './roster';

export { call } from './roster';
export type { CallAction, Caller, CallStatus } from './roster';

let started = false;

export function startCall() {
    if (started) return;
    started = true;
    const q = new URLSearchParams(location.search);

    if (q.has('teams')) {
        const mode = q.get('teams');
        import('./teams')
            .then((teams) => teams.startTeams(mode))
            .catch((e) => {
                console.error('[ATV] Teams failed:', e);
                call.setStatus({ kind: 'error', text: "Couldn't connect to Teams. Try reopening ATV World in the meeting." });
            });
    }

    const names = q.get('call')?.trim();
    const demo = names?.toLowerCase();
    if (demo === 'demo' || demo === 'crowd') startDemo(demo === 'crowd' ? 'crowd' : 'small');
    else if (names) for (const name of names.split(',')) call.join({ name, source: 'url' });
    // Everyone else on the website sees the one meeting the site mirrors (if it's set up: see api/hq).
    else if (!q.has('teams')) followMirror();

    const w = window as unknown as { atv?: Record<string, unknown> };
    w.atv = {
        ...w.atv,
        call: {
            join: (name: string) => call.join({ name, source: 'console' }),
            leave: (name: string) => call.leave(name),
            clear: () => {
                endDemo();
                call.clear();
            },
            demo: (size: DemoSize = 'small') => startDemo(size),
            list: () => call.list().map((c) => c.name),
        },
    };
}
