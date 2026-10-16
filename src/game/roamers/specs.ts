import type { RoamerSpec } from './types';

export type { RoamerSpec } from './types';

// Every file in ./characters exports one RoamerSpec as its default, so adding a character touches no shared file.
const modules = import.meta.glob<{ default: RoamerSpec }>('./characters/*.ts', { eager: true });

export const ROAMERS: RoamerSpec[] = Object.values(modules)
    .map((m) => m.default)
    .sort((a, b) => a.id.localeCompare(b.id));
