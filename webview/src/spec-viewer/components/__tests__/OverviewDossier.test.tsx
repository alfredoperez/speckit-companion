/** @jest-environment jsdom */
import { h, render } from 'preact';
import { IntentSection, OverviewTiming } from '../OverviewDossier';
import type { ViewerState } from '../../types';

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
            .toEqual(['viewer-ui', 'spec-viewer']);
        expect(host.querySelector('.dossier-intent__statement')?.nextElementSibling)
            .toBe(host.querySelector('.dossier-timing'));
    });

    it('renders living specs even when other intent fields are absent', () => {
        const host = document.createElement('div');
        render(h(IntentSection, {
            state: base({ livingSpecs: { loaded: ['viewer-ui'], synced: [] } }),
        }), host);
        expect(host.querySelector('.dossier-intent')).not.toBeNull();
        expect(host.textContent).toContain('viewer-ui');
    });

    it('omits the whole region when no intent context exists', () => {
        const host = document.createElement('div');
        render(h(IntentSection, { state: base({}) }), host);
        expect(host.querySelector('.dossier-intent')).toBeNull();
    });
});

describe('OverviewTiming', () => {
    it('shows a trustworthy whole-run elapsed total and lifecycle phases', () => {
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

        expect(host.textContent).toContain('24m elapsed');
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
        expect(host.textContent).not.toContain('elapsed');
    });

    it('makes zero trusted timing explicit without inventing an elapsed total', () => {
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
        expect(host.textContent).not.toContain('elapsed');
    });

    it('omits itself when no lifecycle history exists', () => {
        const host = document.createElement('div');
        render(h(OverviewTiming, { state: base({}) }), host);
        expect(host.querySelector('.dossier-timing')).toBeNull();
    });
});
