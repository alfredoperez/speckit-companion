import type { ViewerState, LivingSpecsView } from '../../types';
import { readableName } from '../../../../../src/core/utils/capabilityNames';

export interface LivingSpecsCardProps {
    state: ViewerState;
}

export interface LivingSpecChip {
    name: string;
    synced: boolean;
}

/** Collapse an old record's `loaded`/`synced` names to one chip per capability. */
export function livingSpecChips(ls: LivingSpecsView): LivingSpecChip[] {
    const synced = new Set(ls.synced);
    const seen = new Set<string>();
    const chips: LivingSpecChip[] = [];
    for (const name of [...ls.loaded, ...ls.synced]) {
        if (seen.has(name)) continue;
        seen.add(name);
        chips.push({ name, synced: synced.has(name) });
    }
    return chips;
}

/** An old record's capability names as plain text; nothing opens, because the capability files are no longer a surface. */
export function LivingSpecLinks({ livingSpecs }: { livingSpecs: LivingSpecsView }) {
    const chips = livingSpecChips(livingSpecs);
    if (chips.length === 0) return null;

    const groups = [
        { label: 'Updated by this run', chips: chips.filter(c => c.synced) },
        { label: 'Read for context', chips: chips.filter(c => !c.synced) },
    ].filter(g => g.chips.length > 0);

    return (
        <div class="living-specs-groups">
            {groups.map(group => (
                <div key={group.label} class="living-specs-group">
                    <span class="living-specs-group__label">{group.label}</span>
                    <ul class="living-specs-chips" aria-label={group.label}>
                        {group.chips.map(chip => (
                            <li key={chip.name} class="living-specs-chips__item">
                                <span class="living-specs-chip" title={chip.name}>{readableName(chip.name)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

/**
 * Run-log surface for the living specs an older feature touched: one plain
 * chip per capability, grouped by whether the run updated it or only read it.
 * Hides itself when there is no `livingSpecs` data, like every other card.
 */
export function LivingSpecsCard({ state }: LivingSpecsCardProps) {
    const ls = state.livingSpecs;
    if (!ls) return null;

    const chips = livingSpecChips(ls);
    if (chips.length === 0) return null;

    return (
        <section class="activity-card activity-card--living-specs">
            <h3 class="activity-card__title">Living specs</h3>
            <div class="activity-card__body">
                <LivingSpecLinks livingSpecs={ls} />
            </div>
        </section>
    );
}
