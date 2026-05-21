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
import type { SpecDocument } from '../types';
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

// Helper to mark a story as in-flight on a given step. Sets the
// stepHistory entry so the renderer's isRunning check fires and
// hides the footer buttons (the catalog still emits them; the
// hide is at the render layer).
const inFlightNavState = (specStatus: string, step: string) =>
    mockNavState({
        specStatus,
        activeStep: step,
        stepHistory: { [step]: { startedAt: '2026-05-08T00:00:00Z', completedAt: null } },
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

// ── Scratchpad tab ──────────────────────────────────────────
// When the active doc is a scratchpad (a `<doc>-extra.md` history file),
// the footer is replaced by a read-only set with only an Edit button.

export const ScratchpadTab: Story = {
    name: 'Scratchpad tab',
    render: () => {
        const specScratch: SpecDocument = {
            type: 'spec-extra',
            label: 'Spec Notes',
            fileName: 'spec-extra.md',
            filePath: '/workspace/specs/my-feature/spec-extra.md',
            exists: true,
            isCore: false,
            category: 'related',
            parentStep: 'spec',
            isScratchpad: true,
            scratchpadFor: 'spec',
        };
        navState.value = mockNavState({
            coreDocs: [mockDoc('spec', true, 'Specification'), mockDoc('plan', true, 'Plan'), mockDoc('tasks', true, 'Tasks')],
            relatedDocs: [specScratch],
            currentDoc: 'spec-extra',
            isViewingRelatedDoc: true,
        });
        viewerState.value = null;
        return <FooterActions initialSpecStatus="active" />;
    },
};
