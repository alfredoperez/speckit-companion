/**
 * Storybook coverage for the spec-viewer footer.
 *
 * The footer is a pure function of one `viewerState` snapshot (single-source
 * model). Every story drives `viewerState.footer`. `navState` only supplies the
 * workflow-derived `enhancementButtons`. There is a single render shape now:
 * `CatalogFooter`. The in-flight "Generating…" pill was removed (#277 Child 4) —
 * the spinning step tab carries the in-flight signal — and while the current
 * step is in flight the footer suppresses the forward-motion button.
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

// In-flight factory: an in-flight status (specifying / planning / tasking /
// implementing) makes the footer drop the forward-motion button — the spinning
// step tab carries the in-flight signal instead. Only Regenerate (+ closure /
// refine actions) remain.
const inFlightViewerState = (
    status: string,
    activeStep: string,
    footer: FooterEntry[],
): ViewerState => {
    const startedAt = new Date().toISOString();
    return baseViewerState(status, activeStep, footer, {
        runningStepStartedAt: startedAt,
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

// ── In-flight state ────────────────────────────────────────────────────────
// While the current step is in flight the footer suppresses its forward-motion
// button (Approve / next-step start) — only Regenerate remains. The spinning
// step tab (StepTab stories) carries the "actively working" signal now; the old
// "Generating…" footer pill was removed (#277 Child 4).

export const InFlightPlanning: Story = {
    name: 'In-flight — Planning',
    render: () => {
        navState.value = mockNavState({ specStatus: 'planning' });
        viewerState.value = inFlightViewerState('planning', 'plan', pauseFooter('Tasks'));
        return <FooterActions initialSpecStatus="planning" />;
    },
};

export const InFlightTasking: Story = {
    name: 'In-flight — Tasking',
    render: () => {
        navState.value = mockNavState({ specStatus: 'tasking' });
        viewerState.value = inFlightViewerState('tasking', 'tasks', pauseFooter('Implement'));
        return <FooterActions initialSpecStatus="tasking" />;
    },
};

export const InFlightImplementing: Story = {
    name: 'In-flight — Implementing',
    render: () => {
        navState.value = mockNavState({ specStatus: 'implementing' });
        viewerState.value = inFlightViewerState('implementing', 'implement', pauseFooter('Mark Completed'));
        return <FooterActions initialSpecStatus="implementing" />;
    },
};
