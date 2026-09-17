import { navState } from '../../signals';
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

/** The living spec's action bar: Adopt and Validate always, Sync only once drift is found. */
export function LivingFooter() {
    const meta = navState.value?.livingMeta;
    if (!meta) return null;
    const drifted = !!meta.drifted;
    const post = (type: 'livingUpdate' | 'livingValidate' | 'livingAdopt') => () =>
        vscode.postMessage({ type });

    return (
        <footer class="actions">
            <span class="footer-context">{livingCondition(meta)}</span>
            <div class="actions-right">
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
        </footer>
    );
}
