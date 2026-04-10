import type { VSCodeApi, ViewerToExtensionMessage } from '../types';
import { navState } from '../signals';
import { Button } from '../../shared/components/Button';
import { Toast } from '../../shared/components/Toast';

declare const vscode: VSCodeApi;

export interface FooterActionsProps {
    initialSpecStatus: string;
}

export function FooterActions({ initialSpecStatus }: FooterActionsProps) {
    const ns = navState.value;
    if (!ns) return null;

    const send = (msg: ViewerToExtensionMessage) => () => vscode.postMessage(msg);

    const status = ns.footerState?.specStatus || ns.specStatus || initialSpecStatus;
    const isTasksDone = status === 'tasks-done';
    const isCompleted = status === 'completed';
    const isArchived = status === 'archived';
    const isActive = !isTasksDone && !isCompleted && !isArchived;

    const enhancementButtons = ns.footerState?.enhancementButtons ?? ns.enhancementButtons ?? [];

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
