import type { ViewerState } from '../../types';

export interface VerifiedCardProps {
    state: ViewerState;
}

/** What was checked and how it turned out — the run's audit trail. */
export function VerifiedCard({ state }: VerifiedCardProps) {
    const items = state.verified;
    if (!items || items.length === 0) return null;

    return (
        <section class="activity-card activity-card--verified">
            <h3 class="activity-card__title">Checks</h3>
            <div class="activity-card__body">
                <div class="activity-pill-grid">
                    {items.map((v, i) => {
                        const warned = !!(v.warnings && v.warnings.length > 0);
                        return (
                            <div key={i} class={warned ? 'activity-pill activity-pill--warning' : 'activity-pill activity-pill--pass'}>
                                <span class="activity-pill__mark" aria-hidden="true">{warned ? '⚠' : '✓'}</span>
                                <span class="activity-pill__body">
                                    <span class="activity-pill__what">{v.what}</span>
                                    {v.result && <span class="activity-pill__result"> · {v.result}</span>}
                                    {v.command && <div class="activity-detail"><code>{v.command}</code></div>}
                                    {warned && (
                                        <div class="activity-detail activity-detail--warning">
                                            <span class="activity-inline-label">Warnings</span> {v.warnings!.join('; ')}
                                        </div>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
