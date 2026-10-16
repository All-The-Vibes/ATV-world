import { call } from './roster';

/** The README's agents of questionable judgment, dialing in. */
const CAST = ['Steph', 'Darth Vader', 'Nemo', 'Ralph Wiggum', 'Pac-Man', 'Rocky', 'Girl Scout', 'Phoenix'];

/** A big-call demo fills the rest of the room with computing pioneers. */
const PIONEERS = [
    'Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus Torvalds', 'Margaret Hamilton', 'Dennis Ritchie',
    'Ken Thompson', 'Barbara Liskov', 'Edsger Dijkstra', 'Donald Knuth', 'Guido van Rossum', 'Brendan Eich',
    'Anders Hejlsberg', 'Bjarne Stroustrup', 'James Gosling', 'Yukihiro Matsumoto', 'Tim Berners-Lee',
    'Katherine Johnson', 'Hedy Lamarr', 'Radia Perlman', 'Frances Allen', 'Jean Bartik', 'Annie Easley',
    'Sophie Wilson', 'Lynn Conway', 'Joan Clarke', 'Karen Sparck Jones', 'Betty Holberton', 'Kathleen Booth',
    'Adele Goldberg', 'Dorothy Vaughan', 'Shafi Goldwasser', 'Leslie Lamport', 'Niklaus Wirth', 'Tony Hoare',
    'Ivan Sutherland', 'Douglas Engelbart', 'Vint Cerf', 'Whitfield Diffie', 'Ward Cunningham',
];

export type DemoSize = 'small' | 'crowd';

let stopDemo: (() => void) | null = null;

/**
 * A pretend call. 'small': the eight agents join one by one. 'crowd': a 48-person call like the real
 * ones, mostly seated already, the last few walking in. Then people drop off and dial back in.
 * Returns a stop function.
 */
export function startDemo(size: DemoSize = 'small'): () => void {
    stopDemo?.();
    const cast = size === 'crowd' ? [...CAST, ...PIONEERS] : CAST;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const away: string[] = [];
    const later = (ms: number, fn: () => void) => {
        timer = setTimeout(fn, ms);
    };
    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    const inCall = () => cast.filter((name) => call.get(`demo:${name}`));
    const join = (name: string) => call.join({ id: `demo:${name}`, name, source: 'demo' });

    // A crowd is mostly here already; the last six (or all eight agents) walk in.
    let next = size === 'crowd' ? cast.length - 6 : 0;
    cast.slice(0, next).forEach(join);
    const arrive = () => {
        join(cast[next++]);
        if (next < cast.length) later(rand(1800, 3600), arrive);
        else later(rand(6000, 9000), churn);
    };
    // Someone drops off, or someone who dropped off dials back in.
    const churn = () => {
        const here = inCall();
        if (away.length && (here.length < cast.length - 2 || Math.random() < 0.5)) join(away.splice(Math.floor(Math.random() * away.length), 1)[0]);
        else if (here.length) {
            const name = here[Math.floor(Math.random() * here.length)];
            call.leave(`demo:${name}`);
            away.push(name);
        }
        later(rand(5000, 9000), churn);
    };

    const who = size === 'crowd' ? `${cast.length} people dial in and out` : 'the agents dial in';
    call.setStatus({ kind: 'demo', text: `Demo call: ${who}. Open ATV World in a Teams meeting for the real thing.` });
    later(400, arrive);
    const stop = () => {
        clearTimeout(timer);
        call.clear('demo');
        if (call.status.kind === 'demo') call.setStatus({ kind: 'idle' });
        if (stopDemo === stop) stopDemo = null;
    };
    stopDemo = stop;
    return stop;
}

export const demoRunning = () => stopDemo !== null;

export function endDemo() {
    stopDemo?.();
}
