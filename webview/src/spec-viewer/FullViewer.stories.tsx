/**
 * The COMPLETE viewer — header, stepper, sub-doc rail, rendered content,
 * table of contents, Activity toggle, and footer — mounted as the real
 * `App` component and fed real specs (392 · living-specs-viewer and
 * 172 · composable-command-nodes) straight from the repo, including their
 * actual `.spec-context.json` history/decisions/task summaries.
 *
 * NAVIGATION WORKS: the story intercepts the mocked `vscode.postMessage`
 * and answers `stepperClick` / `switchDocument` itself, so clicking the
 * step tabs and the sub-doc rail (research, data-model, quickstart,
 * checklist, contract) switches the rendered document like the extension
 * would. One story per spec is enough — every document is reachable from
 * inside it.
 *
 * For isolated pieces see Viewer/NavigationBar, Viewer/SpecHeader,
 * Viewer/Transitions (status walk-through), and Markdown Rendering.
 *
 * 393 and 394 are frozen COPIES under `__fixtures__/specs/`, not live specs.
 * The originals were deleted by d88eb361 ("prune unused agent scaffolding and
 * stale specs"), which broke this file and `markdown/Tasks.stories.tsx` at
 * load time. They are restored byte-for-byte from d88eb361^ and now live next
 * to the stories, so a future `specs/` cleanup cannot break Storybook again.
 * New story fixtures belong there too, not in the working `specs/` folder.
 */

import type { Meta, StoryObj } from '@storybook/preact';
import type { ViewerState } from './types';
import {
    completedFooter,
    InteractiveViewer,
    stepHistoryFrom,
    vsFromContext,
    type DocSet,
    type SpecContextData,
} from './__stories__/viewerHarness';

import spec392 from '../../../specs/392-living-specs-viewer/spec.md?raw';
import plan392 from '../../../specs/392-living-specs-viewer/plan.md?raw';
import tasks392 from '../../../specs/392-living-specs-viewer/tasks.md?raw';
import research392 from '../../../specs/392-living-specs-viewer/research.md?raw';
import dataModel392 from '../../../specs/392-living-specs-viewer/data-model.md?raw';
import checklist392 from '../../../specs/392-living-specs-viewer/checklists/requirements.md?raw';
import contract392 from '../../../specs/392-living-specs-viewer/contracts/ui-contract.md?raw';
import ctx392Raw from '../../../specs/392-living-specs-viewer/.spec-context.json?raw';
import spec172 from '../../../specs/172-composable-command-nodes/spec.md?raw';
import plan172 from '../../../specs/172-composable-command-nodes/plan.md?raw';
import tasks172 from '../../../specs/172-composable-command-nodes/tasks.md?raw';
import research172 from '../../../specs/172-composable-command-nodes/research.md?raw';
import dataModel172 from '../../../specs/172-composable-command-nodes/data-model.md?raw';
import quickstart172 from '../../../specs/172-composable-command-nodes/quickstart.md?raw';
import checklist172 from '../../../specs/172-composable-command-nodes/checklists/requirements.md?raw';
import contract172 from '../../../specs/172-composable-command-nodes/contracts/assembly-and-parity.md?raw';
import ctx172Raw from '../../../specs/172-composable-command-nodes/.spec-context.json?raw';
import spec394 from './__fixtures__/specs/394-adopt-codex-design/spec.md?raw';
import plan394 from './__fixtures__/specs/394-adopt-codex-design/plan.md?raw';
import tasks394 from './__fixtures__/specs/394-adopt-codex-design/tasks.md?raw';
import research394 from './__fixtures__/specs/394-adopt-codex-design/research.md?raw';
import dataModel394 from './__fixtures__/specs/394-adopt-codex-design/data-model.md?raw';
import checklist394 from './__fixtures__/specs/394-adopt-codex-design/checklists/requirements.md?raw';
import contract394 from './__fixtures__/specs/394-adopt-codex-design/contracts/ui-contract.md?raw';
import ctx394Raw from './__fixtures__/specs/394-adopt-codex-design/.spec-context.json?raw';
import spec406 from '../../../specs/406-living-spec-components/spec.md?raw';
import plan406 from '../../../specs/406-living-spec-components/plan.md?raw';
import tasks406 from '../../../specs/406-living-spec-components/tasks.md?raw';
import ctx406Raw from '../../../specs/406-living-spec-components/.spec-context.json?raw';
import viewerUiLiving from './viewer-ui.spec.md?raw';
import specViewerLiving from '../../../src/features/spec-viewer/spec-viewer.spec.md?raw';
import spec393 from './__fixtures__/specs/393-implement-button-lost/spec.md?raw';
import plan393 from './__fixtures__/specs/393-implement-button-lost/plan.md?raw';
import tasks393 from './__fixtures__/specs/393-implement-button-lost/tasks.md?raw';
import ctx393Raw from './__fixtures__/specs/393-implement-button-lost/.spec-context.json?raw';

