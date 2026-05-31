import { Button } from '../../../shared/components/Button';
import { Toast } from '../../../shared/components/Toast';
import type { VSCodeApi, ViewerToExtensionMessage } from '../../types';
import type { NavState } from '../../types';

declare const vscode: VSCodeApi;

export interface GeneratingFooterProps {
    /** Snapshot of `navState.value` at render time. */
    ns: NavState;
}

/**
 * The "Generating step…" footer state.
 *
 * Rendered when the active step has `startedAt` but no `completedAt`,
 * the artifact-detection hook hasn't fired, and the recovery timeout
 * hasn't elapsed. The right side shows a non-clickable status chip;
 * the left exposes a manual override ("Mark step complete") as a
 * fallback for when auto-detection misses.
 *
 * Extracted from FooterActions in Phase 5a so the dispatch logic in
 * the parent stays focused on choosing-the-branch, and each branch
 * has its own unit-testable surface.
 */
export function GeneratingFooter({ ns }: GeneratingFooterProps) {
    const send = (msg: ViewerToExtensionMessage) => () => vscode.postMessage(msg);
    return (
        <footer class="actions">
            <Toast id="action-toast" />
            <div class="actions-left">
                <Button
                    label="Mark step complete"
                    variant="secondary"
                    title="Manually mark this step complete if auto-detection doesn't fire"
                    onClick={send({ type: 'markStepComplete' })}
                />
            </div>
            <div class="actions-right">
                <span
                    class="footer-generating-chip is-running"
                    role="status"
                    aria-live="polite"
                    title="The AI is generating this step — this status updates once the artifact is ready"
                >
                    <span class="btn-spinner" aria-hidden="true" />
                    Generating {ns.runningStepLabel ?? 'step'}…
                </span>
            </div>
        </footer>
    );
}
