/**
 * README-OWNED COMPOSITES. NOT A COMPONENT CATALOG.
 * ─────────────────────────────────────────────────────────────────────────
 * Wide composed frames captured by `scripts/capture-docs-images.mjs` into
 * `docs/screenshots/generated/` for the root README, in the same spirit as the
 * sidebar triptych (SidebarCapture.stories.tsx B5): several product surfaces
 * arranged on one dark ground, regenerable with one command instead of a
 * hand-driven screenshot that ages out.
 *
 * C1 · README hero (`generated/hero.png`)
 *   The image at the top of the root README and the first thing a Marketplace
 *   visitor sees. The real viewer (mid-plan on the Teamboard feature, live
 *   elapsed on the plan step) as the main panel, the sidebar recreation
 *   beside it in the same state, set type above. Both panels show the SAME
 *   moment of the same run: spec written, plan in flight, tasks not created.
 *
 * C2 · Pipeline stat strip (`generated/pipeline-stats.png`)
 *   The stat tiles under "Pick a pipeline once, run it end to end". Every
 *   number is the benchmark's, quoted from docs/configuration.md#workflow-choice
 *   (measured by /bench-run-all, 2026-06-10). Change the numbers THERE first;
 *   this image only repeats them.
 *
 * C3 · Living Specs pair (`generated/living-specs-pair.png`)
 *   The Living Specs section image in both READMEs: the sidebar's Living Specs
 *   view (coverage counts, drift flags) beside the viewer in its real
 *   `livingMode` (LIVING badge, Covers globs, facts row, WHEN/THEN scenario
 *   rows), both on the SAME capability: photo-storage, 7 of 9 covered,
 *   drifted. The right panel is the actual App rendering, fed by the
 *   `photo-storage.spec.md` Teamboard fixture; counts in the header are
 *   derived from that file, never typed in. This composition is also the
 *   storyboard seed for the future Living Specs GIF (sidebar row → click →
 *   viewer opens → drift → Update).
 *
 * C4 · Benefits strip (`generated/benefits-strip.png`)
 *   The four-benefit sub-hero under the extension README's "What you get":
 *   one panel per benefit, each a real product surface on the Teamboard
 *   fixtures. Traceability shows the Overview's run strip plus verified check
 *   rows from the completed run; Customization shows the
 *   `.specify/companion.yml` hooks shape (same shape as
 *   examples/ship-ticket/companion.inline.yml); Fast path shows the Intent
 *   section with the run's size verdict ("Sized simple: 6 files, 6 tasks
 *   projected"); Living Specs shows the viewer's real living header (LIVING
 *   badge, covers globs, coverage and drift facts) on photo-storage. Laid out
 *   as a 2x2 grid, not one row of four: the product type inside each panel
 *   has to stay legible at the README's ~830px column width.
 *
 * C5 / C6 · Cross-promo banners (`generated/banner-install-engine.png`,
 *   `generated/banner-install-vscode.png`)
 *   The "Install the other half" banners: each README points at the OTHER
 *   half of the product over the mascot art
 *   (speckit-extension/assets/hero-draft-a.png). C5 sits in the root README
 *   and invites installing the Spec Kit engine extension; C6 sits in
 *   speckit-extension/README.md and invites installing the VS Code
 *   extension. Same frame and headline, one subline swapped; each README
 *   wraps its banner in a link to the matching install target.
 *
 * Determinism: wrapped in CaptureFrame (frozen clock, no animation), so two
 * captures a month apart are identical. See captureFrame.tsx.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import type { NavState, ViewerState } from '../types';
import { InteractiveViewer, vsFromContext, type SpecContextData } from './viewerHarness';
import { CaptureFrame } from './captureFrame';
import { SidebarShell } from './sidebarTree';
import { specsPane, livingSpecsPane, steeringPane } from './SidebarCapture.stories';
import {
    ctxPlanning,
    planningStepHistory,
    PLANNING_AT,
    ScrollTo,
    teamboardDocs,
} from './VideoCapture.stories';
import { mockDoc, mockNavState } from '../components/__stories__/mockData';
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
import { IntentSection, OverviewTiming, VerifiedSection } from '../components/OverviewDossier';
import { SpecHeader } from '../components/SpecHeader';

// The cross-promo banner ground (C5/C6): the mossy sprout mascot cradling its
// glowing seedling, plus the Geist faces the banner type renders in (the same
// font files the video compositions embed).
import bannerArt from '../../../../speckit-extension/assets/hero-draft-a.png';
import geistRegular from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-Regular.ttf';
import geistMedium from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-Medium.ttf';
import geistSemiBold from '../../../../media/feature-clips/step-rail/assets/fonts/Geist-SemiBold.ttf';

import teamboardTasks from '../__fixtures__/teamboard/041-profile-photo-upload/tasks.md?raw';
import ctxCompletedRaw from '../__fixtures__/teamboard/041-profile-photo-upload/spec-context.completed.json?raw';
import photoStorageLivingSpec from '../__fixtures__/teamboard/photo-storage.spec.md?raw';

const meta: Meta = {
    title: 'Video Capture/README Composites',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Composed frames for the root README, captured by ' +
                    'scripts/capture-docs-images.mjs. The hero and the pipeline ' +
                    'stat strip; both regenerate from the current UI.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

// ── C1 · the README hero ──────────────────────────────────────────────────
// One coherent mid-plan moment: the sidebar says Specification done / Plan
// running / Tasks not created, and the viewer beside it shows the same spec
// with the plan step live. The type band carries the tagline; the UI carries
// everything else.

const heroSteps = {
    specify: 'completed',
    plan: 'in-progress',
    tasks: 'not-started',
    implement: 'not-started',
} as ViewerState['steps'];

export const C1ReadmeHero: Story = {
    name: 'C1 · README hero',
    parameters: { capture: { width: 1480, height: 660 } },
    render: () => (
        <CaptureFrame at={PLANNING_AT}>
            <div
                style="display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; padding: 36px 44px 40px; background: var(--vscode-editor-background); gap: 22px;"
            >
                <div style="display: flex; align-items: baseline; justify-content: space-between; flex-shrink: 0;">
                    <div style="display: flex; align-items: baseline; gap: 16px;">
                        <div style="font: 600 32px/1.2 var(--vscode-font-family); color: #ececec; letter-spacing: -0.01em;">
                            Spec Kit Companion
                        </div>
                        <div style="font: 400 16.5px/1.4 var(--vscode-font-family); color: #9a9a9a;">
                            Spec-driven development, visualized.
                        </div>
                    </div>
                    <div style="font: 500 13px/1.4 var(--vscode-font-family); color: #6f6f6f; letter-spacing: 0.04em;">
                        Specify · Plan · Tasks · Done
                    </div>
                </div>
                <div style="display: flex; gap: 22px; flex: 1; min-height: 0;">
                    <div style="width: 340px; flex-shrink: 0; border: 1px solid #2e2e2e; border-radius: 8px; overflow: hidden; background: var(--vscode-sideBar-background);">
                        <SidebarShell
                            panes={[
                                specsPane(true, false),
                                livingSpecsPane(),
                                { ...steeringPane(), collapsed: true },
                            ]}
                        />
                    </div>
                    <div style="flex: 1; min-width: 0; border: 1px solid #2e2e2e; border-radius: 8px; overflow: hidden; position: relative;">
                        <ScrollTo headingId="user-scenarios" offset={150}>
                        <InteractiveViewer
                            ctx={ctxPlanning}
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
                                workflowPhase: 'plan',
                                specStatus: 'planning',
                                badgeText: 'PLANNING',
                                stepHistory: planningStepHistory,
                            }}
                            vs={vsFromContext(ctxPlanning, [], {
                                status: 'planning',
                                activeStep: 'plan',
                                pulse: 'plan',
                                steps: heroSteps,
                                stepHistory: planningStepHistory,
                            })}
                        />
                        </ScrollTo>
                        {/* Fade the clipped bottom edge of the document out to
                            the ground, so the crop reads as intentional. */}
                        <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 64px; background: linear-gradient(to bottom, transparent, var(--vscode-editor-background)); pointer-events: none;" />
                    </div>
                </div>
            </div>
        </CaptureFrame>
    ),
};

