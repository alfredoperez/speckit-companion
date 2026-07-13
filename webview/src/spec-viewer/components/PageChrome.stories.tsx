import type { Meta, StoryObj } from '@storybook/preact';
import { SpecHeader } from './SpecHeader';
import { RunStrip } from './RunStrip';
import { navState, viewerState, viewerMode } from '../signals';
import type { ViewerState } from '../types';
import { mockNavState } from './__stories__/mockData';

/**
 * The two stacked bands above the reading column, together — the only place the
 * "is this a double header?" question can actually be judged.
 *
 * They answer different questions on purpose: the header says WHAT THIS SPEC IS
 * (name, lifecycle badge, branch, date), the strip says HOW THE RUN WENT
 * (phase, tasks, traceability, checks, active time). The status is deliberately
 * NOT repeated in the strip — the badge owns it.
 */
function PageChrome() {
    return (
        <div class="viewer-container" style="height: auto;">
            <SpecHeader />
            <RunStrip />
            <div style="padding: 24px; color: var(--text-muted); font-size: 13px;">
                (reading column starts here)
            </div>
        </div>
    );
}

const meta: Meta<typeof PageChrome> = {
    title: 'Viewer/Page Chrome',
    component: PageChrome,
    parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof PageChrome>;

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

// A finished run: badge says COMPLETED once, the strip carries the run facts.
export const Completed: Story = {
    render: () => {
        viewerMode.value = 'document';
        navState.value = mockNavState({
            badgeText: 'COMPLETED',
            createdDate: 'Jul 12, 2026',
            specContextName: 'Adopt Codex Design',
            branch: '394-adopt-codex-design',
        });
        viewerState.value = baseState({
            status: 'completed',
            taskSummaries: Object.fromEntries(
                Array.from({ length: 30 }, (_, i) => [`T${String(i + 1).padStart(3, '0')}`, { status: 'DONE', did: 'x', files: [] }]),
            ),
            coverage: Array.from({ length: 17 }, (_, i) => ({
                req: `FR-${String(i + 1).padStart(3, '0')}`,
                tasks: ['T001'],
                tests: i < 3 ? ['a.test.ts'] : [],
            })),
            verified: Array.from({ length: 5 }, (_, i) => ({ what: `check ${i + 1}` })),
            concerns: [{ note: 'screenshots deferred' }],
            stepHistory: {
                implement: { startedAt: '2026-07-12T10:00:00Z', completedAt: '2026-07-12T13:11:00Z', durationTrusted: true },
            },
        });
        return <PageChrome />;
    },
};

// Mid-run: the badge tracks the in-flight lifecycle, the strip tracks progress.
export const MidRun: Story = {
    render: () => {
        viewerMode.value = 'document';
        navState.value = mockNavState({
            badgeText: 'IMPLEMENTING',
            createdDate: 'Jul 12, 2026',
            specContextName: 'Composable Command Nodes',
            branch: '172-composable-command-nodes',
            taskCompletionPercent: 66,
        });
        viewerState.value = baseState({
            taskSummaries: {
                T001: { status: 'DONE', did: 'a', files: [] },
                T002: { status: 'DONE', did: 'b', files: [] },
                T003: { status: 'IN_PROGRESS', did: 'c', files: [] },
            },
        });
        return <PageChrome />;
    },
};

// A brand-new spec: no run yet, so the strip is absent entirely and the header
// stands alone — the chrome shrinks to what it actually has to say.
export const FreshSpec: Story = {
    render: () => {
        viewerMode.value = 'document';
        navState.value = mockNavState({
            badgeText: 'SPECIFIED',
            createdDate: 'Jul 13, 2026',
            specContextName: 'New Feature',
            branch: '400-new-feature',
            taskCompletionPercent: 0,
        });
        viewerState.value = baseState({ status: 'specified', activeStep: '' });
        return <PageChrome />;
    },
};
