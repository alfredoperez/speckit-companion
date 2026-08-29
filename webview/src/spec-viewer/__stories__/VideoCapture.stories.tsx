/**
 * VIDEO-OWNED STORIES. NOT A TEST CATALOG.
 * ─────────────────────────────────────────────────────────────────────────
 * Every story in this file exists to be SCREEN-CAPTURED for the Spec Kit
 * Companion YouTube series (`Projects/Content/Videos/Spec Kit Companion
 * Series/` in the vault). Changing a fixture string here changes what a
 * recorded episode says on screen, so treat them as published copy, not as
 * test data. Nothing here asserts anything; nothing here should be edited to
 * make a test pass.
 *
 * WHAT IS BEING SHOWN
 * The real `App`, mounted through the same harness `Viewer/Full Viewer` uses,
 * fed the Teamboard fixtures in `__fixtures__/teamboard/`. Timing and status
 * come from the extension's own pure derivations (`deriveStepHistory`,
 * `deriveTimingSummary`), never from hand-written durations.
 *
 * THE WORKED EXAMPLE
 * Teamboard, an internal staff directory. Feature `041-profile-photo-upload`.
 * Four requirements, six tasks. FR-004 is deliberately vacuous — it has no
 * number and no condition, so nothing can prove it false. That is the whole
 * spine of episode 3 and it must not be "improved" here.
 *
 * The series plan writes the requirements as R1 through R4. The badge ids in
 * the fixture are FR-001 through FR-004 because the viewer's requirement-row
 * styling keys on an `XX-nnn` id (see `markdown/preprocessors.ts`
 * `preprocessRequirements`); a bare `R1` renders as an unstyled bullet. The
 * four sentences are verbatim from the plan.
 *
 * DETERMINISM
 * The clock is frozen and animations are disabled by `CaptureFrame`. Two
 * captures of the same story a month apart are identical. See
 * `captureFrame.tsx` for why each of the three moving parts had to be pinned.
 *
 * FRAME SIZE
 * 1224 x 776, which is STAGE MAIN in the episode-1 frame contract: the region
 * of the 1920x1080 canvas reserved for product UI. Capturing at that size lets
 * a frame drop into the composition 1:1 with no resampling.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import type { SerializedFooterAction, ViewerState } from '../types';
import {
    completedFooter,
    InteractiveViewer,
    stepHistoryFrom,
    vsFromContext,
    type DocSet,
    type SpecContextData,
} from './viewerHarness';
import { CaptureFrame, STAGE_HEIGHT, STAGE_WIDTH } from './captureFrame';
import { mockDoc } from '../components/__stories__/mockData';

import teamboardSpec from '../__fixtures__/teamboard/041-profile-photo-upload/spec.md?raw';
import teamboardPlan from '../__fixtures__/teamboard/041-profile-photo-upload/plan.md?raw';
import teamboardTasks from '../__fixtures__/teamboard/041-profile-photo-upload/tasks.md?raw';
import teamboardResearch from '../__fixtures__/teamboard/041-profile-photo-upload/research.md?raw';
import teamboardDataModel from '../__fixtures__/teamboard/041-profile-photo-upload/data-model.md?raw';
import teamboardChecklist from '../__fixtures__/teamboard/041-profile-photo-upload/checklists/requirements.md?raw';
import ctxSpecifiedRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.specified.json?raw';
import ctxPlannedRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.planned.json?raw';
import ctxImplementingRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.implementing.json?raw';
import ctxCompletedRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.completed.json?raw';

const ctxSpecified = JSON.parse(ctxSpecifiedRaw) as SpecContextData;
const ctxPlanned = JSON.parse(ctxPlannedRaw) as SpecContextData;
const ctxImplementing = JSON.parse(ctxImplementingRaw) as SpecContextData;
const ctxCompleted = JSON.parse(ctxCompletedRaw) as SpecContextData;

/**
 * `tasks.md` ships with every box unchecked. The implementing snapshot needs
 * three of six ticked, and deriving that here keeps one copy of the task text
 * rather than two files that can drift apart.
 */
function checkTasks(md: string, ids: string[]): string {
    return ids.reduce(
        (out, id) => out.replace(new RegExp(`^- \\[ \\] \\*\\*${id}\\*\\*`, 'm'), `- [x] **${id}**`),
        md,
    );
}

