import type {
    ConvergeAddedTask,
    ConvergeOutcome,
    ConvergePass,
    ConvergePassRow,
    ConvergeResult,
    SpecContext,
} from '../../core/types/specContext';
import { taskEntries } from '../../core/utils/taskCheckboxes';

function pickPasses(raw: unknown): ConvergePass[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((p): p is ConvergePass =>
        !!p && typeof p === 'object' && typeof (p as ConvergePass).startedAt === 'string');
}

function stringIds(raw: unknown): string[] | undefined {
    return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string'))] : undefined;
}

function passOutcome(pass: ConvergePass): ConvergeOutcome {
    if (typeof pass.finishedAt !== 'string') return 'running';
    const added = stringIds(pass.added);
    if (!added) return 'unknown';
    return added.length > 0 ? 'gaps' : 'clean';
}

function passDuration(pass: ConvergePass): number | undefined {
    if (typeof pass.finishedAt !== 'string') return undefined;
    const ms = Date.parse(pass.finishedAt) - Date.parse(pass.startedAt);
    return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

/** The one reading of converge for every viewer surface; undefined when converge never ran. */
export function deriveConvergeResult(ctx: SpecContext | undefined, tasksContent: string): ConvergeResult | undefined {
    const passes = pickPasses(ctx?.convergePasses);
    if (passes.length === 0) return undefined;

    const rows: ConvergePassRow[] = passes.map((pass, i) => ({
        index: i + 1,
        outcome: passOutcome(pass),
        addedIds: stringIds(pass.added) ?? [],
        durationMs: passDuration(pass),
    }));
    const latest = rows[rows.length - 1];

    const tasks = new Map(taskEntries(tasksContent).map(t => [t.id, t]));
    const addedTasks: ConvergeAddedTask[] = latest.addedIds
        .map(id => tasks.get(id))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .map(t => ({ id: t.id, title: t.title, checked: t.checked }));

    const completing = [...passes].reverse().find(p => p.completed === true && typeof p.finishedAt === 'string');

    return {
        outcome: latest.outcome,
        passCount: rows.length,
        passes: rows,
        addedTasks,
        openAdded: addedTasks.filter(t => !t.checked).length,
        completedBy: completing ? { at: completing.finishedAt!, by: completing.by } : undefined,
    };
}
