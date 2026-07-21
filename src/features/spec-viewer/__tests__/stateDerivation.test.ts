import {
    isStepCompleted,
    deriveStepBadges,
    derivePulse,
    deriveHighlights,
    deriveActiveSubstep,
    deriveViewerState,
} from '../stateDerivation';
import type { SpecContext, HistoryEntry, StepName } from '../../../core/types/specContext';
import type { WorkflowStepConfig } from '../../workflows/types';
import { COMPANION_WORKFLOW, normalizeWorkflowConfig } from '../../workflows/workflowManager';

// Stub footerActions — these tests exercise derivation, not footer logic.
// (vscode itself is mocked globally via jest.config moduleNameMapper, so
// importing workflowManager below is fine.)
jest.mock('../footerActions', () => ({
    getFooterActions: jest.fn().mockReturnValue([]),
}));

function makeContext(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'speckit',
        specName: 'test',
        branch: 'main',
        currentStep: 'specify',
        status: 'draft',
        history: [],
        ...overrides,
    };
}

describe('isStepCompleted', () => {
    it('returns true when step has explicit completedAt', () => {
        const history = { specify: { startedAt: '2026-01-01', completedAt: '2026-01-02' } };
        expect(isStepCompleted('specify', 'specify', history)).toBe(true);
    });

    it('returns true when step has startedAt and precedes currentStep', () => {
        const history = { specify: { startedAt: '2026-01-01', completedAt: null } };
        expect(isStepCompleted('specify', 'plan', history)).toBe(true);
    });

    it('returns true when step has NO history entry but precedes currentStep', () => {
        expect(isStepCompleted('specify', 'tasks', {})).toBe(true);
        expect(isStepCompleted('plan', 'tasks', {})).toBe(true);
    });

    it('returns false for currentStep itself with no history', () => {
        expect(isStepCompleted('tasks', 'tasks', {})).toBe(false);
    });

    it('returns false for steps after currentStep', () => {
        expect(isStepCompleted('tasks', 'specify', {})).toBe(false);
    });

    it('returns false for currentStep with startedAt but no completedAt', () => {
        const history = { plan: { startedAt: '2026-01-01', completedAt: null } };
        expect(isStepCompleted('plan', 'plan', history)).toBe(false);
    });
});

describe('deriveStepBadges', () => {
    it('marks steps before currentStep as completed even without history', () => {
        const ctx = makeContext({ currentStep: 'tasks' });
        const badges = deriveStepBadges(ctx);
        expect(badges['specify']).toBe('completed');
        expect(badges['plan']).toBe('completed');
        expect(badges['tasks']).toBe('not-started');
    });

    it('marks step with startedAt at currentStep as in-progress', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'tasking',
            history: [
                { step: 'tasks', substep: null, kind: 'start', from: { step: 'plan', substep: null }, by: 'extension', at: '2026-01-01T00:00:00Z' },
            ],
        });
        const badges = deriveStepBadges(ctx);
        expect(badges['tasks']).toBe('in-progress');
    });

    it('marks all steps completed when history shows them all completed', () => {
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'ready-to-implement',
            history: [
                { step: 'specify', substep: null, kind: 'start',    from: { step: null, substep: null },    by: 'extension', at: '2026-01-01' },
                { step: 'specify', substep: null, kind: 'complete',                                         by: 'extension', at: '2026-01-02' },
                { step: 'plan',    substep: null, kind: 'start',    from: { step: 'specify', substep: null }, by: 'extension', at: '2026-01-02' },
                { step: 'plan',    substep: null, kind: 'complete',                                          by: 'extension', at: '2026-01-03' },
                { step: 'tasks',   substep: null, kind: 'start',    from: { step: 'plan', substep: null },   by: 'extension', at: '2026-01-03' },
                { step: 'tasks',   substep: null, kind: 'complete',                                          by: 'extension', at: '2026-01-04' },
            ],
        });
        // Status non-terminal: 'tasks' is currentStep, last entry is its completion,
        // so derivation marks it as completed only when a *later* step entry exists.
        // With status 'ready-to-implement', the inferred-completion fallback keeps
        // 'specify' + 'plan' as completed; 'tasks' is the current step still.
        const badges = deriveStepBadges(ctx);
        expect(badges['specify']).toBe('completed');
        expect(badges['plan']).toBe('completed');
    });
});

