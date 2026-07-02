import type { ViewerState } from '../../types';

export interface IntentCardProps {
    state: ViewerState;
}

/** The spec's goal and its out-of-scope fence — what this is for, and what it deliberately isn't. */
export function IntentCard({ state }: IntentCardProps) {
    const { intent, expectations } = state;
    if (!intent && (!expectations || expectations.length === 0)) return null;

    return (
        <section class="activity-card activity-card--intent">
            <h3 class="activity-card__title">Goal</h3>
            <div class="activity-card__body">
                {intent && <p class="activity-intent__text">{intent}</p>}
                {expectations && expectations.length > 0 && (
                    <div class="activity-intent__fence">
                        <span class="activity-detail-label">Out of scope</span>
                        <ul class="activity-list activity-list--compact">
                            {expectations.map((e, i) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}
