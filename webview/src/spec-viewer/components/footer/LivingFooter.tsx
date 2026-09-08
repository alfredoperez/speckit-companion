import { navState } from '../../signals';
import type { VSCodeApi } from '../../types';

declare const vscode: VSCodeApi;

/**
 * The living spec's action bar. Adopt is always offered; the drift actions
 * appear only once drift has been found, so a clean spec's bar carries no
 * status it was never asked for.
 */
export function LivingFooter() {
    const meta = navState.value?.livingMeta;
    if (!meta) return null;
    const drifted = !!meta.drifted;
    const post = (type: 'livingUpdate' | 'livingSyncAll' | 'livingAdopt') => () =>
        vscode.postMessage({ type });

    return (
        <footer class="actions">
            {drifted && (
                <span class="footer-context">Source files changed since this spec was last updated</span>
            )}
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
                {drifted && (
                    <button
                        type="button"
                        class="secondary"
                        title="Update every drifted living spec from the current changes"
                        onClick={post('livingSyncAll')}
                    >
                        Update all drifted
                    </button>
                )}
                {drifted && (
                    <button
                        type="button"
                        class="primary"
                        title="Update this spec to match the changed code, preserving its clarifications"
                        onClick={post('livingUpdate')}
                    >
                        Update this spec
                    </button>
                )}
            </div>
        </footer>
    );
}
