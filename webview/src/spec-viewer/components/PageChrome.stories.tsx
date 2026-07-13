import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import { PageChrome } from './PageChrome';
import { navState, viewerState, viewerMode } from '../signals';
import type { ViewerState } from '../types';
import { mockNavState } from './__stories__/mockData';

/**
 * The real production `PageChrome` — the same component `App.tsx` mounts, not a
 * story-local composition, so what you judge here is what ships.
 *
 * The band carries two things that answer different questions: what this spec IS
 * (name, lifecycle badge, branch, date) and how its run WENT (phase, tasks,
 * traceability…). One boundary, not two headers. The status appears exactly once.
 *
 * The run facts yield as the pane narrows — first the time and the checks, then
 * everything but the way back to the Overview. Identity never yields.
 */

const meta: Meta<typeof PageChrome> = {
    title: 'Viewer/Page Chrome',
    component: PageChrome,
    parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof PageChrome>;

/** Hosts the chrome in a real `.viewer-container` — the query container the
 *  responsive rules key off — at a pinned width, so the collapse can be seen. */
function Pane({ width, children }: { width?: number; children: ComponentChildren }) {
    return (
        <div
            class="viewer-container"
            style={`height: auto; ${width ? `width: ${width}px; border-right: 1px solid var(--border);` : ''}`}
        >
            {children}
            <div style="padding: 20px var(--content-padding); color: var(--text-muted); font-size: 12px;">
                (reading column starts here)
            </div>
        </div>
    );
}

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

/** The 394 run: 30/30 tasks, 3/17 traced, 5 checks, 1 concern, 3h 11m. */
function completedRun() {
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
            Array.from({ length: 30 }, (_, i) => [
                `T${String(i + 1).padStart(3, '0')}`,
                { status: 'DONE', did: 'x', files: [] },
            ]),
        ),
        coverage: Array.from({ length: 17 }, (_, i) => ({
            req: `FR-${String(i + 1).padStart(3, '0')}`,
            tasks: ['T001'],
            tests: i < 3 ? ['a.test.ts'] : [],
        })),
        verified: Array.from({ length: 5 }, (_, i) => ({ what: `check ${i + 1}` })),
        concerns: [{ note: 'screenshots deferred' }],
        stepHistory: {
            implement: {
                startedAt: '2026-07-12T10:00:00Z',
                completedAt: '2026-07-12T13:11:00Z',
                durationTrusted: true,
            },
        },
    });
}

// Wide: every fact fits beside the identity half.
export const Completed: Story = {
    render: () => {
        completedRun();
        return <Pane><PageChrome /></Pane>;
    },
};

// Medium (~1000px): the checks and the active time drop out first — the facts
// that matter least once you're mid-read.
export const MediumPane: Story = {
    name: 'Medium pane (facts start yielding)',
    render: () => {
        completedRun();
        return <Pane width={1000}><PageChrome /></Pane>;
    },
};

// Split pane (~700px): the facts yield entirely; the way back to the Overview
// survives, and the title, badge and branch are all still readable.
export const SplitPane: Story = {
    name: 'Split pane (collapses to Run details)',
    render: () => {
        completedRun();
        return <Pane width={700}><PageChrome /></Pane>;
    },
};

// A long branch name truncates rather than shoving the date out or wrapping.
export const LongBranchName: Story = {
    render: () => {
        completedRun();
        navState.value = mockNavState({
            badgeText: 'IMPLEMENTING',
            createdDate: 'Jul 12, 2026',
            specContextName: 'Adopt Codex Design',
            branch: 'feature/394-adopt-codex-design-context-first-shell-and-review-fixes',
        });
        return <Pane width={860}><PageChrome /></Pane>;
    },
};

// Mid-run: the badge tracks the in-flight lifecycle, the facts track progress.
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
        return <Pane><PageChrome /></Pane>;
    },
};

// A brand-new spec: no run, so RunStrip renders nothing and the band shrinks to
// the identity half — the chrome only claims the height it has a use for.
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
        return <Pane><PageChrome /></Pane>;
    },
};