describe('derivePulse', () => {
    it('returns null when no step is in flight', () => {
        const ctx = makeContext({ currentStep: 'tasks' });
        expect(derivePulse(ctx)).toBeNull();
    });

    it('returns the in-progress step', () => {
        const ctx = makeContext({
            currentStep: 'plan',
            status: 'planning',
            history: [
                { step: 'plan', substep: null, kind: 'start', from: { step: 'specify', substep: null }, by: 'extension', at: '2026-01-01T00:00:00Z' },
            ],
        });
        expect(derivePulse(ctx)).toBe('plan');
    });

    it('returns null for completed/archived specs', () => {
        const ctx = makeContext({ status: 'completed' });
        expect(derivePulse(ctx)).toBeNull();
    });
});

describe('deriveHighlights', () => {
    it('includes steps before currentStep even without history', () => {
        const ctx = makeContext({ currentStep: 'tasks' });
        const highlights = deriveHighlights(ctx);
        expect(highlights).toContain('specify');
        expect(highlights).toContain('plan');
        expect(highlights).not.toContain('tasks');
    });
});

describe('deriveActiveSubstep', () => {
    it('falls back to top-level `progress` when no substeps are in flight', () => {
        const ctx = makeContext({
            currentStep: 'specify',
            // top-level `progress` is a tolerated extra field on .spec-context.json
            progress: 'exploring',
        } as Partial<SpecContext> as SpecContext);
        expect(deriveActiveSubstep(ctx)).toEqual({ step: 'specify', name: 'exploring' });
    });

    it('returns null when neither substeps nor progress is present', () => {
        const ctx = makeContext({ currentStep: 'plan' });
        expect(deriveActiveSubstep(ctx)).toBeNull();
    });

    it('prefers in-flight substep over top-level progress', () => {
        const ctx = makeContext({
            currentStep: 'specify',
            status: 'specifying',
            history: [
                { step: 'specify', substep: null,              kind: 'start', from: { step: null, substep: null },    by: 'extension', at: '2026-01-01T00:00:00Z' },
                { step: 'specify', substep: 'writing-spec', kind: 'start', from: { step: 'specify', substep: null }, by: 'extension', at: '2026-01-01T01:00:00Z' },
            ],
            progress: 'exploring',
        } as Partial<SpecContext> as SpecContext);
        expect(deriveActiveSubstep(ctx)).toEqual({ step: 'specify', name: 'writing-spec' });
    });
});

