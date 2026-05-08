import type { ViewerState } from '../../types';

export interface DecisionsCardProps {
    state: ViewerState;
}

export function DecisionsCard({ state }: DecisionsCardProps) {
    const items = state.decisions;
    if (!items || items.length === 0) return null;

    return (
        <section class="activity-card activity-card--decisions">
            <header class="activity-card__title">
                Decisions <span class="activity-card__count">({items.length})</span>
            </header>
            <div class="activity-card__body">
                <ul class="activity-list">
                    {items.map((d, i) => (
                        <li key={i}>{d}</li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
