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

// The Overview is a rail entry, present only when the spec has a recorded run
// (a `.spec-context.json` with content) — no context, no Overview entry.
export const WithOverviewEntry: Story = {
    name: 'Overview entry (spec has recorded activity)',
    render: () => {
        viewerState.value = {
            status: 'completed', activeStep: 'implement', steps: {}, pulse: null,
            highlights: [], activeSubstep: null, footer: [], history: [], stepHistory: {},
            intent: 'Adopt the Codex redesign in the production viewer.',
            decisions: [{ decision: 'rail-hosted Overview' }],
        } as never;
        navState.value = mockNavState({
            coreDocs: [mockDoc('spec', true, 'Specification'), mockDoc('plan', true, 'Plan'), mockDoc('tasks', true, 'Tasks')],
            currentDoc: 'spec',
            workflowPhase: 'tasks',
            taskCompletionPercent: 100,
        });
        return <NavigationBar />;
    },
};

// Mid-implement: the rail lists documents only — Implement and Mark Complete
// are action steps with nothing to open, so they never become entries. The
// live percent renders on the last document tab (Tasks) instead.
export const ImplementingPercentOnTasks: Story = {
    name: 'Implementing · percent on Tasks, no action entries',
    render: () => {
        viewerState.value = {
            status: 'implementing', activeStep: 'implement', steps: {}, pulse: null,
            highlights: ['specify', 'plan', 'tasks'], activeSubstep: null, footer: [], history: [], stepHistory: {},
        } as never;
        navState.value = mockNavState({
            coreDocs: [
                mockDoc('spec', true, 'Specification'),
                mockDoc('plan', true, 'Plan'),
                mockDoc('tasks', true, 'Tasks'),
                mockActionDoc('implement', 'Implement'),
                mockActionDoc('mark-complete', 'Mark Complete'),
            ],
            currentDoc: 'tasks',
            workflowPhase: 'tasks',
            currentStep: 'implement',
            taskCompletionPercent: 45,
        });
        return <NavigationBar />;
    },
};

export const ActiveSpec: Story = {
    render: () => {
        viewerState.value = null;
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

// ── Artifacts nested under their step ───────────────────────
// A step's related artifact docs render as an indented sub-list directly
// beneath that step's tab in the Pipeline group — so "where does this file
// come from" is answered in place, not in separate "<Step> files" groups
// below the rail.

// Multiple steps each carry their own nested artifacts: Requirements under
// Specification, Data Model / Living Components / Research under Plan.
export const NestedArtifactsAcrossSteps: Story = {
    name: 'Artifacts nested under Specification and Plan',
    render: () => {
        viewerState.value = null;
        navState.value = mockNavState({
            coreDocs: [
                mockDoc('spec', true, 'Specification'),
                mockDoc('plan', true, 'Plan'),
                mockDoc('tasks', true, 'Tasks'),
            ],
            relatedDocs: [
                mockRelatedDoc('requirements', 'spec', 'Requirements'),
                mockRelatedDoc('data-model', 'plan', 'Data Model'),
                mockRelatedDoc('living-components', 'plan', 'Living Components'),
                mockRelatedDoc('research', 'plan', 'Research'),
            ],
            currentDoc: 'plan',
            workflowPhase: 'tasks',
        });
        return <NavigationBar />;
    },
};

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
//    provider-emitted `category: 'action'` entries but never render — the
//    rail lists documents only; lifecycle actions live in the footer. ─────
export const CustomWorkflowSevenSteps: Story = {
    name: 'Custom workflow · 7 steps, action steps hidden, free-named artifacts',
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

// ── GSD × Superpowers: the committed example workflow. Discuss, Execute,
//    and Verify are action steps, so only Plan gets a rail entry — and the
//    running Execute step locks nothing because it has no entry. ─────────
export const GsdSuperpowersWorkflow: Story = {
    name: 'Custom workflow · GSD (only the document step renders)',
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