describe('deriveViewerState', () => {
    it('produces correct state for auto incomplete history', () => {
        // Simulates what auto leaves behind: specify was started but its
        // completion was never appended; currentStep advanced to "tasks".
        const ctx = makeContext({
            currentStep: 'tasks',
            status: 'implementing', // coerced from "active"
            history: [
                { step: 'specify', substep: null, kind: 'start', from: { step: null, substep: null }, by: 'cli', at: '2026-01-01T00:00:00Z' },
            ],
        });
        const state = deriveViewerState(ctx);
        expect(state.steps['specify']).toBe('completed');
        expect(state.steps['plan']).toBe('completed');
        expect(state.steps['tasks']).toBe('not-started');
        expect(state.highlights).toContain('specify');
        expect(state.highlights).toContain('plan');
        expect(state.pulse).toBeNull();
    });

    describe('timing coverage denominator', () => {
        // Mirrors COMPANION_WORKFLOW: 5 steps, mark-complete never times (untimed).
        const companionSteps: WorkflowStepConfig[] = [
            { name: 'specify', command: 'speckit.companion.specify' },
            { name: 'plan', command: 'speckit.companion.plan' },
            { name: 'tasks', command: 'speckit.companion.tasks' },
            { name: 'implement', command: 'speckit.companion.implement', actionOnly: true },
            { name: 'mark-complete', command: 'speckit.companion.mark-complete', actionOnly: true, untimed: true },
        ];
        const extPair = (step: StepName, start: string, end: string): HistoryEntry[] => ([
            { step, substep: null, kind: 'start', from: { step: null, substep: null }, by: 'extension', at: start },
            { step, substep: null, kind: 'complete', from: { step: null, substep: null }, by: 'extension', at: end },
        ]);
        const completedRun = () => makeContext({
            currentStep: 'implement',
            status: 'completed',
            history: [
                ...extPair('specify', '2026-07-21T10:00:00.000Z', '2026-07-21T10:02:00.000Z'),
                ...extPair('plan', '2026-07-21T10:02:00.100Z', '2026-07-21T10:04:00.000Z'),
                ...extPair('tasks', '2026-07-21T10:04:00.100Z', '2026-07-21T10:05:00.000Z'),
                ...extPair('implement', '2026-07-21T10:05:00.100Z', '2026-07-21T10:12:00.000Z'),
            ],
        });

        it('excludes the untimed mark-complete step so a finished Companion run reaches full coverage', () => {
            const timing = deriveViewerState(completedRun(), 'implement', companionSteps).timing;
            expect(timing.expectedPhases).toBe(4);   // not 5 — mark-complete is untimed
            expect(timing.measuredPhases).toBe(4);
            expect(timing.complete).toBe(true);       // this is what unlocks the elapsed block
            expect(timing.elapsedMs).toBeGreaterThan(0);
        });

        it('a fast-path spec parked at ready-to-implement shows 3 of 4, not complete', () => {
            const parked = makeContext({
                currentStep: 'tasks',
                status: 'ready-to-implement',
                history: [
                    ...extPair('specify', '2026-07-21T10:00:00.000Z', '2026-07-21T10:02:00.000Z'),
                    ...extPair('plan', '2026-07-21T10:02:00.100Z', '2026-07-21T10:02:00.200Z'),
                    ...extPair('tasks', '2026-07-21T10:02:00.300Z', '2026-07-21T10:02:00.400Z'),
                ],
            });
            const timing = deriveViewerState(parked, 'tasks', companionSteps).timing;
            expect(timing.measuredPhases).toBe(3);
            expect(timing.expectedPhases).toBe(4);
            expect(timing.complete).toBe(false);
        });

        it('leaves a stock 4-step workflow denominator unchanged', () => {
            const stockSteps = companionSteps.slice(0, 4); // no mark-complete
            const timing = deriveViewerState(completedRun(), 'implement', stockSteps).timing;
            expect(timing.expectedPhases).toBe(4);
            expect(timing.complete).toBe(true);
        });

        it('the real COMPANION_WORKFLOW flags mark-complete untimed, and it survives normalize', () => {
            // Closes the runtime gap: the viewer resolves steps via
            // normalizeWorkflowConfig(COMPANION_WORKFLOW), so the flag must be intact there.
            const norm = normalizeWorkflowConfig(COMPANION_WORKFLOW);
            const markComplete = norm.steps!.find(s => s.name === 'mark-complete');
            expect(markComplete?.untimed).toBe(true);
            const timed = norm.steps!.filter(s => !s.untimed).map(s => s.name);
            expect(timed).toEqual(['specify', 'plan', 'tasks', 'implement']);
        });
    });

    describe('livingSpecs derivation', () => {
        it('exposes loaded + synced when present', () => {
            const ctx = makeContext({
                livingSpecs: { loaded: ['checkout', 'cart'], synced: ['checkout'] },
            });
            expect(deriveViewerState(ctx).livingSpecs).toEqual({
                loaded: ['checkout', 'cart'],
                synced: ['checkout'],
            });
        });

        it('defaults synced to [] when only loaded is present', () => {
            const ctx = makeContext({ livingSpecs: { loaded: ['checkout'] } });
            expect(deriveViewerState(ctx).livingSpecs).toEqual({
                loaded: ['checkout'],
                synced: [],
            });
        });

        it('is undefined when no livingSpecs field', () => {
            expect(deriveViewerState(makeContext()).livingSpecs).toBeUndefined();
        });

        it('is undefined when both lists are empty', () => {
            const ctx = makeContext({ livingSpecs: { loaded: [], synced: [] } });
            expect(deriveViewerState(ctx).livingSpecs).toBeUndefined();
        });

        it('coerces a malformed shape to safe trimmed string arrays', () => {
            const ctx = makeContext({
                livingSpecs: {
                    loaded: ['  checkout  ', 42, null, '', 'cart'] as unknown as string[],
                    synced: 'checkout' as unknown as string[],
                },
            });
            expect(deriveViewerState(ctx).livingSpecs).toEqual({
                loaded: ['checkout', 'cart'],
                synced: [],
            });
        });
    });
});

