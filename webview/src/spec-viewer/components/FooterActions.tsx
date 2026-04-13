import type { VSCodeApi, ViewerToExtensionMessage, SerializedFooterAction } from '../types';
import { navState, viewerState } from '../signals';
import { Button } from '../../shared/components/Button';
import { Toast } from '../../shared/components/Toast';

declare const vscode: VSCodeApi;

const SCOPE_SUFFIX: Record<'spec' | 'step', string> = {
    spec: 'Affects whole spec',
    step: 'Affects this step',
};

function withScopeSuffix(a: SerializedFooterAction): string {
    return `${a.tooltip} (${SCOPE_SUFFIX[a.scope]})`;
}

export interface FooterActionsProps {
    initialSpecStatus: string;
}

export function FooterActions({ initialSpecStatus }: FooterActionsProps) {
    const ns = navState.value;
    const vs = viewerState.value;
    if (!ns) return null;

    const send = (msg: ViewerToExtensionMessage) => () => vscode.postMessage(msg);

    const status = vs?.status || ns.footerState?.specStatus || ns.specStatus || initialSpecStatus;
    const isTasksDone = status === 'tasks-done';
    const isCompleted = status === 'completed';
    const isArchived = status === 'archived';
    const isActive = !isTasksDone && !isCompleted && !isArchived;

    const enhancementButtons = ns.footerState?.enhancementButtons ?? ns.enhancementButtons ?? [];

    // If viewerState.footer is populated, drive lifecycle/step buttons from it.
    if (vs && Array.isArray(vs.footer) && vs.footer.length > 0) {
        const sendFooter = (id: string) => () =>
            vscode.postMessage({ type: 'footerAction', id });
        return (
            <footer class="actions">
                <Toast id="action-toast" />
                <div class="actions-left">
                    <Button label="Edit Source" variant="secondary" onClick={send({ type: 'editSource' })} />
                    {isActive && enhancementButtons.map((btn) => (
                        <Button
                            key={btn.command}
                            label={btn.label}
                            variant="enhancement"
                            icon={btn.icon}
                            title={btn.tooltip || ''}
                            onClick={send({ type: 'clarify', command: btn.command })}
                        />
                    ))}
                </div>
                <div class="actions-right">
                    {vs.footer.map((a) => (
                        <Button
                            key={a.id}
                            label={a.label}
                            variant={a.id === 'approve' || a.id === 'complete' || a.id === 'reactivate' ? 'primary' : 'secondary'}
                            title={withScopeSuffix(a)}
                            onClick={sendFooter(a.id)}
                        />
                    ))}
                </div>
            </footer>
        );
    }

    return (
        <footer class="actions">
            <Toast id="action-toast" />
            <div class="actions-left">
                <Button label="Edit Source" variant="secondary" onClick={send({ type: 'editSource' })} />
                {!isArchived && <Button label="Archive" variant="secondary" onClick={send({ type: 'archiveSpec' })} />}
                {isActive && enhancementButtons.map((btn) => (
                    <Button
                        key={btn.command}
                        label={btn.label}
                        variant="enhancement"
                        icon={btn.icon}
                        title={btn.tooltip || ''}
                        onClick={send({ type: 'clarify', command: btn.command })}
                    />
                ))}
            </div>
            <div class="actions-right">
                {isArchived || isCompleted ? (
                    <Button label="Reactivate" variant="primary" onClick={send({ type: 'reactivateSpec' })} />
                ) : isTasksDone ? (
                    <Button label="Complete" variant="primary" onClick={send({ type: 'completeSpec' })} />
                ) : (
                    <>
                        <Button label="Regenerate" variant="secondary" onClick={send({ type: 'regenerate' })} />
                        {ns.footerState?.showApproveButton && (
                            <Button label={ns.footerState.approveText} variant="primary" onClick={send({ type: 'approve' })} />
                        )}
                    </>
                )}
            </div>
        </footer>
    );
}
