import type { VSCodeApi } from '../types';
import { navState } from '../signals';
import { Button } from '../../shared/components/Button';

declare const vscode: VSCodeApi;

export function StaleBanner() {
    const ns = navState.value;
    if (!ns) return null;

    const currentStaleness = ns.stalenessMap?.[ns.currentDoc];
    if (!currentStaleness?.isStale) return null;

    return (
        <div class="stale-banner" id="stale-banner">
            <span class="stale-banner-message">{currentStaleness.staleReason}</span>
            <Button
                label="Regenerate"
                variant="secondary"
                class="stale-regen-btn"
                onClick={() => vscode.postMessage({ type: 'regenerate' })}
            />
        </div>
    );
}
