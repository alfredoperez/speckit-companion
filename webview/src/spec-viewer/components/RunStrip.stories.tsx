import type { Meta, StoryObj } from '@storybook/preact';
import { RunStrip } from './RunStrip';
import { navState, viewerState } from '../signals';
import type { ViewerState } from '../types';
import { mockNavState } from './__stories__/mockData';

const meta: Meta<typeof RunStrip> = {
    title: 'Viewer/RunStrip',
    component: RunStrip,
    decorators: [(Story) => <div class="main-column" style="max-width: 900px;"><Story /></div>],
};
export default meta;

type Story = StoryObj<typeof RunStrip>;

const baseState = (overrides: Partial<ViewerState>): ViewerState => ({
    status: 'implementing',
    activeStep: 'implement',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer: [],
    history: [],
    stepHistory: {},
    ...overrides,
});

// Mid-run: status, phase, task progress, traceability gap, one concern.
export const MidRun: Story = {
    render: () => {
        navState.value = mockNavState({ taskCompletionPercent: 60 });
        viewerState.value = baseState({
            taskSummaries: {
                T001: { status: 'DONE', did: 'a', files: [] },
                T002: { status: 'DONE', did: 'b', files: [] },
                T003: { status: 'IN_PROGRESS', did: 'c', files: [] },
            },
            coverage: [
                { req: 'FR-001', tasks: ['T001'], tests: ['a.test.ts'] },
                { req: 'FR-002', tasks: ['T002'], tests: [] },
            ],
            verified: [{ what: 'jest' }],
            concerns: [{ note: 'flaky watcher' }],
        });
        return <RunStrip />;
    },
};

// Completed run with a PR link and trusted active time; viewing a document,
// so the "Run details →" action offers the jump back to the Overview.
export const CompletedWithPr: Story = {
    render: () => {
        navState.value = mockNavState({});
        viewerState.value = baseState({
            status: 'completed',
            taskSummaries: { T001: { status: 'DONE', did: 'a', files: [] } },
            coverage: [{ req: 'FR-001', tasks: ['T001'], tests: ['a.test.ts'] }],
            stepHistory: {
                implement: { startedAt: '2026-07-02T10:00:00Z', completedAt: '2026-07-02T13:11:00Z', durationTrusted: true },
            },
            prUrl: 'https://github.com/alfredoperez/speckit-companion/pull/431',
            prNumber: 431,
        });
        return <RunStrip />;
    },
};

// No facts yet (a freshly specified spec): the strip renders nothing at all
// rather than an empty bar. Neither the status nor the phase is repeated here
// (the badge owns both), so with no run facts there is simply nothing to say.
export const NoFactsYet: Story = {
    render: () => {
        navState.value = mockNavState({ taskCompletionPercent: 0 });
        viewerState.value = baseState({ status: 'specified', activeStep: '' });
        return (
            <div>
                <p style="color: var(--text-muted); font-size: 12px; padding: 8px 0;">
                    (nothing renders below — the strip is absent, not empty)
                </p>
                <RunStrip />
            </div>
        );
    },
};
