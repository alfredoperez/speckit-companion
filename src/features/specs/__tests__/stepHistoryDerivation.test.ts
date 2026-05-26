import { deriveStepHistory } from '../stepHistoryDerivation';
import type { Transition } from '../../../core/types/specContext';

const tx = (overrides: Partial<Transition>): Transition => ({
    step: 'specify',
    substep: null,
    from: { step: null, substep: null },
    by: 'extension',
    at: '2026-04-29T00:00:00Z',
    ...overrides,
});

describe('deriveStepHistory', () => {
    it('returns {} for an empty transitions array', () => {
        expect(deriveStepHistory([])).toEqual({});
    });

    it('emits an entry for each step seen, with startedAt = first transition for that step', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
            tx({ step: 'tasks',   at: '2026-04-29T00:02:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'tasks');
        expect(out.specify.startedAt).toBe('2026-04-29T00:00:00Z');
        expect(out.plan.startedAt).toBe('2026-04-29T00:01:00Z');
        expect(out.tasks.startedAt).toBe('2026-04-29T00:02:00Z');
    });

    it('sets completedAt to the first transition of the next step', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'specify', substep: 'parsing', by: 'sdd', at: '2026-04-29T00:00:05Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'plan');
        expect(out.specify.completedAt).toBe('2026-04-29T00:01:00Z');
    });

    it('marks the current step as in-flight when it is the most recent', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'plan');
        expect(out.plan.completedAt).toBeNull();
    });

    it('falls back to the step\'s last transition when the step was left without a successor', () => {
        // currentStep is undefined and no later step exists — best we have.
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'specify', substep: 'parsing', by: 'sdd', at: '2026-04-29T00:00:05Z' }),
        ];
        const out = deriveStepHistory(transitions);
        expect(out.specify.completedAt).toBe('2026-04-29T00:00:05Z');
    });

    it('builds substeps from non-null transitions, with completedAt = next substep at', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'specify', substep: 'parsing',   by: 'sdd', at: '2026-04-29T00:00:05Z' }),
            tx({ step: 'specify', substep: 'exploring', by: 'sdd', at: '2026-04-29T00:00:10Z' }),
            tx({ step: 'specify', substep: 'detecting', by: 'sdd', at: '2026-04-29T00:00:15Z' }),
            tx({ step: 'plan', at: '2026-04-29T00:01:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'plan');
        const subs = out.specify.substeps!;
        expect(subs).toHaveLength(3);
        expect(subs[0]).toEqual({ name: 'parsing',   startedAt: '2026-04-29T00:00:05Z', completedAt: '2026-04-29T00:00:10Z' });
        expect(subs[1]).toEqual({ name: 'exploring', startedAt: '2026-04-29T00:00:10Z', completedAt: '2026-04-29T00:00:15Z' });
        // Last substep falls back to the step's completedAt
        expect(subs[2]).toEqual({ name: 'detecting', startedAt: '2026-04-29T00:00:15Z', completedAt: '2026-04-29T00:01:00Z' });
    });

    it('omits substeps[] when the step has no non-null transitions', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'plan');
        expect(out.specify.substeps).toBeUndefined();
    });

    it('preserves step order across non-contiguous transitions for the same step', () => {
        // Edge: a step appears, jumps to another, then comes back. Real-life
        // transitions[] doesn't usually do this but we shouldn't crash.
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
            tx({ step: 'specify', substep: 'rewriting', by: 'sdd', at: '2026-04-29T00:02:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'specify');
        // specify is current and gets completedAt: null when it's the most-recently-seen
        expect(out.specify.completedAt).toBeNull();
        // Order in the output respects first-appearance: specify, plan
        expect(Object.keys(out)).toEqual(['specify', 'plan']);
    });

    describe('terminal finalize', () => {
        it("finalizes the last current step's completedAt to its own last transition when status is 'completed'", () => {
            const transitions = [
                tx({ step: 'specify',   at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'implement', at: '2026-04-29T00:05:00Z' }),
                tx({ step: 'implement', substep: 'run-tests', by: 'sdd', at: '2026-04-29T00:06:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'implement', 'completed');
            expect(out.implement.completedAt).toBe('2026-04-29T00:06:00Z');
        });

        it("finalizes the last current step's completedAt when status is 'archived'", () => {
            const transitions = [
                tx({ step: 'specify',   at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'implement', at: '2026-04-29T00:05:00Z' }),
                tx({ step: 'implement', substep: 'run-tests', by: 'sdd', at: '2026-04-29T00:06:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'implement', 'archived');
            expect(out.implement.completedAt).toBe('2026-04-29T00:06:00Z');
        });

        it('leaves the last current step in flight (completedAt null) for a non-terminal status', () => {
            const transitions = [
                tx({ step: 'specify',   at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'implement', at: '2026-04-29T00:05:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'implement', 'implementing');
            expect(out.implement.completedAt).toBeNull();
        });

        it('leaves the last current step in flight (completedAt null) when status is omitted', () => {
            const transitions = [
                tx({ step: 'specify',   at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'implement', at: '2026-04-29T00:05:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'implement');
            expect(out.implement.completedAt).toBeNull();
        });
    });

    describe('collapses consecutive identical (step, substep) transitions', () => {
        it('produces the same result feeding a duplicate adjacent transition as feeding one', () => {
            const single = [
                tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
            ];
            const withDuplicate = [
                tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'specify', at: '2026-04-29T00:00:30Z' }), // exact (step, substep) dup
                tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
            ];
            const a = deriveStepHistory(single, 'plan');
            const b = deriveStepHistory(withDuplicate, 'plan');
            expect(b).toEqual(a);
            // The dropped duplicate's `at` must not become startedAt.
            expect(b.specify.startedAt).toBe('2026-04-29T00:00:00Z');
        });

        it('preserves a distinct substep on the same step (not collapsed)', () => {
            const transitions = [
                tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'specify', substep: 'outline',  by: 'sdd', at: '2026-04-29T00:00:05Z' }),
                tx({ step: 'specify', substep: 'validate', by: 'sdd', at: '2026-04-29T00:00:10Z' }),
                tx({ step: 'plan',    at: '2026-04-29T00:01:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'plan');
            expect(out.specify.substeps).toHaveLength(2);
            expect(out.specify.substeps!.map(s => s.name)).toEqual(['outline', 'validate']);
        });
    });

    describe('non-zero duration', () => {
        it('produces completedAt distinct from startedAt when transitions have distinct timestamps', () => {
            const transitions = [
                tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'plan',    at: '2026-04-29T00:10:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'plan');
            expect(out.specify.startedAt).toBe('2026-04-29T00:00:00Z');
            expect(out.specify.completedAt).toBe('2026-04-29T00:10:00Z');
            expect(out.specify.completedAt).not.toBe(out.specify.startedAt);
        });
    });

    // Regression: review finding #3. setStepStarted writes from.step=null when
    // ctx.currentStep === step (fresh buildFallback or a Regenerate), so the
    // lastOwnIsCompletion check can't misfire on a start entry. The writer
    // contract — start entries never have from.step === step — must hold.
    describe('regression: start entries never look like completions', () => {
        it('does NOT mark a step as completed when its lone entry has from.step=null', () => {
            // Shape produced by setStepStarted on a fresh spec where currentStep
            // already equals the step being started.
            const transitions = [
                tx({
                    step: 'specify',
                    substep: null,
                    from: { step: null, substep: null },
                    at: '2026-04-29T00:00:00Z',
                }),
            ];
            const out = deriveStepHistory(transitions, 'specify');
            expect(out.specify.startedAt).toBe('2026-04-29T00:00:00Z');
            // The step is in flight — no completion entry yet.
            expect(out.specify.completedAt).toBeNull();
        });

        it('DOES mark a step as completed when a self-loop entry (from.step === step) is appended', () => {
            // Shape produced by setStepCompleted.
            const transitions = [
                tx({
                    step: 'specify',
                    substep: null,
                    from: { step: null, substep: null },
                    at: '2026-04-29T00:00:00Z',
                }),
                tx({
                    step: 'specify',
                    substep: null,
                    from: { step: 'specify', substep: null },
                    at: '2026-04-29T00:05:00Z',
                }),
            ];
            const out = deriveStepHistory(transitions, 'specify');
            expect(out.specify.startedAt).toBe('2026-04-29T00:00:00Z');
            expect(out.specify.completedAt).toBe('2026-04-29T00:05:00Z');
        });
    });

    // Regression: review finding #7. The new writer emits separate start + complete
    // history entries per substep; buildSubsteps must fold the pair into one
    // SubstepEntry, not render two rows.
    describe('regression: substep start+complete pairs fold into one row', () => {
        it('does not duplicate the substep when both start and completion entries are present', () => {
            const transitions = [
                tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
                tx({
                    step: 'specify',
                    substep: 'outline',
                    from: { step: 'specify', substep: null },
                    at: '2026-04-29T00:01:00Z',
                }),
                tx({
                    step: 'specify',
                    substep: 'outline',
                    from: { step: 'specify', substep: 'outline' },
                    at: '2026-04-29T00:02:00Z',
                }),
            ];
            const out = deriveStepHistory(transitions, 'specify');
            expect(out.specify.substeps).toHaveLength(1);
            expect(out.specify.substeps![0].name).toBe('outline');
            expect(out.specify.substeps![0].startedAt).toBe('2026-04-29T00:01:00Z');
            expect(out.specify.substeps![0].completedAt).toBe('2026-04-29T00:02:00Z');
        });
    });
});
