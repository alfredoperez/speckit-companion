import type { Meta, StoryObj } from '@storybook/preact';
import { StepTab } from './StepTab';
import { mockDoc } from './__stories__/mockData';

const meta: Meta<typeof StepTab> = {
    title: 'Viewer/StepTab',
    component: StepTab,
    decorators: [(Story) => <div class="compact-nav"><div class="nav-primary"><div class="step-tabs"><Story /></div></div></div>],
};
export default meta;

type Story = StoryObj<typeof StepTab>;

const base = {
    index: 0,
    totalSteps: 3,
    currentDoc: 'spec',
    workflowPhase: 'spec',
    taskCompletionPercent: 0,
    isViewingRelatedDoc: false,
    parentPhaseForRelated: 'spec',
    onClick: (phase: string) => console.log('clicked', phase),
};

export const Default: Story = {
    args: { ...base, doc: mockDoc('plan', false, 'Plan'), index: 1 },
};

export const Exists: Story = {
    args: { ...base, doc: mockDoc('spec', true, 'Specification') },
};

export const Viewing: Story = {
    args: { ...base, doc: mockDoc('spec', true, 'Specification'), currentDoc: 'spec' },
};

export const Reviewing: Story = {
    args: { ...base, doc: mockDoc('spec', true, 'Specification'), currentDoc: 'spec', workflowPhase: 'plan' },
};

export const TasksActive: Story = {
    args: { ...base, doc: mockDoc('tasks', true, 'Tasks'), index: 2, currentDoc: 'tasks', taskCompletionPercent: 45 },
};

export const Working: Story = {
    args: { ...base, doc: mockDoc('plan', true, 'Plan'), index: 1, activeStep: 'plan' },
};

export const Stale: Story = {
    args: { ...base, doc: mockDoc('plan', true, 'Plan'), index: 1, stalenessMap: { plan: { isStale: true, staleReason: 'Outdated', newerUpstream: 'spec' } } },
};

export const InProgress: Story = {
    args: { ...base, doc: mockDoc('tasks', true, 'Tasks'), index: 2, taskCompletionPercent: 72 },
};

export const AllStates: Story = {
    render: () => (
        <div style="display: flex; gap: 0; align-items: center;">
            <StepTab {...base} doc={mockDoc('spec', true, 'Specification')} currentDoc="spec" workflowPhase="plan" />
            <span class="step-connector filled" />
            <StepTab {...base} doc={mockDoc('plan', true, 'Plan')} index={1} activeStep="plan" />
            <span class="step-connector" />
            <StepTab {...base} doc={mockDoc('tasks', true, 'Tasks')} index={2} taskCompletionPercent={45} currentDoc="tasks" />
        </div>
    ),
};
