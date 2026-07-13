import type { Meta, StoryObj } from '@storybook/preact';
import { navState, viewerState } from '../signals';
import { NavigationBar } from './NavigationBar';
import { mockActionDoc, mockDoc, mockNavState, mockRelatedDoc, stalePlan } from './__stories__/mockData';

const meta: Meta<typeof NavigationBar> = {
    title: 'Viewer/NavigationBar',
    component: NavigationBar,
    decorators: [(Story) => <div style="max-width: 240px;"><Story /></div>],
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


// ── Custom workflow: the rail is generated from workflow data, not a
//    canonical four-step assumption (FR-007). Action-only steps arrive as
//    provider-emitted `category: 'action'` entries (no fabricated documents)
//    and render as non-openable marks interleaved in workflow order. ─────
export const CustomWorkflowSevenSteps: Story = {
    name: 'Custom workflow · 7 steps + action steps + free-named artifacts',
    render: () => {
        viewerState.value = null;
        navState.value = mockNavState({
            coreDocs: [
                mockActionDoc('discover', 'Discovery'),
                mockDoc('spec', true, 'Specification'),
                mockDoc('plan', true, 'Plan'),
                mockDoc('security-review', false, 'Security Review'),
                mockDoc('tickets', false, 'Create Tickets'),
                mockActionDoc('implement', 'Implement'),
                mockActionDoc('release', 'Release'),
            ],
            relatedDocs: [
                mockRelatedDoc('threat-model', 'security-review', 'threat-model.md'),
                mockRelatedDoc('01-01-PLAN', 'plan', '01-01-PLAN.md'),
                mockRelatedDoc('research', 'plan', 'Research'),
            ],
            currentDoc: 'plan',
            workflowPhase: 'plan',
            activeStep: 'plan',
        });
        return <NavigationBar />;
    },
};

// ── GSD × Superpowers: the committed example workflow. Discuss leads as a
//    completed action step, Plan is the one document step, Execute is the
//    current action step, Verify is still pending. ─────────────────────
export const GsdSuperpowersWorkflow: Story = {
    name: 'Custom workflow · GSD (action steps around one document)',
    render: () => {
        viewerState.value = null;
        navState.value = mockNavState({
            coreDocs: [
                mockActionDoc('discuss', 'Discuss'),
                mockDoc('plan', true, 'Plan Phase'),
                mockActionDoc('execute', 'Execute (Superpowers)'),
                mockActionDoc('verify', 'Verify'),
            ],
            relatedDocs: [
                mockRelatedDoc('01-01-PLAN', 'plan', '01-01-PLAN.md'),
            ],
            currentDoc: 'plan',
            workflowPhase: 'plan',
            currentStep: 'execute',
            stepHistory: {
                discuss: { startedAt: '2026-07-10T10:00:00Z', completedAt: '2026-07-10T10:12:00Z' },
                plan: { startedAt: '2026-07-10T10:12:00Z', completedAt: '2026-07-10T10:31:00Z' },
            },
        });
        return <NavigationBar />;
    },
};
