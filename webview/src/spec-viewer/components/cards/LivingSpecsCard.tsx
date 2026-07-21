import type { ViewerState, VSCodeApi, CapabilityContentView, LivingSpecsView } from '../../types';

declare const vscode: VSCodeApi;

export interface LivingSpecsCardProps {
    state: ViewerState;
}

export interface LivingSpecChip {
    name: string;
    synced: boolean;
    specPath?: string;
}

/**
 * Collapse a living-specs view to one chip per capability. Prefers the resolved
 * `capabilities` (which carry the clickable spec path); falls back to the
 * names-only `loaded`/`synced` arrays for legacy payloads.
 */
export function livingSpecChips(ls: LivingSpecsView): LivingSpecChip[] {
    if (ls.capabilities && ls.capabilities.length > 0) {
        return ls.capabilities.map((cap: CapabilityContentView) => ({
            name: cap.name,
            synced: cap.synced,
            ...(cap.available && cap.specPath ? { specPath: cap.specPath } : {}),
        }));
    }
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

/** Shared compact links used by both the Overview context and legacy card story. */
export function LivingSpecLinks({ livingSpecs }: { livingSpecs: LivingSpecsView }) {
    const chips = livingSpecChips(livingSpecs);
    if (chips.length === 0) return null;

    const openSpec = (chip: LivingSpecChip) => {
        vscode.postMessage({
            type: 'openLivingSpec',
            capabilityName: chip.name,
            ...(chip.specPath ? { specPath: chip.specPath } : {}),
        });
    };

    return (
        <ul class="living-specs-chips">
            {chips.map(chip => (
                <li key={chip.name} class="living-specs-chips__item">
                    <button
                        type="button"
                        class="living-specs-chip living-specs-chip--link"
                        title={`Open ${chip.name} in the Living Specs viewer`}
                        aria-label={`Open ${chip.name} in the Living Specs viewer`}
                        onClick={() => openSpec(chip)}
                    >
                        {chip.name}
                    </button>
                    {chip.synced && (
                        <span class="living-specs-chip__synced" title="Folded back into the living spec">
                            folded back
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}

/**
 * Compact run-log surface for the living specs a feature touched (LS·7): one
 * chip per capability loaded into context (LS·2) or folded back at completion
 * (LS·3). The full capability content lives in the Living Specs viewer, so a
 * chip opens it there rather than reprinting it here. Hides itself when there's
 * no `livingSpecs` data, like every other card.
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
