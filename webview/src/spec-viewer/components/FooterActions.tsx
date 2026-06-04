import { useState, useEffect } from 'preact/hooks';
import type { VSCodeApi, ViewerToExtensionMessage } from '../types';
import { navState, viewerState } from '../signals';
import { Button } from '../../shared/components/Button';
import { Toast } from '../../shared/components/Toast';
import { UndoToast } from '../../shared/components/UndoToast';
import { useInlineConfirm } from '../../shared/hooks/useInlineConfirm';
import { GeneratingFooter } from './footer/GeneratingFooter';
import { CatalogFooter } from './footer/CatalogFooter';

declare const vscode: VSCodeApi;

// How long to show "Generating…" before falling back to an enabled footer so
// the UI never strands. Generous — the manual "Mark step complete" button
// covers faster recovery.
const RECOVERY_TIMEOUT_MS = 10 * 60 * 1000;

// `SCOPE_SUFFIX` / `withScopeSuffix` live in CatalogFooter (the only path
// that uses them).

export interface FooterActionsProps {
    initialSpecStatus: string;
}

export function FooterActions({ initialSpecStatus }: FooterActionsProps) {
    const ns = navState.value;
    const vs = viewerState.value;

    // All hooks must run before the early `if (!ns)` return below, so they read
    // navState defensively (it can be momentarily null before the first update).
    const [regenerateToastActive, setRegenerateToastActive] = useState(false);
    const [, forceTick] = useState(0);

    // A step is "running" when activeStep is set AND its stepHistory entry has
    // startedAt with no completedAt. Requiring startedAt avoids false positives
    // on terminal-archived specs whose entry is missing entirely (which
    // previously disabled Reactivate).
    const runningStep = ns?.activeStep ?? null;
    const runningEntry = runningStep ? ns?.stepHistory?.[runningStep] : null;
    const isRunning = !!(runningEntry?.startedAt && !runningEntry.completedAt);

    // A running step stays "generating" until its artifact is detected on disk;
    // after RECOVERY_TIMEOUT_MS the footer drops back to its enabled buttons so
    // the UI never strands.
    const artifactReady = ns?.runningStepArtifactReady ?? false;
    const startedAtMs = ns?.runningStepStartedAt ? Date.parse(ns.runningStepStartedAt) : NaN;
    const timedOut = !Number.isNaN(startedAtMs) && Date.now() - startedAtMs > RECOVERY_TIMEOUT_MS;
    const isGenerating = isRunning && !artifactReady && !timedOut;

    // Re-render once the recovery window elapses, even with no navState update.
    useEffect(() => {
        if (!isGenerating || Number.isNaN(startedAtMs)) return;
        const remaining = startedAtMs + RECOVERY_TIMEOUT_MS - Date.now();
        if (remaining <= 0) return;
        const t = setTimeout(() => forceTick(v => v + 1), remaining);
        return () => clearTimeout(t);
    }, [isGenerating, startedAtMs]);

    // Archive/Complete/Reactivate require a two-click confirm.
    const archiveConfirm = useInlineConfirm(
        () => vscode.postMessage({ type: 'archiveSpec' })
    );
    const completeConfirm = useInlineConfirm(
        () => vscode.postMessage({ type: 'completeSpec' })
    );
    const reactivateConfirm = useInlineConfirm(
        () => vscode.postMessage({ type: 'reactivateSpec' })
    );

    if (!ns) return null;

    const send = (msg: ViewerToExtensionMessage) => () => vscode.postMessage(msg);

    // Regenerate queues behind a 5s undo toast; never shown while a step runs.
    const onRegenerateClick = () => {
        if (isRunning) return;
        setRegenerateToastActive(true);
    };
    const regenerateElapse = () => {
        setRegenerateToastActive(false);
        vscode.postMessage({ type: 'regenerate' });
    };
    const regenerateUndo = () => {
        setRegenerateToastActive(false);
    };

    // While a step is generating, render the live status as a non-clickable
    // chip on the right and demote the manual override to a secondary action
    // on the left. The two affordances communicate "one thing is happening,
    // one thing is a fallback override."
    if (isGenerating && runningStep) {
        return <GeneratingFooter ns={ns} />;
    }

    const status = vs?.status || ns.footerState?.specStatus || ns.specStatus || initialSpecStatus;
    const isTasksDone = status === 'tasks-done';
    const isCompleted = status === 'completed';
    const isArchived = status === 'archived';
    // 'implemented' is the "ready to mark complete" gate (Mark Completed shows).
    // Treat it like done so refinement (enhancement) buttons stop surfacing once
    // the tasks are complete — they only belong while the spec is still active.
    const isReadyToComplete = status === 'implemented';
    const isActive = !isTasksDone && !isCompleted && !isArchived && !isReadyToComplete;

    const enhancementButtons = ns.footerState?.enhancementButtons ?? ns.enhancementButtons ?? [];

    // If viewerState.footer is populated, drive lifecycle/step buttons from
    // it. Delegates to CatalogFooter; the dispatch logic lives in one place.
    if (vs && Array.isArray(vs.footer) && vs.footer.length > 0) {
        return <CatalogFooter vs={vs} isActive={isActive} enhancementButtons={enhancementButtons} />;
    }

    // Legacy fallback: only show Archive once the spec is at a closure-eligible
    // stage (tasks-done / completed / archived). Mirrors the catalog path's
    // isSpecDone gate in src/features/spec-viewer/footerActions.ts.
    const isLegacyDone = isTasksDone || isCompleted || isArchived;

    return (
        <footer class="actions">
            <Toast id="action-toast" />
            <div class="actions-left">
                {isLegacyDone && !isArchived && !isRunning && (
                    <Button
                        label={archiveConfirm.label ?? 'Archive'}
                        variant="secondary"
                        title={archiveConfirm.armed ? 'Click again to confirm archive' : 'Archive this spec'}
                        onClick={archiveConfirm.onClick}
                    />
                )}
                {isActive && enhancementButtons.map((btn) => (
                    <Button
                        key={btn.command}
                        label={btn.label}
                        variant="enhancement"
                        icon={btn.icon}
                        title={btn.tooltip || btn.label}
                        onClick={send({ type: 'clarify', command: btn.command })}
                    />
                ))}
            </div>
            <div class="actions-right">
                {/* Legacy no-viewerState fallback: hides step/closure controls
                    while a step is in flight (the catalog path above uses the
                    richer Generating state instead). Reactivate stays visible on
                    terminal states because isRunning is false there. */}
                {isArchived || isCompleted ? (
                    <Button
                        label={reactivateConfirm.label ?? 'Reactivate'}
                        variant="primary"
                        title={reactivateConfirm.armed ? 'Click again to confirm reactivate' : 'Reactivate this spec'}
                        onClick={reactivateConfirm.onClick}
                    />
                ) : isTasksDone && !isRunning ? (
                    <Button
                        label={completeConfirm.label ?? 'Complete'}
                        variant="primary"
                        title={completeConfirm.armed ? 'Click again to confirm complete' : 'Mark this spec complete'}
                        onClick={completeConfirm.onClick}
                    />
                ) : !isRunning ? (
                    <>
                        <Button
                            label="Regenerate"
                            variant="secondary"
                            title="Regenerate the current step from scratch"
                            disabled={regenerateToastActive}
                            onClick={onRegenerateClick}
                        />
                        {ns.footerState?.showApproveButton && (
                            <Button
                                label={ns.footerState.approveText}
                                variant="primary"
                                title="Approve and advance to the next step"
                                onClick={send({ type: 'approve' })}
                            />
                        )}
                    </>
                ) : null}
            </div>
            {regenerateToastActive && (
                <UndoToast
                    message="Regenerating in 5s…"
                    countdownMs={5000}
                    onElapse={regenerateElapse}
                    onUndo={regenerateUndo}
                    active={regenerateToastActive}
                />
            )}
        </footer>
    );
}
