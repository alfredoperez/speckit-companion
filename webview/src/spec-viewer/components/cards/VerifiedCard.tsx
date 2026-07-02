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
            <h3 class="activity-card__title">
                Verified <span class="activity-card__count">({items.length})</span>
            </h3>
            <div class="activity-card__body">
                <ul class="activity-list">
                    {items.map((v, i) => (
                        <li key={i}>
                            <span>{v.what}</span>
                            {v.result && <span class="activity-verified__result"> — {v.result}</span>}
                            {v.command && <div class="activity-detail"><code>{v.command}</code></div>}
                            {v.warnings && v.warnings.length > 0 && (
                                <div class="activity-detail activity-detail--warning">
                                    <span class="activity-inline-label">Warnings</span> {v.warnings.join('; ')}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
