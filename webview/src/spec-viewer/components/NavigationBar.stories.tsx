import type { Meta, StoryObj } from '@storybook/preact';
import { navState } from '../signals';
import { NavigationBar } from './NavigationBar';
import { mockDoc, mockNavState, stalePlan } from './__stories__/mockData';

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
