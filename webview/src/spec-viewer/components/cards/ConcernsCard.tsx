import type { ViewerState } from '../../types';

export interface ConcernsCardProps {
    state: ViewerState;
}

export function ConcernsCard({ state }: ConcernsCardProps) {
    const items = state.concerns;
    if (!items || items.length === 0) return null;

    return (
        <section class="activity-card activity-card--concerns">
            <header class="activity-card__title">
                Concerns <span class="activity-card__count">({items.length})</span>
            </header>
            <div class="activity-card__body">
                <ul class="activity-list">
                    {items.map((c, i) => (
                        <li key={i}>
                            {c.task && <span class="activity-task-chip">{c.task}</span>}
                            <span class="activity-concern__note">{c.note}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