const ctx392 = JSON.parse(ctx392Raw) as SpecContextData;
const ctx172 = JSON.parse(ctx172Raw) as SpecContextData;
const ctx394 = JSON.parse(ctx394Raw) as SpecContextData;
const ctx406 = JSON.parse(ctx406Raw) as SpecContextData;
const ctx393 = JSON.parse(ctx393Raw) as SpecContextData;

const docs392: DocSet = {
    spec: { md: spec392, label: 'Specification' },
    plan: { md: plan392, label: 'Plan' },
    tasks: { md: tasks392, label: 'Tasks' },
    checklist: { md: checklist392, label: 'Checklist', parentStep: 'spec' },
    research: { md: research392, label: 'Research', parentStep: 'plan' },
    'data-model': { md: dataModel392, label: 'Data Model', parentStep: 'plan' },
    contract: { md: contract392, label: 'Contracts', parentStep: 'plan' },
};

const docs172: DocSet = {
    spec: { md: spec172, label: 'Specification' },
    plan: { md: plan172, label: 'Plan' },
    tasks: { md: tasks172, label: 'Tasks' },
    checklist: { md: checklist172, label: 'Checklist', parentStep: 'spec' },
    research: { md: research172, label: 'Research', parentStep: 'plan' },
    'data-model': { md: dataModel172, label: 'Data Model', parentStep: 'plan' },
    quickstart: { md: quickstart172, label: 'Quickstart', parentStep: 'plan' },
    contract: { md: contract172, label: 'Contracts', parentStep: 'plan' },
};

const docs394: DocSet = {
    spec: { md: spec394, label: 'Specification' },
    plan: { md: plan394, label: 'Plan' },
    tasks: { md: tasks394, label: 'Tasks' },
    checklist: { md: checklist394, label: 'Checklist', parentStep: 'spec' },
    research: { md: research394, label: 'Research', parentStep: 'plan' },
    'data-model': { md: dataModel394, label: 'Data Model', parentStep: 'plan' },
    contract: { md: contract394, label: 'UI Contract', parentStep: 'plan' },
};

const docs406: DocSet = {
    spec: { md: spec406, label: 'Specification' },
    plan: { md: plan406, label: 'Plan' },
    tasks: { md: tasks406, label: 'Tasks' },
};

const docs393: DocSet = {
    spec: { md: spec393, label: 'Specification' },
    plan: { md: plan393, label: 'Plan' },
    tasks: { md: tasks393, label: 'Tasks' },
};

const meta: Meta = {
    title: 'Viewer/Full Viewer',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'The whole viewer (stepper + header + content + TOC + footer) on real specs, ' +
                    'with WORKING navigation — click the step tabs and the sub-doc rail to switch ' +
                    'documents, and the Activity toggle to see the real recorded history.',
            },
        },
    },
};
export default meta;
type Story = StoryObj;

// One story per spec — navigate to every document from inside it.

export const LivingSpecsViewer392: Story = {
    name: '392 · Living Specs Viewer',
    render: () => (
        <InteractiveViewer ctx={ctx392} docs={docs392} initialDoc="spec" vs={vsFromContext(ctx392, completedFooter)} />
    ),
};

export const ComposableCommandNodes172: Story = {
    name: '172 · Composable Command Nodes',
    render: () => (
        <InteractiveViewer ctx={ctx172} docs={docs172} initialDoc="spec" vs={vsFromContext(ctx172, completedFooter)} />
    ),
};

export const LivingComponents406: Story = {
    name: '406 · Living Components (Overview + real artifacts)',
    render: () => (
        <InteractiveViewer
            ctx={ctx406}
            docs={docs406}
            initialDoc="spec"
            view="overview"
            vs={vsFromContext(ctx406, completedFooter)}
            livingDocs={{
                'viewer-ui': { md: viewerUiLiving, label: 'viewer-ui' },
                'spec-viewer': { md: specViewerLiving, label: 'spec-viewer' },
            }}
        />
    ),
};

/**
 * The requirement outline (#672 Wave 1), driven through the real renderer.
 *
 * `viewer-ui` is one of the repository's largest living specs — the case the
 * outline exists for. Open it from the Overview's living-spec chip: the outline
 * lists every requirement, each row carries a coverage dot and, once markers are
 * adopted, the count of files it claims.
 */