describe('reasoning-trail normalization', () => {
    describe('decisions', () => {
        it('normalizes legacy string decisions into {decision}', () => {
            const state = deriveViewerState(makeContext({ decisions: ['use the store', 'disable not hide'] } as never));
            expect(state.decisions).toEqual([
                { decision: 'use the store' },
                { decision: 'disable not hide' },
            ]);
        });

        it('keeps structured decisions with why/rejected intact', () => {
            const entry = { decision: 'map over array', why: 'one-lookup queries', rejected: 'array scan' };
            const state = deriveViewerState(makeContext({ decisions: [entry] } as never));
            expect(state.decisions).toEqual([entry]);
        });

        it('renders mixed shapes in order and skips malformed entries', () => {
            const state = deriveViewerState(makeContext({
                decisions: ['legacy', { decision: 'structured', why: 'w' }, { why: 'no identity' }, 42, null],
            } as never));
            expect(state.decisions).toEqual([
                { decision: 'legacy' },
                { decision: 'structured', why: 'w' },
            ]);
        });
    });

    describe('verified', () => {
        it('normalizes strings and keeps structured entries with warnings', () => {
            const state = deriveViewerState(makeContext({
                verified: ['build clean', { what: 'jest', result: '20/20', command: 'npm test', warnings: ['w1'] }],
            } as never));
            expect(state.verified).toEqual([
                { what: 'build clean' },
                { what: 'jest', result: '20/20', command: 'npm test', warnings: ['w1'] },
            ]);
        });
    });

    describe('coverage', () => {
        it('turns the map into rows sorted by requirement id with titles', () => {
            const state = deriveViewerState(makeContext({
                coverage: {
                    'FR-010': { tasks: ['T009'], tests: ['a.test.ts'] },
                    'FR-002': { title: 'Second req', tasks: ['T001'] },
                },
            } as never));
            expect(state.coverage).toEqual([
                { req: 'FR-002', title: 'Second req', tasks: ['T001'], tests: [] },
                { req: 'FR-010', title: undefined, tasks: ['T009'], tests: ['a.test.ts'] },
            ]);
        });

        it('skips malformed entries and yields absent for an empty map', () => {
            expect(deriveViewerState(makeContext({ coverage: {} } as never)).coverage).toBeUndefined();
            const state = deriveViewerState(makeContext({ coverage: { 'FR-001': 'not-an-object' } } as never));
            expect(state.coverage).toBeUndefined();
        });
    });

    describe('intent / expectations / classification', () => {
        it('passes intent and expectations through', () => {
            const state = deriveViewerState(makeContext({
                intent: 'the goal', expectations: ['no undo', 'no redesign'],
            } as never));
            expect(state.intent).toBe('the goal');
            expect(state.expectations).toEqual(['no undo', 'no redesign']);
        });

        it('keeps classification only when it carries a verdict', () => {
            const good = deriveViewerState(makeContext({
                classification: { projectedFiles: 9, projectedTasks: 11, scopeSignal: 'none', verdict: 'normal' },
            } as never));
            expect(good.classification?.verdict).toBe('normal');
            const bad = deriveViewerState(makeContext({ classification: { projectedFiles: 9 } } as never));
            expect(bad.classification).toBeUndefined();
        });
    });

    it('a pre-capture context yields every new field absent (legacy identical)', () => {
        const state = deriveViewerState(makeContext());
        expect(state.decisions).toBeUndefined();
        expect(state.verified).toBeUndefined();
        expect(state.coverage).toBeUndefined();
        expect(state.intent).toBeUndefined();
        expect(state.expectations).toBeUndefined();
        expect(state.classification).toBeUndefined();
    });
});

describe('malformed optional fields are coerced, never crash the renderer', () => {
    it('drops a non-array warnings value instead of passing a string through', () => {
        const state = deriveViewerState(makeContext({
            verified: [{ what: 'jest', warnings: 'a bare string, not an array' }],
        } as never));
        expect(state.verified).toEqual([{ what: 'jest', result: undefined, command: undefined, warnings: undefined }]);
    });

    it('drops non-string why/rejected/result/command values', () => {
        const state = deriveViewerState(makeContext({
            decisions: [{ decision: 'keep', why: 42, rejected: { nested: true } }],
            verified: [{ what: 'build', result: 7, command: null }],
        } as never));
        expect(state.decisions).toEqual([{ decision: 'keep', why: undefined, rejected: undefined }]);
        expect(state.verified?.[0]).toEqual({ what: 'build', result: undefined, command: undefined, warnings: undefined });
    });
});

