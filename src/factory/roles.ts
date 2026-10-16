import type { CharacterLook, ColorName } from '../game/kit';

export type RoleId = 'developer' | 'sre' | 'security' | 'tester';

/** Something an agent says to a teammate, and what that teammate answers. */
export interface Handoff {
    to: RoleId;
    line: string;
    reply: string;
}

/** What an agent can be. Add a role here and it shows up in the factory panel and in the world. */
export interface Role {
    id: RoleId;
    title: string;
    /** Short name tags: DEV-1, SRE-2, ... */
    tag: string;
    blurb: string;
    /** The name tag's fill, and the color of its text. */
    badge: ColorName;
    badgeText: ColorName;
    look: CharacterLook;
    /** Things they mutter while wandering (upper case: the mini font has no lower case). */
    lines: string[];
    handoffs: Handoff[];
}

export const MAX_AGENTS = 12;

export const ROLES: readonly Role[] = [
    {
        id: 'developer', title: 'Developer', tag: 'DEV', badge: 'sky', badgeText: 'ink',
        blurb: 'Ships features. Mostly on purpose.',
        look: { hairStyle: 'cap', hat: 'violet', shirt: 'violet', pants: 'navy', shoes: 'white' },
        lines: ['IT WORKS ON MY MACHINE.', 'JUST ONE MORE REFACTOR.', 'SHIPPING IT.', 'TODO: WRITE THE TODO.', 'I WILL FIX IT IN A FOLLOW-UP.'],
        handoffs: [{ to: 'tester', line: '@TESTER PR READY!', reply: 'LOOKING NOW.' }],
    },
    {
        id: 'sre', title: 'SRE', tag: 'SRE', badge: 'orange', badgeText: 'ink',
        blurb: 'Keeps the lights on. Carries the pager.',
        look: { hairStyle: 'cap', hat: 'gold', shirt: 'orange', pants: 'slate', shoes: 'bark' },
        lines: ['ALL GREEN. SUSPICIOUS.', 'PAGER! IT WAS NOTHING.', 'HAVE YOU TRIED A ROLLBACK?', 'FIVE NINES. ONE MORE.', 'WHO TOUCHED PROD?'],
        handoffs: [{ to: 'developer', line: '@DEV YOUR DEPLOY IS ON FIRE.', reply: 'ROLLING BACK!' }],
    },
    {
        id: 'security', title: 'Security Agent', tag: 'SEC', badge: 'red', badgeText: 'white',
        blurb: 'Trusts no one. Rotates every secret.',
        look: { hairStyle: 'short', hat: 'ink', shirt: 'night', pants: 'ink', shoes: 'ink' },
        lines: ['THAT KEY IS IN THE REPO.', 'ZERO TRUST. ZERO FUN.', 'SCANNING EVERYTHING.', 'WHY IS THIS PORT OPEN?', 'ROTATE ALL THE SECRETS.'],
        handoffs: [{ to: 'developer', line: '@DEV SECRET IN THE REPO.', reply: 'WHOOPS. ROTATING.' }],
    },
    {
        id: 'tester', title: 'Tester', tag: 'QA', badge: 'lime', badgeText: 'ink',
        blurb: 'Finds the bug you swore was not there.',
        look: { hairStyle: 'bun', hat: 'leaf', shirt: 'leaf', pants: 'earth', shoes: 'earth' },
        lines: ['I ORDERED -1 COFFEES.', 'WORKS. NOW I WILL BREAK IT.', 'REPRO STEPS ATTACHED.', 'EDGE CASES EVERYWHERE.', 'FLAKY? OR HAUNTED?'],
        handoffs: [{ to: 'developer', line: '@DEV FOUND A BUG. AGAIN.', reply: 'NOT A BUG. A FEATURE.' }],
    },
];

export const roleById = (id: RoleId): Role => ROLES.find((r) => r.id === id) ?? ROLES[0];
