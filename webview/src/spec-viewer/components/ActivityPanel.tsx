import type { ViewerState } from '../types';
import { viewerState, navState } from '../signals';
import { ApproachCard } from './cards/ApproachCard';
import { PhasesCard } from './cards/PhasesCard';
import { TasksCard } from './cards/TasksCard';
import { DecisionsCard } from './cards/DecisionsCard';
import { ConcernsCard } from './cards/ConcernsCard';
import { FilesCard } from './cards/FilesCard';
import { CommentsCard } from './cards/CommentsCard';

/**
 * The viewer install banner, rendered INSIDE the Activity panel (#255 — it used
 * to be injected full-width above #app-root in `html/generator.ts`). Markup,
 * id, classes and `data-action` buttons mirror the server-rendered
 * `installBanner.ts` so the existing document-delegated click handler still
 * resolves `installSpecKitExtension` / `openReadme`. Shown only when the
 * extension is missing (`navState.showInstallPrompt`).
 */
function InstallBanner() {
    if (!navState.value?.showInstallPrompt) return null;
    return (
        <div class="install-banner" id="install-banner" role="region" aria-label="Install spec-kit extension">
            <div class="install-banner__icon"><span class="codicon codicon-rocket" aria-hidden="true" /></div>
            <div class="install-banner__text">
                <strong>Install the spec-kit extension to unlock Turbo &amp; Capture</strong>
                <span>The companion spec-kit extension adds the leaner <code>/speckit.companion.*</code> pipeline and lifecycle capture. It's a one-click install — no need to leave the editor.</span>
            </div>
            <div class="install-banner__actions">
                <button class="install-banner__btn install-banner__btn--primary" data-action="installSpecKitExtension">Install spec-kit extension</button>
                <button class="install-banner__btn install-banner__btn--link" data-action="openReadme">Learn more</button>
            </div>
        </div>
    );
}

function hasAnyData(state: ViewerState): boolean {
    if (state.approach || state.lastAction || state.prUrl) return true;
    if (state.taskSummaries && Object.keys(state.taskSummaries).length > 0) return true;
    if (state.decisions && state.decisions.length > 0) return true;
    if (state.concerns && state.concerns.length > 0) return true;
    if (state.filesModified && state.filesModified.length > 0) return true;
    if (state.reviewComments && state.reviewComments.length > 0) return true;
    if (state.history && state.history.length > 0) return true;
    if (state.stepHistory && Object.keys(state.stepHistory).length > 0) return true;
    return false;
}

export function ActivityPanel() {
    const state = viewerState.value;

    if (!state || !hasAnyData(state)) {
        return (
            <div class="activity-panel">
                <InstallBanner />
                <div class="activity-empty">No activity recorded yet</div>
            </div>
        );
    }

    return (
        <div class="activity-panel">
            <InstallBanner />
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
