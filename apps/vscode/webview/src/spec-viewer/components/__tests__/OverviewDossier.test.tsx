/** @jest-environment jsdom */
import { h, render } from 'preact';
import { IntentSection, OverviewTiming, CoverageSection, DecisionsSection, VerifiedSection } from '../OverviewDossier';
import type { HistoryEntry, ViewerState } from '../../types';
import { deriveStepHistory, deriveTimingSummary } from '../../../../../src/features/specs/stepHistoryDerivation';
import { deriveConvergeResult } from '../../../../../src/features/spec-viewer/convergeResult';
import type { SpecContext } from '../../../../../src/core/types/specContext';

const base = (overrides: Partial<ViewerState>): ViewerState => ({
    status: 'specified',
    activeStep: 'specify',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    history: [],
    stepHistory: {},
    ...overrides,
});

describe('IntentSection', () => {
    afterEach(() => {
        delete (globalThis as { vscode?: unknown }).vscode;
    });

    it('renders an approach-only state as one metadata block with no empty sibling', () => {
        const host = document.createElement('div');
        render(h(IntentSection, { state: base({ intent: 'Make timing honest.', approach: 'Trust explicit boundaries only.' }) }), host);
        const meta = host.querySelector('.dossier-intent__meta');
        expect(meta).not.toBeNull();
        expect(meta?.children).toHaveLength(1);
        expect(meta?.textContent).toContain('Trust explicit boundaries only.');
    });

    it('places selected living specs below Approach, before the Working Area column', () => {
        const host = document.createElement('div');
        render(h(IntentSection, {
            state: base({
                intent: 'Keep the implementation aligned with its capabilities.',
                approach: 'Keep capability context beside the implementation strategy.',
                context: ['area: spec-viewer footer'],
                livingSpecs: { loaded: ['viewer-ui', 'spec-viewer'], synced: [] },
                classification: { verdict: 'normal', projectedFiles: 2, projectedTasks: 4, scopeSignal: 'none' },
                stepHistory: {
                    specify: { startedAt: '2026-07-21T10:00:00Z', completedAt: '2026-07-21T10:04:00Z', durationTrusted: false },
                },
                timing: { measuredPhases: 0, expectedPhases: 4, complete: false },
            }),
        }), host);

        const approach = host.querySelector('.dossier-intent__approach');
        const context = host.querySelector('.dossier-intent__context');
        expect(approach?.textContent).toContain('Approach');
        expect(approach?.textContent).toContain('Living specs');
        expect(context?.textContent).toContain('Working area');
        expect(context?.textContent).toContain('Size');
        expect(context?.textContent).not.toContain('Living specs');
        expect(Array.from(approach?.querySelectorAll('.living-specs-chip') ?? []).map(node => node.textContent))
            .toEqual(['Viewer Ui', 'Spec Viewer']);
        expect(host.querySelector('.dossier-intent__statement')?.nextElementSibling)
            .toBe(host.querySelector('.dossier-timing'));
    });

    it('renders living specs even when other intent fields are absent', () => {
        const host = document.createElement('div');
        render(h(IntentSection, {
            state: base({ livingSpecs: { loaded: ['viewer-ui'], synced: [] } }),
        }), host);
        expect(host.querySelector('.dossier-intent')).not.toBeNull();
        expect(host.textContent).toContain('Viewer Ui');
    });

    it('shows the run overview without an empty Intent heading when only timing exists', () => {
        const host = document.createElement('div');
        render(h(IntentSection, {
            state: base({
                stepHistory: { specify: { startedAt: '2026-07-21T10:00:00Z', completedAt: '2026-07-21T10:04:00Z', durationTrusted: false } },
                timing: { measuredPhases: 0, expectedPhases: 4, complete: false },
            }),
        }), host);
        expect(host.querySelector('.dossier-timing')).not.toBeNull();
        expect(host.textContent).not.toContain('Intent');
    });

    it('omits the whole region when no intent context exists', () => {
        const host = document.createElement('div');
        render(h(IntentSection, { state: base({}) }), host);
        expect(host.querySelector('.dossier-intent')).toBeNull();
    });
});

