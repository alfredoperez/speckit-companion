/**
 * What the board holds, counted from the board.
 *
 * The header's tally read `graph.counts`, a field the reader fills in
 * separately from the steps it hands over. The two disagreed: a board drawing
 * five hooks carried a header saying `nothing attached`, because whatever
 * produced the graph had left the count at zero. A number that contradicts the
 * thing beside it is worse than no number, and this line exists precisely
 * because the old one was wrong once already.
 *
 * So it is counted here, from the same steps the canvas walks. There is no
 * second source to drift from.
 */
import { PipelineGraph, PipelineStep } from '../../../src/protocol/pipeline';

export interface PipelineTotals {
    steps: number;
    phases: number;
    nodes: number;
    /** Hooks this project attached and is running — the ones a reader decides about. */
    hooks: number;
    /** Hooks it wrote and is not running, because the pipeline is the shipped one. */
    parked: number;
    /** Hooks an installed spec-kit extension registered. Shown, never edited here. */
    stockHooks: number;
}

/** Every hook drawn for one step: on its own edges, on its phases, on its nodes. */
function hooksIn(step: PipelineStep): { running: number; parked: number } {
    let running = 0;
    let parked = 0;
    const count = (hooks: { parked?: boolean }[]) => {
        for (const hook of hooks) {
            if (hook.parked) { parked += 1; } else { running += 1; }
        }
    };
    count(step.hooks);
    for (const phase of step.phases) {
        count(phase.hooks);
        for (const node of phase.nodes) { count(node.hooks); }
    }
    return { running, parked };
}

export function totals(graph: PipelineGraph): PipelineTotals {
    let phases = 0;
    let nodes = 0;
    let hooks = 0;
    let parked = 0;
    let stockHooks = 0;
    for (const step of graph.steps) {
        phases += step.phases.length;
        const counted = hooksIn(step);
        hooks += counted.running;
        parked += counted.parked;
        stockHooks += step.stockHooks.length;
        for (const phase of step.phases) { nodes += phase.nodes.length; }
    }
    return { steps: graph.steps.length, phases, nodes, hooks, parked, stockHooks };
}
