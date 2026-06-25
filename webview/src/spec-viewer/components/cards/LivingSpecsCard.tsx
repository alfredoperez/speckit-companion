import type { ViewerState } from '../../types';

export interface LivingSpecsCardProps {
    state: ViewerState;
}

/**
 * Read-only surface for the living specs a feature touched (LS·7): the durable
 * capability specs it loaded into context (LS·2) and the ones it folded its
 * changes back into at completion (LS·3). Hides itself when there's no
 * `livingSpecs` data, like every other Activity card.
 */
export function LivingSpecsCard({ state }: LivingSpecsCardProps) {
    const ls = state.livingSpecs;
    if (!ls) return null;

    const synced = new Set(ls.synced);
    // Show every capability that was loaded or synced, de-duplicated; a name in
    // `synced` but not `loaded` is still folded back, so include it.
    const names: string[] = [];
    const seen = new Set<string>();
    for (const n of [...ls.loaded, ...ls.synced]) {
        if (seen.has(n)) continue;
        seen.add(n);
        names.push(n);
    }
    if (names.length === 0) return null;

    return (
        <section class="activity-card activity-card--living-specs">
            <header class="activity-card__title">
                Living specs <span class="activity-card__count">({names.length})</span>
            </header>
            <div class="activity-card__body">
                <ul class="living-specs-list">
                    {names.map(name => (
                        <li key={name} class="living-specs-list__item">
                            <span class="living-specs-list__name">{name}</span>
                            {synced.has(name) && (
                                <span class="living-specs-list__synced" title="Folded back into the living spec">
                                    folded back
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