// ── C2 · the pipeline stat strip ──────────────────────────────────────────
// Four tiles, one claim each, all quoted from the measured benchmark in
// docs/configuration.md#workflow-choice. No chart: each figure is a single
// headline number, which is stat-tile territory.

function StatTile({ value, label, sub }: { value: string; label: string; sub: string }) {
    return (
        <div style="flex: 1; box-sizing: border-box; padding: 18px 20px 16px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border); border-radius: 8px; display: flex; flex-direction: column; gap: 5px;">
            <div style="font: 600 30px/1.1 var(--vscode-font-family); color: #e2e2e2; letter-spacing: -0.01em;">
                {value}
            </div>
            <div style="font: 600 13px/1.35 var(--vscode-font-family); color: #c7c7c7;">
                {label}
            </div>
            <div style="font: 400 11.5px/1.45 var(--vscode-font-family); color: #8a8a8a;">
                {sub}
            </div>
        </div>
    );
}

export const C2PipelineStats: Story = {
    name: 'C2 · Pipeline stat strip',
    parameters: { capture: { width: 1176, height: 232 } },
    render: () => (
        <CaptureFrame>
            <div style="display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; padding: 28px 40px 20px; background: var(--vscode-editor-background);">
                <div style="display: flex; gap: 18px; align-items: stretch;">
                    <StatTile
                        value="60-68%"
                        label="smaller specs"
                        sub="spec.md lines vs stock Spec Kit, at every benchmark size"
                    />
                    <StatTile
                        value="0"
                        label="throwaway side files"
                        sub="no research.md, data-model.md, quickstart.md, or contracts/ at any size"
                    />
                    <StatTile
                        value="Right-sized"
                        label="ceremony, by change size"
                        sub="a small change skips the ceremony; a large one keeps the full flow"
                    />
                    <StatTile
                        value="5.0 / 5"
                        label="correctness: a tie"
                        sub="both pipelines shipped green on every run; the difference is ceremony, not outcomes"
                    />
                </div>
                <div style="font: 400 11px/1.4 var(--vscode-font-family); color: #6a6a6a; margin-top: 14px;">
                    Measured by /bench-run-all (2026-06-10): the same feature at three sizes, each
                    workflow in an isolated sandbox, judged independently. Details: docs/configuration.md
                </div>
            </div>
        </CaptureFrame>
    ),
};

