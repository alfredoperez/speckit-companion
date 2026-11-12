/** The recorded activity the Overview is drawn from; a structural slice of the viewer state. */
export interface RecordedActivity {
    approach?: string;
    lastAction?: string;
    prUrl?: string;
    taskSummaries?: object;
    decisions?: readonly unknown[];
    intent?: string;
    expectations?: readonly unknown[];
    verified?: readonly unknown[];
    coverage?: readonly unknown[];
    concerns?: readonly unknown[];
    filesModified?: readonly unknown[];
    livingSpecs?: unknown;
    history?: readonly unknown[];
    stepHistory?: object;
}

/** Whether the run recorded anything; a status, a step and the reader's review comments are not a run. */
export function hasAnyData(state: RecordedActivity): boolean {
    if (state.approach || state.lastAction || state.prUrl) return true;
    if (state.taskSummaries && Object.keys(state.taskSummaries).length > 0) return true;
    if (state.decisions && state.decisions.length > 0) return true;
    if (state.intent || (state.expectations && state.expectations.length > 0)) return true;
    if (state.verified && state.verified.length > 0) return true;
    if (state.coverage && state.coverage.length > 0) return true;
    if (state.concerns && state.concerns.length > 0) return true;
    if (state.filesModified && state.filesModified.length > 0) return true;
    if (state.livingSpecs) return true;
    if (state.history && state.history.length > 0) return true;
    if (state.stepHistory && Object.keys(state.stepHistory).length > 0) return true;
    return false;
}

/** Whether a spec has an Overview to show; the viewer pane and the editor tab title both read this. */
export function hasOverview(
    viewerState: RecordedActivity | null | undefined,
    activityPanelEnabled: boolean,
    livingMode: boolean,
): boolean {
    if (livingMode) return false;
    return activityPanelEnabled && !!viewerState && hasAnyData(viewerState);
}
