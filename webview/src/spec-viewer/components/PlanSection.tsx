import type { ViewerState } from '../types';

export interface PlanSectionProps {
    state: ViewerState;
}

function sizingLine(c: NonNullable<ViewerState['classification']>): string {
    const parts: string[] = [];
    if (typeof c.projectedFiles === 'number') parts.push(`${c.projectedFiles} files`);
    if (typeof c.projectedTasks === 'number') parts.push(`${c.projectedTasks} tasks`);
    const inputs = parts.join(', ');
    return inputs ? `Sized as ${c.verdict} — ${inputs} projected.` : `Sized as ${c.verdict}.`;
}

/**
 * The always-visible "what is this and what did it know" block: the ICE
 * triad — Intent (lede), Context, Expectations — plus the approach and the
 * sizing call. Absent entirely when none of its fields exist.
 */
export function PlanSection({ state }: PlanSectionProps) {
    const { intent, context, expectations, approach, classification } = state;
    const hasContent = !!(intent || approach || classification ||
        (context && context.length > 0) || (expectations && expectations.length > 0));
    if (!hasContent) return null;

    return (
        <section class="activity-plan" aria-label="Plan">
            <h2 class="activity-plan__heading">Plan</h2>
            {intent && <p class="activity-plan__lede">{intent}</p>}
            {context && context.length > 0 && (
                <div class="activity-plan__row">
                    <span class="activity-inline-label">Context</span>
                    <span class="activity-plan__list">{context.join(' · ')}</span>
                </div>
            )}
            {expectations && expectations.length > 0 && (
                <div class="activity-plan__row">
                    <span class="activity-inline-label">Out of scope</span>
                    <span class="activity-plan__list">{expectations.join(' · ')}</span>
                </div>
            )}
            {/* The long approach text is progressively disclosed so the run's
                story leads and the how-prose doesn't dominate. */}
            {approach && (
                <details class="activity-plan__disclosure">
                    <summary>Approach</summary>
                    <p class="activity-plan__approach">{approach}</p>
                </details>
            )}
            {classification && (
                <p class="activity-plan__approach">
                    <span class="activity-plan__sizing">{sizingLine(classification)}</span>
                </p>
            )}
        </section>
    );
}
