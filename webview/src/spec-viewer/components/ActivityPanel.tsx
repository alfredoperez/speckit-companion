import type { ViewerState } from '../types';
import { viewerState } from '../signals';
import { ApproachCard } from './cards/ApproachCard';
import { PhasesCard } from './cards/PhasesCard';
import { TasksCard } from './cards/TasksCard';
import { DecisionsCard } from './cards/DecisionsCard';
import { ConcernsCard } from './cards/ConcernsCard';
import { FilesCard } from './cards/FilesCard';
import { CommentsCard } from './cards/CommentsCard';

function hasAnyData(state: ViewerState): boolean {
    if (state.approach || state.lastAction || state.prUrl) return true;
    if (state.taskSummaries && Object.keys(state.taskSummaries).length > 0) return true;
    if (state.decisions && state.decisions.length > 0) return true;
    if (state.concerns && state.concerns.length > 0) return true;
    if (state.filesModified && state.filesModified.length > 0) return true;
    if (state.reviewComments && state.reviewComments.length > 0) return true;
    if (state.transitions && state.transitions.length > 0) return true;
    if (state.stepHistory && Object.keys(state.stepHistory).length > 0) return true;
    return false;
}

export function ActivityPanel() {
    const state = viewerState.value;

    if (!state || !hasAnyData(state)) {
        return (
            <div class="activity-panel">
                <div class="activity-empty">No activity recorded yet</div>
            </div>
        );
    }

    return (
        <div class="activity-panel">
            <ApproachCard state={state} />
            <PhasesCard state={state} />
            <TasksCard state={state} />
            <DecisionsCard state={state} />
            <ConcernsCard state={state} />
            <CommentsCard state={state} />
            <FilesCard state={state} />
        </div>
    );
}
