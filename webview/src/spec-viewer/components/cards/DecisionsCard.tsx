import type { ViewerState } from '../../types';

export interface DecisionsCardProps {
    state: ViewerState;
}

export function DecisionsCard({ state }: DecisionsCardProps) {
    const items = state.decisions;
    if (!items || items.length === 0) return null;

    return (
        <section class="activity-card activity-card--decisions">
            <h3 class="activity-card__title">
                Decisions <span class="activity-card__count">({items.length})</span>
            </h3>
            <div class="activity-card__body">
                <ol class="activity-list activity-list--ordinals">
                    {items.map((d, i) => (
                        <li key={i}>
                            <span class="activity-ordinal" aria-hidden="true">{i + 1}</span>
                            <span class="activity-decision__text">{d.decision}</span>
                            {d.why && <div class="activity-detail"><span class="activity-inline-label">Why</span> {d.why}</div>}
                            {d.rejected && (
                                <div class="activity-detail"><span class="activity-inline-label">Rejected</span> {d.rejected}</div>
                            )}
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
