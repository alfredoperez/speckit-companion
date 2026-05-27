/**
 * Storybook coverage for the spec-viewer footer.
 *
 * Two sections:
 *   - Legacy stories — drive the old navState.footerState code path
 *     (status='active' / 'tasks-done'). Kept for backward compat.
 *   - Per-status stories — drive the catalog code path
 *     (viewerState.footer[]) with one entry per canonical status.
 *
 * Story names use the visible status label only; no parens, no
 * extra annotations.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { navState, viewerState } from '../signals';
import { FooterActions } from './FooterActions';
import { mockDoc, mockNavState } from './__stories__/mockData';

const meta: Meta<typeof FooterActions> = {
    title: 'Viewer/FooterActions',
    component: FooterActions,
};
export default meta;

type Story = StoryObj<typeof FooterActions>;

// ── Legacy code path (driven by navState.footerState) ──────

export const Active: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: { showApproveButton: true, approveText: 'Plan', enhancementButtons: [], specStatus: 'active' },
        });
        return <FooterActions initialSpecStatus="active" />;
    },
};

export const ActiveWithEnhancements: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: {
                showApproveButton: true,
                approveText: 'Plan',
                enhancementButtons: [{ label: 'Auto Mode', command: 'autoMode', icon: '⚡', tooltip: 'Run automatic pipeline' }],
                specStatus: 'active',
            },
        });
        return <FooterActions initialSpecStatus="active" />;
    },
};

export const TasksDone: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: { showApproveButton: false, approveText: '', enhancementButtons: [], specStatus: 'tasks-done' },
        });
        return <FooterActions initialSpecStatus="tasks-done" />;
    },
};

// ── Catalog code path (driven by viewerState.footer) ───────
// One entry per canonical spec status, in lifecycle order.

interface FooterEntry {
    id: string;
    label: string;
    scope: 'spec' | 'step';
    tooltip: string;
}

const baseViewerState = (status: string, activeStep: string, footer: FooterEntry[]) => ({
    status,
    activeStep,
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer,
});

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

// Helper to mark a story as in-flight on a given step. The renderer shows a
// non-clickable "Generating <step>…" status chip on the right and the
// secondary "Mark step complete" override on the left while the step's
// artifact is not yet ready. `runningStepStartedAt` is stamped "now" so the
// recovery timeout has not elapsed and `runningStepArtifactReady` is false,
// so isGenerating fires. `runningStepLabel` mirrors what the provider ships
// via getDocTypeLabel.
const STEP_LABELS: Record<string, string> = { spec: 'Spec', plan: 'Plan', tasks: 'Tasks' };
const inFlightNavState = (specStatus: string, step: string) =>
    mockNavState({
        specStatus,
        activeStep: step,
        runningStepArtifactReady: false,
        runningStepStartedAt: new Date().toISOString(),
        runningStepLabel: STEP_LABELS[step] ?? step,
        stepHistory: { [step]: { startedAt: new Date().toISOString(), completedAt: null } },
    });

export const Specifying: Story = {
    name: 'Specifying',
    render: () => {
        // In-flight: renderer hides all buttons because isRunning=true.
        navState.value = inFlightNavState('specifying', 'specify');
        viewerState.value = baseViewerState('specifying', 'specify', pauseFooter('Plan'));
        return <FooterActions initialSpecStatus="specifying" />;
    },
};

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

export const Planning: Story = {
    name: 'Planning',
    render: () => {
        navState.value = inFlightNavState('planning', 'plan');
        viewerState.value = baseViewerState('planning', 'plan', pauseFooter('Tasks'));
        return <FooterActions initialSpecStatus="planning" />;
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

export const CreatingTasks: Story = {
    name: 'Creating Tasks',
    render: () => {
        navState.value = inFlightNavState('tasking', 'tasks');
        viewerState.value = baseViewerState('tasking', 'tasks', pauseFooter('Implement'));
        return <FooterActions initialSpecStatus="tasking" />;
    },
};

export const TasksCreated: Story = {
    name: 'Tasks Created',
    render: () => {
        navState.value = mockNavState({ specStatus: 'ready-to-implement' });
        viewerState.value = baseViewerState(
            'ready-to-implement',
            'tasks',
            pauseFooter('Implement')
        );
        return <FooterActions initialSpecStatus="ready-to-implement" />;
    },
};

export const TasksCreatedWithRefine: Story = {
    name: 'Tasks Created With Refine',
    render: () => {
        navState.value = mockNavState({ specStatus: 'ready-to-implement' });
        viewerState.value = baseViewerState(
            'ready-to-implement',
            'tasks',
            withRefine(pauseFooter('Implement'))
        );
        return <FooterActions initialSpecStatus="ready-to-implement" />;
    },
};

export const Implementing: Story = {
    name: 'Implementing',
    render: () => {
        navState.value = inFlightNavState('implementing', 'implement');
        viewerState.value = baseViewerState(
            'implementing',
            'implement',
            pauseFooter('Complete')
        );
        return <FooterActions initialSpecStatus="implementing" />;
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
            activeStep: 'tasks',
            enhancementButtons: [
                { label: 'Checklist', command: '/speckit.checklist', icon: '⚡', tooltip: 'Generate a checklist' },
                { label: 'Analyze', command: '/speckit.analyze', icon: '⚡', tooltip: 'Analyze the spec' },
            ],
        });
        viewerState.value = baseViewerState('implemented', 'tasks', finalApprovalFooter);
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

// ── Generating state (spec 099 → restyled in spec 115) ─────────────────
// The right side shows a non-clickable "Generating <step>…" status chip
// (pill + spinner) while the running step's artifact is not yet on disk;
// the left side shows the secondary "Mark step complete" override. Once
// the artifact lands (or the recovery timeout elapses) the normal footer
// returns.

export const GeneratingTasks: Story = {
    name: 'Generating — Tasks',
    render: () => {
        navState.value = inFlightNavState('tasking', 'tasks');
        viewerState.value = baseViewerState('tasking', 'tasks', pauseFooter('Implement'));
        return <FooterActions initialSpecStatus="tasking" />;
    },
};

export const GeneratingPlan: Story = {
    name: 'Generating — Plan',
    render: () => {
        navState.value = inFlightNavState('planning', 'plan');
        viewerState.value = baseViewerState('planning', 'plan', pauseFooter('Tasks'));
        return <FooterActions initialSpecStatus="planning" />;
    },
};

export const GeneratingArtifactReady: Story = {
    name: 'Generating — artifact ready (re-enabled)',
    render: () => {
        // Running, but the artifact is now detected → normal forward footer.
        navState.value = mockNavState({
            specStatus: 'tasking',
            activeStep: 'tasks',
            runningStepArtifactReady: true,
            runningStepStartedAt: new Date().toISOString(),
            stepHistory: { tasks: { startedAt: new Date().toISOString(), completedAt: null } },
        });
        viewerState.value = baseViewerState('tasking', 'tasks', pauseFooter('Implement'));
        return <FooterActions initialSpecStatus="tasking" />;
    },
};

export const GeneratingTimedOut: Story = {
    name: 'Generating — recovery timeout',
    render: () => {
        // Running, artifact never appeared, but the 10-min window elapsed →
        // footer falls back to the enabled buttons so it never strands.
        navState.value = mockNavState({
            specStatus: 'tasking',
            activeStep: 'tasks',
            runningStepArtifactReady: false,
            runningStepStartedAt: '2026-05-08T00:00:00Z',
            stepHistory: { tasks: { startedAt: '2026-05-08T00:00:00Z', completedAt: null } },
        });
        viewerState.value = baseViewerState('tasking', 'tasks', pauseFooter('Implement'));
        return <FooterActions initialSpecStatus="tasking" />;
    },
};

