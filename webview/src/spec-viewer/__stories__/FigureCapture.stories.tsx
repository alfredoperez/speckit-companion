/**
 * ARTICLE FIGURES. NOT A COMPONENT CATALOG.
 * ─────────────────────────────────────────────────────────────────────────
 * A figure is a product screenshot that lives in an article: one region of the
 * real product inside the compact frame (window bar, strong edge, the site's
 * wordmark bottom right), with outlines where a region needs pointing at. The
 * caption is NOT baked in: it is text under the image in the article, so it
 * stays readable on a phone when the image does not. Figures are 800 wide
 * where the surface allows; the wide ones are illustrations on a phone.
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
    title: 'Content/Article Figures',
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

import { Figure, T } from './figure';

// ── The completed run every Overview figure is cut from. ──────────────────
const ctxCompleted = JSON.parse(ctxCompletedRaw) as SpecContextData;
const vsCompleted = vsFromContext(ctxCompleted, []);

const DOSSIER_CSS = `
    .capture-stage .activity-panel { padding: 14px 22px; gap: 10px; max-width: none; }
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

const OVERVIEW = 'Spec Viewer · Overview';

// ── The Overview, one figure per part ─────────────────────────────────────

export const F1OverviewIntent: Story = {
    name: 'F1 · Overview: intent and the run',
    parameters: { capture: { width: 800, height: 800 } },
    render: () => (
        <CaptureFrame>
            <Figure compact zoom={1.12} windowName={OVERVIEW} marks={[{ selector: '.dossier-timing', kind: 'here', label: 'four phases, timed' }]}>
                <Dossier>
                    <IntentSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

export const F2OverviewExpectations: Story = {
    name: 'F2 · Overview: the fence',
    parameters: { capture: { width: 800, height: 620 } },
    render: () => (
        <CaptureFrame>
            <Figure compact zoom={1.15} windowName={OVERVIEW}>
                <Dossier>
                    <ExpectationsSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

export const F3OverviewVerified: Story = {
    name: 'F3 · Overview: what was checked',
    parameters: { capture: { width: 800, height: 740 } },
    render: () => (
        <CaptureFrame>
            <Figure compact zoom={1.1} windowName={OVERVIEW}>
                <Dossier>
                    <VerifiedSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

export const F4OverviewDecisions: Story = {
    name: 'F4 · Overview: decisions',
    parameters: { capture: { width: 800, height: 700 } },
    render: () => (
        <CaptureFrame>
            <Figure compact zoom={1.1} windowName={OVERVIEW}>
                <Dossier>
                    <DecisionsSection state={vsCompleted} />
                </Dossier>
            </Figure>
        </CaptureFrame>
    ),
};

export const F5OverviewCoverage: Story = {
    name: 'F5 · Overview: coverage',
    parameters: { capture: { width: 800, height: 580 } },
    render: () => (
        <CaptureFrame>
            <Figure compact zoom={1.1} windowName={OVERVIEW}>
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
    parameters: { capture: { width: 900, height: 760 } },
    render: () => (
        <CaptureFrame at={PLANNING_AT}>
            <Figure compact windowName="Spec Viewer · Plan, running" marks={[{ selector: '.doc-rail', kind: 'here', label: 'the pipeline', pad: 4 }]}>
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
    parameters: { capture: { width: 900, height: 760 } },
    render: () => (
        <CaptureFrame>
            <Figure compact windowName="Spec Viewer · Specification">
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

export const F8InlineReview: Story = {
    name: 'F8 · Inline review',
    parameters: { capture: { width: 800, height: 640 } },
    render: () => (
        <CaptureFrame>
            <Figure compact zoom={1.22} windowName="Spec Viewer · Review" shotPadding="18px 22px">
                <div id="markdown-content" style={`width: ${IC_CARD_WIDTH}px;`}>
                    {severalOnOneDocumentWithComposer()}
                </div>
            </Figure>
        </CaptureFrame>
    ),
};

// ── The sidebar, and the living specs view ────────────────────────────────

export const F9Sidebar: Story = {
    name: 'F9 · The sidebar',
    parameters: { capture: { width: 480, height: 860 } },
    render: () => (
        <CaptureFrame>
            <Figure compact zoom={1.2} windowName="Specs sidebar">
                <div style="height: 100%; overflow: hidden;">
                    <SidebarShell panes={[specsPane(true, false), livingSpecsPane(), steeringPane(true)]} />
                </div>
            </Figure>
        </CaptureFrame>
    ),
};

export const F10LivingSpecs: Story = {
    name: 'F10 · Living specs',
    parameters: { capture: { width: 1100, height: 760 } },
    render: () => (
        <CaptureFrame>
            <Figure compact windowName="Living Specs · photo-storage">
                <div style="display: flex; height: 100%;">
                    <div style={`width: 340px; flex-shrink: 0; border-right: 1px solid ${T.borderPanel}; overflow: hidden;`}>
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
    parameters: { capture: { width: 1200, height: 840 } },
    render: () => (
        <CaptureFrame>
            <Figure compact windowName="Pipeline Builder">
                <div style="height: 100%; overflow: hidden;">{(TheBoard.render as () => ComponentChildren)()}</div>
            </Figure>
        </CaptureFrame>
    ),
};
