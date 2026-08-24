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
 * Determinism: wrapped in CaptureFrame (frozen clock, no animation), so two
 * captures a month apart are identical. See captureFrame.tsx.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ViewerState } from '../types';
import { InteractiveViewer, vsFromContext } from './viewerHarness';
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
import { mockDoc } from '../components/__stories__/mockData';

import teamboardTasks from '../__fixtures__/teamboard/041-profile-photo-upload/tasks.md?raw';

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
