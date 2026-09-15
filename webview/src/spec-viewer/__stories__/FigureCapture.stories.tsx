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
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ViewerState } from '../types';
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
import {
    CoverageSection,
    DecisionsSection,
    ExpectationsSection,
    IntentSection,
    VerifiedSection,
} from '../components/OverviewDossier';
import { severalOnOneDocumentWithComposer } from '../components/InlineComment.stories';
import { TheBoard } from '../../pipeline-builder/__stories__/Guide.stories';

import mascotArt from '../../../../website/public/mascot/pointing-256.png';
import geistRegular from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-Regular.ttf';
import geistMedium from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-Medium.ttf';
import geistSemiBold from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-SemiBold.ttf';

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

// ── The frame's own colours: Constellation, transcribed from tokens.css. ──
// Literal on purpose. The frame IS the site's identity; it never follows the
// capture palette (see the header comment).
const T = {
    ground: '#0a0913',
    panel: '#0d0b1a',
    borderPanel: '#2a2545',
    borderStrong: '#3a3357',
    textPrimary: '#edeaf6',
    textBody: '#b6b0d2',
    textMuted: '#9d97bd',
    accent: '#a78bfa',
    accentSolid: '#8b5cf6',
    green: '#7cc98a',
};

const GEIST_FACES = `
@font-face { font-family: 'Geist'; src: url('${geistRegular}') format('truetype'); font-weight: 400; font-style: normal; }
@font-face { font-family: 'Geist'; src: url('${geistMedium}') format('truetype'); font-weight: 500; font-style: normal; }
@font-face { font-family: 'Geist'; src: url('${geistSemiBold}') format('truetype'); font-weight: 600; font-style: normal; }
`;

const FIGURE_FONT = "'Geist', system-ui, sans-serif";

// The site's mark: a double chevron with a check tucked inside the right one.
// Path data copied from website/src/components/LogoMark.astro, the chosen
// artwork in a 678 box, untouched. Change it there first.
const MARK = {
    right: 'M315.34 2.18C357.67-2.1 377.91 28.2 404.93 55.31L482.8 133.14L584.21 234.53C601.87 252.07 622.52 271.31 638.57 289.69C653.83 307.16 658.46 343.01 650.95 364.47C648.62 371.12 645.39 380.51 640.87 385.94C624.36 405.78 605.54 424.08 587.31 442.34L491.88 537.59L413.56 616.25C397.49 632.33 378.97 652.1 361.28 665.59C353.78 670.27 348.83 673.06 340.12 675.38C323.13 679.82 305.08 677.36 289.9 668.53C276.51 660.64 266.85 647.7 263.09 632.62C258.98 616.27 261.62 598.96 270.42 584.58C275.97 575.34 297.94 555.48 307 546.47L425.48 430.74C443.2 413.37 470.93 389 484.23 369.28C494.14 354.6 493.56 326.31 484.76 310.65C474.11 291.72 448.59 270.61 432.2 255.13L340.5 167.44C319.08 147.2 295.75 125.87 276.08 103.89C270.29 97.42 266.87 89.05 264.67 80.64C260.26 63.99 262.77 46.26 271.63 31.49C281.68 14.84 296.99 6.45 315.34 2.18z',
    armTop: 'M170.9 232.63L89.44 153.61C72.98 137.67 46.88 115.02 34.44 96.61C9.21 59.25 36.58 2.46 82.89 1.29C113.53 0.52 130.63 23.82 150.46 43.28C156.76 49.48 162.92 55.91 169.12 62.22C197.56 91.23 226.29 119.94 255.31 148.36C265.23 158.37 331.99 223.45 332.76 229.72C327 240.01 262.65 300.94 250.99 310.16C225.07 285.72 196.37 257.63 170.9 232.63z',
    elbowTop: 'M255.31 148.36C265.23 158.37 331.99 223.45 332.76 229.72C327 240.01 262.65 300.94 250.99 310.16C225.07 285.72 196.37 257.63 170.9 232.63C182.57 222.24 194.88 208.93 205.94 197.69L255.31 148.36z',
    armBottom: 'M169.67 451.43C195.29 425.65 225.42 394.59 251.81 369.89C259.8 376.73 331.49 446.43 332.55 451.22C327.33 461.58 267.72 520.38 254.9 533.4C217.03 571.66 179.03 609.89 141.17 648.15C124.85 664.65 110.3 677.32 85.8 677.01C71.59 676.84 56.35 671.51 46.27 661.13C34.73 649.07 28.38 632.97 28.59 616.27C29.14 581.69 58.75 560.4 81.65 537.76L169.67 451.43z',
    elbowBottom: 'M169.67 451.43C195.29 425.65 225.42 394.59 251.81 369.89C259.8 376.73 331.49 446.43 332.55 451.22C327.33 461.58 267.72 520.38 254.9 533.4C247.76 528.06 238.53 518.09 231.94 511.6L198.44 478.94C188.92 469.52 180.03 459.91 169.67 451.43z',
    check: 'M403.53 293.71C410.8 296.72 428.95 311.41 420 319.53C410.87 327.82 352.9 390.82 345.5 391.67C337.78 389.59 326.89 376.49 320.97 370.33C305.4 355.01 285.95 346.93 316.27 328.27C321.28 325.19 339.21 345.41 344.31 349.18L345.51 350.05C357.26 337.99 391.83 301.3 403.53 293.71z',
};

