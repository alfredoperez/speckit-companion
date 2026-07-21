import type { ViewerState } from '../types';
import { viewerState, navState, historyEntries } from '../signals';
import { hasAnyData } from '../overviewModel';
import {
    IntentSection,
    ExpectationsSection,
    VerifiedSection,
    DecisionsSection,
    CoverageSection,
} from './OverviewDossier';
import { PhasesCard } from './cards/PhasesCard';
import { TasksCard } from './cards/TasksCard';
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
            <span class="install-banner__icon codicon codicon-rocket" aria-hidden="true" />
            <span class="install-banner__text">Install the spec-kit extension for the leaner <code>/speckit.companion.*</code> pipeline and capture.</span>
            <button type="button" class="install-banner__btn install-banner__btn--primary" data-action="installSpecKitExtension">Install</button>
            <button type="button" class="install-banner__btn install-banner__btn--link" data-action="openReadme">Learn more</button>
            <button type="button" class="install-banner__dismiss codicon codicon-close" data-action="dismissInstallBanner" aria-label="Dismiss install prompt" />
        </div>
    );
}

/** The last few recorded finishes, newest first — the Overview's pulse line. */
function LatestFeed() {
    const entries = historyEntries.value
        .filter(entry => entry.kind === 'complete')
        .slice(-3)
        .reverse();
    if (entries.length === 0) return null;
    const fmtTime = (iso: string) => {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    return (
        <section class="activity-feed" aria-label="Latest activity">
            <span class="activity-feed__label">Latest activity</span>
            <ul>
                {entries.map((entry, i) => (
                    <li key={`${entry.step}-${entry.at}-${i}`}>
                        <span class="activity-feed__mark" aria-hidden="true"></span>
                        <span class="activity-feed__text">
                            {entry.task
                                ? `${entry.task} finished`
                                : `${entry.step}${entry.substep ? ` · ${entry.substep}` : ''} complete`}
                        </span>
                        <time>{fmtTime(entry.at)}</time>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Whether any of the work-log cards inside the disclosure would render. */
function hasRunLogData(state: ViewerState): boolean {
    return (
        (state.history?.length ?? 0) > 0 ||
        Object.keys(state.stepHistory ?? {}).length > 0 ||
        Object.keys(state.taskSummaries ?? {}).length > 0 ||
        (state.concerns?.length ?? 0) > 0 ||
        (state.filesModified?.length ?? 0) > 0 ||
        (state.reviewComments?.length ?? 0) > 0 ||
        !!state.lastAction
    );
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

    const taskCount = Object.keys(state.taskSummaries ?? {}).length;

    // Lifecycle signal first, then durable context (why → fence → proof →
    // choices → traceability); granular run history stays collapsed below.
    return (
        <div class="activity-panel dossier">
            <InstallBanner />
            <IntentSection state={state} />
            <ExpectationsSection state={state} />
            <VerifiedSection state={state} />
            <DecisionsSection state={state} />
            <CoverageSection state={state} />
            {hasRunLogData(state) && (
                <details class="dossier-log">
                    <summary>
                        Run log{taskCount > 0 ? ` and ${taskCount} task record${taskCount === 1 ? '' : 's'}` : ''}
                    </summary>
                    <div class="dossier-log__body">
                        {state.lastAction && <p class="dossier-log__last-action">{state.lastAction}</p>}
                        <LatestFeed />
                        <PhasesCard state={state} />
                        <TasksCard state={state} />
                        <ConcernsCard state={state} />
                        <FilesCard state={state} />
                        <CommentsCard state={state} />
                    </div>
                </details>
            )}
        </div>
    );
}
