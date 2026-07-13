import type { VSCodeApi } from '../types';
import { navState } from '../signals';
import { Button } from '../../shared/components/Button';

declare const vscode: VSCodeApi;

/**
 * "This document trails the one it was generated from." A fact about the
 * document you're reading, with an action scoped to that document — so it sits
 * over the reading column, not across the whole window. The matching mark on
 * the rail item answers the same question from the navigation side; the two are
 * complementary, not a duplicate.
 */
export function StaleBanner() {
    const ns = navState.value;
    if (!ns) return null;

    const currentStaleness = ns.stalenessMap?.[ns.currentDoc];
    if (!currentStaleness?.isStale) return null;

    const docLabel =
        ns.coreDocs?.find(d => d.type === ns.currentDoc)?.label
        ?? ns.relatedDocs?.find(d => d.type === ns.currentDoc)?.label
        ?? 'This document';

    return (
        <div class="stale-banner" id="stale-banner" role="status">
            <span class="codicon codicon-warning stale-banner__icon" aria-hidden="true" />
            <div class="stale-banner__body">
                <p class="stale-banner__title">{docLabel} may be stale</p>
                <p class="stale-banner__detail">{currentStaleness.staleReason}</p>
            </div>
            <Button
                label="Regenerate"
                variant="secondary"
                class="stale-regen-btn"
                onClick={() => vscode.postMessage({ type: 'regenerate' })}
            />
        </div>
    );
}
