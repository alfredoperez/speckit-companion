/** Fixture rows for the sidebar prototypes: bugs and ideas, grouped or flat, plus a generator for the many-items view. */

import type { IconTone, SidebarRow } from '../../__stories__/sidebarTree';

export type BugState = 'fix' | 'test' | 'verified';

export interface Bug {
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    state: BugState;
    outcome: string;
    /** The spec whose area the fix belongs to. */
    spec?: string;
}

export interface Idea {
    id: string;
    title: string;
    state: 'assessing' | 'decided';
    /** The stage reached while assessing, or the verdict once decided. */
    note: string;
    /** The spec a "go" idea became. */
    spec?: string;
}

export const BUGS: Bug[] = [
    { id: 'slug-keeps-spaces', title: 'toSlug only replaces the first space', severity: 'medium', state: 'fix', outcome: 'valid' },
    { id: 'invite-sent-twice', title: 'Invite email is sent twice', severity: 'high', state: 'fix', outcome: 'test failed', spec: '038' },
    { id: 'heic-upload-stalls', title: 'Photo upload stalls on HEIC files', severity: 'medium', state: 'test', outcome: 'fix applied', spec: '041' },
    { id: 'cart-total-skips-first', title: 'cartTotal skips the first cart item', severity: 'high', state: 'verified', outcome: 'verified' },
    { id: 'search-ignores-accents', title: 'Search ignores accented names', severity: 'low', state: 'verified', outcome: 'verified' },
];

export const IDEAS: Idea[] = [
    { id: 'offline-mode', title: 'Offline mode', state: 'assessing', note: 'research' },
    { id: 'csv-roster-import', title: 'CSV roster import', state: 'assessing', note: 'intake' },
    { id: 'member-status-badges', title: 'Member status badges', state: 'decided', note: 'go', spec: '042' },
    { id: 'guest-access-links', title: 'Guest access links', state: 'decided', note: 'needs-clarification' },
    { id: 'shared-lists', title: 'Shared todo lists', state: 'decided', note: 'kill' },
];

const BUG_GROUPS: Array<{ state: BugState; label: string; icon: string; tone?: IconTone }> = [
    { state: 'fix', label: 'To fix', icon: 'wrench' },
    { state: 'test', label: 'To test', icon: 'play-circle' },
    { state: 'verified', label: 'Verified', icon: 'pass-filled', tone: 'passed' },
];

const BUG_TONE: Record<BugState, IconTone> = { fix: 'default', test: 'blue', verified: 'passed' };
const VERDICT_TONE: Record<string, IconTone> = { go: 'passed', 'needs-clarification': 'warning', kill: 'default' };

export interface RowOptions {
    /** How a row shows the spec it relates to: in its description, or as a child row. */
    relation?: 'suffix' | 'child' | 'none';
}

function bugRow(bug: Bug, depth: number, { relation = 'none' }: RowOptions): SidebarRow[] {
    const parts = [bug.severity, bug.outcome];
    if (relation === 'suffix' && bug.spec) parts.push(`spec ${bug.spec}`);
    const child = relation === 'child' && !!bug.spec;
    const row: SidebarRow = {
        id: `bug-${bug.id}`,
        depth,
        label: bug.title,
        description: parts.join(' · '),
        icon: 'bug',
        tone: bug.outcome === 'test failed' ? 'warning' : BUG_TONE[bug.state],
        twistie: child ? 'expanded' : 'collapsed',
    };
    if (!child) return [row];
    return [
        row,
        { id: `bug-${bug.id}-assessment`, depth: depth + 1, label: 'Assessment', icon: 'pass', tone: 'passed' },
        { id: `bug-${bug.id}-fix`, depth: depth + 1, label: 'Fix', icon: 'pass', tone: 'passed' },
        bug.outcome === 'fix applied'
            ? { id: `bug-${bug.id}-test`, depth: depth + 1, label: 'Test', description: 'not created' }
            : { id: `bug-${bug.id}-test`, depth: depth + 1, label: 'Test', description: 'failed', icon: 'warning', tone: 'warning' },
        { id: `bug-${bug.id}-spec`, depth: depth + 1, label: `Spec ${bug.spec}`, description: 'area', icon: 'link' },
    ];
}

function ideaRow(idea: Idea, depth: number, { relation = 'none' }: RowOptions): SidebarRow[] {
    const parts = [idea.note];
    if (relation === 'suffix' && idea.spec) parts.push(`spec ${idea.spec}`);
    const child = relation === 'child' && !!idea.spec;
    const row: SidebarRow = {
        id: `idea-${idea.id}`,
        depth,
        label: idea.title,
        description: parts.join(' · '),
        icon: 'lightbulb',
        tone: idea.state === 'assessing' ? 'blue' : VERDICT_TONE[idea.note],
        twistie: child ? 'expanded' : 'collapsed',
    };
    if (!child) return [row];
    return [row, { id: `idea-${idea.id}-spec`, depth: depth + 1, label: `Spec ${idea.spec}`, description: 'created from this idea', icon: 'link' }];
}

