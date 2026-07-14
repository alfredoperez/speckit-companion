import type { Meta, StoryObj } from '@storybook/preact';
import { StepTab } from './StepTab';
import { viewerState } from '../signals';
import type { ViewerState } from '../types';
import { mockActionDoc, mockDoc } from './__stories__/mockData';

// The in-flight derivation reads `status` from `viewerState`, so a story that
// exercises a lifecycle status has to seed it.
const seedStatus = (status: string) => {
    viewerState.value = {
        status,
        highlights: ['specify', 'plan', 'tasks'],
        activeSubstep: null,
    } as unknown as ViewerState;
};

const meta: Meta<typeof StepTab> = {
    title: 'Viewer/StepTab',
    component: StepTab,
    decorators: [(Story) => {
        // Reset between stories — a status seeded by one story would otherwise
        // decide the next one's in-flight state.
        viewerState.value = null;
        return <div class="compact-nav"><div class="nav-primary"><div class="step-tabs"><Story /></div></div></div>;
    }],
};
export default meta;

type Story = StoryObj<typeof StepTab>;

const base = {
    index: 0,
    currentDoc: 'spec',
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
    args: { ...base, doc: mockDoc('tasks', true, 'Tasks'), index: 2, currentStep: 'implement', isPercentHost: true, taskCompletionPercent: 72 },
};

// #229: the in-flight indicator is a spinning `sync` codicon — looping arrows
// that read as "actively working". The glyph disappears the moment the step
// completes (activeStep moves off / completedAt set).
export const InFlightSyncGlyph: Story = {
    args: {
        ...base,
        doc: mockDoc('plan', true, 'Plan'),
        index: 1,
        activeStep: 'plan',
        currentStep: 'plan',
        stepHistory: { plan: { startedAt: new Date(Date.now() - 18_000).toISOString() } },
    },
};

// #277 Child 4: the implement tab now shows the spinning sync glyph NEXT TO the
// live percentage, so it has motion instead of a static "Tasks 0%". The glyph
// renders inside `.step-tab__percent`.
export const InFlightImplementPercentAndGlyph: Story = {
    args: {
        ...base,
        doc: mockDoc('tasks', true, 'Tasks'),
        index: 2,
        currentDoc: 'tasks',
        currentStep: 'implement',
        taskCompletionPercent: 40,
        isPercentHost: true,
    },
};

// A running implement: the status says the step is in flight, so the tab spins
// and the percent advances as tasks.md boxes get checked.
export const ImplementRunning: Story = {
    render: () => {
        seedStatus('implementing');
        return (
            <StepTab
                {...base}
                doc={mockDoc('tasks', true, 'Tasks')}
                index={2}
                currentDoc="tasks"
                currentStep="implement"
                taskCompletionPercent={40}
                isPercentHost
            />
        );
    },
};

// A settled spec never spins, whatever the percent says. A tasks.md whose
// percent stalls below 100 (a stray unchecked box) must still read as done.
export const CompletedWithStalledPercent: Story = {
    render: () => {
        seedStatus('completed');
        return (
            <StepTab
                {...base}
                doc={mockDoc('tasks', true, 'Tasks')}
                index={2}
                currentDoc="tasks"
                currentStep="implement"
                taskCompletionPercent={95}
                isPercentHost
            />
        );
    },
};

// ── Action-only pipeline entries (FR-007) ─────────────────
// No document: marked with the action glyph, non-openable, completion from
// step history, `current` while the workflow sits at the step.

export const ActionPending: Story = {
    args: { ...base, doc: mockActionDoc('execute', 'Execute (Superpowers)'), index: 2, currentStep: 'plan' },
};

export const ActionCurrent: Story = {
    args: { ...base, doc: mockActionDoc('execute', 'Execute (Superpowers)'), index: 2, currentStep: 'execute' },
};

// Implement has no document of its own — selecting it opens tasks.md, the
// document it runs from, so no rail entry is a dead click.
export const ActionOpensItsSourceDoc: Story = {
    args: {
        ...base,
        doc: mockActionDoc('implement', 'Implement'),
        index: 3,
        currentStep: 'implement',
        sourceDoc: { type: 'tasks', label: 'Tasks' },
    },
};

export const ActionDone: Story = {
    args: {
        ...base,
        doc: mockActionDoc('discuss', 'Discuss'),
        index: 0,
        currentStep: 'plan',
        stepHistory: { discuss: { startedAt: '2026-07-10T10:00:00Z', completedAt: '2026-07-10T10:12:00Z' } },
    },
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
    args: { ...base, doc: mockDoc('tasks', true, 'Tasks'), index: 2, currentStep: 'implement', isPercentHost: true, taskCompletionPercent: 45, stalenessMap: staleMap('tasks') },
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
        currentStep: 'implement',
        isPercentHost: true,
        taskCompletionPercent: 33,
    },
};

export const CurrentInFlightStale: Story = {
    args: {
        ...base,
        doc: mockDoc('tasks', true, 'Tasks'),
        index: 2,
        currentDoc: 'tasks',
        currentStep: 'implement',
        isPercentHost: true,
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
            />
            <span class="step-connector filled" />
            <StepTab
                {...base}
                doc={mockDoc('plan', true, 'Plan')}
                index={1}
                currentDoc="plan"
            />
            <span class="step-connector filled" />
            <StepTab
                {...base}
                doc={mockDoc('tasks', true, 'Tasks')}
                index={2}
                currentDoc="_"
                activeStep="tasks"
                stepHistory={{ tasks: { startedAt: STARTED_3M_22S_AGO } }}
            />
            <span class="step-connector" />
            <StepTab
                {...base}
                doc={mockDoc('done', false, 'Implement')}
                index={3}
                currentDoc="_"
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
            <StepTab {...base} doc={mockDoc('tasks', true, 'Tasks')} index={2} currentDoc="_" currentStep="implement" taskCompletionPercent={45} isPercentHost />
        </div>
    ),
};
