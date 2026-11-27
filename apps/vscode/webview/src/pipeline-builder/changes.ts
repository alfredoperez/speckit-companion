/**
 * What this project changed about a step, derived once.
 *
 * The board's mark and the header's list computed this separately, in slightly
 * different words, from the same data — so the same fact read two ways
 * depending on where you found it.
 */
import { PipelineStep } from '../../../src/protocol/pipeline';

/** What the board marks as changed, so nothing on the page can say otherwise. */
export function changed(step: PipelineStep): boolean {
    const c = step.changes;
    return Boolean(c.added.length || c.removed.length || c.reordered || c.hooks
        || c.decisions.length || c.replaced.length || c.phases.length
        || step.template?.sections.length);
}

/** The change line for one step: `+review-gaps · reordered · 2 hooks`. */
export function changeSummary(step: PipelineStep): string[] {
    const c = step.changes;
    const bits: string[] = [];
    if (c.removed.length) { bits.push(`\u2212${c.removed.join(', ')}`); }
    if (c.added.length) { bits.push(`+${c.added.join(', ')}`); }
    if (c.reordered) { bits.push('reordered'); }
    if (c.hooks) { bits.push(`${c.hooks} hook${c.hooks === 1 ? '' : 's'}`); }
    if (c.replaced.length) { bits.push(`your own: ${c.replaced.join(', ')}`); }
    if (c.phases.length) { bits.push(`phases: ${c.phases.join(', ')}`); }
    if (c.decisions.length) { bits.push(`routing: ${c.decisions.join(', ')}`); }
    // Only a section someone pointed elsewhere. Every step that writes a
    // document has a template, so naming the file listed "template
    // spec-template.md" as a change on a step nobody had touched.
    if (step.template?.sections.length) {
        bits.push(`template: ${step.template.sections.join(', ')}`);
    }
    return bits;
}

/** How many separate changes a step carries, one per thing a person did. */
export function changeCount(step: PipelineStep): number {
    const c = step.changes;
    return c.added.length + c.removed.length + (c.reordered ? 1 : 0) + c.hooks
        + c.decisions.length + c.replaced.length + c.phases.length
        + (step.template?.sections.length ?? 0);
}

/**
 * What waits for a build, as a line. Only a project never built can count it:
 * everything it changed from shipped is unbuilt. Once built, what differs from
 * shipped is not what differs from the last build, so no number is claimed.
 */
export function unbuiltLine(steps: PipelineStep[], neverBuilt: boolean, tail = ' yet'): string {
    const n = neverBuilt ? steps.reduce((sum, step) => sum + changeCount(step), 0) : 0;
    if (n === 0) { return neverBuilt ? 'Never built' : `Changes not built${tail}`; }
    return `${n} change${n === 1 ? '' : 's'} not built${tail}`;
}
