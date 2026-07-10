/**
 * Footer button matrix oracle (encoded from
 * specs/124-fix-footer-button-visibility/contracts/footer-button-matrix.md).
 *
 * Each row maps one true state — `(status, currentStep, history)` — to the
 * expected Left + Right footer button ids and, for forward stages, the resolved
 * Approve label. The determinism tests assert the live-derived footer equals
 * these sets for every row.
 *
 * Zones (mirrors webview CatalogFooter): Left = `regenerate`. Right = `refine`,
 * `approve`, `reactivate`, `archive`, `complete`.
 */

import type {
    HistoryEntry,
    StepName,
    Status,
} from '../../../core/types/specContext';
import type { WorkflowStepConfig } from '../../workflows/types';

/** Linear workflow used by the oracle so Approve resolves to the next label. */
export const WORKFLOW_STEPS: WorkflowStepConfig[] = [
    { name: 'specify', label: 'Spec', command: 'speckit.specify' },
    { name: 'plan', label: 'Plan', command: 'speckit.plan' },
    { name: 'tasks', label: 'Tasks', command: 'speckit.tasks' },
    { name: 'implement', label: 'Implement', command: 'speckit.implement' },
];

const T = '2026-01-01T00:00:00Z';

function start(step: StepName, from: StepName | null): HistoryEntry {
    return { step, substep: null, kind: 'start', from: { step: from, substep: null }, by: 'extension', at: T };
}
function complete(step: StepName): HistoryEntry {
    return { step, substep: null, kind: 'complete', by: 'extension', at: T };
}
/** The gear's force-status rollback boundary (`forceStatus` → `setStepCompleted(step, 'user')`). */
function forcedComplete(step: StepName): HistoryEntry {
    return { step, substep: null, kind: 'complete', by: 'user', at: T };
}

/** Append-only history for every step up to (and including completion of) `through`. */
function historyThrough(through: StepName): HistoryEntry[] {
    const order: StepName[] = ['specify', 'plan', 'tasks', 'implement'];
    const out: HistoryEntry[] = [];
    let prev: StepName | null = null;
    for (const s of order) {
        out.push(start(s, prev));
        out.push(complete(s));
        prev = s;
        if (s === through) break;
    }
    return out;
}

export interface FooterMatrixRow {
    /** Human-readable row label (the pause stage). */
    name: string;
    status: Status;
    currentStep: StepName;
    history: HistoryEntry[];
    /** Expected action ids in the left zone. */
    left: string[];
    /** Expected action ids in the right zone. */
    right: string[];
    /** Expected resolved label of the `approve` action, when present. */
    approveLabel?: string;
}

export const FOOTER_MATRIX: FooterMatrixRow[] = [
    {
        name: 'specified',
        status: 'specified',
        currentStep: 'specify',
        history: historyThrough('specify'),
        left: ['regenerate'],
        right: ['approve'],
        approveLabel: 'Plan',
    },
    {
        name: 'planned',
        status: 'planned',
        currentStep: 'plan',
        history: historyThrough('plan'),
        left: ['regenerate'],
        right: ['approve'],
        approveLabel: 'Tasks',
    },
    {
        name: 'ready-to-implement',
        status: 'ready-to-implement',
        currentStep: 'tasks',
        history: historyThrough('tasks'),
        left: ['regenerate'],
        right: ['approve'],
        approveLabel: 'Implement',
    },
    {
        // implement dispatched, run interrupted (dangling start), user forces
        // ready-to-implement via the gear — the Implement button must come back.
        name: 'ready-to-implement (recovered after interrupted implement)',
        status: 'ready-to-implement',
        currentStep: 'tasks',
        history: [...historyThrough('tasks'), start('implement', 'tasks'), forcedComplete('tasks')],
        left: ['regenerate'],
        right: ['approve'],
        approveLabel: 'Implement',
    },
    {
        name: 'planned (recovered after interrupted implement)',
        status: 'planned',
        currentStep: 'plan',
        history: [...historyThrough('tasks'), start('implement', 'tasks'), forcedComplete('plan')],
        left: ['regenerate'],
        right: ['approve'],
        approveLabel: 'Tasks',
    },
    {
        name: 'ready-to-implement (recovered twice after repeated interruptions)',
        status: 'ready-to-implement',
        currentStep: 'tasks',
        history: [
            ...historyThrough('tasks'),
            start('implement', 'tasks'),
            forcedComplete('tasks'),
            start('implement', 'tasks'),
            forcedComplete('tasks'),
        ],
        left: ['regenerate'],
        right: ['approve'],
        approveLabel: 'Implement',
    },
    {
        // Guard rail: a LATER step genuinely ahead (its start follows this step's
        // last boundary — no rollback in between) must still hide Approve.
        name: 'tasks tab while implement is genuinely ahead (stale currentStep)',
        status: 'ready-to-implement',
        currentStep: 'tasks',
        history: [...historyThrough('tasks'), start('implement', 'tasks')],
        left: ['regenerate'],
        right: [],
    },
    {
        name: 'implemented',
        status: 'implemented',
        currentStep: 'implement',
        history: historyThrough('implement'),
        left: ['regenerate'],
        right: ['archive', 'complete'],
    },
    {
        name: 'completed',
        status: 'completed',
        currentStep: 'implement',
        history: historyThrough('implement'),
        left: [],
        right: ['reactivate', 'archive'],
    },
    {
        name: 'archived',
        status: 'archived',
        currentStep: 'implement',
        history: historyThrough('implement'),
        left: [],
        right: ['reactivate'],
    },
];

/** Zone partition mirroring webview CatalogFooter. */
export const LEFT_IDS = new Set(['regenerate']);
export const RIGHT_IDS = new Set(['refine', 'approve', 'reactivate', 'archive', 'complete', 'start']);
