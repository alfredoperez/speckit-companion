import { navState } from '../../signals';
import type { VSCodeApi } from '../../types';

declare const vscode: VSCodeApi;

/** A bug or idea page's next steps: the secondary actions, then the one main action on the right. */
export function ReportFooter() {
    const actions = navState.value?.reportActions ?? [];
    if (actions.length === 0) return null;
    const primary = actions.find((a) => a.primary);
    const ordered = [...actions.filter((a) => a !== primary), ...(primary ? [primary] : [])];

    return (
        <footer class="actions">
            {primary && <span class="footer-context">Next: {primary.label}</span>}
            <div class="actions-right">
                {ordered.map((a) => (
                    <button
                        key={a.id}
                        type="button"
                        class={a === primary ? 'primary' : 'secondary'}
                        onClick={() => vscode.postMessage({ type: 'reportAction', id: a.id })}
                    >
                        {a.label}
                    </button>
                ))}
            </div>
        </footer>
    );
}