export const RequirementOutline672: Story = {
    name: '672 · Requirement outline on a large living spec',
    render: () => (
        <InteractiveViewer
            ctx={ctx406}
            docs={docs406}
            initialDoc="living:viewer-ui"
            vs={vsFromContext(ctx406, completedFooter)}
            livingDocs={{
                'viewer-ui': { md: viewerUiLiving, label: 'viewer-ui' },
                'spec-viewer': { md: specViewerLiving, label: 'spec-viewer' },
                // A short, marked spec beside the long unmarked ones, so the file
                // count and a narrow column are both visible in one story.
                marked: {
                    label: 'marked',
                    md: [
                        '# marked',
                        '',
                        '## Purpose',
                        '',
                        'A capability whose requirements carry file markers.',
                        '',
                        '## Requirements',
                        '',
                        '### A requirement whose heading is long enough to need the ellipsis it carries',
                        '<!-- touches: src/alpha/**, src/alpha/extra.ts, src/alpha/third.ts -->',
                        '',
                        'It claims three paths.',
                        '',
                        '#### Scenario: it applies',
                        '- **WHEN** something changes under those paths',
                        '- **THEN** this requirement is the one a run reads',
                        '',
                        '### An unmarked requirement',
                        '',
                        'Read by every run, which is what makes partial adoption safe.',
                        '',
                    ].join('\n'),
                },
            }}
        />
    ),
};

export const IncompleteMetadata393: Story = {
    name: '393 · Incomplete metadata (no Approach)',
    render: () => (
        <InteractiveViewer
            ctx={ctx393}
            docs={docs393}
            initialDoc="spec"
            view="overview"
            vs={vsFromContext(ctx393, completedFooter)}
        />
    ),
};

// ── 394 · the review surface ──
// Lands on Plan, with the plan marked stale, so the whole chrome can be judged
// at once: one header band, a document-local stale notice that does NOT span
// the rail, the rail with its Overview entry, a long right-hand TOC over real
// markdown, and the footer. This is the story the layout review runs against.

export const AdoptCodexDesign394OnPlan: Story = {
    name: '394 · On Plan (chrome + staleness + long TOC)',
    render: () => (
        <InteractiveViewer
            ctx={ctx394}
            docs={docs394}
            initialDoc="plan"
            view="document"
            extraNav={{
                stalenessMap: {
                    plan: {
                        isStale: true,
                        staleReason: 'The specification changed after this plan was generated.',
                        newerUpstream: 'spec',
                    },
                },
            }}
            vs={vsFromContext(ctx394, completedFooter)}
        />
    ),
};

// ── 172 · in-flight implement (synthetic snapshot of the real run) ──

const implementStartIndex = ctx172.history.findIndex(
    (h) => h.step === 'implement' && h.kind === 'start',
);
const historyMidImplement = ctx172.history.slice(
    0,
    implementStartIndex >= 0 ? implementStartIndex + 1 : ctx172.history.length,
);
const midImplementStepHistory = {
    ...stepHistoryFrom(historyMidImplement),
    implement: {
        startedAt: ctx172.history[implementStartIndex]?.at,
        completedAt: null,
    },
} as ViewerState['stepHistory'];

export const Implementing172: Story = {
    name: '172 · Implementing (in flight)',
    render: () => (
        <InteractiveViewer
            ctx={ctx172}
            docs={docs172}
            initialDoc="tasks"
            view="document"
            extraNav={{
                specStatus: 'implementing',
                badgeText: 'IMPLEMENTING',
                taskCompletionPercent: 66,
                currentTask: 'T021',
                stepHistory: midImplementStepHistory,
            }}
            vs={vsFromContext(ctx172, [], {
                status: 'implementing',
                pulse: 'implement',
                steps: { specify: 'completed', plan: 'completed', tasks: 'completed', implement: 'in-progress' },
                history: historyMidImplement,
                stepHistory: midImplementStepHistory,
            })}
        />
    ),
};

// ── 172 · narrow pane · the rail folds to a horizontal strip ──
// Below a container width of 900px the doc-rail becomes a horizontal scrolling
// strip. Each step and its own files form one inline unit — the step tab
// followed by a row of its artifact chips — with a divider between units, so a
// step reads with its own files instead of colliding with the next one.
export const NarrowPaneFold172: Story = {
    name: '172 · Narrow pane (rail folds horizontal, inline step+files units)',
    render: () => (
        <div style="width: 760px; max-width: 100%; height: 100vh; overflow: hidden;">
            <InteractiveViewer
                ctx={ctx172}
                docs={docs172}
                initialDoc="plan"
                view="document"
                vs={vsFromContext(ctx172, completedFooter)}
            />
        </div>
    ),
};
