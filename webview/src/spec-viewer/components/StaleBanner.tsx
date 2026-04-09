import type { VSCodeApi } from '../types';
import { navState } from '../signals';

declare const vscode: VSCodeApi;

export function StaleBanner() {
    const ns = navState.value;
    if (!ns) return null;

    const currentStaleness = ns.stalenessMap?.[ns.currentDoc];
    if (!currentStaleness?.isStale) return null;

    return (
        <div class="stale-banner" id="stale-banner">
            <span class="stale-banner-message">{currentStaleness.staleReason}</span>
            <button
                class="stale-regen-btn"
                onClick={() => vscode.postMessage({ type: 'regenerate' })}
            >
                Regenerate
            </button>
        </div>
    );
}
