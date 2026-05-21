import { useState, useEffect } from 'preact/hooks';
import type { VSCodeApi, ViewerToExtensionMessage, SerializedFooterAction } from '../types';
import { navState, viewerState } from '../signals';
import { findActiveDoc } from '../scratchpad';
import { Button } from '../../shared/components/Button';
import { Toast } from '../../shared/components/Toast';
import { UndoToast } from '../../shared/components/UndoToast';
import { useInlineConfirm } from '../../shared/hooks/useInlineConfirm';

declare const vscode: VSCodeApi;

const SCOPE_SUFFIX: Record<'spec' | 'step', string> = {
    spec: 'Affects whole spec',
    step: 'Affects this step',
};

// Spec 099: how long to show "Generating…" before falling back to an enabled
// footer so the UI never strands. Generous — the manual "Mark step complete"
// button covers faster recovery.
const RECOVERY_TIMEOUT_MS = 10 * 60 * 1000;

const GENERATING_LABELS: Record<string, string> = {
    spec: 'Spec',
    specify: 'Spec',
    plan: 'Plan',
    tasks: 'Tasks',
    implement: 'Implementation',
};

function generatingLabel(step: string): string {
    return GENERATING_LABELS[step] ?? step.charAt(0).toUpperCase() + step.slice(1);
}

function withScopeSuffix(a: SerializedFooterAction): string {
    return `${a.tooltip} (${SCOPE_SUFFIX[a.scope]})`;
}

export interface FooterActionsProps {
    initialSpecStatus: string;
}

