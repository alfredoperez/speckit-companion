import * as fs from 'fs';
import * as path from 'path';

export type SortMode = 'number' | 'name' | 'dateCreated' | 'dateModified' | 'status';

export type StatFn = (p: string) => { birthtimeMs: number; mtimeMs: number };

export const DEFAULT_SORT_MODE: SortMode = 'number';

export const ALL_SORT_MODES: readonly SortMode[] = [
    'number',
    'name',
    'dateCreated',
    'dateModified',
    'status',
] as const;

export interface SortableSpec {
    name: string;
    path: string;
}

export interface ComparatorContext {
    basePath: string;
    specNameByPath: Map<string, string | undefined>;
    statusByPath: Map<string, string | undefined>;
    statFn?: StatFn;
}

const defaultStatFn: StatFn = (p) => {
    const s = fs.statSync(p);
    return { birthtimeMs: s.birthtime.getTime(), mtimeMs: s.mtime.getTime() };
};

type ComparatorFactory = (ctx: ComparatorContext) => (a: SortableSpec, b: SortableSpec) => number;

function extractNumericPrefix(name: string): number | null {
    const match = name.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

// Numeric-prefix desc, then slug asc. Used as the primary order for "number"
// mode and as the tie-break tail for every other mode so output is
// deterministic across reloads.
function compareByNumberThenName(a: SortableSpec, b: SortableSpec): number {
    const aNum = extractNumericPrefix(a.name);
    const bNum = extractNumericPrefix(b.name);
    if (aNum !== null && bNum !== null && aNum !== bNum) return bNum - aNum;
    if (aNum !== null && bNum === null) return -1;
    if (aNum === null && bNum !== null) return 1;
    return a.name.localeCompare(b.name);
}

// Workflow order for the status sort. Missing/unknown steps sink to the end.
const STEP_ORDER: Record<string, number> = {
    specify: 0,
    plan: 1,
    tasks: 2,
    implement: 3,
    done: 4,
};

function stepRank(step: string | undefined): number {
    if (!step) return Number.MAX_SAFE_INTEGER;
    const rank = STEP_ORDER[step];
    return rank === undefined ? Number.MAX_SAFE_INTEGER : rank;
}

function safeStatTime(ctx: ComparatorContext, relPath: string, which: 'birthtime' | 'mtime'): number {
    const statFn = ctx.statFn ?? defaultStatFn;
    try {
        const s = statFn(path.join(ctx.basePath, relPath));
        return which === 'birthtime' ? s.birthtimeMs : s.mtimeMs;
    } catch {
        // Sink unstattable specs to the bottom without throwing.
        return -1;
    }
}

export const comparators: Record<SortMode, ComparatorFactory> = {
    number: () => compareByNumberThenName,

    name: (ctx) => (a, b) => {
        const aName = ctx.specNameByPath.get(a.path) ?? a.name;
        const bName = ctx.specNameByPath.get(b.path) ?? b.name;
        const byName = aName.localeCompare(bName);
        if (byName !== 0) return byName;
        return compareByNumberThenName(a, b);
    },

    dateCreated: (ctx) => (a, b) => {
        const aT = safeStatTime(ctx, a.path, 'birthtime');
        const bT = safeStatTime(ctx, b.path, 'birthtime');
        if (aT < 0 && bT >= 0) return 1;
        if (bT < 0 && aT >= 0) return -1;
        if (aT !== bT) return bT - aT;
        return compareByNumberThenName(a, b);
    },

    dateModified: (ctx) => (a, b) => {
        const aT = safeStatTime(ctx, a.path, 'mtime');
        const bT = safeStatTime(ctx, b.path, 'mtime');
        if (aT < 0 && bT >= 0) return 1;
        if (bT < 0 && aT >= 0) return -1;
        if (aT !== bT) return bT - aT;
        return compareByNumberThenName(a, b);
    },

    status: (ctx) => (a, b) => {
        const aR = stepRank(ctx.statusByPath.get(a.path));
        const bR = stepRank(ctx.statusByPath.get(b.path));
        if (aR !== bR) return aR - bR;
        return compareByNumberThenName(a, b);
    },
};