function Wordmark() {
    return (
        <div style={`display: flex; align-items: center; gap: 12px; font: 600 17px/1 ${FIGURE_FONT}; letter-spacing: -0.01em; color: ${T.textPrimary}; white-space: nowrap; flex-shrink: 0;`}>
            <svg width="24" height="24" viewBox="0 0 678 678" fill="none" aria-hidden="true" style="display: block;">
                <path fill={T.textPrimary} d={MARK.right} />
                <path fill={T.accent} d={MARK.armTop} />
                <path fill={T.textPrimary} d={MARK.elbowTop} />
                <path fill={T.accent} d={MARK.armBottom} />
                <path fill={T.textPrimary} d={MARK.elbowBottom} />
                <path fill={T.textPrimary} d={MARK.check} />
            </svg>
            SpecKit Companion
        </div>
    );
}

export interface FigureMark {
    /** Selector, resolved inside the shot. The first match is outlined. */
    selector: string;
    /** `here` outlines in green (this is where it is); `point` in violet
     *  (this is the point). At most one `point` per figure. */
    kind: 'here' | 'point';
    label?: string;
    /** Extra padding around the measured rect, px. */
    pad?: number;
}

interface Rect {
    l: number;
    t: number;
    w: number;
    h: number;
}

/** Draw the outlines from measured rects. The shot's own content renders
 *  asynchronously (the viewer scrolls on a double rAF), so the measurement
 *  waits a beat and re-measures once more before the capture script's
 *  fonts.ready await resolves. */
function Marks({ marks }: { marks: FigureMark[] }) {
    const holder = useRef<HTMLDivElement>(null);
    const [rects, setRects] = useState<(Rect | null)[]>([]);
    const [shotW, setShotW] = useState(0);
    useLayoutEffect(() => {
        const shot = holder.current?.parentElement;
        if (!shot) return;
        const measure = () => {
            const base = shot.getBoundingClientRect();
            setShotW(base.width);
            setRects(
                marks.map((m) => {
                    const el = shot.querySelector<HTMLElement>(m.selector);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    const pad = m.pad ?? 6;
                    return {
                        l: r.left - base.left - pad,
                        t: r.top - base.top - pad,
                        w: r.width + pad * 2,
                        h: r.height + pad * 2,
                    };
                }),
            );
        };
        let raf = 0;
        const t1 = setTimeout(() => (raf = requestAnimationFrame(measure)), 60);
        const t2 = setTimeout(measure, 400);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            cancelAnimationFrame(raf);
        };
    }, [marks]);
    return (
        <div ref={holder} style="position: absolute; inset: 0; pointer-events: none;">
            {marks.map((m, i) => {
                const r = rects[i];
                if (!r) return null;
                const colour = m.kind === 'point' ? T.accent : T.green;
                return (
                    <div key={i}>
                        <div style={`position: absolute; left: ${r.l}px; top: ${r.t}px; width: ${r.w}px; height: ${r.h}px; border: 3px solid ${colour}; border-radius: 8px; box-sizing: border-box;`} />
                        {m.label && (
                            <div style={`position: absolute; right: ${shotW - r.l - r.w + 12}px; top: ${r.t - 14}px; font: 600 14px/1 ${FIGURE_FONT}; color: ${T.ground}; background: ${colour}; padding: 7px 10px; border-radius: 6px; white-space: nowrap;`}>
                                {m.label}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

interface FigureProps {
    /** Names the screen, never the point: "What was checked". */
    title: string;
    /** The point of the figure, one sentence. <b> lifts the key phrase. */
    caption: ComponentChildren;
    marks?: FigureMark[];
    /** Padding inside the shot, for surfaces that need air (the comment card). */
    shotPadding?: string;
    children: ComponentChildren;
}

/** The frame. Header (title chip, wordmark), the shot, the caption with the
 *  mascot. Fixed violet palette on its root. */
function Figure({ title, caption, marks = [], shotPadding, children }: FigureProps) {
    useEffect(() => {
        document.fonts.load(`600 17px Geist`);
        document.fonts.load(`400 21px Geist`);
    }, []);
    return (
        <div style={`display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; padding: 22px 26px 24px; gap: 16px; background: ${T.ground}; border: 1px solid ${T.borderPanel}; border-radius: 14px; font-family: ${FIGURE_FONT}; color: ${T.textPrimary};`}>
            <style>{GEIST_FACES}</style>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-shrink: 0;">
                <div style={`font: 600 18px/1 ${FIGURE_FONT}; padding: 9px 14px; border-radius: 9px; background: rgba(139, 92, 246, 0.25); border: 1px solid rgba(167, 139, 250, 0.5); color: ${T.textPrimary}; white-space: nowrap;`}>
                    {title}
                </div>
                <Wordmark />
            </div>
            <div
                data-panel="shot"
                style={`position: relative; flex: 1; min-height: 0; border: 2px solid ${T.borderStrong}; border-radius: 10px; overflow: hidden; background: ${T.panel}; ${shotPadding ? `padding: ${shotPadding};` : ''}`}
            >
                {children}
                {marks.length > 0 && <Marks marks={marks} />}
            </div>
            <div style="display: flex; align-items: center; gap: 16px; flex-shrink: 0;">
                <img src={mascotArt} alt="" style="width: 54px; height: 54px; flex: none; display: block;" />
                <div style={`font: 400 21px/1.4 ${FIGURE_FONT}; color: ${T.textBody};`}>{caption}</div>
            </div>
        </div>
    );
}

/** The key phrase of a caption. */
function B({ children }: { children: ComponentChildren }) {
    return <span style={`font-weight: 600; color: ${T.textPrimary};`}>{children}</span>;
}

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
