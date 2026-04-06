import type { VSCodeApi } from '../types';
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

    const send = (type: string, extra?: Record<string, unknown>) => () =>
        vscode.postMessage({ type, ...extra } as any);

    const status = ns.footerState?.specStatus || ns.specStatus || initialSpecStatus;
    const isTasksDone = status === 'tasks-done';
    const isCompleted = status === 'completed';
    const isArchived = status === 'archived';

    const enhancementButtons = ns.footerState?.enhancementButtons ?? ns.enhancementButtons ?? [];

    return (
        <footer class="actions">
            <div class="actions-left">
                <Button label="Edit Source" variant="secondary" onClick={send('editSource')} />
                {!isArchived && <Button label="Archive" variant="secondary" onClick={send('archiveSpec')} />}
                <Toast id="action-toast" />
                {enhancementButtons.map((btn, i) => (
                    <Button
                        key={i}
                        label={btn.label}
                        variant="enhancement"
                        icon={btn.icon}
                        title={btn.tooltip || ''}
                        onClick={send('clarify', { command: btn.command })}
                    />
                ))}
            </div>
            <div class="actions-right">
                {isArchived || isCompleted ? (
                    <Button label="Reactivate" variant="secondary" onClick={send('reactivateSpec')} />
                ) : isTasksDone ? (
                    <Button label="Complete" variant="primary" onClick={send('completeSpec')} />
                ) : (
                    <>
                        <Button label="Regenerate" variant="secondary" onClick={send('regenerate')} />
                        {ns.footerState?.showApproveButton && (
                            <Button label={ns.footerState.approveText} variant="primary" onClick={send('approve')} />
                        )}
                    </>
                )}
            </div>
        </footer>
    );
}
