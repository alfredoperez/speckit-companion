import { HistoryEntry, StepName } from '../../core/types/specContext';
import { isPerTaskEntry } from './historyHelpers';

export interface LastTransition {
    /** Human label for the most recent history entry, e.g. "Plan started". */
    label: string;
    /** ISO 8601 timestamp of the entry. */
    at: string;
    /** Relative time from `at` (e.g. "2h ago"), measured against the entry. */
    relative: string;
    /**
     * The active task id (e.g. "T004") when the most recent entry is a per-task
     * implement finish; otherwise undefined. Exposed as a discrete field so the
     * sidebar can surface the task in its trimmed, icon-absent row description
     * without string-parsing `label`.
     */
    task?: string;
}

/**
 * Minimal reader-facing view of a canonical `HistoryEntry`: the fields this
 * module reads, all optional with `step` widened so the legacy `TransitionEntry`
 * (no `kind`) also assigns.
 */
type HistoryEntryView = Partial<Pick<HistoryEntry, 'substep' | 'task' | 'kind' | 'at'>> & {
    step?: string | null;
};

interface HistoryHolder {
    history?: ReadonlyArray<HistoryEntryView> | null;
}

const STEP_LABELS: Record<StepName, string> = {
    specify: 'Specify',
    clarify: 'Clarify',
    plan: 'Plan',
    tasks: 'Tasks',
    analyze: 'Analyze',
    implement: 'Implement',
};

function stepLabel(step: StepName | string | null | undefined): string {
    if (!step) {
        return 'Step';
    }
    return STEP_LABELS[step as StepName] ?? String(step);
}

function entryLabel(entry: HistoryEntryView): string {
    // A per-task implement finish must read as that task, not as the step's
    // completion — otherwise "T004 done" renders "Implement completed".
    if (isPerTaskEntry(entry)) {
        return `${stepLabel(entry.step)} · ${entry.task}`;
    }
    if (entry.substep) {
        return `${stepLabel(entry.step)} · ${entry.substep}`;
    }
    return entry.kind === 'complete'
        ? `${stepLabel(entry.step)} completed`
        : `${stepLabel(entry.step)} started`;
}

export function formatRelative(fromIso: string, now: number): string {
    const then = Date.parse(fromIso);
    if (Number.isNaN(then)) {
        return '';
    }
    const seconds = Math.max(0, Math.floor((now - then) / 1000));
    if (seconds < 60) {
        return 'just now';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Derive a one-line "last transition" view from the canonical append-only
 * `history[]`. Returns null when there is no history. `now` is injectable for
 * testing; defaults to the current time. Relative time is measured from the
 * entry's own `at`, not from a step's start.
 */
export function deriveLastTransition(
    ctx: HistoryHolder | undefined | null,
    now: number = Date.now()
): LastTransition | null {
    const history = ctx?.history;
    if (!Array.isArray(history) || history.length === 0) {
        return null;
    }
    const entry = history[history.length - 1];
    if (!entry || typeof entry.at !== 'string') {
        return null;
    }
    return {
        label: entryLabel(entry),
        at: entry.at,
        relative: formatRelative(entry.at, now),
        // Only a per-task implement finish carries an active task id; step-boundary
        // and substep entries leave this undefined.
        task: isPerTaskEntry(entry) ? entry.task ?? undefined : undefined,
    };
}
