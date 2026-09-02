import { PipelineStep } from '../../../src/protocol/pipeline';

/** What the board marks as changed, so nothing on the page can say otherwise. */
export function changed(step: PipelineStep): boolean {
    const c = step.changes;
    return Boolean(c.added.length || c.removed.length || c.reordered || c.hooks
        || c.decisions.length || c.replaced.length || c.phases.length
        || step.template?.sections.length);
}
