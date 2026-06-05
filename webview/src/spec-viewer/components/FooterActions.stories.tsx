/**
 * Storybook coverage for the spec-viewer footer.
 *
 * The footer is a pure function of one `viewerState` snapshot (single-source
 * model). Every story drives `viewerState.footer` plus, for in-flight states,
 * the run-step/generating fields on `viewerState`. `navState` only supplies the
 * workflow-derived `enhancementButtons`. There are exactly two render shapes:
 * `CatalogFooter` and `GeneratingFooter`.
 *
 * Story names use the visible status label only; no parens, no extra
 * annotations.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { navState, viewerState } from '../signals';
import type { ViewerState } from '../types';
import { FooterActions } from './FooterActions';
import { mockNavState } from './__stories__/mockData';

const meta: Meta<typeof FooterActions> = {
    title: 'Viewer/FooterActions',
    component: FooterActions,
};
export default meta;

type Story = StoryObj<typeof FooterActions>;

interface FooterEntry {
    id: string;
    label: string;
    scope: 'spec' | 'step';
    tooltip: string;
}

// Single-source viewerState factory. The footer reads everything here; defaults
// represent a paused (not-generating) step.
const baseViewerState = (
    status: string,
    activeStep: string,
    footer: FooterEntry[],
    extra: Partial<ViewerState> = {},
): ViewerState =>
    ({
        status,
        activeStep,
        steps: {},
        pulse: null,
        highlights: [],
        activeSubstep: null,
        footer,
        history: [],
        stepHistory: {},
        runningStepArtifactReady: false,
        runningStepStartedAt: null,
        runningStepLabel: null,
        ...extra,
    }) as ViewerState;

// In-flight factory: stamps the run-step fields so isGenerating fires. The
// right side shows a non-clickable "Generating <label>…" chip; the left shows
// the "Mark step complete" override.
const generatingViewerState = (
    status: string,
    activeStep: string,
    label: string,
    footer: FooterEntry[],
    opts: { artifactReady?: boolean; startedAt?: string } = {},
): ViewerState => {
    const startedAt = opts.startedAt ?? new Date().toISOString();
    return baseViewerState(status, activeStep, footer, {
        runningStepArtifactReady: opts.artifactReady ?? false,
        runningStepStartedAt: startedAt,
        runningStepLabel: label,
        stepHistory: { [activeStep]: { startedAt, completedAt: null } },
    });
};

const pauseFooter = (forwardLabel: string): FooterEntry[] => [
    { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 'Re-run only the current step' },
    { id: 'approve', label: forwardLabel, scope: 'step', tooltip: 'Approve this step and continue' },
];

const finalApprovalFooter: FooterEntry[] = [
    { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
    { id: 'complete', label: 'Mark Completed', scope: 'spec', tooltip: 'Mark this spec as completed' },
    { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 'Re-run only the current step' },
];

const REFINE_ACTION: FooterEntry = {
    id: 'refine',
    label: '✨ Refine (2)',
    scope: 'spec',
    tooltip: 'Submit 2 line comments for refinement',
};

const withRefine = (footer: FooterEntry[]): FooterEntry[] => [REFINE_ACTION, ...footer];

// ── Pause-stage catalog stories (one per canonical pause status) ────────────

export const Specified: Story = {
    name: 'Specified',
    render: () => {
        navState.value = mockNavState({ specStatus: 'specified' });
        viewerState.value = baseViewerState('specified', 'specify', pauseFooter('Plan'));
        return <FooterActions initialSpecStatus="specified" />;
    },
};

export const SpecifiedWithRefine: Story = {
    name: 'Specified With Refine',
    render: () => {
        navState.value = mockNavState({ specStatus: 'specified' });
        viewerState.value = baseViewerState('specified', 'specify', withRefine(pauseFooter('Plan')));
        return <FooterActions initialSpecStatus="specified" />;
    },
};

export const Planned: Story = {
    name: 'Planned',
    render: () => {
        navState.value = mockNavState({ specStatus: 'planned' });
        viewerState.value = baseViewerState('planned', 'plan', pauseFooter('Tasks'));
        return <FooterActions initialSpecStatus="planned" />;
    },
};

export const PlannedWithRefine: Story = {
    name: 'Planned With Refine',
    render: () => {
        navState.value = mockNavState({ specStatus: 'planned' });
        viewerState.value = baseViewerState('planned', 'plan', withRefine(pauseFooter('Tasks')));
        return <FooterActions initialSpecStatus="planned" />;
    },
};

export const TasksCreated: Story = {
    name: 'Tasks Created',
    render: () => {
        navState.value = mockNavState({ specStatus: 'ready-to-implement' });
        viewerState.value = baseViewerState('ready-to-implement', 'tasks', pauseFooter('Implement'));
        return <FooterActions initialSpecStatus="ready-to-implement" />;
    },
};

export const TasksCreatedWithRefine: Story = {
    name: 'Tasks Created With Refine',
    render: () => {
        navState.value = mockNavState({ specStatus: 'ready-to-implement' });
        viewerState.value = baseViewerState('ready-to-implement', 'tasks', withRefine(pauseFooter('Implement')));
        return <FooterActions initialSpecStatus="ready-to-implement" />;
    },
};

export const Implemented: Story = {
    name: 'Implemented',
    render: () => {
        navState.value = mockNavState({ specStatus: 'implemented' });
        viewerState.value = baseViewerState('implemented', 'implement', finalApprovalFooter);
        return <FooterActions initialSpecStatus="implemented" />;
    },
};

export const ImplementedOptionalCommandsHidden: Story = {
    name: 'Implemented — optional commands suppressed',
    render: () => {
        // Optional refinement commands are defined, but the spec is at the
        // closure gate (footer has `complete`), so Clarify/Checklist/Analyze
        // must NOT render — there's nothing left to refine.
        navState.value = mockNavState({
            specStatus: 'implemented',
            enhancementButtons: [
                { label: 'Checklist', command: '/speckit.checklist', icon: '⚡', tooltip: 'Generate a checklist' },
                { label: 'Analyze', command: '/speckit.analyze', icon: '⚡', tooltip: 'Analyze the spec' },
            ],
        });
        viewerState.value = baseViewerState('implemented', 'implement', finalApprovalFooter);
        return <FooterActions initialSpecStatus="implemented" />;
    },
};

export const Completed: Story = {
    name: 'Completed',
    render: () => {
        navState.value = mockNavState({ specStatus: 'completed' });
        viewerState.value = baseViewerState('completed', 'implement', [
            { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
            { id: 'reactivate', label: 'Reactivate', scope: 'spec', tooltip: 'Reactivate archived spec' },
        ]);
        return <FooterActions initialSpecStatus="completed" />;
    },
};

export const Archived: Story = {
    name: 'Archived',
    render: () => {
        navState.value = mockNavState({ specStatus: 'archived' });
        viewerState.value = baseViewerState('archived', 'implement', [
            { id: 'reactivate', label: 'Reactivate', scope: 'spec', tooltip: 'Reactivate archived spec' },
        ]);
        return <FooterActions initialSpecStatus="archived" />;
    },
};

// ── Generating state ───────────────────────────────────────────────────────
// The right side shows a non-clickable "Generating <label>…" status chip while
// the running step's artifact is not yet on disk; the left shows the secondary
// "Mark step complete" override. Once the artifact lands (or the recovery
// timeout elapses) the normal footer returns.

export const GeneratingPlan: Story = {
    name: 'Generating — Plan',
    render: () => {
        navState.value = mockNavState({ specStatus: 'planning' });
        viewerState.value = generatingViewerState('planning', 'plan', 'Plan', pauseFooter('Tasks'));
        return <FooterActions initialSpecStatus="planning" />;
    },
};

export const GeneratingTasks: Story = {
    name: 'Generating — Tasks',
    render: () => {
        navState.value = mockNavState({ specStatus: 'tasking' });
        viewerState.value = generatingViewerState('tasking', 'tasks', 'Tasks', pauseFooter('Implement'));
        return <FooterActions initialSpecStatus="tasking" />;
    },
};

export const GeneratingArtifactReady: Story = {
    name: 'Generating — artifact ready (re-enabled)',
    render: () => {
        // Running, but the artifact is now detected → normal forward footer.
        navState.value = mockNavState({ specStatus: 'tasking' });
        viewerState.value = generatingViewerState('tasking', 'tasks', 'Tasks', pauseFooter('Implement'), {
            artifactReady: true,
        });
        return <FooterActions initialSpecStatus="tasking" />;
    },
};

export const GeneratingTimedOut: Story = {
    name: 'Generating — recovery timeout',
    render: () => {
        // Running, artifact never appeared, but the 10-min window elapsed →
        // footer falls back to the enabled buttons so it never strands.
        navState.value = mockNavState({ specStatus: 'tasking' });
        viewerState.value = generatingViewerState('tasking', 'tasks', 'Tasks', pauseFooter('Implement'), {
            startedAt: '2026-05-08T00:00:00Z',
        });
        return <FooterActions initialSpecStatus="tasking" />;
    },
};