const teamboardTasksPartial = checkTasks(teamboardTasks, ['T001', 'T002', 'T003']);
const allTasksChecked = checkTasks(teamboardTasks, ['T001', 'T002', 'T003', 'T004', 'T005', 'T006']);

/**
 * The rail entries, restricted to the documents that exist at a given point in
 * the run. Related docs hang under the step that produced them. A step tab
 * reads as done purely because its document exists (`StepTab.tsx`), so a
 * snapshot that has not reached `plan` yet must not ship a `plan.md`, or the
 * rail lies about how far the run got.
 */
export function teamboardDocs(tasksMd: string, reached: 'specify' | 'plan' | 'tasks'): DocSet {
    const docs: DocSet = {
        spec: { md: teamboardSpec, label: 'Specification' },
        checklist: { md: teamboardChecklist, label: 'Checklist', parentStep: 'spec' },
    };
    if (reached === 'plan' || reached === 'tasks') {
        docs.plan = { md: teamboardPlan, label: 'Plan' };
        docs.research = { md: teamboardResearch, label: 'Research', parentStep: 'plan' };
        docs['data-model'] = { md: teamboardDataModel, label: 'Data Model', parentStep: 'plan' };
    }
    if (reached === 'tasks') {
        docs.tasks = { md: tasksMd, label: 'Tasks' };
    }
    return docs;
}

/** Core pipeline tabs, with `exists` telling the truth for this snapshot. */
function coreDocsFor(reached: 'specify' | 'plan' | 'tasks') {
    return [
        mockDoc('spec', true, 'Specification'),
        mockDoc('plan', reached !== 'specify', 'Plan'),
        mockDoc('tasks', reached === 'tasks', 'Tasks'),
    ];
}

/** The two-button pause footer: Regenerate, plus the pill naming the next step. */
const pauseFooter = (forwardLabel: string): SerializedFooterAction[] => [
    { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 'Re-run only the current step' },
    { id: 'approve', label: forwardLabel, scope: 'step', tooltip: 'Approve this step and continue' },
];

const steps = (
    specify: string,
    plan: string,
    tasks: string,
    implement: string,
): ViewerState['steps'] =>
    ({ specify, plan, tasks, implement }) as ViewerState['steps'];

/**
 * Parks the reading column on one element, so a capture lands on the section
 * a beat is about instead of the top of the document. Sets `scrollTop`
 * directly after two frames — no smooth scrolling, because a capture taken
 * mid-animation is a different frame every time.
 *
 * Name the target either by `headingId` (a markdown heading's slug, whose
 * `offsetTop` is measured inside the reading column) or by `selector` (any
 * element, used for the Overview's dossier sections, which have no ids and
 * whose `offsetTop` is measured from the top of the capture box and so already
 * counts the page header).
 */
export function ScrollTo({
    headingId,
    selector,
    offset = 28,
    children,
}: {
    headingId?: string;
    /** CSS selector for the element to park on, when it has no id. */
    selector?: string;
    /** Pixels of context left visible above the target (28 default; a small
     *  value pins the heading flush to the top with no sliver of the previous
     *  section showing). */
    offset?: number;
    children: ComponentChildren;
}) {
    useEffect(() => {
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => {
                const area = document.getElementById('content-area');
                const target = headingId
                    ? document.getElementById(headingId)
                    : selector
                      ? document.querySelector<HTMLElement>(selector)
                      : null;
                if (area && target) area.scrollTop = Math.max(0, target.offsetTop - offset);
            });
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [headingId, selector, offset]);
    return <>{children}</>;
}

/**
 * The whole-dossier capture box: the Overview's own scroll container, opened
 * out so the entire dossier lays out in one image, with the floating action
 * footer taken off it. Used only by the tall Overview story below, which the
 * overview-readme and overview-engine clips pan a camera down.
 */
const TALL_DOSSIER_CSS = `
    .capture-stage .content-area { overflow: visible !important; height: auto !important; }
    .capture-stage footer.actions { display: none !important; }
`;

