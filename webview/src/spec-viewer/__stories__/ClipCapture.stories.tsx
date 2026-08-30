/**
 * CLIP-OWNED STATES. NOT A COMPONENT CATALOG, NOT A DOCS IMAGE SOURCE.
 * ─────────────────────────────────────────────────────────────────────────
 * Every story here is one FRAME OF A CLIP under `media/feature-clips/`. They
 * are captured into that composition's own `assets/captures/` (gitignored,
 * re-shot on demand) by `node scripts/capture-docs-images.mjs --clips`, and
 * none of them writes into `docs/screenshots/generated/`.
 *
 * WHY A SEPARATE FILE
 * `VideoCapture.stories.tsx` (A*) is the Teamboard lifecycle walk,
 * `SidebarCapture.stories.tsx` (B*) is the sidebar recreation, and
 * `ReadmeCapture.stories.tsx` (C*) is composed README art. These are none of
 * those: they are ordered STATE PAIRS for four specific clips, where what
 * matters is that two shots differ in exactly one thing so a single camera can
 * cut between them.
 *
 * THE RULE EVERY GROUP FOLLOWS
 * All shots of one clip declare the SAME `parameters.capture` size, because
 * every rect in that composition's `BEATS` is measured in the capture's own
 * CSS pixels and one size change invalidates all of them.
 *
 *   D · review                 1224 x 776   the review loop, one document
 *   E · living-specs           1564 x 992   work tree, a click, the spec open
 *   F · workflow-documents 1224 x 776   two workflow documents, Plan and Tasks
 *   G · own-workflow           1224 x 776   Create Spec, then the step rail
 *   H · inline-comments        918 x 594    one comment card, closed and open
 *
 * DETERMINISM
 * Every story is wrapped in `CaptureFrame`: frozen clock, no transitions, no
 * animations, no scrollbars. The two groups that need a click (an expanded
 * comment, an open menu) do it from a `requestAnimationFrame` chain inside the
 * story rather than from a Storybook `play()`, so the frame is settled before
 * the capture script's `document.fonts.ready` + two-frame wait ever runs.
 *
 * WHAT IS REAL AND WHAT IS FIXTURE
 * Every panel is the real product component fed fixture data, exactly like the
 * A/B/C groups: the viewer is `App` through `viewerHarness`, the review
 * comments are mounted by the product's own `restoreComments()` and rendered
 * by `InlineComment`, the Refine button is created by the product's own
 * `updateRefineButton()`, the Create Spec form is `CreateSpecMock`, and the
 * sidebar is the documented recreation (`sidebarTree.tsx`). Nothing here draws
 * a panel that the product does not draw.
 *
 * TWO DELIBERATE FIXTURE CHOICES, BOTH RECORDED FOR THE STORYBOARDS
 *  1. The Companion workflow card's shipping description is the pinned
 *     "specs 60–68% leaner" line (`workflowManager.ts` COMPANION_WORKFLOW).
 *     The claim ledger lists that number as unsourced and bans it from
 *     published material, so the G group renders the card with a cleared
 *     description instead. The product string is what needs fixing; a clip is
 *     not the place to publish it again.
 *  2. The E group's completed run carries a living-specs record renamed onto
 *     `photo-storage`, which is what the sidebar rows and the living-spec
 *     fixture call it. The on-disk completed Teamboard context records
 *     `profiles` / `media-storage` instead, and
 *     `docs/screenshots/generated/overview.png` keeps showing those. The
 *     override exists so nothing in this clip can name a capability its own
 *     tree does not list.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import type { NavState, ReviewComment, SerializedFooterAction, ViewerState } from '../types';
import {
    InteractiveViewer,
    vsFromContext,
    type DocSet,
    type SpecContextData,
} from './viewerHarness';
import { CaptureFrame, STAGE_HEIGHT, STAGE_WIDTH } from './captureFrame';
import { SidebarShell, type RowState } from './sidebarTree';
import { specsPane, livingSpecsWorkTreePane, steeringPane } from './SidebarCapture.stories';
import { teamboardDocs } from './VideoCapture.stories';
import { mockDoc, mockNavState } from '../components/__stories__/mockData';
import { DocumentContext, severalOnOneDocument } from '../components/InlineComment.stories';
import { App } from '../App';
import { navState, viewerState, markdownHtml, historyEntries } from '../signals';
import {
    renderMarkdown,
    setCurrentTask,
    setHasSpecContext,
    setLivingCoverage,
    setLivingMode,
    setTaskSummaries,
} from '../markdown';
import { applyHighlighting } from '../highlighting';
import { buildToc } from '../toc';
import { restoreComments } from '../editor/restoreComments';
import { clearAllRefinements } from '../editor/refinements';
import { CreateSpecMock, type MockWorkflowChoice } from '../../spec-editor/CreateSpecMock';
import '../../../styles/spec-editor.css';

import teamboardSpec from '../__fixtures__/teamboard/041-profile-photo-upload/spec.md?raw';
import teamboardTasks from '../__fixtures__/teamboard/041-profile-photo-upload/tasks.md?raw';
import ctxSpecifiedRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.specified.json?raw';
import ctxPlannedRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.planned.json?raw';
import ctxCompletedRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.completed.json?raw';
import photoStorageLivingSpec from '../__fixtures__/teamboard/photo-storage.spec.md?raw';

const ctxSpecified = JSON.parse(ctxSpecifiedRaw) as SpecContextData;
const ctxPlanned = JSON.parse(ctxPlannedRaw) as SpecContextData;
const ctxCompleted = JSON.parse(ctxCompletedRaw) as SpecContextData;

/** The two-button pause footer, same shape VideoCapture's snapshots use. */
const pauseFooter = (forwardLabel: string): SerializedFooterAction[] => [
    { id: 'regenerate', label: 'Regenerate', scope: 'step', tooltip: 'Re-run only the current step' },
    { id: 'approve', label: forwardLabel, scope: 'step', tooltip: 'Approve this step and continue' },
];

