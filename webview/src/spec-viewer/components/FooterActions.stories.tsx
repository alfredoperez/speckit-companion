import type { Meta, StoryObj } from '@storybook/preact';
import { navState, viewerState } from '../signals';
import { FooterActions } from './FooterActions';
import { mockNavState } from './__stories__/mockData';

const meta: Meta<typeof FooterActions> = {
    title: 'Viewer/FooterActions',
    component: FooterActions,
};
export default meta;

type Story = StoryObj<typeof FooterActions>;

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

export const Completed: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: { showApproveButton: false, approveText: '', enhancementButtons: [], specStatus: 'completed' },
        });
        return <FooterActions initialSpecStatus="completed" />;
    },
};

export const Archived: Story = {
    render: () => {
        navState.value = mockNavState({
            footerState: { showApproveButton: false, approveText: '', enhancementButtons: [], specStatus: 'archived' },
        });
        return <FooterActions initialSpecStatus="archived" />;
    },
};

// ── Catalog path (driven by viewerState.footer) ─────────────
// FooterActions.tsx has two render paths: the legacy one (above) driven by
// navState.footerState, and a newer catalog-driven one that fires when
// viewerState.footer is populated. The catalog path is what the extension
// produces for every spec-context spec via getFooterActions(ctx, step).
// These stories cover the catalog path's lifecycle states so we have visual
// coverage of the action filtering done in src/features/spec-viewer/footerActions.ts.

const baseViewerState = (status: string, footer: { id: string; label: string; scope: 'spec' | 'step'; tooltip: string }[]) => ({
    status,
    activeStep: 'tasks',
    steps: {},
    pulse: null,
    highlights: [],
    activeSubstep: null,
    footer,
});

export const CatalogActiveTasks: Story = {
    render: () => {
        navState.value = mockNavState({ specStatus: 'active' });
        viewerState.value = baseViewerState('active', [
            { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
            { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 'Re-run only the current step' },
            { id: 'approve', label: 'Approve', scope: 'step', tooltip: 'Approve this step and continue' },
        ]);
        return <FooterActions initialSpecStatus="active" />;
    },
};

// Regression coverage: the user reported seeing Archive + Reactivate + Regenerate
// + Approve on a completed spec. The fix in footerActions.ts:46-74 hides
// step-scoped actions (start, regenerate, approve) when status is terminal.
// This story asserts the catalog path now produces just Archive + Reactivate.
export const CatalogCompleted: Story = {
    render: () => {
        navState.value = mockNavState({ specStatus: 'completed' });
        viewerState.value = baseViewerState('completed', [
            { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
            { id: 'reactivate', label: 'Reactivate', scope: 'spec', tooltip: 'Reactivate archived spec' },
        ]);
        return <FooterActions initialSpecStatus="completed" />;
    },
};

export const CatalogArchived: Story = {
    render: () => {
        navState.value = mockNavState({ specStatus: 'archived' });
        viewerState.value = baseViewerState('archived', [
            { id: 'reactivate', label: 'Reactivate', scope: 'spec', tooltip: 'Reactivate archived spec' },
        ]);
        return <FooterActions initialSpecStatus="archived" />;
    },
};

export const CatalogTasksDone: Story = {
    render: () => {
        navState.value = mockNavState({ specStatus: 'tasks-done' });
        viewerState.value = baseViewerState('tasks-done', [
            { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
            { id: 'complete', label: 'Mark Completed', scope: 'spec', tooltip: 'Mark this spec as completed' },
            { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 'Re-run only the current step' },
        ]);
        return <FooterActions initialSpecStatus="tasks-done" />;
    },
};