const meta: Meta = {
    title: 'Video Capture/Episode 1 · Teamboard',
    // Shared with ReadmeCapture.stories.tsx (the README hero composite), which
    // reuses the mid-plan Teamboard state rather than forking the fixtures.
    excludeStories: [
        'teamboardDocs',
        'PLANNING_AT',
        'ctxPlanning',
        'planningStepHistory',
        'ScrollTo',
        'OVERVIEW_TALL_HEIGHT',
    ],
    parameters: {
        layout: 'fullscreen',
        capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
        docs: {
            description: {
                component:
                    'Frames for the Spec Kit Companion video series, not a component catalog. ' +
                    'The real viewer on the Teamboard fixtures, at STAGE MAIN size (1224x776) ' +
                    'with the clock frozen and animations off, so a capture is reproducible.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

// ── Snapshot 1 · specify has run, nothing else has ────────────────────────
// Storyboard beats D1, D2, D3. The header sets, the four requirements read at
// full column width, the footer pill says Plan. Beat D2 is the plant: FR-004
// gets exactly the same treatment as the other three.

export const A1SpecJustSpecified: Story = {
    name: 'A1 · Spec, just specified',
    render: () => (
        <CaptureFrame>
            <InteractiveViewer
                ctx={ctxSpecified}
                docs={teamboardDocs(teamboardTasks, 'specify')}
                initialDoc="spec"
                view="document"
                extraNav={{
                    coreDocs: coreDocsFor('specify'),
                    taskCompletionPercent: 0,
                    workflowPhase: 'specify',
                    badgeText: 'SPECIFIED',
                }}
                vs={vsFromContext(ctxSpecified, pauseFooter('Plan'), {
                    steps: steps('completed', 'not-started', 'not-started', 'not-started'),
                })}
            />
        </CaptureFrame>
    ),
};

// ── Snapshot 1 · the requirements, parked in frame ────────────────────────
// Storyboard beat D2. The four requirement rows read at full column width in
// about two seconds each. FR-004 gets exactly the same line rule as the other
// three: no emphasis, no callout. The plant only works if the frame keeps a
// straight face.

export const A1bRequirements: Story = {
    name: 'A1b · The four requirements',
    render: () => (
        <CaptureFrame>
            <ScrollTo headingId="requirements">
                <InteractiveViewer
                    ctx={ctxSpecified}
                    docs={teamboardDocs(teamboardTasks, 'specify')}
                    initialDoc="spec"
                    view="document"
                    extraNav={{
                        coreDocs: coreDocsFor('specify'),
                        taskCompletionPercent: 0,
                        workflowPhase: 'specify',
                        badgeText: 'SPECIFIED',
                    }}
                    vs={vsFromContext(ctxSpecified, pauseFooter('Plan'), {
                        steps: steps('completed', 'not-started', 'not-started', 'not-started'),
                    })}
                />
            </ScrollTo>
        </CaptureFrame>
    ),
};

// ── Snapshot 1b · plan is running ─────────────────────────────────────────
// Storyboard beat E2.1: the pill was clicked, the plan step spins, and the step
// tab carries a live elapsed span. That span is the one visible string in the
// whole group that reads the clock, so this is also the story that proves the
// freeze: the clock is pinned 1m 18s after the plan step started, and it stays
// there no matter when the frame is grabbed.

export const PLANNING_AT = '2026-05-19T13:12:22.000Z';

const planStartIndex = ctxPlanned.history.findIndex((h) => h.step === 'plan' && h.kind === 'start');
export const ctxPlanning: SpecContextData = {
    ...ctxPlanned,
    status: 'planning',
    currentStep: 'plan',
    history: ctxPlanned.history.slice(0, planStartIndex + 1),
};
export const planningStepHistory = {
    ...stepHistoryFrom(ctxPlanning.history),
    plan: { startedAt: ctxPlanned.history[planStartIndex]?.at, completedAt: null },
} as ViewerState['stepHistory'];

export const A2PlanRunning: Story = {
    name: 'A2 · Plan running (live elapsed)',
    render: () => (
        <CaptureFrame at={PLANNING_AT}>
            <InteractiveViewer
                ctx={ctxPlanning}
                docs={teamboardDocs(teamboardTasks, 'specify')}
                initialDoc="spec"
                view="document"
                extraNav={{
                    coreDocs: coreDocsFor('specify'),
                    taskCompletionPercent: 0,
                    workflowPhase: 'plan',
                    specStatus: 'planning',
                    badgeText: 'PLANNING',
                    stepHistory: planningStepHistory,
                }}
                vs={vsFromContext(ctxPlanning, [], {
                    status: 'planning',
                    activeStep: 'plan',
                    pulse: 'plan',
                    steps: steps('completed', 'in-progress', 'not-started', 'not-started'),
                    stepHistory: planningStepHistory,
                })}
            />
        </CaptureFrame>
    ),
};

// ── Snapshot 2 · plan.md exists, the pill relabels to Tasks ────────────────
// Storyboard beat E2. The point of the frame is the relabel, so nothing else
// changes between this and A1.

export const A3PlannedFooterReadsTasks: Story = {
    name: 'A3 · Planned, footer pill reads Tasks',
    render: () => (
        <CaptureFrame>
            <InteractiveViewer
                ctx={ctxPlanned}
                docs={teamboardDocs(teamboardTasks, 'plan')}
                initialDoc="plan"
                view="document"
                extraNav={{
                    coreDocs: coreDocsFor('plan'),
                    taskCompletionPercent: 0,
                    workflowPhase: 'plan',
                    badgeText: 'PLANNED',
                }}
                vs={vsFromContext(ctxPlanned, pauseFooter('Tasks'), {
                    steps: steps('completed', 'completed', 'not-started', 'not-started'),
                })}
            />
        </CaptureFrame>
    ),
};

// ── Snapshot 2b · the tasks list, every box empty ─────────────────────────
// Storyboard beat E3.1. Six tasks, dependency ordered, none started.

export const A4TasksNoneChecked: Story = {
    name: 'A4 · Tasks, none checked',
    render: () => (
        <CaptureFrame>
            <InteractiveViewer
                ctx={ctxPlanned}
                docs={teamboardDocs(teamboardTasks, 'tasks')}
                initialDoc="tasks"
                view="document"
                extraNav={{
                    coreDocs: coreDocsFor('tasks'),
                    taskCompletionPercent: 0,
                    workflowPhase: 'tasks',
                    specStatus: 'ready-to-implement',
                    badgeText: 'READY TO IMPLEMENT',
                }}
                vs={vsFromContext(ctxPlanned, pauseFooter('Implement'), {
                    status: 'ready-to-implement',
                    activeStep: 'tasks',
                    steps: steps('completed', 'completed', 'completed', 'not-started'),
                })}
            />
        </CaptureFrame>
    ),
};

// ── Snapshot 3 · implement in flight, three of six done ───────────────────
// Storyboard beat E3.2: the live percent on the step tab is what gets the
// region box. The footer drops its forward button while a step runs, which is
// the product's own behaviour and not a fixture choice.

const implementingStepHistory = {
    ...stepHistoryFrom(ctxImplementing.history),
    implement: {
        startedAt: ctxImplementing.history.find((h) => h.step === 'implement' && h.kind === 'start')?.at,
        completedAt: null,
    },
} as ViewerState['stepHistory'];

export const A5ImplementingThreeOfSix: Story = {
    name: 'A5 · Implementing, 3 of 6 (live percent)',
    render: () => (
        <CaptureFrame>
            <InteractiveViewer
                ctx={ctxImplementing}
                docs={teamboardDocs(teamboardTasksPartial, 'tasks')}
                initialDoc="tasks"
                view="document"
                extraNav={{
                    taskCompletionPercent: 50,
                    workflowPhase: 'implement',
                    specStatus: 'implementing',
                    badgeText: 'IMPLEMENTING',
                    currentTask: 'T004',
                    stepHistory: implementingStepHistory,
                }}
                vs={vsFromContext(ctxImplementing, [], {
                    status: 'implementing',
                    pulse: 'implement',
                    steps: steps('completed', 'completed', 'completed', 'in-progress'),
                    stepHistory: implementingStepHistory,
                })}
            />
        </CaptureFrame>
    ),
};

// ── Snapshot 4 · completed, the Overview dossier ──────────────────────────
// Storyboard beats F1 and F2. Intent, expectations, decisions with their
// rejected alternatives, verified entries with the command that produced them,
// and the coverage table — including the FR-004 row with a plausible test name
// that nothing in the extension ever opens. That row is the hinge of episode 3.

export const A6CompletedOverview: Story = {
    name: 'A6 · Completed, Overview dossier',
    render: () => (
        <CaptureFrame>
            <InteractiveViewer
                ctx={ctxCompleted}
                docs={teamboardDocs(allTasksChecked, 'tasks')}
                initialDoc="spec"
                view="overview"
                extraNav={{
                    taskCompletionPercent: 100,
                    workflowPhase: 'implement',
                    badgeText: 'COMPLETED',
                }}
                vs={vsFromContext(ctxCompleted, completedFooter)}
            />
        </CaptureFrame>
    ),
};

// ── The same completed spec, on the document instead of the Overview ──────
// Used when a beat needs the finished spec.md with every step tab settled.

export const A7CompletedSpecDocument: Story = {
    name: 'A7 · Completed, spec document',
    render: () => (
        <CaptureFrame>
            <InteractiveViewer
                ctx={ctxCompleted}
                docs={teamboardDocs(allTasksChecked, 'tasks')}
                initialDoc="spec"
                view="document"
                extraNav={{
                    taskCompletionPercent: 100,
                    workflowPhase: 'implement',
                    badgeText: 'COMPLETED',
                }}
                vs={vsFromContext(ctxCompleted, completedFooter)}
            />
        </CaptureFrame>
    ),
};

// ── The Overview, parked on the coverage table ────────────────────────────
// The `coverage` clip's only shot. The dossier sections carry no ids, so the
// scroll targets the Coverage section by selector. `offset` is measured from
// the top of the capture box (the section's `offsetTop` counts the page
// header), so 183 leaves the tail of the last decision visible above the
// table and puts the first coverage row on y=317, which is where the clip's
// beat rects expect it.

export const A6bOverviewCoverage: Story = {
    name: 'A6b · Completed, Overview at Coverage',
    render: () => (
        <CaptureFrame>
            <ScrollTo selector='section[aria-label="Coverage"]' offset={183}>
                <InteractiveViewer
                    ctx={ctxCompleted}
                    docs={teamboardDocs(allTasksChecked, 'tasks')}
                    initialDoc="spec"
                    view="overview"
                    extraNav={{
                        taskCompletionPercent: 100,
                        workflowPhase: 'implement',
                        badgeText: 'COMPLETED',
                    }}
                    vs={vsFromContext(ctxCompleted, completedFooter)}
                />
            </ScrollTo>
        </CaptureFrame>
    ),
};

// ── The whole dossier in one tall image ───────────────────────────────────
// The single shot the overview-readme and overview-engine clips pan down: the
// same completed Overview as A6, with the scroll container opened out and the
// floating footer removed so nothing is cut off mid-page and nothing hovers
// over the content the camera lands on.
//
// 1224 x 2430 is the capture box both compositions measure their rects in
// (`assets/captures/rects-v2.json`, inlined as the `R` table in each
// index.html). Every one of those rects is a real element box in THIS space,
// so the height is a contract: change it and every camera move in both clips
// points at the wrong thing.

export const OVERVIEW_TALL_HEIGHT = 2430;

export const A6cOverviewWholeDossier: Story = {
    name: 'A6c · Completed, whole Overview dossier',
    parameters: { capture: { width: STAGE_WIDTH, height: OVERVIEW_TALL_HEIGHT } },
    render: () => (
        <CaptureFrame>
            <style>{TALL_DOSSIER_CSS}</style>
            <InteractiveViewer
                ctx={ctxCompleted}
                docs={teamboardDocs(allTasksChecked, 'tasks')}
                initialDoc="spec"
                view="overview"
                extraNav={{
                    taskCompletionPercent: 100,
                    workflowPhase: 'implement',
                    badgeText: 'COMPLETED',
                }}
                vs={vsFromContext(ctxCompleted, completedFooter)}
            />
        </CaptureFrame>
    ),
};

// ── The finished spec, parked on the requirements ─────────────────────────
// The `spec-viewer` clip's only shot: A7 with the reading column moved to
// Functional Requirements, which is the block its first beat names and the
// reason the TOC entry on the right reads as the active one.

export const A7bCompletedSpecRequirements: Story = {
    name: 'A7b · Completed, spec at Requirements',
    render: () => (
        <CaptureFrame>
            <ScrollTo headingId="requirements">
                <InteractiveViewer
                    ctx={ctxCompleted}
                    docs={teamboardDocs(allTasksChecked, 'tasks')}
                    initialDoc="spec"
                    view="document"
                    extraNav={{
                        taskCompletionPercent: 100,
                        workflowPhase: 'implement',
                        badgeText: 'COMPLETED',
                    }}
                    vs={vsFromContext(ctxCompleted, completedFooter)}
                />
            </ScrollTo>
        </CaptureFrame>
    ),
};
