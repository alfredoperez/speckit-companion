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

type Shape = { order: string[]; phases: Array<{ name: string; nodes: string[] }> };

/** The step's order and grouping with the node one place earlier or later in its phase, or null at an edge. */
export function movedWithin(step: PipelineStep, nodeId: string, direction: 'up' | 'down'): Shape | null {
    const phases = step.phases.map(p => ({ name: p.name, nodes: p.nodes.map(n => n.id) }));
    const phase = phases.find(p => p.nodes.includes(nodeId));
    if (!phase) { return null; }
    const from = phase.nodes.indexOf(nodeId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= phase.nodes.length) { return null; }
    [phase.nodes[from], phase.nodes[to]] = [phase.nodes[to], phase.nodes[from]];
    return { order: phases.flatMap(p => p.nodes), phases };
}

/** One place a node could go, and why the writer would refuse it, if it would. */
export interface MovePlace {
    /** The action the popover sends: `up`, `down` or `phase:<name>`. */
    id: string;
    label: string;
    direction: 'up' | 'down';
    /** Empty when the move is allowed. */
    refused: string;
}

export interface MovePlaces {
    places: MovePlace[];
    /** Held nodes beside the moves, each said once. */
    held: string[];
    /** Why the node itself cannot move, or empty when it can. */
    pinned: string;
}

/** The reason `config_write.check_order` would give for this order, or empty. */
function refusal(step: PipelineStep, nodeId: string, order: string[]): string {
    const nodes = new Map(step.phases.flatMap(p => p.nodes).map(n => [n.id, n]));
    const before = step.phases.flatMap(p => p.nodes.map(n => n.id));
    const name = (id: string) => nodes.get(id)?.name ?? id;
    const rank = new Map(order.map((id, at) => [id, at]));
    const moved = nodes.get(nodeId);
    const at = rank.get(nodeId) ?? 0;
    for (const dep of moved?.reads ?? []) {
        if ((rank.get(dep) ?? -1) > at) { return `It reads ${name(dep)}, so it cannot run before it.`; }
    }
    for (const other of nodes.values()) {
        if (other.id !== nodeId && other.reads.includes(nodeId) && (rank.get(other.id) ?? 0) < at) {
            return `${other.name} reads it, so it cannot run after ${other.name}.`;
        }
    }
    for (const other of nodes.values()) {
        if (other.id === nodeId || !other.pinned) { continue; }
        const was = before.indexOf(other.id);
        if (rank.get(other.id) === was) { continue; }
        const after = before.indexOf(nodeId) < was;
        return `${other.name} is held in place, so nothing goes ${after ? 'after' : 'before'} it.`;
    }
    return '';
}

/** Every place a node can be moved to, each with the writer's reason when it would refuse it. */
export function movePlaces(step: PipelineStep, nodeId: string): MovePlaces {
    const all = step.phases.flatMap(p => p.nodes);
    const node = all.find(n => n.id === nodeId);
    const home = step.phases.findIndex(p => p.nodes.some(n => n.id === nodeId));
    if (!node || home < 0) { return { places: [], held: [], pinned: '' }; }
    if (node.pinned) { return { places: [], held: [], pinned: node.pinned }; }

    const siblings = step.phases[home].nodes;
    const index = siblings.findIndex(n => n.id === nodeId);
    const places: MovePlace[] = [];
    const add = (id: string, label: string, direction: 'up' | 'down', shape: Shape | null) => {
        if (shape) { places.push({ id, label, direction, refused: refusal(step, nodeId, shape.order) }); }
    };
    if (index > 0) {
        add('up', `Up, above ${siblings[index - 1].name}`, 'up', movedWithin(step, nodeId, 'up'));
    }
    if (index < siblings.length - 1) {
        add('down', `Down, below ${siblings[index + 1].name}`, 'down', movedWithin(step, nodeId, 'down'));
    }
    for (const target of moveTargets(step, nodeId)) {
        add(`phase:${target.phase}`,
            `To phase ${target.phase}, ${target.joins === 'end' ? 'last' : 'first'}`,
            target.joins === 'end' ? 'up' : 'down', movedToPhase(step, nodeId, target.phase));
    }
    const held = all.filter(n => n.id !== nodeId && n.pinned)
        .map(n => `${n.name} is held in place: ${n.pinned}.`);
    return { places, held, pinned: '' };
}
