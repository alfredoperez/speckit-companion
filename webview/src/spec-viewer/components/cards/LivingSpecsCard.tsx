import type { ViewerState, CapabilityContentView } from '../../types';

export interface LivingSpecsCardProps {
    state: ViewerState;
}

function deltaLabel(delta: NonNullable<CapabilityContentView['delta']>): string {
    const parts: string[] = [];
    if (delta.added) parts.push(`+${delta.added} added`);
    if (delta.modified) parts.push(`${delta.modified} modified`);
    if (delta.removed) parts.push(`${delta.removed} removed`);
    if (delta.renamed) parts.push(`${delta.renamed} renamed`);
    return parts.join(' · ');
}

function CapabilitySection({ cap }: { cap: CapabilityContentView }) {
    return (
        <details class="living-specs-cap" open>
            <summary class="living-specs-cap__summary">
                <span class="living-specs-cap__name">{cap.name}</span>
                {cap.synced && (
                    <span class="living-specs-list__synced" title="Folded back into the living spec">
                        folded back
                    </span>
                )}
                {cap.delta && <span class="living-specs-cap__delta">{deltaLabel(cap.delta)}</span>}
            </summary>
            {cap.available ? (
                <div class="living-specs-cap__body">
                    {cap.purpose && <p class="living-specs-cap__purpose">{cap.purpose}</p>}
                    {cap.requirements && cap.requirements.length > 0 ? (
                        <ul class="living-specs-req-list">
                            {cap.requirements.map(r => (
                                <li key={r.id} class="living-specs-req">
                                    <span class="living-specs-req__id">{r.id}</span>
                                    {r.text && <span class="living-specs-req__text">{r.text}</span>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p class="living-specs-cap__unavailable">No requirements recorded yet.</p>
                    )}
                </div>
            ) : (
                <p class="living-specs-cap__unavailable">Content unavailable in this workspace.</p>
            )}
        </details>
    );
}

/**
 * Read-only surface for the living specs a feature touched (LS·7): the durable
 * capability specs it loaded into context (LS·2) and the ones it folded its
 * changes back into at completion (LS·3). Renders readable content when the
 * provider could load it; degrades to the names-only list for legacy payloads.
 * Hides itself when there's no `livingSpecs` data, like every other card.
 */
export function LivingSpecsCard({ state }: LivingSpecsCardProps) {
    const ls = state.livingSpecs;
    if (!ls) return null;

    if (ls.capabilities && ls.capabilities.length > 0) {
        return (
            <section class="activity-card activity-card--living-specs">
                <h3 class="activity-card__title">Living specs</h3>
                <div class="activity-card__body">
                    {ls.capabilities.map(cap => (
                        <CapabilitySection key={cap.name} cap={cap} />
                    ))}
                </div>
            </section>
        );
    }

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
            <h3 class="activity-card__title">Living specs</h3>
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
