/**
 * StaleBanner — warning banner when current doc is stale.
 * Replaces the stale-banner portion of updateNavState().
 */

import { Component } from '../../shared/component';
import type { NavState, VSCodeApi } from '../types';
import { viewerStore } from '../viewerStore';

declare const vscode: VSCodeApi;

export interface StaleBannerProps {
    navState: NavState;
}

export class StaleBanner extends Component<StaleBannerProps> {
    private unsubscribe: (() => void) | null = null;

    constructor(props: StaleBannerProps) {
        super(props, { className: 'stale-banner' });
        this.el.id = 'stale-banner';
    }

    protected render(): string {
        const { navState } = this.props;
        const currentStaleness = navState.stalenessMap?.[navState.currentDoc];

        if (!currentStaleness?.isStale) {
            this.el.style.display = 'none';
            return '';
        }

        this.el.style.display = '';
        return `<span class="stale-banner-message">${currentStaleness.staleReason}</span>
                <button id="stale-regen" class="stale-regen-btn">Regenerate</button>`;
    }

    protected onMount(): void {
        const regenBtn = this.query('#stale-regen');
        if (regenBtn) {
            this.listen(regenBtn, 'click', () => {
                vscode.postMessage({ type: 'regenerate' });
            });
        }

        this.unsubscribe = viewerStore.on('navState', (ns) => {
            if (ns) this.update({ navState: ns });
        });
    }

    protected onUnmount(): void {
        this.unsubscribe?.();
    }
}
