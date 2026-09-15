/**
 * ARTICLE FIGURES. NOT A COMPONENT CATALOG.
 * ─────────────────────────────────────────────────────────────────────────
 * A figure is a product screenshot that lives in an article: the real product
 * surface inside one fixed frame that names the screen, carries the site's
 * wordmark, makes its point in a caption, and may outline one or two regions.
 * Captured by `scripts/capture-docs-images.mjs --only figure-` into
 * `docs/screenshots/generated/figure-*.png`.
 *
 * The frame is the figure style guide as code (vault: Projects/speckit
 * companion/marketing/Figure style guide.md). It shows the product, so its
 * chrome is the site's: Constellation tokens (website/src/styles/tokens.css)
 * and the chevron wordmark (website/src/components/LogoMark.astro). It is read
 * on the blog, so its text is Geist, the blog's reading face.
 *
 * Figures are ALWAYS shot in the violet palette, whatever `activeCapturePalette`
 * says: the frame is dark by definition and a light capture inside it would be
 * a white block on a black card. The capture script opens each figure entry
 * with the preview's `violet` theme (`theme: 'violet'` on the entry), the same
 * switch the Storybook toolbar offers, so nothing else in the set changes.
 *
 * Outlines are measured, never eyeballed: each mark names a selector inside the
 * shot, and the box is drawn from getBoundingClientRect after layout. Green
 * means "this is where it is", violet means "this is the point", one violet
 * per figure at most.
 *
 * Every figure here uses the same fixture spec (041 Profile photo upload), so a
 * reader moving through an article is never decoding a new feature between
 * sections.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import { CaptureFrame } from './captureFrame';
import { InteractiveViewer, vsFromContext, type SpecContextData } from './viewerHarness';
import { SidebarShell } from './sidebarTree';
import { specsPane, livingSpecsPane, steeringPane } from './SidebarCapture.stories';
import {
    ctxPlanning,
    ctxSpecified,
    coreDocsFor,
    pauseFooter,
    planningStepHistory,
    PLANNING_AT,
    ScrollTo,
    steps,
    teamboardDocs,
} from './VideoCapture.stories';
import { LivingViewerPanel } from './ReadmeCapture.stories';
import { viewerMode } from '../signals';
import { useEffect } from 'preact/hooks';
import {
    CoverageSection,
    DecisionsSection,
    ExpectationsSection,
    IntentSection,
    VerifiedSection,
} from '../components/OverviewDossier';
import { severalOnOneDocumentWithComposer } from '../components/InlineComment.stories';
import { TheBoard } from '../../pipeline-builder/__stories__/Guide.stories';


import teamboardTasks from '../__fixtures__/teamboard/041-profile-photo-upload/tasks.md?raw';
import ctxCompletedRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.completed.json?raw';

const meta: Meta = {
    title: 'Video Capture/Figures',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Article figures: one product surface inside the fixed figure frame. ' +
                    'Captured by scripts/capture-docs-images.mjs --only figure-.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

import { B, Figure, T } from './figure';

// ── Sizes. Width is the article column at 2x; height follows the surface. ──
const WIDE = { width: 1600, height: 900 };
const DOSSIER_INTENT = { width: 1240, height: 640 };
const DOSSIER_FENCE = { width: 1240, height: 520 };
const DOSSIER_VERIFIED = { width: 1240, height: 720 };
const DOSSIER_DECISIONS = { width: 1240, height: 760 };
const DOSSIER_COVERAGE = { width: 1240, height: 560 };
const PORTRAIT = { width: 900, height: 980 };

// ── The completed run every Overview figure is cut from. ──────────────────
const ctxCompleted = JSON.parse(ctxCompletedRaw) as SpecContextData;
const vsCompleted = vsFromContext(ctxCompleted, []);

const DOSSIER_CSS = `
    .capture-stage .activity-panel { padding: 18px 30px; gap: 12px; max-width: none; }
`;

function Dossier({ children }: { children: ComponentChildren }) {
    return (
        <>
            <style>{DOSSIER_CSS}</style>
            <div class="activity-panel dossier" style="height: 100%; overflow: hidden;">
                {children}
            </div>
        </>
    );
}

// ── The Overview, one figure per part ─────────────────────────────────────

export const F1OverviewIntent: Story = {
    name: 'F1 · Overview: intent and the run',
    parameters: { capture: DOSSIER_INTENT },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: why the spec exists"
                caption={
                    <>
                        The reason in one sentence, then <B>how long each phase took</B>, then which living specs the run folded back into.
                    </>
                }
                marks={[
                    { selector: '.dossier-timing', kind: 'here', label: 'four phases, timed' },
                ]}
            >
                <Dossier>
                    <IntentSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

export const F2OverviewExpectations: Story = {
    name: 'F2 · Overview: the fence',
    parameters: { capture: DOSSIER_FENCE },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: the fence around the work"
                caption={
                    <>
                        What must stay true, and <B>what was deliberately left out</B>. The second list is the one that saves arguments later.
                    </>
                }
            >
                <Dossier>
                    <ExpectationsSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

export const F3OverviewVerified: Story = {
    name: 'F3 · Overview: what was checked',
    parameters: { capture: DOSSIER_VERIFIED },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: what was checked"
                caption={
                    <>
                        Not "tests pass" as a sentence. <B>Five rows, each with the command that ran and what came back.</B>
                    </>
                }
            >
                <Dossier>
                    <VerifiedSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

export const F4OverviewDecisions: Story = {
    name: 'F4 · Overview: decisions',
    parameters: { capture: DOSSIER_DECISIONS },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: decisions"
                caption={
                    <>
                        Each decision carries its reason and <B>the alternative it rejected</B>, so nobody proposes the rejected option as if it were new.
                    </>
                }
            >
                <Dossier>
                    <DecisionsSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

export const F5OverviewCoverage: Story = {
    name: 'F5 · Overview: coverage',
    parameters: { capture: DOSSIER_COVERAGE },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Overview: requirement to task to test"
                caption={
                    <>
                        One row per requirement: the tasks that delivered it and the tests that cover it. <B>A requirement with no test shows up as a gap.</B>
                    </>
                }
            >
                <Dossier>
                    <CoverageSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

// ── The spec mid-run, and the spec as rows ────────────────────────────────

export const F6MidRun: Story = {
    name: 'F6 · Mid-run: plan in flight',
    parameters: { capture: WIDE },
    render: () => (
        <CaptureFrame at={PLANNING_AT}>
            <Figure
                title="The same spec while the run is going"
                caption={
                    <>
                        Two phases in. <B>The pipeline on the left ticks each document as it lands</B>; the header counts the phases timed so far.
                    </>
                }
                marks={[{ selector: '.doc-rail', kind: 'here', label: 'the pipeline', pad: 4 }]}
            >
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
            </Figure>
        </CaptureFrame>
    ),
};

export const F7ViewerRows: Story = {
    name: 'F7 · The spec as rows',
    parameters: { capture: WIDE },
    render: () => (
        <CaptureFrame>
            <Figure
                title="The specification, rendered"
                caption={
                    <>
                        <B>Each requirement is a labeled row</B>, the section list on the right, the pipeline on the left.
                    </>
                }
            >
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
            </Figure>
        </CaptureFrame>
    ),
};

// ── Inline review ─────────────────────────────────────────────────────────

const IC_CARD_WIDTH = 590;
const IC_ZOOM = 1.7;

export const F8InlineReview: Story = {
    name: 'F8 · Inline review',
    parameters: { capture: WIDE },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Inline review comments"
                caption={
                    <>
                        Each comment sits under the line it is about. <B>One pending, one applied, a third being written.</B>
                    </>
                }
                shotPadding="26px 34px"
            >
                <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                    <div style={`zoom: ${IC_ZOOM};`}>
                        <div id="markdown-content" style={`width: ${IC_CARD_WIDTH}px;`}>
                            {severalOnOneDocumentWithComposer()}
                        </div>
                    </div>
                </div>
            </Figure>
        </CaptureFrame>
    ),
};

// ── The sidebar, and the living specs view ────────────────────────────────

export const F9Sidebar: Story = {
    name: 'F9 · The sidebar',
    parameters: { capture: PORTRAIT },
    render: () => (
        <CaptureFrame>
            <Figure
                title="The Specs sidebar"
                caption={
                    <>
                        Grouped by lifecycle, <B>each document with its own state</B>: done, still being written, not created yet.
                    </>
                }
            >
                <div style="height: 100%; overflow: hidden;">
                    <SidebarShell panes={[specsPane(true, false), livingSpecsPane(), steeringPane(true)]} />
                </div>
            </Figure>
        </CaptureFrame>
    ),
};

export const F10LivingSpecs: Story = {
    name: 'F10 · Living specs',
    parameters: { capture: WIDE },
    render: () => (
        <CaptureFrame>
            <Figure
                title="Living Specs"
                caption={
                    <>
                        Coverage per capability in the tree, and one capability open with <B>a requirement flagged as drifted</B>.
                    </>
                }
            >
                <div style="display: flex; height: 100%;">
                    <div style={`width: 360px; flex-shrink: 0; border-right: 1px solid ${T.borderPanel}; overflow: hidden;`}>
                        <SidebarShell
                            panes={[
                                { ...specsPane(false), collapsed: true },
                                livingSpecsPane(true),
                                { ...steeringPane(), collapsed: true },
                            ]}
                        />
                    </div>
                    <div style="flex: 1; min-width: 0; position: relative; overflow: hidden;">
                        <ScrollTo headingId="requirements" offset={186}>
                            <LivingSpecBody />
                        </ScrollTo>
                    </div>
                </div>
            </Figure>
        </CaptureFrame>
    ),
};

/** The living viewer lands on its Overview tab; the figure wants the spec body. */
function LivingSpecBody() {
    useEffect(() => {
        viewerMode.value = 'document';
        return () => {
            viewerMode.value = null;
        };
    }, []);
    return <LivingViewerPanel />;
}

// ── The Pipeline Builder ──────────────────────────────────────────────────

export const F11Builder: Story = {
    name: 'F11 · The Pipeline Builder',
    parameters: { capture: { width: 1600, height: 1040 } },
    render: () => (
        <CaptureFrame>
            <Figure
                title="The Pipeline Builder"
                caption={
                    <>
                        Four steps as columns. <B>The hooks under before and after, marked as this project's own</B>, are the customization.
                    </>
                }
            >
                <div style="height: 100%; overflow: hidden;">{(TheBoard.render as () => ComponentChildren)()}</div>
            </Figure>
        </CaptureFrame>
    ),
};
