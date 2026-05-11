/**
 * Combined Storybook stories that show the full viewer chrome
 * (header + step tabs + footer) at each canonical spec status.
 *
 * Storybook order follows the lifecycle:
 *   Create Spec → Specifying → Specified → Planning → Planned →
 *   Creating Tasks → Tasks Created → Implementing → Implemented →
 *   Completed → Archived
 *
 * Story names use the visible status label only — no parens, no
 * phase numbers.
 *
 * For per-component stories see:
 *   - Viewer/SpecHeader        (header badge variants)
 *   - Viewer/NavigationBar     (step tabs + sub-doc rail)
 *   - Viewer/StepTab           (single-tab visual states)
 *   - Viewer/FooterActions     (footer button visibility per status)
 *   - Viewer/Activity/PhasesCard (timeline)
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { navState, viewerState } from '../../signals';
import type { ViewerState, SerializedFooterAction } from '../../types';
import { SpecHeader } from '../SpecHeader';
import { NavigationBar } from '../NavigationBar';
import { FooterActions } from '../FooterActions';
import { CreateSpecMock } from '../../../spec-editor/CreateSpecMock';
import { mockDoc, mockNavState } from './mockData';

const meta: Meta = {
    title: 'Viewer/Transitions',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Combined header + stepper + footer at each canonical spec status. ' +
                    'Walk top-to-bottom in the sidebar to step through the lifecycle one status at a time.',
            },
        },
    },
};
export default meta;

type Story = StoryObj;

const NOW = Date.now();
const iso = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

interface Frame {
    status: string;
    badgeText: string;
    activeDoc: string;
    workflowPhase: string;
    activeStep: string;
    /** Spec's `currentStep` from .spec-context.json. Drives the
     *  last-step in-progress percent (only fires when currentStep
     *  is `'implement'`). */
    currentStep?: string;
    /** Mock task-completion percent shown on the last navigable
     *  tab while currentStep is `'implement'`. */
    taskCompletionPercent?: number;
    stepHistory: ViewerState['stepHistory'];
    footer: SerializedFooterAction[];
    note: string;
}

// Footer-array shorthands.
//
// Pause states (between phases) show the dynamic next-step button + Regenerate.
// Closure-eligible pauses also show Archive + Mark Completed.
// In-flight stories pass an empty array — the renderer hides the buttons
// rather than disabling them while the AI is mid-step.

const pauseFooter = (forwardLabel: string): SerializedFooterAction[] => [
    { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 'Re-run only the current step' },
    { id: 'approve', label: forwardLabel, scope: 'step', tooltip: 'Approve this step and continue' },
];

