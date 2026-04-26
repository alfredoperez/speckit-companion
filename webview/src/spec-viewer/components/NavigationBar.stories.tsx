import type { Meta, StoryObj } from '@storybook/preact';
import { navState } from '../signals';
import { NavigationBar } from './NavigationBar';
import { mockDoc, mockNavState, mockRelatedDoc, stalePlan } from './__stories__/mockData';

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
