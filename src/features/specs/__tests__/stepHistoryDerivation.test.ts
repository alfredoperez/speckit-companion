import { deriveStepHistory, deriveDocumentState, deriveTimingSummary } from '../stepHistoryDerivation';
import { findRunningStep } from '../../spec-viewer/stateDerivation';
import type { Transition } from '../../../core/types/specContext';

const tx = (overrides: Partial<Transition>): Transition => ({
    step: 'specify',
    substep: null,
    kind: 'start',
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
            tx({ step: 'specify', substep: 'parsing', by: 'cli', at: '2026-04-29T00:00:05Z' }),
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
            tx({ step: 'specify', substep: 'parsing', by: 'cli', at: '2026-04-29T00:00:05Z' }),
        ];
        const out = deriveStepHistory(transitions);
        expect(out.specify.completedAt).toBe('2026-04-29T00:00:05Z');
    });

    it('builds substeps from non-null transitions, with completedAt = next substep at', () => {
        const transitions = [
            tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'specify', substep: 'parsing',   by: 'cli', at: '2026-04-29T00:00:05Z' }),
            tx({ step: 'specify', substep: 'exploring', by: 'cli', at: '2026-04-29T00:00:10Z' }),
            tx({ step: 'specify', substep: 'detecting', by: 'cli', at: '2026-04-29T00:00:15Z' }),
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

    it('derives finish-only substeps from deltas, first anchored to the step start', () => {
        // The model: one `complete` (finish) per substep; duration = gap to the
        // previous finish, the first measured from the step start. No 0s ticks.
        const transitions = [
            tx({ step: 'plan', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'plan', substep: 'research', kind: 'complete', by: 'ai', at: '2026-04-29T00:02:00Z' }),
            tx({ step: 'plan', substep: 'design',   kind: 'complete', by: 'ai', at: '2026-04-29T00:05:00Z' }),
            tx({ step: 'tasks', at: '2026-04-29T00:06:00Z' }),
        ];
        const out = deriveStepHistory(transitions, 'tasks');
        const subs = out.plan.substeps!;
        expect(subs).toHaveLength(2);
        // research: step start → its finish (2 min), not a 0s tick
        expect(subs[0]).toEqual({ name: 'research', startedAt: '2026-04-29T00:00:00Z', completedAt: '2026-04-29T00:02:00Z' });
        // design: previous finish → its finish (3 min)
        expect(subs[1]).toEqual({ name: 'design', startedAt: '2026-04-29T00:02:00Z', completedAt: '2026-04-29T00:05:00Z' });
    });

    it('derives finish-only per-task implement rows from deltas (no start, no 0s)', () => {
        const transitions = [
            tx({ step: 'implement', at: '2026-04-29T00:00:00Z' }),
            tx({ step: 'implement', substep: 'T001', task: 'T001', kind: 'complete', by: 'ai', at: '2026-04-29T00:00:30Z' }),
            tx({ step: 'implement', substep: 'T002', task: 'T002', kind: 'complete', by: 'ai', at: '2026-04-29T00:01:15Z' }),
        ];
        const out = deriveStepHistory(transitions, 'implement');
        const subs = out.implement.substeps!;
        expect(subs).toHaveLength(2);
        expect(subs[0]).toEqual({ name: 'T001', startedAt: '2026-04-29T00:00:00Z', completedAt: '2026-04-29T00:00:30Z' });
        expect(subs[1]).toEqual({ name: 'T002', startedAt: '2026-04-29T00:00:30Z', completedAt: '2026-04-29T00:01:15Z' });
        // No row collapses to zero duration.
        for (const s of subs) {
            expect(s.startedAt).not.toBe(s.completedAt);
        }
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
            tx({ step: 'specify', substep: 'rewriting', by: 'cli', at: '2026-04-29T00:02:00Z' }),
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
                tx({ step: 'implement', substep: 'run-tests', by: 'cli', at: '2026-04-29T00:06:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'implement', 'completed');
            expect(out.implement.completedAt).toBe('2026-04-29T00:06:00Z');
        });

        it("finalizes the last current step's completedAt when status is 'archived'", () => {
            const transitions = [
                tx({ step: 'specify',   at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'implement', at: '2026-04-29T00:05:00Z' }),
                tx({ step: 'implement', substep: 'run-tests', by: 'cli', at: '2026-04-29T00:06:00Z' }),
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
        it('collapses duplicate rows for display but preserves the repeated-start trust anomaly', () => {
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
            expect(b.specify.startedAt).toBe(a.specify.startedAt);
            expect(b.specify.completedAt).toBe(a.specify.completedAt);
            expect(b.specify.durationTrusted).toBe(false);
            // The dropped duplicate's `at` must not become startedAt.
            expect(b.specify.startedAt).toBe('2026-04-29T00:00:00Z');
        });

        it('preserves a distinct substep on the same step (not collapsed)', () => {
            const transitions = [
                tx({ step: 'specify', at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'specify', substep: 'outline',  by: 'cli', at: '2026-04-29T00:00:05Z' }),
                tx({ step: 'specify', substep: 'validate', by: 'cli', at: '2026-04-29T00:00:10Z' }),
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

    // T011: new-shape kind-based tests
    describe('kind:complete marks a step as done (new canonical shape)', () => {
        it('step is in-flight when only kind:start entry exists', () => {
            const transitions = [
                tx({ step: 'specify', substep: null, kind: 'start', at: '2026-04-29T00:00:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'specify');
            expect(out.specify.completedAt).toBeNull();
        });

        it('step is completed when kind:complete entry (no from) is appended', () => {
            const transitions = [
                tx({ step: 'specify', substep: null, kind: 'start',    at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'specify', substep: null, kind: 'complete', from: undefined, at: '2026-04-29T00:05:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'specify');
            expect(out.specify.completedAt).toBe('2026-04-29T00:05:00Z');
        });

        it('substep pair (start + kind:complete) folds into one row', () => {
            const transitions = [
                tx({ step: 'specify', substep: null,      kind: 'start',    at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'specify', substep: 'outline', kind: 'start',    from: { step: 'specify', substep: null }, at: '2026-04-29T00:01:00Z' }),
                tx({ step: 'specify', substep: 'outline', kind: 'complete', from: undefined, at: '2026-04-29T00:02:00Z' }),
            ];
            const out = deriveStepHistory(transitions, 'specify');
            expect(out.specify.substeps).toHaveLength(1);
            expect(out.specify.substeps![0].name).toBe('outline');
            expect(out.specify.substeps![0].startedAt).toBe('2026-04-29T00:01:00Z');
            expect(out.specify.substeps![0].completedAt).toBe('2026-04-29T00:02:00Z');
        });
    });

    // Regression: review finding #3. setStepStarted writes kind:start entries;
    // only kind:complete entries should trigger completedAt.
    describe('regression: start entries never look like completions', () => {
        it('does NOT mark a step as completed when its lone entry has kind:start', () => {
            const transitions = [
                tx({
                    step: 'specify',
                    substep: null,
                    kind: 'start',
                    from: { step: null, substep: null },
                    at: '2026-04-29T00:00:00Z',
                }),
            ];
            const out = deriveStepHistory(transitions, 'specify');
            expect(out.specify.startedAt).toBe('2026-04-29T00:00:00Z');
            // The step is in flight — no completion entry yet.
            expect(out.specify.completedAt).toBeNull();
        });

        it('DOES mark a step as completed when a kind:complete entry is appended', () => {
            const transitions = [
                tx({
                    step: 'specify',
                    substep: null,
                    kind: 'start',
                    from: { step: null, substep: null },
                    at: '2026-04-29T00:00:00Z',
                }),
                tx({
                    step: 'specify',
                    substep: null,
                    kind: 'complete',
                    from: undefined,
                    at: '2026-04-29T00:05:00Z',
                }),
            ];
            const out = deriveStepHistory(transitions, 'specify');
            expect(out.specify.startedAt).toBe('2026-04-29T00:00:00Z');
            expect(out.specify.completedAt).toBe('2026-04-29T00:05:00Z');
        });
    });

    // The writer no longer emits `from` on starts, nor mirrors the task id into
    // `substep` on per-task implement finishes (substep is null, `task` carries
    // the id). A record in the new shape must derive identically to a legacy one.
    describe('new shape (no from, null substep on tasks) derives identically to legacy', () => {
        it('per-task implement rows match whether substep mirrors task or is null', () => {
            const legacy = [
                tx({ step: 'specify',   substep: null, kind: 'start', from: { step: null, substep: null }, at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'specify',   substep: null, kind: 'complete', from: undefined, at: '2026-04-29T00:01:00Z' }),
                tx({ step: 'implement', substep: null, kind: 'start', from: { step: 'specify', substep: null }, at: '2026-04-29T00:02:00Z' }),
                tx({ step: 'implement', substep: 'T001', task: 'T001', kind: 'complete', from: undefined, at: '2026-04-29T00:02:30Z' }),
                tx({ step: 'implement', substep: 'T002', task: 'T002', kind: 'complete', from: undefined, at: '2026-04-29T00:03:15Z' }),
            ];
            const newShape = [
                tx({ step: 'specify',   substep: null, kind: 'start', from: undefined, at: '2026-04-29T00:00:00Z' }),
                tx({ step: 'specify',   substep: null, kind: 'complete', from: undefined, at: '2026-04-29T00:01:00Z' }),
                tx({ step: 'implement', substep: null, kind: 'start', from: undefined, at: '2026-04-29T00:02:00Z' }),
                tx({ step: 'implement', substep: null, task: 'T001', kind: 'complete', from: undefined, at: '2026-04-29T00:02:30Z' }),
                tx({ step: 'implement', substep: null, task: 'T002', kind: 'complete', from: undefined, at: '2026-04-29T00:03:15Z' }),
            ];
            const a = deriveStepHistory(legacy, 'implement', 'implementing');
            const b = deriveStepHistory(newShape, 'implement', 'implementing');
            expect(b).toEqual(a);
            // And the per-task rows are the real shape we expect.
            expect(b.implement.substeps!.map(s => s.name)).toEqual(['T001', 'T002']);
            expect(b.implement.completedAt).toBeNull(); // still in flight, not closed by a task finish
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
                    kind: 'start',
                    from: { step: 'specify', substep: null },
                    at: '2026-04-29T00:01:00Z',
                }),
                tx({
                    step: 'specify',
                    substep: 'outline',
                    kind: 'complete',
                    from: undefined,
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

    // Regression for #229: an AI-authored step-level completion must clear
    // in-flight exactly like an extension-authored one. The viewer's tab
    // in-flight visual is gated on `completedAt` + `findRunningStep`; if a
    // `by: "ai"` complete didn't register, the tab would spin forever after
    // the AI finished the step (the original #229 symptom).
    describe('regression #229: ai-authored completion clears in-flight', () => {
        it('records completedAt and stops the running step for a by:"ai" step-level complete', () => {
            // currentStep still 'plan' (the AI self-closed before the user
            // advanced), status flipped to 'planned'. Mirrors the
            // specs/_01_demo-planned fixture inline (no .specify dependency).
            const history: Transition[] = [
                tx({ step: 'specify', kind: 'complete', by: 'ai', at: '2026-05-20T20:05:00Z' }),
                tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-05-20T20:05:00Z' }),
                tx({ step: 'plan', kind: 'complete', by: 'ai', at: '2026-05-20T20:10:00Z' }),
            ];
            const sh = deriveStepHistory(history, 'plan', 'planned');
            expect(sh.plan.completedAt).toBe('2026-05-20T20:10:00Z');
            expect(findRunningStep(sh)).toBeNull();
        });

        it('keeps a genuinely-running step in flight (started, no completion)', () => {
            const history: Transition[] = [
                tx({ step: 'specify', kind: 'complete', by: 'ai', at: '2026-05-20T20:05:00Z' }),
                tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-05-20T20:05:00Z' }),
                // Substep finishes recorded, but no step-level complete yet.
                tx({ step: 'plan', substep: 'research', kind: 'complete', by: 'ai', at: '2026-05-20T20:07:00Z' }),
            ];
            const sh = deriveStepHistory(history, 'plan', 'planning');
            expect(sh.plan.completedAt).toBeNull();
            expect(findRunningStep(sh)).toEqual({ step: 'plan', startedAt: '2026-05-20T20:05:00Z' });
        });
    });

    describe('duration honesty: durationTrusted only from extension-stamped boundaries', () => {
        it('trusts a span whose start and close are both extension-stamped', () => {
            const history: Transition[] = [
                tx({ step: 'specify', kind: 'start', by: 'extension', at: '2026-07-01T10:00:00Z' }),
                tx({ step: 'specify', kind: 'complete', by: 'extension', at: '2026-07-01T10:05:00Z' }),
            ];
            const sh = deriveStepHistory(history, 'specify', 'specified');
            expect(sh.specify.durationTrusted).toBe(true);
        });

        it('does not trust a span closed by an ai-journaled finish', () => {
            const history: Transition[] = [
                tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-07-01T10:00:00Z' }),
                tx({ step: 'plan', kind: 'complete', by: 'ai', at: '2026-07-01T10:00:00.100Z' }),
            ];
            const sh = deriveStepHistory(history, 'plan', 'planned');
            expect(sh.plan.completedAt).toBe('2026-07-01T10:00:00.100Z');
            expect(sh.plan.durationTrusted).toBe(false);
        });

        it('does not trust a span whose start was ai-journaled (fast-path fold)', () => {
            const history: Transition[] = [
                tx({ step: 'plan', kind: 'start', by: 'ai', substep: 'fast-path', at: '2026-07-01T10:00:00Z' }),
                tx({ step: 'plan', kind: 'complete', by: 'ai', substep: 'fast-path', at: '2026-07-01T10:00:00.094Z' }),
            ];
            const sh = deriveStepHistory(history, 'plan', 'planned');
            expect(sh.plan.durationTrusted).toBe(false);
        });

        it('trusts an extension-closed boundary via the next step\'s extension start', () => {
            const history: Transition[] = [
                tx({ step: 'specify', kind: 'start', by: 'extension', at: '2026-07-01T10:00:00Z' }),
                tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-07-01T10:06:00Z' }),
            ];
            const sh = deriveStepHistory(history, 'plan', 'planning');
            expect(sh.specify.completedAt).toBe('2026-07-01T10:06:00Z');
            expect(sh.specify.durationTrusted).toBe(true);
        });

        it('does not call an in-flight start a measured duration', () => {
            const history: Transition[] = [
                tx({ step: 'implement', kind: 'start', by: 'extension', at: '2026-07-01T10:00:00Z' }),
            ];
            const sh = deriveStepHistory(history, 'implement', 'implementing');
            expect(sh.implement.completedAt).toBeNull();
            expect(sh.implement.durationTrusted).toBe(false);
        });

        it('rejects completion-before-start and repeated starts', () => {
            const completionBeforeStart = deriveStepHistory([
                tx({ step: 'plan', kind: 'complete', by: 'extension', at: '2026-07-01T09:59:00Z' }),
                tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-07-01T10:00:00Z' }),
            ], 'plan', 'planned');
            expect(completionBeforeStart.plan.durationTrusted).toBe(false);

            const repeated = deriveStepHistory([
                tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-07-01T10:00:00Z' }),
                tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-07-01T10:01:00Z' }),
                tx({ step: 'plan', kind: 'complete', by: 'extension', at: '2026-07-01T10:03:00Z' }),
            ], 'plan', 'planned');
            expect(repeated.plan.durationTrusted).toBe(false);
        });
    });
});

describe('deriveTimingSummary', () => {
    const measured = (startedAt: string, completedAt: string) => ({
        startedAt,
        completedAt,
        durationTrusted: true,
    });

    it('returns wall-clock elapsed only when every expected phase is measured', () => {
        const timing = deriveTimingSummary({
            specify: measured('2026-07-01T10:00:00Z', '2026-07-01T10:05:00Z'),
            plan: measured('2026-07-01T10:05:00Z', '2026-07-01T10:12:00Z'),
            tasks: measured('2026-07-01T10:12:00Z', '2026-07-01T10:15:00Z'),
            implement: measured('2026-07-01T10:15:00Z', '2026-07-01T10:24:00Z'),
        });
        expect(timing).toEqual({
            measuredPhases: 4,
            expectedPhases: 4,
            complete: true,
            startedAt: '2026-07-01T10:00:00Z',
            endedAt: '2026-07-01T10:24:00Z',
            elapsedMs: 24 * 60 * 1000,
        });
    });

    it('keeps partial timing as coverage and never a total', () => {
        const timing = deriveTimingSummary({
            implement: measured('2026-07-01T10:15:00Z', '2026-07-01T10:21:30Z'),
        });
        expect(timing).toEqual({ measuredPhases: 1, expectedPhases: 4, complete: false });
        expect(timing.elapsedMs).toBeUndefined();
    });

    it('models feature 484 as Implement-only timing (~6m 30s), never a run total', () => {
        const history: Transition[] = [
            tx({ step: 'specify', kind: 'start', by: 'extension', at: '2026-07-21T04:54:47.394Z' }),
            tx({ step: 'specify', kind: 'complete', by: 'extension', at: '2026-07-21T04:56:53.041Z' }),
            tx({ step: 'plan', substep: 'research', kind: 'complete', by: 'ai', at: '2026-07-21T04:58:08.019Z' }),
            tx({ step: 'plan', kind: 'complete', by: 'ai', at: '2026-07-21T04:58:08.222Z' }),
            tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-07-21T04:58:18.300Z' }),
            tx({ step: 'tasks', substep: 'generate', kind: 'complete', by: 'ai', at: '2026-07-21T04:58:58.186Z' }),
            tx({ step: 'tasks', kind: 'complete', by: 'ai', at: '2026-07-21T04:58:58.320Z' }),
            tx({ step: 'tasks', kind: 'start', by: 'extension', at: '2026-07-21T04:59:18.547Z' }),
            tx({ step: 'implement', kind: 'start', by: 'extension', at: '2026-07-21T04:59:32.305Z' }),
            tx({ step: 'implement', kind: 'complete', by: 'extension', at: '2026-07-21T05:06:01.863Z' }),
        ];
        const steps = deriveStepHistory(history, 'implement', 'completed');
        expect(steps.implement.durationTrusted).toBe(true);
        expect(Date.parse(steps.implement.completedAt!) - Date.parse(steps.implement.startedAt))
            .toBe(389_558);
        expect(deriveTimingSummary(steps)).toEqual({
            measuredPhases: 1,
            expectedPhases: 4,
            complete: false,
        });
    });

    it('trusts all four phases for the fixed capture order (body starts + hook completes)', () => {
        const history: Transition[] = [
            tx({ step: 'specify', kind: 'start', by: 'extension', at: '2026-07-21T10:00:00.100Z' }),
            tx({ step: 'specify', kind: 'complete', by: 'extension', at: '2026-07-21T10:04:00.200Z' }),
            tx({ step: 'plan', kind: 'start', by: 'extension', at: '2026-07-21T10:04:30.300Z' }),
            tx({ step: 'plan', substep: 'research', kind: 'complete', by: 'ai', at: '2026-07-21T10:07:00Z' }),
            tx({ step: 'plan', substep: 'design', kind: 'complete', by: 'ai', at: '2026-07-21T10:09:00Z' }),
            tx({ step: 'plan', kind: 'complete', by: 'extension', at: '2026-07-21T10:09:10.400Z' }),
            tx({ step: 'tasks', kind: 'start', by: 'extension', at: '2026-07-21T10:09:30.500Z' }),
            tx({ step: 'tasks', substep: 'generate', kind: 'complete', by: 'ai', at: '2026-07-21T10:12:00Z' }),
            tx({ step: 'tasks', kind: 'complete', by: 'extension', at: '2026-07-21T10:12:10.600Z' }),
            tx({ step: 'implement', kind: 'start', by: 'extension', at: '2026-07-21T10:12:30.700Z' }),
            tx({ step: 'implement', substep: null, task: 'T001', kind: 'complete', by: 'ai', at: '2026-07-21T10:15:00Z' }),
            tx({ step: 'implement', substep: null, task: 'T002', kind: 'complete', by: 'ai', at: '2026-07-21T10:18:00Z' }),
            tx({ step: 'implement', kind: 'complete', by: 'extension', at: '2026-07-21T10:20:00.800Z' }),
        ];
        const steps = deriveStepHistory(history, 'implement', 'completed');
        for (const step of ['specify', 'plan', 'tasks', 'implement'] as const) {
            expect(steps[step].durationTrusted).toBe(true);
        }
        const timing = deriveTimingSummary(steps);
        expect(timing.measuredPhases).toBe(4);
        expect(timing.complete).toBe(true);
        expect(timing.startedAt).toBe('2026-07-21T10:00:00.100Z');
        expect(timing.endedAt).toBe('2026-07-21T10:20:00.800Z');
    });

    it('models feature 406 repeated/reversed boundaries without four trusted phases', () => {
        const history: Transition[] = [
            tx({ step: 'specify', kind: 'start', by: 'extension', at: '2026-07-21T00:25:21.186Z' }),
            tx({ step: 'specify', kind: 'complete', by: 'extension', at: '2026-07-21T00:28:53.117Z' }),
            tx({ step: 'specify', kind: 'complete', by: 'user', at: '2026-07-21T00:40:36.886Z' }),
            tx({ step: 'plan', kind: 'complete', by: 'extension', at: '2026-07-21T00:40:44.310Z' }),
            tx({ step: 'tasks', kind: 'start', by: 'extension', at: '2026-07-21T00:40:44.312Z' }),
            tx({ step: 'plan', kind: 'start', by: 'user', at: '2026-07-21T00:41:37.194Z' }),
            tx({ step: 'plan', kind: 'complete', by: 'user', at: '2026-07-21T00:49:34.719Z' }),
            tx({ step: 'tasks', kind: 'start', by: 'extension', at: '2026-07-21T00:52:29.049Z' }),
            tx({ step: 'tasks', kind: 'complete', by: 'user', at: '2026-07-21T01:02:03.685Z' }),
            tx({ step: 'implement', kind: 'start', by: 'extension', at: '2026-07-21T01:02:05.953Z' }),
            tx({ step: 'implement', kind: 'complete', by: 'extension', at: '2026-07-21T01:15:18.570Z' }),
        ];
        const timing = deriveTimingSummary(deriveStepHistory(history, 'implement', 'completed'));
        expect(timing.complete).toBe(false);
        expect(timing.measuredPhases).toBeLessThan(4);
        expect(timing.elapsedMs).toBeUndefined();
    });
});

describe('deriveDocumentState', () => {
    const done = { startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' };

    it('reports a missing file as missing whatever the parent says', () => {
        expect(deriveDocumentState('empty', 'specify', { status: 'completed', currentStep: 'implement' }))
            .toBe('missing');
        expect(deriveDocumentState(undefined, 'specify', undefined)).toBe('missing');
    });

    it.each(['completed', 'archived'])(
        'still completes a finished step under a %s spec (no blank icon)',
        status => {
            expect(deriveDocumentState('complete', 'specify', { status, currentStep: 'implement' }))
                .toBe('complete');
        },
    );

    it('keeps a stub file in progress under a completed spec rather than claiming completion', () => {
        expect(deriveDocumentState('partial', 'tasks', { status: 'completed', currentStep: 'implement' }))
            .toBe('in-progress');
    });

    it('completes a step the workflow moved past', () => {
        expect(deriveDocumentState('complete', 'specify', { currentStep: 'plan', stepHistory: { specify: done } }))
            .toBe('complete');
    });

    it('marks the current step in progress', () => {
        expect(deriveDocumentState('complete', 'plan', { currentStep: 'plan' })).toBe('in-progress');
    });

    it('leaves a step the workflow has not reached pending', () => {
        expect(deriveDocumentState('complete', 'tasks', { currentStep: 'specify' })).toBe('pending');
    });

    it('treats a non-workflow document by its own content', () => {
        expect(deriveDocumentState('complete', 'research', { currentStep: 'specify' })).toBe('complete');
        expect(deriveDocumentState('partial', 'research', { currentStep: 'specify' })).toBe('in-progress');
    });
});
