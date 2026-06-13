import { Button } from '../../../shared/components/Button';
import { Toast } from '../../../shared/components/Toast';
import type {
    EnhancementButton,
    SerializedFooterAction,
    ViewerState,
    VSCodeApi,
    ViewerToExtensionMessage,
} from '../../types';

declare const vscode: VSCodeApi;

const SCOPE_SUFFIX: Record<'spec' | 'step', string> = {
    spec: 'Affects whole spec',
    step: 'Affects this step',
};

function withScopeSuffix(a: SerializedFooterAction): string {
    return `${a.tooltip} (${SCOPE_SUFFIX[a.scope]})`;
}

export interface CatalogFooterProps {
    /** Canonical viewerState carrying the footer-action catalogue. */
    vs: ViewerState;
    /** Whether the spec is in a still-active phase (drives enhancement-button visibility). */
    isActive: boolean;
    /**
     * The current step is in flight (specifying / planning / tasking /
     * implementing). While true, the forward-motion lifecycle button (Approve /
     * the next step's `start`) is suppressed — the step hasn't settled, so
     * advancing it makes no sense. The spinning step tab carries the in-flight
     * signal instead (#277 Child 4).
     */
    stepInFlight?: boolean;
    /** Enhancement buttons resolved from custom commands + workflow config. */
    enhancementButtons: EnhancementButton[];
}

/**
 * Catalog-driven footer state.
 *
 * Rendered when `viewerState.footer` is populated (the canonical
 * spec-driven shape, post-Phase-3). Splits actions into a left region
 * (Regenerate + enhancement commands) and a right region (lifecycle +
 * forward motion: Refine / Approve / Reactivate / Archive / Mark Completed).
 */
export function CatalogFooter({ vs, isActive, stepInFlight = false, enhancementButtons }: CatalogFooterProps) {
    const send = (msg: ViewerToExtensionMessage) => () => vscode.postMessage(msg);
    const sendFooter = (id: string) => () => vscode.postMessage({ type: 'footerAction', id });

    const visible = vs.footer;
    const LEFT_IDS = new Set(['regenerate']);
    const RIGHT_IDS = new Set(['refine', 'approve', 'reactivate', 'archive', 'complete', 'start']);
    // While the current step is in flight, drop the forward-motion buttons
    // (Approve / next-step `start`) — the step hasn't settled. Closure/refine
    // actions (archive / complete / reactivate / refine) are unaffected.
    const FORWARD_MOTION_IDS = new Set(['approve', 'start']);
    const leftActions = visible.filter((a) => LEFT_IDS.has(a.id));
    const rightActions = visible.filter(
        (a) => RIGHT_IDS.has(a.id) && !(stepInFlight && FORWARD_MOTION_IDS.has(a.id)),
    );

    // Once the spec is at the closure gate (Mark Completed / Reactivate are
    // offered), the optional refinement commands no longer make sense — gate
    // on the footer's actual closure actions rather than the status string.
    const specClosureReady = visible.some((a) => a.id === 'complete' || a.id === 'reactivate');

    const renderAction = (a: SerializedFooterAction) => {
        const isPrimary = a.id === 'approve' || a.id === 'complete' || a.id === 'reactivate';
        const isRefine = a.id === 'refine';
        return (
            <Button
                key={a.id}
                label={a.label}
                variant={isRefine ? 'enhancement' : (isPrimary ? 'primary' : 'secondary')}
                title={withScopeSuffix(a)}
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
