import { navState } from '../../signals';
import type { VSCodeApi } from '../../types';

declare const vscode: VSCodeApi;

/**
 * The living spec's action bar. The header used to carry Update beside the
 * facts, and only once drift had been found; the actions live here now, in the
 * same bar every other viewer state uses, and there is always one for this
 * spec and one for every drifted spec at once.
 */
export function LivingFooter() {
    const meta = navState.value?.livingMeta;
    if (!meta) return null;
    const drifted = !!meta.drifted;
    const post = (type: 'livingUpdate' | 'livingCheckDrift' | 'livingSyncAll') => () =>
        vscode.postMessage({ type });

    return (
        <footer class="actions">
            <span class="footer-context">
                {drifted ? 'Source files changed since this spec was last updated' : 'In step with the code'}
            </span>
            <div class="actions-right">
                <button
                    type="button"
                    class="secondary"
                    title="Update every drifted living spec from the current changes"
                    onClick={post('livingSyncAll')}
                >
                    Update all drifted
                </button>
                {drifted ? (
                    <button
                        type="button"
                        class="primary"
                        title="Update this spec to match the changed code, preserving its clarifications"
                        onClick={post('livingUpdate')}
                    >
                        Update this spec
                    </button>
                ) : (
                    <button
                        type="button"
                        class="secondary"
                        title="Re-check this capability's source files against the spec"
                        onClick={post('livingCheckDrift')}
                    >
                        Check for drift
                    </button>
                )}
            </div>
        </footer>
    );
}