// ── C3 · the Living Specs pair ────────────────────────────────────────────
// One capability, two surfaces. The sidebar's Living Specs view shows
// photo-storage at "7/9 covered · drift"; the viewer beside it is App's real
// living mode open on that same capability, whose header derives the same
// 7/9 and the same drift flag from the fixture. If the two panels ever
// disagree, the fixture is wrong, not the composition.

const livingRequirementCount = (photoStorageLivingSpec.match(/^###\s+/gm) ?? []).length;
const livingScenarioCount = (photoStorageLivingSpec.match(/^####\s+Scenario:/gm) ?? []).length;

/**
 * Mount the real App in living mode on the photo-storage fixture, the same
 * signals-in path index.tsx uses. Static on purpose: the capture needs one
 * deterministic frame, not navigation.
 */
function LivingViewerPanel() {
    setLivingMode(true);
    setLivingCoverage(null);
    setHasSpecContext(true);
    setCurrentTask(null);
    setTaskSummaries(null);
    viewerState.value = null;
    historyEntries.value = [];
    navState.value = mockNavState({
        coreDocs: [
            mockDoc('spec', true, 'Spec'),
            mockDoc('arch', true, 'Architecture'),
            mockDoc('coverage', true, 'Coverage'),
        ],
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

export const C3LivingSpecsPair: Story = {
    name: 'C3 · Living Specs pair',
    parameters: { capture: { width: 1480, height: 1040 } },
    render: () => (
        <CaptureFrame>
            <div
                style="display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box; padding: 36px 44px 40px; background: var(--vscode-editor-background); gap: 22px;"
            >
                <div style="display: flex; align-items: baseline; justify-content: space-between; flex-shrink: 0;">
                    <div style="display: flex; align-items: baseline; gap: 16px;">
                        <div style="font: 600 26px/1.2 var(--vscode-font-family); color: #ececec; letter-spacing: -0.01em;">
                            Living Specs
                        </div>
                        <div style="font: 400 15.5px/1.4 var(--vscode-font-family); color: #9a9a9a;">
                            One durable spec per capability, kept in one folder or next to the code it covers.
                        </div>
                    </div>
                    <div style="font: 500 13px/1.4 var(--vscode-font-family); color: #6f6f6f; letter-spacing: 0.04em;">
                        Coverage · Drift · Sync
                    </div>
                </div>
                <div style="display: flex; gap: 22px; flex: 1; min-height: 0;">
                    {/* Addressable panels: a composition (or the future GIF's
                        storyboard) can mask, highlight, or morph either card
                        by id without counting children. Rows inside the
                        sidebar carry their own `#row-<slug>` ids already. */}
                    <div id="living-pair-sidebar" data-panel="sidebar" style="width: 340px; flex-shrink: 0; border: 1px solid #2e2e2e; border-radius: 8px; overflow: hidden; background: var(--vscode-sideBar-background);">
                        <SidebarShell
                            panes={[
                                { ...specsPane(false), collapsed: true },
                                livingSpecsPane(true),
                                { ...steeringPane(), collapsed: true },
                            ]}
                        />
                    </div>
                    <div id="living-pair-viewer" data-panel="viewer" style="flex: 1; min-width: 0; border: 1px solid #2e2e2e; border-radius: 8px; overflow: hidden; position: relative;">
                        <LivingViewerPanel />
                        {/* Fade the clipped bottom edge of the document out to
                            the ground, so the crop reads as intentional. */}
                        <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 64px; background: linear-gradient(to bottom, transparent, var(--vscode-editor-background)); pointer-events: none;" />
                    </div>
                </div>
            </div>
        </CaptureFrame>
    ),
};

// ── C4 · the benefits strip ───────────────────────────────────────────────
// Four real product surfaces, one per benefit of the extension README's
// "What you get" spine, on one dark ground. Every panel is fixture-fed
// product rendering (or, for Customization, the literal companion.yml hook
// shape): nothing is drawn for the picture.

const ctxCompletedStrip = JSON.parse(ctxCompletedRaw) as SpecContextData;
const vsCompletedStrip = vsFromContext(ctxCompletedStrip, []);

/** Traceability: the run strip plus two verified rows from the completed
 *  Teamboard run. The verified slice keeps the panel short; the count chip
 *  honestly counts what is shown. */
const vsTraceability: ViewerState = {
    ...vsCompletedStrip,
    verified: [vsCompletedStrip.verified![0], vsCompletedStrip.verified![4]],
};

/** Fast path: the Intent section reduced to the sizing moment. Approach,
 *  living specs, and the timing strip are elsewhere in the strip already;
 *  what this panel is about is "Sized simple: 6 files, 6 tasks projected". */
const vsSizing: ViewerState = {
    ...vsCompletedStrip,
    approach: undefined,
    context: undefined,
    livingSpecs: undefined,
    stepHistory: {} as ViewerState['stepHistory'],
    timing: undefined,
};

/** One benefit panel: kicker + heading + one line, then a bordered card. */
function BenefitPanel({
    kicker,
    heading,
    caption,
    height,
    children,
}: {
    kicker: string;
    heading: string;
    caption: string;
    height: number;
    children: ComponentChildren;
}) {
    return (
        <div style="display: flex; flex-direction: column; min-width: 0;">
            <div style="font: 700 11px/1 var(--vscode-font-family); color: #78dce8; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 7px;">
                {kicker}
            </div>
            <div style="font: 600 18px/1.25 var(--vscode-font-family); color: #e2e2e2; margin-bottom: 5px;">
                {heading}
            </div>
            <div style="font: 400 12.5px/1.5 var(--vscode-font-family); color: #9a9a9a; margin-bottom: 12px;">
                {caption}
            </div>
            <div
                style={`position: relative; border: 1px solid #2e2e2e; border-radius: 8px; overflow: hidden; background: var(--vscode-editor-background); height: ${height}px; flex-shrink: 0;`}
            >
                {children}
                {/* Fade the clipped bottom edge out to the ground, so a crop
                    reads as intentional (same device as C1 and C3). */}
                <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 36px; background: linear-gradient(to bottom, transparent, var(--vscode-editor-background)); pointer-events: none;" />
            </div>
        </div>
    );
}

// The companion.yml hooks block, colored by hand so the card reads as config
// without dragging a highlighter into the story. The SHAPE is the real one:
// it mirrors examples/ship-ticket/companion.inline.yml (type: command / prompt
// / node are the three hook forms docs/node-model.md defines).
const YAML_KEY = '#78dce8';
const YAML_STR = '#a9dc76';
const YAML_PLAIN = '#c7c7c7';
const YAML_COMMENT = '#6a6a6a';

function YamlLine({ indent, children }: { indent: number; children: ComponentChildren }) {
    return (
        <div style={`padding-left: ${indent * 16}px; white-space: pre;`}>{children}</div>
    );
}

function CompanionYmlCard() {
    return (
        <div style="padding: 22px 24px; font: 400 14px/2 var(--vscode-editor-font-family); color: #c7c7c7;">
            <YamlLine indent={0}>
                <span style={`color: ${YAML_COMMENT};`}># .specify/companion.yml</span>
            </YamlLine>
            <YamlLine indent={0}>
                <span style={`color: ${YAML_KEY};`}>commands</span>
                <span style={`color: ${YAML_PLAIN};`}>:</span>
            </YamlLine>
            <YamlLine indent={1}>
                <span style={`color: ${YAML_KEY};`}>implement</span>
                <span style={`color: ${YAML_PLAIN};`}>:</span>
            </YamlLine>
            <YamlLine indent={2}>
                <span style={`color: ${YAML_KEY};`}>hooks</span>
                <span style={`color: ${YAML_PLAIN};`}>:</span>
            </YamlLine>
            <YamlLine indent={3}>
                <span style={`color: ${YAML_KEY};`}>after</span>
                <span style={`color: ${YAML_PLAIN};`}>:</span>
            </YamlLine>
            <YamlLine indent={4}>
                <span style={`color: ${YAML_KEY};`}>implement-exec</span>
                <span style={`color: ${YAML_PLAIN};`}>:</span>
            </YamlLine>
            <YamlLine indent={5}>
                <span style={`color: ${YAML_PLAIN};`}>- {'{'} </span>
                <span style={`color: ${YAML_KEY};`}>type</span>
                <span style={`color: ${YAML_PLAIN};`}>: command, </span>
                <span style={`color: ${YAML_KEY};`}>run</span>
                <span style={`color: ${YAML_PLAIN};`}>: </span>
                <span style={`color: ${YAML_STR};`}>"npm test"</span>
                <span style={`color: ${YAML_PLAIN};`}> {'}'}</span>
            </YamlLine>
            <YamlLine indent={5}>
                <span style={`color: ${YAML_PLAIN};`}>- {'{'} </span>
                <span style={`color: ${YAML_KEY};`}>type</span>
                <span style={`color: ${YAML_PLAIN};`}>: prompt, </span>
                <span style={`color: ${YAML_KEY};`}>text</span>
                <span style={`color: ${YAML_PLAIN};`}>: </span>
                <span style={`color: ${YAML_STR};`}>"Open a PR for review"</span>
                <span style={`color: ${YAML_PLAIN};`}> {'}'}</span>
            </YamlLine>
            <YamlLine indent={5}>
                <span style={`color: ${YAML_PLAIN};`}>- {'{'} </span>
                <span style={`color: ${YAML_KEY};`}>type</span>
                <span style={`color: ${YAML_PLAIN};`}>: node, </span>
                <span style={`color: ${YAML_KEY};`}>ref</span>
                <span style={`color: ${YAML_PLAIN};`}>: review </span>
                <span style={`color: ${YAML_PLAIN};`}>{'}'}</span>
            </YamlLine>
        </div>
    );
}

/** The viewer's real living header (SpecHeader in livingMode), signals-fed
 *  exactly like C3's viewer panel, on the same photo-storage fixture. */
function LivingHeaderPanel() {
    viewerState.value = null;
    navState.value = mockNavState({
        coreDocs: [
            mockDoc('spec', true, 'Spec'),
            mockDoc('arch', true, 'Architecture'),
            mockDoc('coverage', true, 'Coverage'),
        ],
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

    return (
        <div class="viewer-container" style="height: 100%; padding: 18px 22px;">
            <SpecHeader />
        </div>
    );
}

export const C4BenefitsStrip: Story = {
    name: 'C4 · Benefits strip',
    parameters: { capture: { width: 1176, height: 902 } },
    render: () => (
        <CaptureFrame>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px 26px; width: 100%; height: 100%; box-sizing: border-box; padding: 36px 40px 40px; background: var(--vscode-editor-background); align-content: start;">
                <BenefitPanel
                    kicker="Traceability"
                    heading="Every run leaves a record"
                    caption="Each step lands in a committed file: honest per-phase timing, plus every check that was verified and the command that proves it."
                    height={410}
                >
                    <div style="padding: 14px 22px 0;">
                        <OverviewTiming state={vsCompletedStrip} />
                        <VerifiedSection state={vsTraceability} />
                    </div>
                </BenefitPanel>
                <BenefitPanel
                    kicker="Customization"
                    heading="Hooks and custom steps"
                    caption="Attach your own work before or after any node of a command in .specify/companion.yml, without forking the command itself."
                    height={410}
                >
                    <CompanionYmlCard />
                </BenefitPanel>
                <BenefitPanel
                    kicker="Fast path"
                    heading="Small changes skip the ceremony"
                    caption="Every change is sized after specify; a small one takes a folded path with the plan inline, straight to implement."
                    height={260}
                >
                    <div style="padding: 16px 22px 0;">
                        <IntentSection state={vsSizing} />
                    </div>
                </BenefitPanel>
                <BenefitPanel
                    kicker="Living specs"
                    heading="Specs that live with the code"
                    caption="One durable spec per capability, central or colocated, with coverage counts and a drift flag the moment the code moves on."
                    height={260}
                >
                    <LivingHeaderPanel />
                </BenefitPanel>
            </div>
        </CaptureFrame>
    ),
};

// ── C5 / C6 · the cross-promotion banners ─────────────────────────────────
// Each README carries a wide banner pointing at the OTHER half of the
// product: the root README invites installing the Spec Kit engine extension,
// the extension README invites installing the VS Code workspace. Same frame,
// same headline, one subline swapped. The ground is the mascot art
// (speckit-extension/assets/hero-draft-a.png) cropped to a band that keeps
// the sprout on its log center-right; the type sits in the dark forest on
// the left, over a left-to-right scrim. Emerald stays scarce per THEME.md:
// only the "Get it" chip carries it. No em dashes in on-image copy.

const GEIST_FACES = `
@font-face { font-family: 'Geist'; src: url('${geistRegular}') format('truetype'); font-weight: 400; font-style: normal; }
@font-face { font-family: 'Geist'; src: url('${geistMedium}') format('truetype'); font-weight: 500; font-style: normal; }
@font-face { font-family: 'Geist'; src: url('${geistSemiBold}') format('truetype'); font-weight: 600; font-style: normal; }
`;

function CrossPromoBanner({ subline }: { subline: string }) {
    useEffect(() => {
        // Pull the Geist faces into document.fonts before the capture
        // script's `document.fonts.ready` await, so the type never captures
        // in its fallback face.
        document.fonts.load('600 58px Geist');
        document.fonts.load('400 23px Geist');
        document.fonts.load('500 15px Geist');
    }, []);
    return (
        <div style="position: relative; width: 100%; height: 100%; overflow: hidden; background: #010409;">
            <style>{GEIST_FACES}</style>
            {/* The art is 1552x656; the banner is a 420-tall band of it.
                Shifting it up 128px keeps the head sprout, face, seedling,
                and mossy log all inside the frame. */}
            <img
                src={bannerArt}
                alt=""
                style="position: absolute; left: 0; top: -128px; width: 1552px; max-width: none; display: block;"
            />
            {/* Left-to-right scrim: near-opaque under the type, gone before
                the mascot. */}
            <div style="position: absolute; inset: 0; background: linear-gradient(90deg, rgba(1,4,9,0.93) 0%, rgba(1,4,9,0.87) 26%, rgba(1,4,9,0.58) 46%, rgba(1,4,9,0.14) 62%, rgba(1,4,9,0) 74%);" />
            <div style="position: absolute; left: 88px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: flex-start; gap: 15px; max-width: 660px;">
                <div style="font: 600 58px/1.08 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e6edf3; letter-spacing: -0.015em; text-shadow: 0 2px 26px rgba(1,4,9,0.85), 0 0 44px rgba(120,189,247,0.22);">
                    Install the other half
                </div>
                <div style="font: 400 23px/1.4 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #b7c4d0; text-shadow: 0 1px 14px rgba(1,4,9,0.9);">
                    {subline}
                </div>
                <div style="margin-top: 7px; display: inline-flex; align-items: center; padding: 10px 22px; border: 1px solid rgba(63,185,80,0.6); border-radius: 7px; background: rgba(63,185,80,0.13); font: 500 16px/1 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #7ee2a8; letter-spacing: 0.01em; box-shadow: 0 0 22px rgba(63,185,80,0.18);">
                    Get it
                </div>
            </div>
        </div>
    );
}

export const C5BannerInstallEngine: Story = {
    name: 'C5 · Banner: install engine',
    parameters: { capture: { width: 1552, height: 420 } },
    render: () => (
        <CaptureFrame>
            <CrossPromoBanner subline="The engine that records every run" />
        </CaptureFrame>
    ),
};

export const C6BannerInstallVscode: Story = {
    name: 'C6 · Banner: install VS Code',
    parameters: { capture: { width: 1552, height: 420 } },
    render: () => (
        <CaptureFrame>
            <CrossPromoBanner subline="See everything it records, in VS Code" />
        </CaptureFrame>
    ),
};
