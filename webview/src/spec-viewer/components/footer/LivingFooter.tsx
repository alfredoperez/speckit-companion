import { useCallback, useMemo, useState } from 'preact/hooks';
import { navState } from '../../signals';
import { UndoToast } from '../../../shared/components/UndoToast';
import type { LivingHeaderMeta, VSCodeApi } from '../../types';

declare const vscode: VSCodeApi;

/** The capability's condition in words, for the bar's left side. */
export function livingCondition(meta: LivingHeaderMeta): string {
    if (meta.missing) return 'No spec yet';
    if (meta.drifted === undefined) return 'Drift unknown';
    const n = meta.driftedRequirements?.length ?? 0;
    if (meta.drifted && n > 0) return `${n} ${n === 1 ? 'requirement' : 'requirements'} drifted`;
    if (meta.drifted) return 'Source files changed since this spec was last updated';
    return 'In sync';
}

/** The living spec's action bar: approve while the spec is a draft or anything is adopted, Adopt and Validate always, Sync only once drift is found. */
export function LivingFooter() {
    const ns = navState.value;
    const meta = ns?.livingMeta;
    const undo = ns?.livingUndo ?? null;
    const [spent, setSpent] = useState<string | null>(null);
    // Measured once per action: a countdown recomputed on every frame's render would restart itself.
    const remaining = useMemo(() => (undo ? undo.expiresAt - Date.now() : 0), [undo?.token]);
    const onElapse = useCallback(() => setSpent(undo?.token ?? null), [undo?.token]);
    const onUndo = useCallback(() => {
        if (!undo) return;
        vscode.postMessage({ type: 'undoLivingAction', token: undo.token });
        setSpent(undo.token);
    }, [undo?.token]);
    if (!meta) return null;
    const drifted = !!meta.drifted;
    const adopted = ns?.livingOverview?.requirements.filter((r) => r.adopted).length ?? 0;
    const isDraft = !!meta.draft;
    const post = (type: 'livingUpdate' | 'livingValidate' | 'livingAdopt') => () =>
        vscode.postMessage({ type });
    // The count comes from the spec tier, so the action has to name it: on the
    // Rules tab the handler would otherwise approve whatever is on screen.
    const approveSpec = () => vscode.postMessage({ type: 'approveSpec', documentType: 'spec' });

    return (
        <footer class="actions">
            <span class="footer-context">{livingCondition(meta)}</span>
            <div class="actions-right">
                {(adopted > 0 || isDraft) && (
                    <button
                        type="button"
                        class="secondary"
                        title={adopted > 0 ? 'Approve every adopted requirement and clear the draft banner. You can undo for 5 seconds.' : 'Clear the draft banner. You can undo for 5 seconds.'}
                        onClick={approveSpec}
                    >
                        <span class="codicon codicon-check" aria-hidden="true" />
                        {adopted > 0 ? `Approve all ${adopted}` : 'Approve spec'}
                    </button>
                )}
                <button
                    type="button"
                    class="secondary"
                    title="Adopt another area of the code as a living spec"
                    onClick={post('livingAdopt')}
                >
                    <span class="codicon codicon-wand" aria-hidden="true" />
                    Adopt an area
                </button>
                <button
                    type="button"
                    class="secondary"
                    title="Check every living spec's shape: scenarios, headings, deltas"
                    onClick={post('livingValidate')}
                >
                    Validate
                </button>
                {drifted && (
                    <button
                        type="button"
                        class="primary"
                        title="Update this spec to match the changed code, preserving its clarifications"
                        onClick={post('livingUpdate')}
                    >
                        Sync
                    </button>
                )}
            </div>
            {undo && remaining > 0 && (
                <UndoToast
                    key={undo.token}
                    message={undo.kind === 'remove' ? 'Requirement removed' : 'Spec approved'}
                    countdownMs={remaining}
                    onElapse={onElapse}
                    onUndo={onUndo}
                    active={spent !== undo.token}
                    captureKeyboard={false}
                />
            )}
        </footer>
    );
}
