import type { ViewerState } from '../types';
import { viewerState, navState } from '../signals';
import { ApproachCard } from './cards/ApproachCard';
import { IntentCard } from './cards/IntentCard';
import { PhasesCard } from './cards/PhasesCard';
import { TasksCard } from './cards/TasksCard';
import { DecisionsCard } from './cards/DecisionsCard';
import { VerifiedCard } from './cards/VerifiedCard';
import { CoverageCard } from './cards/CoverageCard';
import { ConcernsCard } from './cards/ConcernsCard';
import { FilesCard } from './cards/FilesCard';
import { CommentsCard } from './cards/CommentsCard';
import { LivingSpecsCard } from './cards/LivingSpecsCard';

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
            <span class="install-banner__icon codicon codicon-rocket" aria-hidden="true" />
            <span class="install-banner__text">Install the spec-kit extension for the leaner <code>/speckit.companion.*</code> pipeline and capture.</span>
            <button type="button" class="install-banner__btn install-banner__btn--primary" data-action="installSpecKitExtension">Install</button>
            <button type="button" class="install-banner__btn install-banner__btn--link" data-action="openReadme">Learn more</button>
            <button type="button" class="install-banner__dismiss codicon codicon-close" data-action="dismissInstallBanner" aria-label="Dismiss install prompt" />
        </div>
    );
}

function hasAnyData(state: ViewerState): boolean {
    if (state.approach || state.lastAction || state.prUrl) return true;
    if (state.taskSummaries && Object.keys(state.taskSummaries).length > 0) return true;
    if (state.decisions && state.decisions.length > 0) return true;
    if (state.intent || (state.expectations && state.expectations.length > 0)) return true;
    if (state.verified && state.verified.length > 0) return true;
    if (state.coverage && state.coverage.length > 0) return true;
    if (state.concerns && state.concerns.length > 0) return true;
    if (state.filesModified && state.filesModified.length > 0) return true;
    if (state.reviewComments && state.reviewComments.length > 0) return true;
    if (state.livingSpecs) return true;
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
            <IntentCard state={state} />
            <ApproachCard state={state} />
            <DecisionsCard state={state} />
            <PhasesCard state={state} />
            <LivingSpecsCard state={state} />
            <TasksCard state={state} />
            <VerifiedCard state={state} />
            <CoverageCard state={state} />
            <ConcernsCard state={state} />
            <CommentsCard state={state} />
            <FilesCard state={state} />
        </div>
    );
}