const finalApprovalFooter: SerializedFooterAction[] = [
    { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
    { id: 'complete', label: 'Mark Completed', scope: 'spec', tooltip: 'Mark this spec as completed' },
    { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 'Re-run only the current step' },
];

const completedFooter: SerializedFooterAction[] = [
    { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
    { id: 'reactivate', label: 'Reactivate', scope: 'spec', tooltip: 'Reactivate archived spec' },
];

const archivedFooter: SerializedFooterAction[] = [
    { id: 'reactivate', label: 'Reactivate', scope: 'spec', tooltip: 'Reactivate archived spec' },
];

// Refine variants: prepend a synthetic refine action to an existing
// footer. The id 'refine' is recognized by FooterActions.tsx and gets
// the enhancement (sparkle) variant.
const REFINE_ACTION: SerializedFooterAction = {
    id: 'refine',
    label: '✨ Refine (2)',
    scope: 'spec',
    tooltip: 'Submit 2 line comments for refinement',
};

const withRefine = (footer: SerializedFooterAction[]): SerializedFooterAction[] =>
    [REFINE_ACTION, ...footer];

function renderFrame(frame: Frame) {
    navState.value = mockNavState({
        coreDocs: [
            mockDoc('spec', true, 'Specification'),
            mockDoc('plan', frame.workflowPhase !== 'spec', 'Plan'),
            mockDoc('tasks', ['tasks', 'implement'].includes(frame.workflowPhase), 'Tasks'),
        ],
        currentDoc: frame.activeDoc,
        workflowPhase: frame.workflowPhase,
        activeStep: frame.activeStep,
        ...(frame.currentStep !== undefined ? { currentStep: frame.currentStep } : {}),
        ...(frame.taskCompletionPercent !== undefined
            ? { taskCompletionPercent: frame.taskCompletionPercent }
            : {}),
        stepHistory: frame.stepHistory,
        specStatus: frame.status,
        badgeText: frame.badgeText,
        specContextName: 'Quiet Footer Demo',
        branch: 'feat/094-viewer-state-machine',
        createdDate: 'May 8, 2026',
    });
    viewerState.value = {
        status: frame.status,
        activeStep: frame.activeStep,
        steps: {},
        pulse: null,
        highlights: [],
        activeSubstep: null,
        footer: frame.footer,
        transitions: [],
        stepHistory: frame.stepHistory,
    };

    return (
        <div style="background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #ccc); padding: 24px; min-height: 100vh; font-family: var(--vscode-font-family, system-ui);">
            <p style="opacity: 0.65; font-size: 12px; margin: 0 0 16px;">{frame.note}</p>
            <div style="border: 1px solid var(--vscode-widget-border, #303030); border-radius: 6px; overflow: hidden;">
                <SpecHeader />
                <nav class="compact-nav">
                    <NavigationBar />
                </nav>
                <div style="padding: 64px 24px; opacity: 0.4; font-size: 12px;">
                    <em>(spec content body — omitted in this story)</em>
                </div>
                <FooterActions initialSpecStatus={frame.status} />
            </div>
        </div>
    );
}

// ── Create Spec — pre-viewer entry point ───────────────────
// Embeds the actual Create New Spec mock so reviewers can see the
// "phase zero" UI (where Auto Mode lives) without leaving the
// transition walk-through.

export const CreateSpec: Story = {
    name: 'Create Spec',
    render: () => <CreateSpecMock />,
};

// ── Specifying — specify in flight ─────────────────────────
// Footer is empty during in-flight states. The header badge + the
// active step's pulse are the "AI is working" cues; rendering greyed
// buttons would be noise. The sidebar's per-row Archive remains
// available if the user wants to bail mid-step.

export const Specifying: Story = {
    name: 'Specifying',
    render: () => renderFrame({
        status: 'specifying',
        badgeText: 'SPECIFYING',
        activeDoc: 'spec',
        workflowPhase: 'spec',
        activeStep: 'specify',
        stepHistory: {
            specify: { startedAt: iso(45_000), completedAt: null },
        },
        footer: [],
        note: 'AI is writing spec.md. Footer is empty until the step completes.',
    }),
};

// ── Specified — specify done, plan not started ─────────────

export const Specified: Story = {
    name: 'Specified',
    render: () => renderFrame({
        status: 'specified',
        badgeText: 'SPECIFIED',
        activeDoc: 'spec',
        workflowPhase: 'spec',
        activeStep: 'specify',
        stepHistory: {
            specify: { startedAt: iso(700_000), completedAt: iso(120_000) },
        },
        footer: pauseFooter('Plan'),
        note: 'specify.md is done. The user reviews and clicks "Plan" to dispatch the next phase.',
    }),
};

export const SpecifiedWithRefine: Story = {
    name: 'Specified With Refine',
    render: () => renderFrame({
        status: 'specified',
        badgeText: 'SPECIFIED',
        activeDoc: 'spec',
        workflowPhase: 'spec',
        activeStep: 'specify',
        stepHistory: {
            specify: { startedAt: iso(700_000), completedAt: iso(120_000) },
        },
        footer: withRefine(pauseFooter('Plan')),
        note: 'User added 2 inline comments on spec.md. The ✨ Refine button surfaces alongside the next-step button.',
    }),
};

// ── Planning — plan in flight ──────────────────────────────

export const Planning: Story = {
    name: 'Planning',
    render: () => renderFrame({
        status: 'planning',
        badgeText: 'PLANNING',
        activeDoc: 'plan',
        workflowPhase: 'plan',
        activeStep: 'plan',
        stepHistory: {
            specify: { startedAt: iso(900_000), completedAt: iso(700_000) },
            plan: { startedAt: iso(120_000), completedAt: null },
        },
        footer: [],
        note: 'AI is writing plan.md. Specify shows the green check; Plan tab is in flight.',
    }),
};

// ── Planned — plan done, tasks not started ────────────────

export const Planned: Story = {
    name: 'Planned',
    render: () => renderFrame({
        status: 'planned',
        badgeText: 'PLANNED',
        activeDoc: 'plan',
        workflowPhase: 'plan',
        activeStep: 'plan',
        stepHistory: {
            specify: { startedAt: iso(1_400_000), completedAt: iso(1_200_000) },
            plan: { startedAt: iso(1_200_000), completedAt: iso(120_000) },
        },
        footer: pauseFooter('Tasks'),
        note: 'plan.md is done. The user reviews and clicks "Tasks" to dispatch task generation.',
    }),
};

export const PlannedWithRefine: Story = {
    name: 'Planned With Refine',
    render: () => renderFrame({
        status: 'planned',
        badgeText: 'PLANNED',
        activeDoc: 'plan',
        workflowPhase: 'plan',
        activeStep: 'plan',
        stepHistory: {
            specify: { startedAt: iso(1_400_000), completedAt: iso(1_200_000) },
            plan: { startedAt: iso(1_200_000), completedAt: iso(120_000) },
        },
        footer: withRefine(pauseFooter('Tasks')),
        note: 'User added 2 inline comments on plan.md. ✨ Refine + the next-step button.',
    }),
};

// ── Creating Tasks — tasks in flight ──────────────────────
// Status key on disk: `tasking`. Visible label: "Creating Tasks".

export const CreatingTasks: Story = {
    name: 'Creating Tasks',
    render: () => renderFrame({
        status: 'tasking',
        badgeText: 'CREATING TASKS',
        activeDoc: 'tasks',
        workflowPhase: 'tasks',
        activeStep: 'tasks',
        stepHistory: {
            specify: { startedAt: iso(1_800_000), completedAt: iso(1_600_000) },
            plan: { startedAt: iso(1_600_000), completedAt: iso(1_200_000) },
            tasks: { startedAt: iso(180_000), completedAt: null },
        },
        footer: [],
        note: 'AI is writing tasks.md. Footer empty until the step completes.',
    }),
};

// ── Tasks Created — tasks done, implement not started ─────
// Status key on disk: `ready-to-implement`. Visible label: "Tasks Created".
// Archive + Mark Completed are HIDDEN here — the user is meant to
// move forward to Implement, not to terminate. Closure controls
// surface only at `implemented` (final approval gate).

export const TasksCreated: Story = {
    name: 'Tasks Created',
    render: () => renderFrame({
        status: 'ready-to-implement',
        badgeText: 'TASKS CREATED',
        activeDoc: 'tasks',
        workflowPhase: 'tasks',
        activeStep: 'tasks',
        stepHistory: {
            specify: { startedAt: iso(2_400_000), completedAt: iso(2_200_000) },
            plan: { startedAt: iso(2_200_000), completedAt: iso(1_800_000) },
            tasks: { startedAt: iso(1_800_000), completedAt: iso(120_000) },
        },
        footer: pauseFooter('Implement'),
        note: 'tasks.md is done. Footer focuses on the forward action. Archive / Mark Completed wait until Implemented.',
    }),
};

export const TasksCreatedWithRefine: Story = {
    name: 'Tasks Created With Refine',
    render: () => renderFrame({
        status: 'ready-to-implement',
        badgeText: 'TASKS CREATED',
        activeDoc: 'tasks',
        workflowPhase: 'tasks',
        activeStep: 'tasks',
        stepHistory: {
            specify: { startedAt: iso(2_400_000), completedAt: iso(2_200_000) },
            plan: { startedAt: iso(2_200_000), completedAt: iso(1_800_000) },
            tasks: { startedAt: iso(1_800_000), completedAt: iso(120_000) },
        },
        footer: withRefine(pauseFooter('Implement')),
        note: 'User added 2 inline comments on tasks.md. ✨ Refine + the forward "Implement" button.',
    }),
};

// ── Implementing — implement in flight ────────────────────

export const Implementing: Story = {
    name: 'Implementing',
    render: () => renderFrame({
        status: 'implementing',
        badgeText: 'IMPLEMENTING',
        activeDoc: 'tasks',
        workflowPhase: 'implement',
        activeStep: 'implement',
        // currentStep + taskCompletionPercent drive the last-tab in-flight
        // pill so the Tasks tab shows e.g. "45%" while the AI builds.
        currentStep: 'implement',
        taskCompletionPercent: 45,
        stepHistory: {
            specify: { startedAt: iso(3_600_000), completedAt: iso(3_300_000) },
            plan: { startedAt: iso(3_300_000), completedAt: iso(2_700_000) },
            tasks: { startedAt: iso(2_700_000), completedAt: iso(2_400_000) },
            implement: { startedAt: iso(900_000), completedAt: null },
        },
        footer: [],
        note: 'AI is building the feature. The Tasks tab shows the task-completion percent. Footer empty during the build — sidebar Archive is available if you need to bail.',
    }),
};

// ── Implemented — implement done, awaiting Mark Completed ──

export const Implemented: Story = {
    name: 'Implemented',
    render: () => renderFrame({
        status: 'implemented',
        badgeText: 'IMPLEMENTED',
        activeDoc: 'tasks',
        workflowPhase: 'implement',
        activeStep: 'implement',
        stepHistory: {
            specify: { startedAt: iso(7_200_000), completedAt: iso(6_900_000) },
            plan: { startedAt: iso(6_900_000), completedAt: iso(6_300_000) },
            tasks: { startedAt: iso(6_300_000), completedAt: iso(6_000_000) },
            implement: { startedAt: iso(6_000_000), completedAt: iso(120_000) },
        },
        footer: finalApprovalFooter,
        note: 'AI finished the build. The Approve button is hidden (no later step). User clicks Mark Completed to mark the spec terminally complete.',
    }),
};

// ── Completed — terminal ──────────────────────────────────

export const Completed: Story = {
    name: 'Completed',
    render: () => renderFrame({
        status: 'completed',
        badgeText: 'COMPLETED',
        activeDoc: 'tasks',
        workflowPhase: 'implement',
        activeStep: 'implement',
        stepHistory: {
            specify: { startedAt: iso(7_200_000), completedAt: iso(6_900_000) },
            plan: { startedAt: iso(6_900_000), completedAt: iso(6_300_000) },
            tasks: { startedAt: iso(6_300_000), completedAt: iso(6_000_000) },
            implement: { startedAt: iso(6_000_000), completedAt: iso(60_000) },
        },
        footer: completedFooter,
        note: 'Terminal state. Stepper shows all green checks. Footer shows Archive and Reactivate.',
    }),
};

// ── Archived — terminal ──────────────────────────────────

export const Archived: Story = {
    name: 'Archived',
    render: () => renderFrame({
        status: 'archived',
        badgeText: 'ARCHIVED',
        activeDoc: 'tasks',
        workflowPhase: 'implement',
        activeStep: 'implement',
        stepHistory: {
            specify: { startedAt: iso(86_400_000), completedAt: iso(86_000_000) },
        },
        footer: archivedFooter,
        note: 'Terminal state. The spec is shelved. Only Reactivate is available to bring it back.',
    }),
};
