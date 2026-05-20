import type { Meta, StoryObj } from '@storybook/preact';
import type { SpecDocument } from '../types';
import { navState } from '../signals';
import { NavigationBar } from './NavigationBar';
import { mockDoc, mockNavState, mockRelatedDoc, stalePlan } from './__stories__/mockData';

function scratchpadDoc(base: 'spec' | 'plan' | 'tasks'): SpecDocument {
    return {
        type: `${base}-extra`,
        label: `${base[0].toUpperCase()}${base.slice(1)} Notes`,
        fileName: `${base}-extra.md`,
        filePath: `/workspace/specs/my-feature/${base}-extra.md`,
        exists: true,
        isCore: false,
        category: 'related',
        parentStep: base,
        isScratchpad: true,
        scratchpadFor: base,
    };
}

const meta: Meta<typeof NavigationBar> = {
    title: 'Viewer/NavigationBar',
    component: NavigationBar,
    decorators: [(Story) => <nav class="compact-nav"><Story /></nav>],
};
export default meta;

type Story = StoryObj<typeof NavigationBar>;

export const ActiveSpec: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [mockDoc('spec', true, 'Specification'), mockDoc('plan', true, 'Plan'), mockDoc('tasks', true, 'Tasks')],
            currentDoc: 'spec',
            workflowPhase: 'tasks',
            taskCompletionPercent: 45,
        });
        return <NavigationBar />;
    },
};

export const CompletedSpec: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [mockDoc('spec', true, 'Specification'), mockDoc('plan', true, 'Plan'), mockDoc('tasks', true, 'Tasks')],
            currentDoc: 'tasks',
            workflowPhase: 'tasks',
            taskCompletionPercent: 100,
        });
        return <NavigationBar />;
    },
};

export const NewSpec: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [mockDoc('spec', true, 'Specification'), mockDoc('plan', false, 'Plan'), mockDoc('tasks', false, 'Tasks')],
            currentDoc: 'spec',
            workflowPhase: 'spec',
        });
        return <NavigationBar />;
    },
};

export const WithStaleIndicator: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [mockDoc('spec', true, 'Specification'), mockDoc('plan', true, 'Plan'), mockDoc('tasks', false, 'Tasks')],
            currentDoc: 'spec',
            workflowPhase: 'plan',
            stalenessMap: stalePlan,
        });
        return <NavigationBar />;
    },
};

export const WorkingOnPlan: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [mockDoc('spec', true, 'Specification'), mockDoc('plan', true, 'Plan'), mockDoc('tasks', false, 'Tasks')],
            currentDoc: 'plan',
            workflowPhase: 'plan',
            activeStep: 'plan',
        });
        return <NavigationBar />;
    },
};

// ── Step-children rail (parent + sub-files) ─────────────────
// Verifies the second-row treatment introduced in feat/085: when the active
// step has related sub-docs, they render in a children rail beneath the
// step-tabs row, with the parent step as the first chip so users can hop
// back to the step's overview from any sub-doc.

export const PlanWithChildrenActive: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [
                mockDoc('spec', true, 'Specification'),
                mockDoc('plan', true, 'Plan'),
                mockDoc('tasks', true, 'Tasks'),
            ],
            relatedDocs: [
                mockRelatedDoc('data-model', 'plan', 'Data Model'),
                mockRelatedDoc('quickstart', 'plan', 'Quickstart'),
                mockRelatedDoc('research', 'plan', 'Research'),
            ],
            currentDoc: 'plan',
            workflowPhase: 'plan',
        });
        return <NavigationBar />;
    },
};

export const ViewingDataModel: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [
                mockDoc('spec', true, 'Specification'),
                mockDoc('plan', true, 'Plan'),
                mockDoc('tasks', true, 'Tasks'),
            ],
            relatedDocs: [
                mockRelatedDoc('data-model', 'plan', 'Data Model'),
                mockRelatedDoc('quickstart', 'plan', 'Quickstart'),
                mockRelatedDoc('research', 'plan', 'Research'),
            ],
            currentDoc: 'data-model',
            workflowPhase: 'plan',
            isViewingRelatedDoc: true,
        });
        return <NavigationBar />;
    },
};

export const SpecWithoutChildren: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [
                mockDoc('spec', true, 'Specification'),
                mockDoc('plan', true, 'Plan'),
                mockDoc('tasks', true, 'Tasks'),
            ],
            relatedDocs: [
                mockRelatedDoc('data-model', 'plan', 'Data Model'),
                mockRelatedDoc('research', 'plan', 'Research'),
            ],
            currentDoc: 'spec',
            workflowPhase: 'plan',
        });
        return <NavigationBar />;
    },
};

// ── Scratchpad sub-tab (FR-005 distinction) ───────────────────────────
// The "Spec Notes" chip is rendered distinct from the source chip (dashed
// italic). It only appears once `spec-extra.md` exists on disk; the file
// is created as a side effect of submitting inline-comment batches via
// the source-tab Refine button.

export const SpecWithScratchpad: Story = {
    render: () => {
        navState.value = mockNavState({
            coreDocs: [
                mockDoc('spec', true, 'Specification'),
                mockDoc('plan', true, 'Plan'),
                mockDoc('tasks', true, 'Tasks'),
            ],
            relatedDocs: [scratchpadDoc('spec')],
            currentDoc: 'spec',
            workflowPhase: 'spec',
        });
        return <NavigationBar />;
    },
};