export function FooterActions({ initialSpecStatus }: FooterActionsProps) {
    const ns = navState.value;
    const vs = viewerState.value;
    const [regenerateToastActive, setRegenerateToastActive] = useState(false);

    if (!ns) return null;

    const send = (msg: ViewerToExtensionMessage) => () => vscode.postMessage(msg);

    // A step is "running" when activeStep is set AND its stepHistory entry
    // has startedAt with no completedAt. Requiring startedAt prevents
    // false positives on terminal-archived specs where the entry is
    // missing entirely (which previously disabled Reactivate).
    const runningStep = ns.activeStep ?? null;
    const runningEntry = runningStep ? ns.stepHistory?.[runningStep] : null;
    const isRunning = !!(runningEntry?.startedAt && !runningEntry.completedAt);

    // Spec 099: a running step is "generating" until its artifact is detected on
    // disk (R002/R003). After RECOVERY_TIMEOUT_MS we drop back to the normal
    // (enabled) footer so the UI never strands (R005).
    const artifactReady = ns.runningStepArtifactReady ?? false;
    const startedAtMs = ns.runningStepStartedAt ? Date.parse(ns.runningStepStartedAt) : NaN;
    const timedOut = !Number.isNaN(startedAtMs) && Date.now() - startedAtMs > RECOVERY_TIMEOUT_MS;
    const isGenerating = isRunning && !artifactReady && !timedOut;

    // Re-render once the recovery window elapses, even with no navState update.
    const [, forceTick] = useState(0);
    useEffect(() => {
        if (!isGenerating || Number.isNaN(startedAtMs)) return;
        const remaining = startedAtMs + RECOVERY_TIMEOUT_MS - Date.now();
        if (remaining <= 0) return;
        const t = setTimeout(() => forceTick(v => v + 1), remaining);
        return () => clearTimeout(t);
    }, [isGenerating, startedAtMs]);

    // R024/R030: Regenerate queues behind a 5s undo toast. Never shown
    // while another step is already running (the button stays disabled).
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

    // R026: Archive/Complete/Reactivate require a two-click confirm.
    const archiveConfirm = useInlineConfirm(
        () => vscode.postMessage({ type: 'archiveSpec' })
    );
    const completeConfirm = useInlineConfirm(
        () => vscode.postMessage({ type: 'completeSpec' })
    );
    const reactivateConfirm = useInlineConfirm(
        () => vscode.postMessage({ type: 'reactivateSpec' })
    );

    // Scratchpad view: read-only history of inline-comment batches. The only
    // footer affordance is Edit, which opens the file in the standard editor
    // for manual cleanup. The dispatch path stays on the source-tab batch
    // Refine — there is no scratchpad-tab Refine.
    const activeDoc = findActiveDoc(ns);
    if (activeDoc?.isScratchpad) {
        return (
            <footer class="actions">
                <Toast id="action-toast" />
                <div class="actions-left"></div>
                <div class="actions-right">
                    <Button
                        label="Edit"
                        variant="secondary"
                        title="Open this scratchpad in the editor"
                        onClick={send({ type: 'editDocument' })}
                    />
                </div>
            </footer>
        );
    }

    // Spec 099: while a step is generating, replace the forward button with a
    // disabled "Generating <step>…" spinner plus a manual completion fallback.
    // Applies to every step transition (R001/R004/R006).
    if (isGenerating && runningStep) {
        return (
            <footer class="actions">
                <Toast id="action-toast" />
                <div class="actions-left"></div>
                <div class="actions-right">
                    <Button
                        label={`Generating ${generatingLabel(runningStep)}…`}
                        variant="primary"
                        loading
                        title="The AI is generating this step — the button re-enables once the artifact is ready"
                    />
                    <Button
                        label="Mark step complete"
                        variant="secondary"
                        title="Manually mark this step complete if auto-detection doesn't fire"
                        onClick={send({ type: 'markStepComplete' })}
                    />
                </div>
            </footer>
        );
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

    // If viewerState.footer is populated, drive lifecycle/step buttons from it.
    if (vs && Array.isArray(vs.footer) && vs.footer.length > 0) {
        const sendFooter = (id: string) => () =>
            vscode.postMessage({ type: 'footerAction', id });

        // Spec 099: the generating state is handled by the early return above.
        // Reaching here means the step is idle, ready, or past the recovery
        // timeout — so the footer's forward/lifecycle buttons are shown enabled.
        const visible = vs.footer;

        // Route each action to the left or right region:
        //   Left  = Regenerate (leftmost) followed by the optional-command
        //           enhancement buttons — the "redo / refine this step" tools.
        //   Right = lifecycle + forward motion (Refine, Approve, Reactivate,
        //           Archive, Mark Completed). Closure controls live on the
        //           right next to the next-step button so the user's eye
        //           lands on "what do I do next" in one place.
        const LEFT_IDS = new Set(['regenerate']);
        const RIGHT_IDS = new Set([
            'refine',
            'approve',
            'reactivate',
            'archive',
            'complete',
            'start',
        ]);
        const leftActions = visible.filter(a => LEFT_IDS.has(a.id));
        const rightActions = visible.filter(a => RIGHT_IDS.has(a.id));

        // Once the spec is at the closure gate (Mark Completed / Reactivate are
        // offered), the optional refinement commands (Clarify / Checklist /
        // Analyze) no longer make sense — there's nothing left to refine. Gate
        // on the footer's actual closure actions rather than the status string,
        // which can lag behind (e.g. provider specStatus vs canonical status).
        const specClosureReady = visible.some(
            a => a.id === 'complete' || a.id === 'reactivate'
        );

        const renderAction = (a: typeof vs.footer[number]) => {
            const isPrimary = a.id === 'approve' || a.id === 'complete' || a.id === 'reactivate';
            const isRefine = a.id === 'refine';
            const baseTitle = withScopeSuffix(a);
            return (
                <Button
                    key={a.id}
                    label={a.label}
                    variant={isRefine ? 'enhancement' : (isPrimary ? 'primary' : 'secondary')}
                    title={baseTitle}
                    onClick={sendFooter(a.id)}
                />
            );
        };

        return (
            <footer class="actions">
                <Toast id="action-toast" />
                <div class="actions-left">
                    {leftActions.map(renderAction)}
                    {isActive && !specClosureReady && enhancementButtons.map((btn) => (
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
                    {rightActions.map(renderAction)}
                </div>
            </footer>
        );
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
                {/* Hide all step/closure controls during an in-flight step.
                    Reactivate stays visible on terminal states because
                    isRunning is now correctly false there. */}
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