describe('OverviewTiming', () => {
    it('shows a trustworthy whole-run active total and lifecycle phases', () => {
        const host = document.createElement('div');
        render(h(OverviewTiming, {
            state: base({
                stepHistory: {
                    specify: { startedAt: '2026-07-21T10:00:00Z', completedAt: '2026-07-21T10:04:00Z', durationTrusted: true },
                    plan: { startedAt: '2026-07-21T10:04:00Z', completedAt: '2026-07-21T10:12:00Z', durationTrusted: true },
                    tasks: { startedAt: '2026-07-21T10:12:00Z', completedAt: '2026-07-21T10:15:00Z', durationTrusted: true },
                    implement: { startedAt: '2026-07-21T10:15:00Z', completedAt: '2026-07-21T10:24:00Z', durationTrusted: true },
                },
                timing: { measuredPhases: 4, expectedPhases: 4, complete: true, elapsedMs: 24 * 60_000 },
            }),
        }), host);

        expect(host.textContent).toContain('24m active');
        expect(host.textContent).toContain('Specify');
        expect(host.textContent).toContain('Implement');
        expect(host.textContent).not.toContain('Timing coverage');
    });

    it('shows partial coverage and only trusted individual phase durations', () => {
        const host = document.createElement('div');
        render(h(OverviewTiming, {
            state: base({
                stepHistory: {
                    specify: { startedAt: '2026-07-21T10:00:00Z', completedAt: '2026-07-21T10:04:00Z', durationTrusted: false },
                    plan: { startedAt: '2026-07-21T10:04:00Z', completedAt: '2026-07-21T10:12:00Z', durationTrusted: false },
                    tasks: { startedAt: '2026-07-21T10:12:00Z', completedAt: '2026-07-21T10:15:00Z', durationTrusted: false },
                    implement: { startedAt: '2026-07-21T10:15:00Z', completedAt: '2026-07-21T10:21:29Z', durationTrusted: true },
                },
                timing: { measuredPhases: 1, expectedPhases: 4, complete: false },
            }),
        }), host);

        expect(host.textContent).toContain('Timing coverage: 1 of 4 phases');
        expect(host.textContent).toContain('6m 29s');
        expect(host.textContent).not.toContain('active');
    });

    it('makes zero trusted timing explicit without inventing an active total', () => {
        const host = document.createElement('div');
        render(h(OverviewTiming, {
            state: base({
                stepHistory: {
                    specify: { startedAt: '2026-07-21T10:00:00Z', completedAt: '2026-07-21T10:04:00Z', durationTrusted: false },
                },
                timing: { measuredPhases: 0, expectedPhases: 4, complete: false },
            }),
        }), host);
        expect(host.textContent).toContain('Timing coverage: 0 of 4 phases');
        expect(host.textContent).not.toContain('active');
    });

    describe('a run that converged after implement', () => {
        const at = (minute: number) => `2026-09-30T10:${String(minute).padStart(2, '0')}:00.000Z`;
        const pair = (step: HistoryEntry['step'], start: number, end: number): HistoryEntry[] => [
            { step, substep: null, kind: 'start', by: 'extension', at: at(start) },
            { step, substep: null, kind: 'complete', by: 'extension', at: at(end) },
        ];
        const record: HistoryEntry[] = [
            ...pair('specify', 0, 4), ...pair('plan', 5, 9), ...pair('tasks', 10, 12),
            ...pair('implement', 13, 20), ...pair('converge', 30, 32),
        ];
        const renderRun = (history: HistoryEntry[], currentStep: 'implement' | 'converge') => {
            const stepHistory = deriveStepHistory(history, currentStep, 'implemented');
            const host = document.createElement('div');
            render(h(OverviewTiming, {
                state: base({ status: 'implemented', history, stepHistory, timing: deriveTimingSummary(stepHistory) }),
            }), host);
            return host;
        };
        const phaseNames = (host: HTMLElement) => Array.from(host.querySelectorAll('.dossier-timing__name'))
            .map(node => node.textContent);

        it('lists Converge after Implement with its duration and counts it in the active total', () => {
            const host = renderRun(record, 'converge');
            expect(phaseNames(host)).toEqual(['Specify', 'Plan', 'Tasks', 'Implement', 'Converge']);
            const converge = Array.from(host.querySelectorAll('.dossier-timing__phase'))
                .find(node => node.querySelector('.dossier-timing__name')?.textContent === 'Converge');
            expect(converge?.querySelector('.dossier-timing__duration')?.textContent).toBe('2m');
            expect(host.textContent).toContain('19m active');
            expect(host.textContent).not.toContain('Timing coverage');
        });

        it('renders a run without converge exactly as before', () => {
            const host = renderRun(record.slice(0, -2), 'implement');
            expect(phaseNames(host)).toEqual(['Specify', 'Plan', 'Tasks', 'Implement']);
            expect(host.textContent).toContain('17m active');
        });
    });

    describe('a spec that sat idle between specify and plan', () => {
        const qaRecord: HistoryEntry[] = [
            { step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-09-30T20:23:24.574Z' },
            { step: 'specify', substep: null, kind: 'complete', by: 'extension', at: '2026-09-30T20:23:47.208Z' },
            { step: 'plan', substep: null, kind: 'start', by: 'extension', at: '2026-09-30T21:17:20.000Z' },
            { step: 'plan', substep: null, kind: 'complete', by: 'ai', at: '2026-09-30T21:20:18.000Z' },
            { step: 'plan', substep: null, kind: 'complete', by: 'ai', at: '2026-09-30T21:20:19.000Z' },
            { step: 'plan', substep: null, kind: 'complete', by: 'ai', at: '2026-09-30T21:20:20.000Z' },
        ];
        const renderFor = (history: HistoryEntry[], currentStep: 'specify' | 'plan', status: 'specified' | 'planning' | 'planned') => {
            const stepHistory = deriveStepHistory(history, currentStep, status);
            const host = document.createElement('div');
            render(h(OverviewTiming, {
                state: base({ history, stepHistory, timing: deriveTimingSummary(stepHistory) }),
            }), host);
            const phase = (name: string) => Array.from(host.querySelectorAll('.dossier-timing__phase'))
                .find(node => node.querySelector('.dossier-timing__name')?.textContent === name);
            return (name: string) => phase(name)?.querySelector('.dossier-timing__duration')?.textContent ?? null;
        };

        it('shows Specify at 22s before plan is clicked', () => {
            expect(renderFor(qaRecord.slice(0, 2), 'specify', 'specified')('Specify')).toBe('22s');
        });

        it('keeps Specify at 22s the moment plan starts', () => {
            expect(renderFor(qaRecord.slice(0, 3), 'plan', 'planning')('Specify')).toBe('22s');
        });

        it('keeps Specify at 22s and shows Plan at 2m 58s after plan records three finishes', () => {
            const duration = renderFor(qaRecord, 'plan', 'planned');
            expect(duration('Specify')).toBe('22s');
            expect(duration('Plan')).toBe('2m 58s');
        });
    });

    it('omits itself when no lifecycle history exists', () => {
        const host = document.createElement('div');
        render(h(OverviewTiming, { state: base({}) }), host);
        expect(host.querySelector('.dossier-timing')).toBeNull();
    });

    describe('fast-path folded phases', () => {
        const foldedState = () => base({
            stepHistory: {
                specify: { startedAt: '2026-07-22T20:45:44.521Z', completedAt: '2026-07-22T20:51:14.340Z', durationTrusted: true },
                plan: { startedAt: '2026-07-22T20:51:14.423Z', completedAt: '2026-07-22T20:51:14.505Z', durationTrusted: true, folded: true },
                tasks: { startedAt: '2026-07-22T20:51:14.584Z', completedAt: '2026-07-22T20:51:14.665Z', durationTrusted: true, folded: true },
                implement: { startedAt: '2026-07-22T20:54:43.271Z', completedAt: '2026-07-22T20:58:00.000Z', durationTrusted: true },
            },
            timing: { measuredPhases: 4, expectedPhases: 4, complete: true, elapsedMs: 12 * 60_000 },
        });

        it('labels folded phases "folded into Specify" and never renders "<1s"', () => {
            const host = document.createElement('div');
            render(h(OverviewTiming, { state: foldedState() }), host);
            const foldedNotes = Array.from(host.querySelectorAll('.dossier-timing__duration--folded'));
            expect(foldedNotes.map(node => node.textContent)).toEqual(['folded into Specify', 'folded into Specify']);
            expect(host.textContent).not.toContain('<1s');
        });

        it('marks folded phases visually and keeps measured phases untouched', () => {
            const host = document.createElement('div');
            render(h(OverviewTiming, { state: foldedState() }), host);
            const phases = Array.from(host.querySelectorAll('.dossier-timing__phase'));
            expect(phases.map(node => node.classList.contains('is-folded'))).toEqual([false, true, true, false]);
            expect(host.textContent).toContain('5m 29s');
        });

        it('renders a plain "folded" note when no earlier non-folded phase exists', () => {
            const host = document.createElement('div');
            render(h(OverviewTiming, {
                state: base({
                    stepHistory: {
                        plan: { startedAt: '2026-07-22T20:51:14.423Z', completedAt: '2026-07-22T20:51:14.505Z', durationTrusted: true, folded: true },
                    },
                    timing: { measuredPhases: 1, expectedPhases: 4, complete: false },
                }),
            }), host);
            expect(host.querySelector('.dossier-timing__duration--folded')?.textContent).toBe('folded');
        });

        it('never renders the folded note for a measured phase', () => {
            const host = document.createElement('div');
            render(h(OverviewTiming, {
                state: base({
                    stepHistory: {
                        specify: { startedAt: '2026-07-21T10:00:00Z', completedAt: '2026-07-21T10:04:00Z', durationTrusted: true },
                    },
                    timing: { measuredPhases: 1, expectedPhases: 4, complete: false },
                }),
            }), host);
            expect(host.querySelector('.dossier-timing__duration--folded')).toBeNull();
            expect(host.textContent).toContain('4m');
        });
    });
});

describe('CoverageSection', () => {
    const renderRows = (coverage: unknown[]) => {
        const host = document.createElement('div');
        render(h(CoverageSection, { state: base({ coverage } as never) }), host);
        return host;
    };

    it('labels an assumed row and shows its assumption', () => {
        const host = renderRows([{ req: 'FR-4', tasks: ['T4'], tests: [], assumes: 'relies on the index' }]);
        expect(host.querySelector('.dossier-coverage__state.is-assumed')?.textContent).toContain('Assumed');
        expect(host.querySelector('.dossier-coverage__assumes')?.textContent).toBe('relies on the index');
    });

    it('keeps the test count and shows the assumption on a tested row', () => {
        const host = renderRows([{ req: 'FR-3', tasks: ['T3'], tests: ['a.test.ts'], assumes: 'relies on reload' }]);
        expect(host.querySelector('.dossier-coverage__state.is-traced')?.textContent).toContain('1 test');
        expect(host.querySelector('.dossier-coverage__assumes')?.textContent).toBe('relies on reload');
    });

    it('keeps a missing test marked missing even with an assumption', () => {
        const host = renderRows([{ req: 'FR-1', tasks: ['T1'], tests: ['a.test.ts'], missingTests: ['a.test.ts'], assumes: 'x' }]);
        expect(host.querySelector('.dossier-coverage__state.is-missing')).not.toBeNull();
        expect(host.querySelector('.is-assumed')).toBeNull();
    });

    it('counts assumed rows as traced', () => {
        const host = renderRows([
            { req: 'FR-1', tasks: [], tests: ['a'] },
            { req: 'FR-2', tasks: [], tests: [] },
            { req: 'FR-3', tasks: [], tests: ['b'], assumes: 'x' },
            { req: 'FR-4', tasks: [], tests: [], assumes: 'y' },
        ]);
        expect(host.textContent).toContain('3/4 traced');
    });

    it('stays a warning when every row is traced but some only by an assumption', () => {
        const host = renderRows([
            { req: 'FR-1', tasks: [], tests: ['a'] },
            { req: 'FR-2', tasks: [], tests: [], assumes: 'y' },
        ]);
        expect(host.textContent).toContain('2/2 traced');
        expect(host.querySelector('.dossier-count--warn')).not.toBeNull();
    });

    it('lists untraced rows first and assumed second', () => {
        const host = renderRows([
            { req: 'FR-1', tasks: [], tests: ['a'] },
            { req: 'FR-2', tasks: [], tests: [], assumes: 'y' },
            { req: 'FR-3', tasks: [], tests: [] },
        ]);
        const order = Array.from(host.querySelectorAll('.dossier-coverage__req b')).map(b => b.textContent);
        expect(order).toEqual(['FR-3', 'FR-2', 'FR-1']);
    });

    it('labels a weak row and says a planted bug passed', () => {
        const host = renderRows([{ req: 'FR-5', tasks: ['T5'], tests: ['a.test.ts'], weak: true }]);
        expect(host.querySelector('.dossier-coverage__state.is-weak')?.textContent).toContain('Weak');
        expect(host.querySelector('.dossier-coverage__assumes')?.textContent).toBe('tested, but a planted bug passed');
    });

    it('keeps the assumption line on a weak row', () => {
        const host = renderRows([{ req: 'FR-5', tasks: [], tests: ['a'], weak: true, assumes: 'relies on the clock' }]);
        const lines = Array.from(host.querySelectorAll('.dossier-coverage__assumes')).map(l => l.textContent);
        expect(lines).toEqual(['tested, but a planted bug passed', 'relies on the clock']);
    });

    it('lets a missing test beat weak', () => {
        const host = renderRows([{ req: 'FR-5', tasks: [], tests: ['a'], missingTests: ['a'], weak: true }]);
        expect(host.querySelector('.is-missing')).not.toBeNull();
        expect(host.querySelector('.is-weak')).toBeNull();
    });

    it('lists weak rows after untraced and before assumed', () => {
        const host = renderRows([
            { req: 'FR-1', tasks: [], tests: ['a'] },
            { req: 'FR-2', tasks: [], tests: [], assumes: 'y' },
            { req: 'FR-3', tasks: [], tests: ['c'], weak: true },
            { req: 'FR-4', tasks: [], tests: [] },
        ]);
        const order = Array.from(host.querySelectorAll('.dossier-coverage__req b')).map(b => b.textContent);
        expect(order).toEqual(['FR-4', 'FR-3', 'FR-2', 'FR-1']);
    });

    it('renders no assumption line for a row without one', () => {
        const host = renderRows([{ req: 'FR-1', tasks: ['T1'], tests: ['a'] }]);
        expect(host.querySelector('.dossier-coverage__assumes')).toBeNull();
    });

    it('renders assumption markup as text', () => {
        const host = renderRows([{ req: 'FR-1', tasks: [], tests: [], assumes: '<b>x</b>' }]);
        expect(host.querySelector('.dossier-coverage__assumes b')).toBeNull();
        expect(host.querySelector('.dossier-coverage__assumes')?.textContent).toBe('<b>x</b>');
    });

    it('renders when at least one requirement has a linked test', () => {
        const host = document.createElement('div');
        render(h(CoverageSection, {
            state: base({
                coverage: [
                    { req: 'FR-1', tasks: ['T001'], tests: ['auth.test.ts'] },
                    { req: 'FR-2', tasks: ['T002'], tests: [] },
                ],
            }),
        }), host);
        expect(host.querySelector('.dossier-section')).not.toBeNull();
        expect(host.textContent).toContain('1/2 traced');
    });

    it('states the zero instead of hiding it', () => {
        // It used to omit itself here, on the reasoning that a bare zero reads as
        // failure when the pipeline simply never mapped tests. But the header strip
        // kept showing "0 of N traced" regardless, so the page reported the zero and
        // hid the explanation at the same time. Zero traced is a finding, not an
        // unknown — arguably the most important one this table can carry.
        const host = document.createElement('div');
        render(h(CoverageSection, {
            state: base({
                coverage: [
                    { req: 'FR-1', tasks: ['T001'], tests: [] },
                    { req: 'FR-2', tasks: ['T002'], tests: [] },
                ],
            }),
        }), host);
        expect(host.querySelector('.dossier-section')).not.toBeNull();
        expect(host.textContent).toContain('0/2 traced');
        expect(host.textContent).toContain('No test linked');
    });

    it('separates a test that is named but not on disk from one that is missing entirely', () => {
        const host = document.createElement('div');
        render(h(CoverageSection, {
            state: base({
                coverage: [
                    { req: 'FR-1', tasks: ['T001'], tests: ['src/a.test.ts'], missingTests: ['src/a.test.ts'] },
                    { req: 'FR-2', tasks: ['T002'], tests: ['src/b.test.ts'] },
                    { req: 'FR-3', tasks: ['T003'], tests: [] },
                ],
            }),
        }), host);
        expect(host.querySelector('.is-missing')).not.toBeNull();
        expect(host.textContent).toContain('1 test not found');
        expect(host.textContent).toContain('No test linked');
    });

    it('says how many of several named tests were found', () => {
        const host = document.createElement('div');
        render(h(CoverageSection, {
            state: base({
                coverage: [
                    {
                        req: 'FR-1', tasks: ['T001'],
                        tests: ['src/a.test.ts', 'src/b.test.ts'],
                        missingTests: ['src/b.test.ts'],
                    },
                ],
            }),
        }), host);
        expect(host.textContent).toContain('1 of 2 found');
    });
});

describe('converge in the overview', () => {
    const at = (minute: number, second = 0) =>
        `2026-11-03T10:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`;
    const pair = (step: HistoryEntry['step'], start: number, end: number): HistoryEntry[] => [
        { step, substep: null, kind: 'start', by: 'extension', at: at(start) },
        { step, substep: null, kind: 'complete', by: 'extension', at: at(end) },
    ];
    const record: HistoryEntry[] = [
        ...pair('specify', 0, 1), ...pair('plan', 2, 6), ...pair('tasks', 7, 8),
        ...pair('implement', 9, 27), ...pair('converge', 28, 30),
    ];
    const TASKS = [
        '- [x] **T001** done',
        '- [ ] **T013** Saved filter names must be unique per user',
        '- [ ] **T014** Deleting a filter that is applied clears it',
        '- [ ] **T015** <b>Test</b> for SC-002',
    ].join('\n');
    const gapsPass = { startedAt: at(28), by: 'extension', finishedAt: at(30, 31), added: ['T013', 'T014', 'T015'] };
    const cleanPass = { startedAt: at(40), by: 'extension', finishedAt: at(41), added: [], completed: true };

    const renderWith = (convergePasses: unknown[], tasks = TASKS, status: ViewerState['status'] = 'implemented') => {
        const stepHistory = deriveStepHistory(record, 'converge', status as 'implemented');
        const converge = deriveConvergeResult({ convergePasses } as unknown as SpecContext, tasks);
        const host = document.createElement('div');
        render(h(IntentSection, {
            state: base({ status, history: record, stepHistory, timing: deriveTimingSummary(stepHistory), converge }),
        }), host);
        return host;
    };
    const pill = (host: HTMLElement) => host.querySelector('.dossier-timing__converge');

    it('draws an amber pill with its time and gaps, then a waiting implement round', () => {
        const host = renderWith([gapsPass]);
        expect(pill(host)?.classList.contains('is-gaps')).toBe(true);
        expect(pill(host)?.textContent).toBe('Converge2m 31s · 3 gaps');
        const waiting = host.querySelector('.dossier-timing__phase.is-waiting');
        expect(waiting?.textContent).toBe('Implementround 2, waiting');
    });

    it('lists the added tasks with their titles under CONVERGE FOUND 3 GAPS', () => {
        const host = renderWith([gapsPass]);
        const card = host.querySelector('.dossier-converge--gaps')!;
        expect(card.querySelector('.dossier-kicker')?.textContent).toBe('CONVERGE FOUND 3 GAPS');
        expect(card.textContent).toContain('added these to the end of tasks.md. The spec did not change.');
        expect(Array.from(card.querySelectorAll('li code')).map(n => n.textContent)).toEqual(['T013', 'T014', 'T015']);
        expect(card.textContent).toContain('Saved filter names must be unique per user');
    });

    it('says GAP in the singular for one added task', () => {
        const host = renderWith([{ ...gapsPass, added: ['T013'] }]);
        expect(host.querySelector('.dossier-converge .dossier-kicker')?.textContent).toBe('CONVERGE FOUND 1 GAP');
        expect(pill(host)?.textContent).toContain('1 gap');
    });

    it('shows a task title holding markup as text', () => {
        const host = renderWith([gapsPass]);
        expect(host.querySelector('.dossier-converge b')).toBeNull();
        expect(host.textContent).toContain('<b>Test</b> for SC-002');
    });

    it('draws a green pill and the clean card after a clean second pass', () => {
        const done = TASKS.replace(/- \[ \]/g, '- [x]');
        const host = renderWith([gapsPass, cleanPass], done, 'completed');
        expect(pill(host)?.classList.contains('is-clean')).toBe(true);
        expect(pill(host)?.textContent).toBe('Converge2 passes · clean');
        expect(host.querySelector('.dossier-timing__phase.is-waiting')).toBeNull();
        const card = host.querySelector('.dossier-converge--clean')!;
        expect(card.querySelector('.dossier-kicker')?.textContent).toBe('DONE, BY A CLEAN CONVERGE');
        expect(card.textContent).toContain('The second converge pass found nothing missing, so the spec is completed.');
        const rows = Array.from(card.querySelectorAll('dt')).map(dt => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`);
        expect(rows[0]).toBe('PASS 1: 3 gaps, added as T013 to T015');
        expect(rows[1]).toBe('PASS 2: nothing added');
        expect(rows[2]).toMatch(/^COMPLETED: Nov 3, 2026 at \d\d:\d\d, written by the extension$/);
    });

    it('reads one clean pass as clean with no pass count', () => {
        const host = renderWith([cleanPass], TASKS.replace(/- \[ \]/g, '- [x]'), 'completed');
        expect(pill(host)?.textContent).toBe('Convergeclean');
    });

    it('shows no DONE card for a clean pass on a spec that is not completed', () => {
        const host = renderWith([cleanPass]);
        expect(pill(host)?.textContent).toBe('Convergeclean');
        expect(host.querySelector('.dossier-converge--clean')).toBeNull();
    });

    it('stays amber on a completed spec whose last pass added tasks', () => {
        const host = renderWith([cleanPass, { ...gapsPass, startedAt: at(50), finishedAt: at(51), added: ['T015'] }], TASKS, 'completed');
        expect(pill(host)?.classList.contains('is-gaps')).toBe(true);
        expect(host.querySelector('.dossier-converge--clean')).toBeNull();
    });

    it('draws nothing about converge when it never ran', () => {
        const stepHistory = deriveStepHistory(record.slice(0, -2), 'implement', 'implemented');
        const host = document.createElement('div');
        render(h(IntentSection, { state: base({ status: 'implemented', stepHistory, timing: deriveTimingSummary(stepHistory) }) }), host);
        expect(pill(host)).toBeNull();
        expect(host.querySelector('.dossier-converge')).toBeNull();
        expect(host.querySelector('.is-waiting')).toBeNull();
    });
});

describe('source ticket and lineage', () => {
    const mount = (state: ViewerState) => {
        const host = document.createElement('div');
        render(h(IntentSection, { state }), host);
        return host;
    };
    const row = (host: HTMLElement, label: string) => {
        const el = Array.from(host.querySelectorAll('.dossier-meta-label')).find(l => l.textContent === label);
        return el?.nextElementSibling as HTMLElement | undefined;
    };

    it('shows a plain ticket id as text', () => {
        const value = row(mount(base({ source: 'TODO-42' })), 'Source');
        expect(value?.textContent).toBe('TODO-42');
        expect(value?.querySelector('a')).toBeNull();
    });

    it('links a ticket URL', () => {
        const url = 'https://github.com/acme/app/issues/42';
        const link = row(mount(base({ source: url })), 'Source')?.querySelector('a');
        expect(link?.getAttribute('href')).toBe(url);
    });

    it('never links a script URL, and keeps markup as text', () => {
        const value = row(mount(base({ source: 'javascript:alert(1)<b>x</b>' })), 'Source');
        expect(value?.querySelector('a')).toBeNull();
        expect(value?.querySelector('b')).toBeNull();
        expect(value?.textContent).toBe('javascript:alert(1)<b>x</b>');
    });

    it('opens the idea page when the source is an idea folder', () => {
        const postMessage = jest.fn();
        (globalThis as { vscode?: unknown }).vscode = { postMessage };
        try {
            const button = row(mount(base({ source: '.specify/assessments/saved-filters/', sourceIsIdea: true })), 'Source')?.querySelector('button');
            expect(button?.textContent).toBe('.specify/assessments/saved-filters/');
            button?.click();
            expect(postMessage).toHaveBeenCalledWith({ type: 'openIdea', folder: '.specify/assessments/saved-filters/' });
        } finally {
            delete (globalThis as { vscode?: unknown }).vscode;
        }
    });

    it('keeps a path-like ticket that is not an idea as text', () => {
        const value = row(mount(base({ source: 'ENG/42' })), 'Source');
        expect(value?.querySelector('button, a')).toBeNull();
        expect(value?.textContent).toBe('ENG/42');
    });

    it('shows the folder a spec extends and the one it replaces', () => {
        const host = mount(base({ extends: 'specs/041-saved-filters', supersedes: 'specs/030-old' }));
        expect(row(host, 'Extends')?.textContent).toBe('specs/041-saved-filters');
        expect(row(host, 'Replaces')?.textContent).toBe('specs/030-old');
    });
});

describe('request and decision provenance', () => {
    const mount = (state: ViewerState, C: typeof IntentSection = IntentSection) => {
        const host = document.createElement('div');
        render(h(C, { state }), host);
        return host;
    };

    it('shows the request as text with markup escaped', () => {
        const host = mount(base({ intent: 'Do it.', request: 'Make <b>bold</b> "quotes"\nline two' }));
        const el = host.querySelector('.dossier-intent__request');
        expect(host.textContent).toContain('Your request, word for word');
        expect(el?.textContent).toBe('Make <b>bold</b> "quotes"\nline two');
        expect(host.querySelector('b')).toBeNull();
    });

    it('omits the request block without a request', () => {
        const host = mount(base({ intent: 'Do it.' }));
        expect(host.querySelector('.dossier-intent__request')).toBeNull();
    });

    it('shows answered-by meta whenever the author is known', () => {
        const host = mount(base({
            decisions: [
                { decision: 'A', by: 'you', at: '2026-07-21T10:04:00Z' },
                { decision: 'B', by: 'you' },
                { decision: 'C', at: '2026-07-21T10:04:00Z' },
            ],
        }), DecisionsSection);
        const metas = host.querySelectorAll('.dossier-decision__meta');
        expect(metas).toHaveLength(2);
        expect(metas[0].textContent).toMatch(/^answered by you · /);
        expect(metas[1].textContent).toBe('answered by you');
    });

    it('lists earlier answers in order with reopened meta', () => {
        const host = mount(base({
            decisions: [{
                id: 'x',
                decision: 'Final',
                earlier: [
                    { decision: 'First', by: 'agent' },
                    { decision: 'Second', by: 'you', at: '2026-07-21T10:04:00Z' },
                ],
            }],
        }), DecisionsSection);
        const items = Array.from(host.querySelectorAll('.dossier-decision__earlier li'));
        expect(items.map(li => li.querySelector('s')?.textContent)).toEqual(['First', 'Second']);
        expect(items[0].textContent).toContain('earlier answer · agent · reopened');
        expect(items[1].textContent).toMatch(/earlier answer · you · .+ · reopened/);
        expect(host.textContent).not.toContain('undefined');
    });

    it('renders a legacy decision without meta', () => {
        const host = mount(base({ decisions: [{ decision: 'Old', why: 'Because' }] }), DecisionsSection);
        expect(host.querySelector('.dossier-decision__meta')).toBeNull();
        expect(host.querySelector('.dossier-decision__earlier')).toBeNull();
        expect(host.querySelector('.dossier-decision__head')).toBeNull();
        expect(host.querySelector('h3')?.textContent).toBe('Old');
    });
});

describe('VerifiedSection', () => {
    const mount = (verified: NonNullable<ViewerState['verified']>, extra: Partial<ViewerState> = {}) => {
        const host = document.createElement('div');
        render(h(VerifiedSection, { state: base({ verified, ...extra }) }), host);
        return host;
    };

    it('shows the computed review depth', () => {
        const host = mount([{ what: 'By hand', result: 'ok' }], { risk: { tier: 'normal', computed: 'normal', reasons: ['4 files'] } });
        const pill = host.querySelector('.dossier-depth');
        expect(pill?.textContent).toBe('Review depth: normal');
        expect(pill?.getAttribute('title')).toBe('4 files');
        expect(pill?.classList.contains('dossier-depth--high')).toBe(false);
    });

    it('says who raised the depth and why, in the amber style', () => {
        const host = mount([{ what: 'By hand', result: 'ok' }], {
            risk: { tier: 'high', computed: 'normal', reasons: [], raised: { tier: 'high', reason: 'touches the orders query', by: 'ai', at: '2026-11-07T10:00:00Z' } },
        });
        const pill = host.querySelector('.dossier-depth');
        expect(pill?.textContent).toBe('Review depth: high · raised by the agent: "touches the orders query"');
        expect(pill?.classList.contains('dossier-depth--high')).toBe(true);
    });

    it('stays hidden with a risk but nothing checked, so the depth does not read as verification', () => {
        const host = mount([], { risk: { tier: 'low', computed: 'low', reasons: [] } });
        expect(host.querySelector('.dossier-depth')).toBeNull();
    });

    it('shows no pill without a risk', () => {
        const host = mount([{ what: 'By hand', result: 'ok' }]);
        expect(host.querySelector('.dossier-depth')).toBeNull();
    });

    it('says which commit a derived check ran at', () => {
        const host = mount([{ what: 'Jest', source: 'derived', exitCode: 0, commit: '4f2c9a1', changedSince: 0 }]);
        expect(host.querySelector('.dossier-evidence__at')?.textContent).toBe('at 4f2c9a1');
        expect(host.querySelector('.dossier-evidence__stale')).toBeNull();
    });

    it('marks a check out of date and counts the files', () => {
        const host = mount([{ what: 'Jest', source: 'derived', exitCode: 0, commit: '1b07e3c', changedSince: 2 }]);
        expect(host.querySelector('.dossier-evidence__stale')?.textContent).toBe('OUT OF DATE');
        expect(host.querySelector('.dossier-evidence__row--stale')).not.toBeNull();
        expect(host.querySelector('.dossier-evidence__at')?.textContent).toBe('at 1b07e3c, 2 files changed since');
    });

    it('uses the singular for one file', () => {
        const host = mount([{ what: 'Jest', source: 'derived', exitCode: 0, commit: '1b07e3c', changedSince: 1 }]);
        expect(host.querySelector('.dossier-evidence__at')?.textContent).toContain('1 file changed since');
    });

    it('turns the section tone to warn when a check is stale', () => {
        const stale = mount([{ what: 'Jest', source: 'derived', exitCode: 0, commit: '1b07e3c', changedSince: 2 }]);
        const fresh = mount([{ what: 'Jest', source: 'derived', exitCode: 0, commit: '1b07e3c', changedSince: 0 }]);
        expect(stale.innerHTML).not.toBe(fresh.innerHTML);
        expect(stale.querySelector('[class*="warn"]')).not.toBeNull();
        expect(fresh.querySelector('.dossier-section [class*="--warn"]:not(.dossier-check)')).toBeNull();
    });

    it('shows no commit line for a derived check recorded before commits were kept', () => {
        const host = mount([{ what: 'Jest', source: 'derived', exitCode: 0 }]);
        expect(host.querySelector('.dossier-evidence__at')).toBeNull();
    });

    it('leaves a reported row as it was', () => {
        const host = mount([{ what: 'By hand', result: 'looked fine' }]);
        expect(host.querySelector('.dossier-evidence__at')).toBeNull();
        expect(host.querySelector('.dossier-evidence__stale')).toBeNull();
        expect(host.querySelector('.dossier-evidence__row--claimed')).not.toBeNull();
    });
});
