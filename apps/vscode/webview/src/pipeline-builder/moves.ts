import { PipelineStep } from '../../../src/protocol/pipeline';

export interface MoveTarget {
    phase: string;
    /** Which edge of that phase the node lands on. */
    joins: 'start' | 'end';
}

/** The phases a node is not in, in run order, with the edge it would join. */
export function moveTargets(step: PipelineStep, nodeId: string): MoveTarget[] {
    const from = step.phases.findIndex(p => p.nodes.some(n => n.id === nodeId));
    if (from < 0) { return []; }
    return step.phases.flatMap((p, at) => at === from
        ? []
        : [{ phase: p.name, joins: at < from ? 'end' as const : 'start' as const }]);
}

/** The step's order and grouping with the node in another phase, or null when that is no move. */
export function movedToPhase(step: PipelineStep, nodeId: string, phase: string):
{ order: string[]; phases: Array<{ name: string; nodes: string[] }> } | null {
    const grouped = step.phases.map(p => ({ name: p.name, nodes: p.nodes.map(n => n.id) }));
    const from = grouped.findIndex(p => p.nodes.includes(nodeId));
    const to = grouped.findIndex(p => p.name === phase);
    if (from < 0 || to < 0 || from === to) { return null; }

    grouped[from].nodes = grouped[from].nodes.filter(id => id !== nodeId);
    grouped[to].nodes = to < from
        ? [...grouped[to].nodes, nodeId]
        : [nodeId, ...grouped[to].nodes];

    const phases = grouped.filter(p => p.nodes.length > 0);
    return { order: phases.flatMap(p => p.nodes), phases };
}