describe('rollback recovery (#414) — interrupted step after a forced status', () => {
    // implement dispatched, run interrupted (dangling start), user forces
    // ready-to-implement via the gear (forceStatus realigns currentStep=tasks
    // and appends a user tasks-complete).
    function strandedThenForced(): SpecContext {
        return makeContext({
            currentStep: 'tasks',
            status: 'ready-to-implement',
            history: [
                { step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-07-09T10:00:00Z' },
                { step: 'specify', substep: null, kind: 'complete', by: 'extension', at: '2026-07-09T10:05:00Z' },
                { step: 'plan', substep: null, kind: 'start', by: 'extension', at: '2026-07-09T10:06:00Z' },
                { step: 'plan', substep: null, kind: 'complete', by: 'extension', at: '2026-07-09T10:15:00Z' },
                { step: 'tasks', substep: null, kind: 'start', by: 'extension', at: '2026-07-09T10:16:00Z' },
                { step: 'tasks', substep: null, kind: 'complete', by: 'extension', at: '2026-07-09T10:20:00Z' },
                { step: 'implement', substep: null, kind: 'start', by: 'extension', at: '2026-07-09T10:21:00Z' },
                { step: 'tasks', substep: null, kind: 'complete', by: 'user', at: '2026-07-09T11:00:00Z' },
            ],
        });
    }

    it('does not display the interrupted implement step as completed', () => {
        const badges = deriveStepBadges(strandedThenForced());
        expect(badges['implement']).toBe('not-started');
        expect(badges['tasks']).toBe('completed');
    });

    it('does not back-fill the interrupted attempt\'s end from the rollback boundary', () => {
        const state = deriveViewerState(strandedThenForced(), 'tasks');
        expect(state.stepHistory['implement']).toBeUndefined();
    });

    it('does not pulse the rolled-back step as if it were running', () => {
        expect(derivePulse(strandedThenForced())).toBeNull();
    });

    it('keeps a completed retry after recovery as completed', () => {
        const ctx = strandedThenForced();
        ctx.history = [
            ...ctx.history,
            { step: 'implement', substep: null, kind: 'start', by: 'extension', at: '2026-07-09T11:05:00Z' },
            { step: 'implement', substep: null, kind: 'complete', by: 'extension', at: '2026-07-09T11:30:00Z' },
        ];
        ctx.currentStep = 'implement';
        ctx.status = 'implemented';
        const badges = deriveStepBadges(ctx);
        expect(badges['implement']).toBe('completed');
    });

    it('re-running an earlier step keeps a genuinely completed later step completed', () => {
        // late clarify after plan finished — a rollback only trims *incomplete* attempts
        const ctx = makeContext({
            currentStep: 'clarify',
            status: 'specifying',
            history: [
                { step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-07-09T10:00:00Z' },
                { step: 'specify', substep: null, kind: 'complete', by: 'extension', at: '2026-07-09T10:05:00Z' },
                { step: 'plan', substep: null, kind: 'start', by: 'extension', at: '2026-07-09T10:06:00Z' },
                { step: 'plan', substep: null, kind: 'complete', by: 'extension', at: '2026-07-09T10:15:00Z' },
                { step: 'clarify', substep: null, kind: 'start', by: 'extension', at: '2026-07-09T10:20:00Z' },
            ],
        });
        const state = deriveViewerState(ctx, 'clarify');
        expect(state.stepHistory['plan']?.completedAt).toBe('2026-07-09T10:15:00Z');
        expect(deriveStepBadges(ctx)['plan']).toBe('completed');
    });

    it('keeps a genuinely in-flight current step in flight (no rollback involved)', () => {
        const ctx = strandedThenForced();
        ctx.history = ctx.history.slice(0, 7); // ends at the dangling implement start
        ctx.currentStep = 'implement';
        ctx.status = 'implementing';
        expect(derivePulse(ctx)).toBe('implement');
        expect(deriveStepBadges(ctx)['implement']).toBe('in-progress');
    });
});

describe('context (ICE C) passthrough', () => {
    it('passes context strings through and drops non-strings', () => {
        const state = deriveViewerState(makeContext({
            context: ['living spec: checkout', 42, 'area: nodes/specify', null],
        } as never));
        expect(state.context).toEqual(['living spec: checkout', 'area: nodes/specify']);
    });

    it('is absent when the field is missing', () => {
        expect(deriveViewerState(makeContext()).context).toBeUndefined();
    });
});
