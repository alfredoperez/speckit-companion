import type { ViewerState } from './types';

/**
 * Tab model for the Activity panel: which tabs exist for a given state,
 * their labels/badges, and which one opens by default. Pure functions so
 * the rule set is unit-testable without rendering.
 */

export type ActivityTabId = 'decisions' | 'work' | 'proof' | 'notes';

export interface ActivityTab {
    id: ActivityTabId;
    label: string;
    /** Count badge; undefined renders no badge. */
    count?: number;
    /** Attention badge (uncovered/concerns) — renders with warning treatment. */
    warning?: boolean;
}

function hasWork(state: ViewerState): boolean {
    return (
        (state.history?.length ?? 0) > 0 ||
        Object.keys(state.stepHistory ?? {}).length > 0 ||
        Object.keys(state.taskSummaries ?? {}).length > 0 ||
        (state.filesModified?.length ?? 0) > 0
    );
}

function proofCount(state: ViewerState): number {
    return (state.verified?.length ?? 0) + (state.coverage?.length ?? 0);
}

function notesCount(state: ViewerState): number {
    return (
        (state.concerns?.length ?? 0) +
        (state.reviewComments?.length ?? 0) +
        (state.livingSpecs ? 1 : 0)
    );
}

/** A count badge that renders with warning treatment, or nothing when there's nothing to flag. */
function attentionBadge(count: number): Pick<ActivityTab, 'count' | 'warning'> {
    return count > 0 ? { count, warning: true } : {};
}

/** The tabs that have content for this state, in canonical order. */
export function activityTabs(state: ViewerState): ActivityTab[] {
    const tabs: ActivityTab[] = [];
    if ((state.decisions?.length ?? 0) > 0) {
        tabs.push({ id: 'decisions', label: 'Decisions', count: state.decisions!.length });
    }
    if (hasWork(state)) {
        const tasks = Object.keys(state.taskSummaries ?? {}).length;
        tabs.push({ id: 'work', label: 'Work', count: tasks > 0 ? tasks : undefined });
    }
    if (proofCount(state) > 0) {
        // Proof mixes checks + requirements, so the badge flags only the actionable count: uncovered requirements.
        const uncovered = (state.coverage ?? []).filter(r => r.tests.length === 0).length;
        tabs.push({ id: 'proof', label: 'Proof', ...attentionBadge(uncovered) });
    }
    if (notesCount(state) > 0) {
        const concerns = state.concerns?.length ?? 0;
        tabs.push({ id: 'notes', label: 'Notes', ...attentionBadge(concerns) });
    }
    return tabs;
}

/**
 * Default tab rule: Proof when something demands attention (uncovered
 * requirements or open concerns), else Decisions, else the first tab.
 */
export function defaultActivityTab(state: ViewerState): ActivityTabId | null {
    const tabs = activityTabs(state);
    if (tabs.length === 0) return null;
    const uncovered = (state.coverage ?? []).some(r => r.tests.length === 0);
    const concerned = (state.concerns?.length ?? 0) > 0;
    if ((uncovered || concerned) && tabs.some(t => t.id === 'proof')) return 'proof';
    if (tabs.some(t => t.id === 'decisions')) return 'decisions';
    return tabs[0].id;
}