export function bugGroups(bugs: Bug[], depth: number, options: RowOptions = {}): SidebarRow[] {
    return BUG_GROUPS.flatMap((group) => {
        const mine = bugs.filter((b) => b.state === group.state);
        return [
            { id: `bugs-${group.state}`, depth, label: `${group.label} (${mine.length})`, icon: group.icon, tone: group.tone, twistie: 'expanded' as const },
            ...mine.flatMap((b) => bugRow(b, depth + 1, options)),
        ];
    });
}

export function bugsFlat(bugs: Bug[], depth: number, options: RowOptions = {}): SidebarRow[] {
    return bugs.flatMap((b) => bugRow(b, depth, options));
}

export function ideaGroups(ideas: Idea[], depth: number, options: RowOptions = {}): SidebarRow[] {
    const groups: Array<[Idea['state'], string, string]> = [
        ['assessing', 'Assessing', 'pulse'],
        ['decided', 'Decided', 'law'],
    ];
    return groups.flatMap(([state, label, icon]) => {
        const mine = ideas.filter((i) => i.state === state);
        return [
            { id: `ideas-${state}`, depth, label: `${label} (${mine.length})`, icon, twistie: 'expanded' as const },
            ...mine.flatMap((i) => ideaRow(i, depth + 1, options)),
        ];
    });
}

export function ideasFlat(ideas: Idea[], depth: number, options: RowOptions = {}): SidebarRow[] {
    return ideas.flatMap((i) => ideaRow(i, depth, options));
}

export function section(id: string, label: string, icon: string, count: number): SidebarRow {
    return { id, depth: 0, label: `${label} (${count})`, icon, twistie: 'expanded' };
}

export function deepen(rows: SidebarRow[], by = 1): SidebarRow[] {
    return rows.map((r) => ({ ...r, depth: r.depth + by }));
}

export const archivedGroup = (count: number): SidebarRow => ({
    id: 'group-archived',
    depth: 0,
    label: `Archived (${count})`,
    icon: 'archive',
    twistie: 'collapsed',
});

const AREAS = ['Profile', 'Team', 'Directory', 'Invite', 'Avatar', 'Roster', 'Billing', 'Search'];
const THINGS = ['Export', 'Filters', 'Badges', 'Emails', 'Settings'];

/** 40 specs the way a year-old project has them: a few active, most completed. */
export function manySpecs(): SidebarRow[] {
    const names = AREAS.flatMap((a) => THINGS.map((t) => `${a} ${t}`));
    const spec = (name: string, i: number, done: boolean): SidebarRow => ({
        id: `many-${i}`,
        depth: 1,
        label: name,
        description: done ? `${i + 2}d ago` : `${i + 1}h ago`,
        icon: 'beaker',
        tone: done ? 'passed' : 'blue',
        twistie: 'collapsed',
    });
    return [
        { id: 'group-active', depth: 0, label: 'Active (8)', icon: 'pulse', twistie: 'expanded' },
        ...names.slice(0, 8).map((n, i) => spec(n, i, false)),
        { id: 'group-completed', depth: 0, label: 'Completed (26)', icon: 'pass-filled', tone: 'passed', twistie: 'expanded' },
        ...names.slice(8, 34).map((n, i) => spec(n, i + 8, true)),
        archivedGroup(6),
    ];
}

export function manyBugs(): Bug[] {
    const titles = [
        'Export drops the last row',
        'Badge color ignores theme',
        'Filter resets on reload',
        'Roster sort is unstable',
        'Avatar crops off-center',
        'Settings save shows no confirmation',
        'Billing total rounds down',
    ];
    const extra: Bug[] = titles.map((title, i) => ({
        id: `many-bug-${i}`,
        title,
        severity: (['high', 'medium', 'low'] as const)[i % 3],
        state: (['fix', 'fix', 'fix', 'test', 'test', 'verified', 'verified'] as const)[i],
        outcome: (['valid', 'valid', 'valid', 'fix applied', 'fix applied', 'verified', 'verified'] as const)[i],
    }));
    return [...BUGS, ...extra];
}

export function manyIdeas(): Idea[] {
    return [...IDEAS, { id: 'bulk-archive', title: 'Bulk archive for old rosters', state: 'decided', note: 'kill' }];
}