const meta: Meta = {
    title: 'Video Capture/Clip States',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Ordered state pairs for the feature clips under media/feature-clips/. ' +
                    'Captured into each composition\'s own assets/captures/ by ' +
                    '`node scripts/capture-docs-images.mjs --clips`; none of these is a ' +
                    'documentation image. Every shot of one clip shares one capture size, ' +
                    'because the composition measures its beat rects in that space.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

// ═════════════════════════════════════════════════════════════════════════
// D · review — the review loop on one document
// ═════════════════════════════════════════════════════════════════════════
// Five shots of the SAME frame: the Teamboard spec parked on Requirements,
// with the run paused after specify. Through D4 only the comments change; D5
// is the closing shot, where the side bar opens beside the finished review.
//
//   D1  no comments                    the resting pose the clip opens on
//   D2  two pending comments           the footer grows "Refine (2)"
//   D3  the first comment opened       Refine / Edit / Delete are reachable
//   D4  both comments applied          the Refine button is gone again
//   D5  the Specs view open beside it  where you find this spec again later
//
// What this films is exactly what the product does: Refine builds a prompt
// from the current document's PENDING comments, hands it to the AI, and marks
// those comments applied. It never reads the file back, so nothing here shows
// or implies an edited spec.
//
// The comments land on FR-003 and FR-004. FR-004 is the fixture's deliberate
// plant (no number, no condition), which makes "this cannot be verified" the
// most natural review note anyone would write on this document.

const REVIEW_COMMENTS: ReviewComment[] = [
    {
        id: 'rc-fr003',
        doc: 'spec',
        anchor: {
            heading: 'Functional Requirements',
            blockText: 'FR-003 An uploaded photo is stored as a 256 by 256 pixel square and replaces the member’s previous photo.',
            line: 31,
        },
        comment: 'Say what happens to the original file after the square is stored.',
        status: 'pending',
        createdAt: '2026-05-19T13:04:00.000Z',
    },
    {
        id: 'rc-fr004',
        doc: 'spec',
        anchor: {
            heading: 'Functional Requirements',
            blockText: 'FR-004 The upload experience should feel fast and reassuring on mobile.',
            line: 32,
        },
        comment: 'No number here. Say how fast, and on what connection.',
        status: 'pending',
        createdAt: '2026-05-19T13:05:00.000Z',
    },
];

const appliedComments: ReviewComment[] = REVIEW_COMMENTS.map((c) => ({ ...c, status: 'applied' }));

/**
 * Runs the product's own restore pass over the freshly rendered document, then
 * optionally opens one card and parks the reading column on a heading.
 *
 * Ordering matters and is why this is a rAF chain rather than three effects:
 * comments change the height of every line below them, so the scroll has to
 * happen after they mount and after any card has opened. `FullViewer` already
 * schedules its highlight/TOC pass on the first frame; this component's effect
 * runs after its children's, so its first frame lands after that one.
 */
function ReviewLayer({
    comments,
    expandId,
    headingId,
    offset = 28,
    children,
}: {
    comments: ReviewComment[];
    /** `data-ref-id` of the card to open, or omit to leave every card closed. */
    expandId?: string;
    headingId?: string;
    offset?: number;
    children: ComponentChildren;
}) {
    useEffect(() => {
        let f2 = 0;
        let f3 = 0;
        const f1 = requestAnimationFrame(() => {
            restoreComments();
            f2 = requestAnimationFrame(() => {
                if (expandId) {
                    document
                        .querySelector<HTMLButtonElement>(`[data-ref-id="${expandId}"] .comment-disclosure`)
                        ?.click();
                }
                f3 = requestAnimationFrame(() => {
                    const area = document.getElementById('content-area');
                    const target = headingId ? document.getElementById(headingId) : null;
                    if (area && target) area.scrollTop = Math.max(0, target.offsetTop - offset);
                });
            });
        });
        return () => {
            cancelAnimationFrame(f1);
            cancelAnimationFrame(f2);
            cancelAnimationFrame(f3);
            // The refinement module keeps mounted cards in module scope; a
            // story that left them behind would leak into the next one.
            clearAllRefinements();
        };
    }, [comments, expandId, headingId, offset]);
    return <>{children}</>;
}

const REVIEW_SIDEBAR = 340;

/**
 * The closing shot's sidebar column, and the reason it holds only TWO panes.
 *
 * Specs and Steering are the pair a fresh install with just the VS Code
 * extension actually puts in the activity bar: `contributes.views` gates
 * Living Specs behind `speckit.companion.installed` and ships Settings &
 * Feedback hidden. B4 in SidebarCapture.stories.tsx films all three sections
 * because it is the establishing shot of the whole sidebar; this one is the
 * end of a review, so it shows what the reader would have, not the maximum.
 *
 * Both panes are the same recreation (`sidebarTree.tsx`) and the same fixture
 * rows B1 to B4 use, and no row is invented for this shot. Specs carries the
 * lifecycle groups with their live counts and the feature the clip has been
 * commenting on, expanded onto its documents; Steering carries the SpecKit
 * project files, and it is the last pane so it takes the leftover height.
 */
function ReviewSidebar() {
    return (
        <div
            id="clip-sidebar"
            data-panel="sidebar"
            style={`width: ${REVIEW_SIDEBAR}px; flex-shrink: 0; border-right: 1px solid var(--vscode-editorWidget-border); background: var(--vscode-sideBar-background); overflow: hidden;`}
        >
            <SidebarShell panes={[specsPane(true, false), steeringPane(true)]} />
        </div>
    );
}

/**
 * The spec document, paused after specify, with whatever comments are passed.
 * `sidebar` opens the Specs view beside it, which narrows the reading column
 * exactly the way opening the side bar narrows it in the editor.
 */
function ReviewShot({
    comments,
    expandId,
    sidebar = false,
}: {
    comments: ReviewComment[];
    expandId?: string;
    sidebar?: boolean;
}) {
    const viewer = (
        <InteractiveViewer
            ctx={ctxSpecified}
            docs={teamboardDocs(teamboardTasks, 'specify')}
            initialDoc="spec"
            view="document"
            extraNav={{
                coreDocs: [
                    mockDoc('spec', true, 'Specification'),
                    mockDoc('plan', false, 'Plan'),
                    mockDoc('tasks', false, 'Tasks'),
                ],
                taskCompletionPercent: 0,
                workflowPhase: 'specify',
                badgeText: 'SPECIFIED',
            }}
            vs={vsFromContext(ctxSpecified, pauseFooter('Plan'), {
                steps: {
                    specify: 'completed',
                    plan: 'not-started',
                    tasks: 'not-started',
                    implement: 'not-started',
                } as ViewerState['steps'],
                reviewComments: comments,
            })}
        />
    );
    return (
        <CaptureFrame>
            <ReviewLayer comments={comments} expandId={expandId} headingId="requirements">
                {sidebar ? (
                    <div style="display: flex; width: 100%; height: 100%; background: var(--vscode-editor-background);">
                        <ReviewSidebar />
                        <div
                            id="clip-viewer"
                            data-panel="viewer"
                            style="flex: 1; min-width: 0; overflow: hidden;"
                        >
                            {viewer}
                        </div>
                    </div>
                ) : (
                    viewer
                )}
            </ReviewLayer>
        </CaptureFrame>
    );
}

export const D1NoComments: Story = {
    name: 'D1 · review: document, no comments',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => <ReviewShot comments={[]} />,
};

export const D2Pending: Story = {
    name: 'D2 · review: two comments pending',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => <ReviewShot comments={REVIEW_COMMENTS} />,
};

export const D3Opened: Story = {
    name: 'D3 · review: one comment opened',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => <ReviewShot comments={REVIEW_COMMENTS} expandId="rc-fr004" />,
};

export const D4Applied: Story = {
    name: 'D4 · review: both comments applied',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => <ReviewShot comments={appliedComments} />,
};

/**
 * D5 · the closing shot. Same document, same applied comments, with the Specs
 * view open beside it: the answer to "where do I find this again". It shares
 * D1 to D4's capture size, so the dissolve into it is one camera at rest and
 * the only change on screen is the side bar opening and the reading column
 * narrowing to make room for it.
 */
export const D5Sidebar: Story = {
    name: 'D5 · review: the spec back in the sidebar',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => <ReviewShot comments={appliedComments} sidebar />,
};

// ═════════════════════════════════════════════════════════════════════════
// E · living-specs — open a living spec from the work tree
// ═════════════════════════════════════════════════════════════════════════
// One window, three shots, filmed as one gesture: read the tree, click a row,
// land in the spec. The sidebar column is the SAME tree in all three, so the
// only things that ever change are one row's wash and the pane beside it.
//
//   E1  the tree at rest, beside the feature run that just finished
//   E2  the pointer resting on the photo-storage row (list.hoverBackground)
//   E3  that capability open in the viewer's real living mode, its row left
//       selected the way the list leaves it once focus moves to the editor
//
// The tree is `livingSpecsWorkTreePane`, the deep fixture in
// SidebarCapture.stories.tsx: eight capabilities, three of them centralized at
// `capabilities/<name>/spec.md` and five colocated in `src/`, grouped exactly
// the way `buildCapabilityTree` groups them. Depth is the point — the
// centralized-versus-colocated split is only legible once there is a directory
// tree to see it in.
//
// Deliberately NOT filmed: the Architecture and Coverage tiers. The resolver
// recognizes `.arch.md` / `.coverage.md` siblings but nothing generates them,
// and this repo's own registered capabilities have none. A capability with only
// a spec on disk is a leaf row and shows only its spec, which is what E3 shows.

const LIVING_WIDTH = 1564;
const LIVING_HEIGHT = 992;
const LIVING_SIDEBAR = 340;

const livingRequirementCount = (photoStorageLivingSpec.match(/^###\s+/gm) ?? []).length;
const livingScenarioCount = (photoStorageLivingSpec.match(/^####\s+Scenario:/gm) ?? []).length;

/**
 * The sidebar column. Identical across E1, E2 and E3 except for `emphasis`,
 * which is the one row the list is doing something to.
 */
function LivingSidebar({ emphasis }: { emphasis?: { row: string; state: RowState } }) {
    return (
        <div
            id="clip-sidebar"
            data-panel="sidebar"
            style={`width: ${LIVING_SIDEBAR}px; flex-shrink: 0; border-right: 1px solid var(--vscode-editorWidget-border); background: var(--vscode-sideBar-background); overflow: hidden;`}
        >
            <SidebarShell
                panes={[
                    { ...specsPane(false), collapsed: true },
                    livingSpecsWorkTreePane(emphasis, true),
                    { ...steeringPane(), collapsed: true },
                ]}
            />
        </div>
    );
}

function LivingWindow({
    emphasis,
    children,
}: {
    emphasis?: { row: string; state: RowState };
    children: ComponentChildren;
}) {
    return (
        <div style="display: flex; width: 100%; height: 100%; background: var(--vscode-editor-background);">
            <LivingSidebar emphasis={emphasis} />
            <div id="clip-viewer" data-panel="viewer" style="flex: 1; min-width: 0; overflow: hidden;">
                {children}
            </div>
        </div>
    );
}

/** The row the clip clicks, in the deep tree's id space. */
const CLICKED_ROW = 'lw-photo-storage';

/**
 * The real App in living mode on the photo-storage fixture — the same
 * signals-in path `index.tsx` uses, and the same one C3 in
 * ReadmeCapture.stories.tsx uses, minus the tier tabs (see the group note).
 */
function LivingCapabilityViewer() {
    setLivingMode(true);
    setLivingCoverage(null);
    setHasSpecContext(true);
    setCurrentTask(null);
    setTaskSummaries(null);
    viewerState.value = null;
    historyEntries.value = [];
    navState.value = mockNavState({
        coreDocs: [mockDoc('spec', true, 'Spec')],
        relatedDocs: [],
        currentDoc: 'spec',
        workflowPhase: 'spec',
        isViewingRelatedDoc: false,
        specStatus: 'active',
        badgeText: 'LIVING',
        createdDate: null,
        specContextName: 'Photo Storage',
        titleFromHeading: true,
        branch: null,
        filePath: 'capabilities/photo-storage/spec.md',
        docTypeLabel: 'Spec',
        activityPanelEnabled: false,
        livingMode: true,
        livingMeta: {
            capabilityName: 'photo-storage',
            specPath: 'capabilities/photo-storage/spec.md',
            location: 'central',
            match: [
                'src/services/photoStorage/**',
                'src/api/photos/**',
                'src/components/PhotoUploader/**',
                'src/jobs/thumbnailQueue/**',
            ],
            requirements: livingRequirementCount,
            scenarios: livingScenarioCount,
            coverage: { covered: livingRequirementCount - 2, total: livingRequirementCount },
            drifted: true,
        },
    } as Partial<NavState>);
    markdownHtml.value = renderMarkdown(photoStorageLivingSpec);

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            applyHighlighting();
            buildToc(
                document.getElementById('content-area'),
                document.getElementById('markdown-content'),
                document.getElementById('spec-toc'),
            );
        });
        return () => {
            cancelAnimationFrame(id);
            setLivingMode(false);
            setLivingCoverage(null);
        };
    }, []);

    return (
        <div class="viewer-container">
            <App specStatus="active" />
        </div>
    );
}

/**
 * The completed run, with its living-specs record renamed onto the capability
 * the rest of this clip is about. See the file header for why the override
 * exists and what the on-disk fixture says instead. It is what sits in the
 * editor before anyone touches the tree, which is why E1 opens on it.
 */
const vsCompletedFolded = (view: Partial<ViewerState> = {}): ViewerState =>
    vsFromContext(ctxCompleted, [], {
        livingSpecs: { loaded: ['member-profiles', 'photo-storage'], synced: ['photo-storage'] },
        ...view,
    });

const completedNav = {
    taskCompletionPercent: 100,
    workflowPhase: 'implement',
    badgeText: 'COMPLETED',
};

const finishedRun = (
    <InteractiveViewer
        ctx={ctxCompleted}
        docs={teamboardDocs(teamboardTasks, 'tasks')}
        initialDoc="spec"
        view="document"
        extraNav={completedNav}
        vs={vsCompletedFolded()}
    />
);

export const E1WorkTree: Story = {
    name: 'E1 · living-specs: the work tree at rest',
    parameters: { capture: { width: LIVING_WIDTH, height: LIVING_HEIGHT } },
    render: () => (
        <CaptureFrame>
            <LivingWindow>{finishedRun}</LivingWindow>
        </CaptureFrame>
    ),
};

export const E2RowClicked: Story = {
    name: 'E2 · living-specs: the pointer on a capability row',
    parameters: { capture: { width: LIVING_WIDTH, height: LIVING_HEIGHT } },
    render: () => (
        <CaptureFrame>
            <LivingWindow emphasis={{ row: CLICKED_ROW, state: 'hover' }}>{finishedRun}</LivingWindow>
        </CaptureFrame>
    ),
};

export const E3CapabilityOpen: Story = {
    name: 'E3 · living-specs: the living spec open',
    parameters: { capture: { width: LIVING_WIDTH, height: LIVING_HEIGHT } },
    render: () => (
        <CaptureFrame>
            <LivingWindow emphasis={{ row: CLICKED_ROW, state: 'selected' }}>
                <LivingCapabilityViewer />
            </LivingWindow>
        </CaptureFrame>
    ),
};

// ═════════════════════════════════════════════════════════════════════════
// F · workflow-documents. Written to shoot where a custom command actually shows
// up, which is the footer's collapsed Other actions menu and never a toolbar. The
// footer sits outside the declared capture box, so these three shoot the document
// body only. Fixing that means growing the box to include the footer AND making
// the F2 click land; today F1 and F2 produce byte-identical files.
// ═════════════════════════════════════════════════════════════════════════
// The "Run SpecKit Custom Command" quick pick is `vscode.window.showQuickPick`
// (specCommands.ts registerCustomCommand). That is native VS Code chrome with
// no webview and no DOM this catalog can mount, so it CANNOT be captured, and
// nothing here draws a fake one.
//
// What is capturable is the other surface the same setting feeds: the viewer
// footer's "Other actions" menu, built from `speckit.customCommands` by
// `optionalCommands.ts customCommandButtons` and rendered by CatalogFooter.
// Three shots:
//
//   F1  the menu closed, on the plan document
//   F2  the menu open on the plan document — the two `step: all` commands
//   F3  the menu open on the tasks document — the tasks-scoped one joins them
//
// F2 → F3 is what makes the scoping visible: a command declares which phase it
// belongs to, and the menu only offers the ones that match.

/** Straight out of `speckit.customCommands`, in the object form. */
const CUSTOM_COMMAND_BUTTONS = [
    {
        label: 'Security review',
        command: '/speckit.security-review ${specDir}',
        icon: '⚡',
        tooltip: 'Read this spec against the security checklist',
    },
    {
        label: 'Estimate',
        command: '/speckit.estimate ${specDir}',
        icon: '⚡',
        tooltip: 'Size the work before the tasks are cut',
    },
];

const TASKS_SCOPED_BUTTON = {
    label: 'Split the tasks',
    command: '/speckit.split-tasks ${specDir}',
    icon: '⚡',
    tooltip: 'Break any task over a day into smaller ones',
};

/** Opens the footer menu after the viewer has settled. */
function OpenOtherActions({ open, children }: { open: boolean; children: ComponentChildren }) {
    useEffect(() => {
        if (!open) return undefined;
        let f2 = 0;
        const f1 = requestAnimationFrame(() => {
            f2 = requestAnimationFrame(() => {
                const buttons = Array.from(
                    document.querySelectorAll<HTMLButtonElement>('.actions-left button'),
                );
                buttons.find((b) => b.textContent?.trim() === 'Other actions')?.click();
            });
        });
        return () => {
            cancelAnimationFrame(f1);
            cancelAnimationFrame(f2);
        };
    }, [open]);
    return <>{children}</>;
}

function CustomCommandShot({
    doc,
    buttons,
    open,
}: {
    doc: 'plan' | 'tasks';
    buttons: typeof CUSTOM_COMMAND_BUTTONS;
    open: boolean;
}) {
    return (
        <CaptureFrame>
            <OpenOtherActions open={open}>
                <InteractiveViewer
                    ctx={ctxPlanned}
                    docs={teamboardDocs(teamboardTasks, 'tasks')}
                    initialDoc={doc}
                    view="document"
                    extraNav={{
                        coreDocs: [
                            mockDoc('spec', true, 'Specification'),
                            mockDoc('plan', true, 'Plan'),
                            mockDoc('tasks', true, 'Tasks'),
                        ],
                        taskCompletionPercent: 0,
                        workflowPhase: doc === 'tasks' ? 'tasks' : 'plan',
                        specStatus: 'ready-to-implement',
                        badgeText: 'READY TO IMPLEMENT',
                        enhancementButtons: buttons,
                    }}
                    vs={vsFromContext(ctxPlanned, pauseFooter('Implement'), {
                        status: 'ready-to-implement',
                        activeStep: 'tasks',
                        steps: {
                            specify: 'completed',
                            plan: 'completed',
                            tasks: 'completed',
                            implement: 'not-started',
                        } as ViewerState['steps'],
                    })}
                />
            </OpenOtherActions>
        </CaptureFrame>
    );
}

export const F1MenuClosed: Story = {
    name: 'F1 · custom commands: menu closed',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => <CustomCommandShot doc="plan" buttons={CUSTOM_COMMAND_BUTTONS} open={false} />,
};

export const F2MenuOpen: Story = {
    name: 'F2 · custom commands: menu open on Plan',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => <CustomCommandShot doc="plan" buttons={CUSTOM_COMMAND_BUTTONS} open />,
};

export const F3MenuOpenTasks: Story = {
    name: 'F3 · custom commands: menu open on Tasks',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => (
        <CustomCommandShot
            doc="tasks"
            buttons={[...CUSTOM_COMMAND_BUTTONS, TASKS_SCOPED_BUTTON]}
            open
        />
    ),
};

// ═════════════════════════════════════════════════════════════════════════
// G · own-workflow — a workflow you defined, offered and then recorded
// ═════════════════════════════════════════════════════════════════════════
//   G1  Create New Spec listing three workflows, SpecKit pre-selected
//   G2  the same form with the custom workflow picked
//   G3  the spec that pick produced, its step rail built from that workflow
//
// The three cards are what `buildWorkflowChoices` produces: every workflow
// with its description, the two built-ins plus whatever `speckit.customWorkflows`
// declares. "Discuss First" is the custom one, carried over verbatim from the
// existing SpecEditor/CreateSpec MultiWorkflowChoice story so the catalog and
// the clip describe the same fixture.
//
// The Companion card's description is NOT the shipping string. See the file
// header: the shipping one carries a benchmark number the claim ledger bans.

const CLIP_WORKFLOWS: MockWorkflowChoice[] = [
    {
        name: 'speckit',
        displayName: 'SpecKit',
        description: 'Standard SpecKit workflow',
        installed: true,
    },
    {
        name: 'companion',
        displayName: 'SpecKit Companion',
        description: 'Adds a terminal step that marks the spec complete',
        installed: true,
    },
    {
        name: 'discuss-first',
        displayName: 'Discuss First',
        description: 'Talk the shape through before any document is written.',
        installed: true,
    },
];

const BRIEF = 'Let members upload their own profile photo, replacing the grey placeholder.';

export const G1WorkflowChoice: Story = {
    name: 'G1 · own workflow: three workflows offered',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => (
        <CaptureFrame>
            <CreateSpecMock
                initialContent={BRIEF}
                showAuto={false}
                workflows={CLIP_WORKFLOWS}
                selectedWorkflow="speckit"
            />
        </CaptureFrame>
    ),
};

export const G2CustomPicked: Story = {
    name: 'G2 · own workflow: the custom one picked',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => (
        <CaptureFrame>
            <CreateSpecMock
                initialContent={BRIEF}
                showAuto={false}
                workflows={CLIP_WORKFLOWS}
                selectedWorkflow="discuss-first"
            />
        </CaptureFrame>
    ),
};

/**
 * The rail the pick produced. `coreDocs` is what the extension sends after
 * resolving the recorded workflow's steps, so a workflow with a Discussion
 * phase ahead of Specification renders a rail that starts with Discussion.
 */
const discussFirstDocs: DocSet = {
    spec: { md: teamboardSpec, label: 'Specification' },
};

export const G3StepRail: Story = {
    name: 'G3 · own workflow: the rail it built',
    parameters: { capture: { width: STAGE_WIDTH, height: STAGE_HEIGHT } },
    render: () => (
        <CaptureFrame>
            <InteractiveViewer
                ctx={ctxSpecified}
                docs={discussFirstDocs}
                initialDoc="spec"
                view="document"
                extraNav={{
                    coreDocs: [
                        mockDoc('discussion', true, 'Discussion'),
                        mockDoc('spec', true, 'Specification'),
                        mockDoc('plan', false, 'Plan'),
                        mockDoc('tasks', false, 'Tasks'),
                    ],
                    taskCompletionPercent: 0,
                    workflowPhase: 'specify',
                    badgeText: 'SPECIFIED',
                }}
                vs={vsFromContext(ctxSpecified, pauseFooter('Plan'), {
                    steps: {
                        discussion: 'completed',
                        specify: 'completed',
                        plan: 'not-started',
                        tasks: 'not-started',
                    } as ViewerState['steps'],
                })}
            />
        </CaptureFrame>
    ),
};

// ═════════════════════════════════════════════════════════════════════════
// H · inline-comments — one card, closed and open
// ═════════════════════════════════════════════════════════════════════════
// Two shots of the same five annotated lines, differing in exactly one thing:
// whether the first comment is open. The clip hard-cuts between them under a
// stationary marker, so the document must not move at all.
//
//   H1  every card collapsed        two PENDING, one APPLIED
//   H2  the first card open         its body, and Refine / Edit / Delete
//
// The lines and the three comments are `Viewer/InlineComment`'s own
// `Several on one document`, imported rather than copied so the clip and the
// README still show the same document.
//
// FRAME GEOMETRY IS A CONTRACT
// 918 x 594 with the 590-wide card centred and parked 32px down. The card's
// width is the viewer's reading-column width, and 590 centred in 918 puts its
// left edge on x=164, which is where the composition's REST framing and all
// three beat rects are measured from. Change any of the three numbers and
// every camera move in the clip points somewhere else.

const IC_WIDTH = 918;
const IC_HEIGHT = 594;
const IC_CARD_WIDTH = 590;
const IC_CARD_TOP = 32;

/**
 * The annotated document on the capture ground, with an optional click on the
 * first comment's disclosure. The click runs from a `requestAnimationFrame`
 * chain rather than a `play()` so the card is already open on the frame the
 * capture script settles and screenshots.
 */
function InlineCommentShot({ expandFirst = false }: { expandFirst?: boolean }) {
    useEffect(() => {
        if (!expandFirst) return;
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => {
                document
                    .querySelector<HTMLButtonElement>('.comment-disclosure')
                    ?.click();
            });
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [expandFirst]);
    return (
        <CaptureFrame>
            <div
                style={`width: 100%; height: 100%; display: flex; justify-content: center; align-items: flex-start; padding-top: ${IC_CARD_TOP}px; box-sizing: border-box; background: var(--vscode-editor-background);`}
            >
                <div style={`width: ${IC_CARD_WIDTH}px;`}>
                    <DocumentContext>{severalOnOneDocument()}</DocumentContext>
                </div>
            </div>
        </CaptureFrame>
    );
}

export const H1CommentsCollapsed: Story = {
    name: 'H1 · inline comments: every card collapsed',
    parameters: { capture: { width: IC_WIDTH, height: IC_HEIGHT } },
    render: () => <InlineCommentShot />,
};

export const H2CommentExpanded: Story = {
    name: 'H2 · inline comments: the first card open',
    parameters: { capture: { width: IC_WIDTH, height: IC_HEIGHT } },
    render: () => <InlineCommentShot expandFirst />,
};
