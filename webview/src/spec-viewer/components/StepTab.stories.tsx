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

const staleMap = (phase: string) => ({
    [phase]: { isStale: true, staleReason: 'Outdated', newerUpstream: 'spec' },
});

// ── Canonical states ─────────────────────────────────────

export const Current: Story = {
    args: { ...base, doc: mockDoc('spec', true, 'Specification'), currentDoc: 'spec' },
};

export const Done: Story = {
    args: { ...base, doc: mockDoc('spec', true, 'Specification'), currentDoc: 'plan' },
};

export const InFlight: Story = {
    args: { ...base, doc: mockDoc('tasks', true, 'Tasks'), index: 2, taskCompletionPercent: 72 },
};

export const Locked: Story = {
    args: {
        ...base,
        doc: mockDoc('plan', false, 'Plan'),
        index: 1,
        runningStepIndex: 0,
    },
};

// ── Canonical states × stale ─────────────────────────────

export const CurrentStale: Story = {
    args: { ...base, doc: mockDoc('spec', true, 'Specification'), currentDoc: 'spec', stalenessMap: staleMap('spec') },
};

export const DoneStale: Story = {
    args: { ...base, doc: mockDoc('spec', true, 'Specification'), currentDoc: 'plan', stalenessMap: staleMap('spec') },
};

export const InFlightStale: Story = {
    args: { ...base, doc: mockDoc('tasks', true, 'Tasks'), index: 2, taskCompletionPercent: 45, stalenessMap: staleMap('tasks') },
};

export const LockedStale: Story = {
    args: {
        ...base,
        doc: mockDoc('plan', false, 'Plan'),
        index: 1,
        runningStepIndex: 0,
        stalenessMap: staleMap('plan'),
    },
};

// ── Current + in-flight (the image 3/4 bug case) ─────────

export const CurrentInFlight: Story = {
    args: {
        ...base,
        doc: mockDoc('tasks', true, 'Tasks'),
        index: 2,
        currentDoc: 'tasks',
        taskCompletionPercent: 33,
    },
};

export const CurrentInFlightStale: Story = {
    args: {
        ...base,
        doc: mockDoc('tasks', true, 'Tasks'),
        index: 2,
        currentDoc: 'tasks',
        taskCompletionPercent: 33,
        stalenessMap: staleMap('tasks'),
    },
};

// ── Elapsed-timer bands (non-last step, activeStep + stepHistory) ─
// Frozen at module load — open a story and it ticks forward. If the
// Storybook tab sits idle, elapsed will drift past the labeled band;
// reload to reset.
const STARTED_12S_AGO = new Date(Date.now() - 12_000).toISOString();
const STARTED_3M_22S_AGO = new Date(Date.now() - (3 * 60_000 + 22_000)).toISOString();
const STARTED_2H_15M_AGO = new Date(Date.now() - (2 * 60 * 60_000 + 15 * 60_000)).toISOString();

export const InFlightElapsedSeconds: Story = {
    args: {
        ...base,
        doc: mockDoc('plan', true, 'Plan'),
        index: 1,
        activeStep: 'plan',
        stepHistory: { plan: { startedAt: STARTED_12S_AGO } },
    },
};

export const InFlightElapsedMinutes: Story = {
    args: {
        ...base,
        doc: mockDoc('plan', true, 'Plan'),
        index: 1,
        activeStep: 'plan',
        stepHistory: { plan: { startedAt: STARTED_3M_22S_AGO } },
    },
};

export const InFlightElapsedHours: Story = {
    args: {
        ...base,
        doc: mockDoc('plan', true, 'Plan'),
        index: 1,
        activeStep: 'plan',
        stepHistory: { plan: { startedAt: STARTED_2H_15M_AGO } },
    },
};

export const CurrentInFlightElapsed: Story = {
    args: {
        ...base,
        doc: mockDoc('plan', true, 'Plan'),
        index: 1,
        currentDoc: 'plan',
        activeStep: 'plan',
        stepHistory: { plan: { startedAt: STARTED_3M_22S_AGO } },
    },
};

// ── Full row ─────────────────────────────────────────────

export const AllStates: Story = {
    render: () => (
        <div style="display: flex; gap: 0; align-items: center;">
            <StepTab
                {...base}
                doc={mockDoc('spec', true, 'Specification')}
                currentDoc="_"
                totalSteps={4}
            />
            <span class="step-connector filled" />
            <StepTab
                {...base}
                doc={mockDoc('plan', true, 'Plan')}
                index={1}
                currentDoc="plan"
                totalSteps={4}
            />
            <span class="step-connector filled" />
            <StepTab
                {...base}
                doc={mockDoc('tasks', true, 'Tasks')}
                index={2}
                currentDoc="_"
                activeStep="tasks"
                stepHistory={{ tasks: { startedAt: STARTED_3M_22S_AGO } }}
                totalSteps={4}
            />
            <span class="step-connector" />
            <StepTab
                {...base}
                doc={mockDoc('done', false, 'Implement')}
                index={3}
                currentDoc="_"
                totalSteps={4}
                runningStepIndex={2}
            />
        </div>
    ),
};

export const AllStatesWithPercent: Story = {
    render: () => (
        <div style="display: flex; gap: 0; align-items: center;">
            <StepTab {...base} doc={mockDoc('spec', true, 'Specification')} currentDoc="spec" />
            <span class="step-connector filled" />
            <StepTab {...base} doc={mockDoc('plan', true, 'Plan')} index={1} currentDoc="_" />
            <span class="step-connector filled" />
            <StepTab {...base} doc={mockDoc('tasks', true, 'Tasks')} index={2} currentDoc="_" taskCompletionPercent={45} />
        </div>
    ),
};
