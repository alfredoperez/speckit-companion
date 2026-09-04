/**
 * The header cannot contradict the board.
 *
 * It read `graph.counts`, a field whatever produced the graph fills in
 * separately from the steps it hands over. The two disagreed in a rendered
 * capture: five hooks drawn down the lane, `nothing attached` in the header —
 * and this line exists precisely because an earlier count was wrong once
 * already. Counting from the steps the canvas walks is what makes the two
 * unable to differ.
 */
import { totals } from '../counts';
import { graph, hook, node, phase, step } from '../__stories__/fixtures';

describe('what the board holds, counted from the board', () => {
    it('totals the hooks the canvas draws, wherever they hang', () => {
        const g = graph([step('implement', [
            phase('wrap-up', [
                node('complete', 'Mark the spec complete', {
                    hooks: [hook({ type: 'command' }), hook({ type: 'node' })],
                }),
                node('handoff', 'Hand off at the end', { hooks: [hook({ when: 'after' })] }),
            ], [hook()]),
        ], { hooks: [hook()] })]);

        // Two on a node, one on another, one on the phase, one on the step.
        expect(totals(g).hooks).toBe(5);
    });

    it('ignores the counts field, which is what drifted', () => {
        const g = graph([step('implement', [
            phase('wrap-up', [node('complete', 'Mark it', { hooks: [hook()] })]),
        ])], { counts: { steps: 9, phases: 9, nodes: 9, hooks: 0, stockHooks: 0 } });

        expect(totals(g).hooks).toBe(1);
        expect(totals(g).steps).toBe(1);
        expect(totals(g).nodes).toBe(1);
    });

    it('keeps the extensions\' hooks apart from the project\'s own', () => {
        const g = graph([step('specify', [
            phase('gather', [node('resolve-dir', 'Resolve', { hooks: [hook()] })]),
        ], {
            stockHooks: [{
                when: 'after', extension: 'speckit', command: '/speckit.record',
                description: 'Record it', optional: false, conditional: true,
            }],
        })]);

        expect(totals(g)).toMatchObject({ hooks: 1, stockHooks: 1 });
    });

    it('counts nothing when a step declares no phases', () => {
        expect(totals(graph([step('doctor', [])]))).toMatchObject({
            steps: 1, phases: 0, nodes: 0, hooks: 0,
        });
    });
});
