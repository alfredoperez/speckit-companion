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
 */

import type { Meta, StoryObj } from '@storybook/preact';
import { useEffect, useState } from 'preact/hooks';
import { App } from './App';
import { navState, viewerState, markdownHtml, historyEntries, viewerMode } from './signals';
import type { NavState, ViewerState, DocumentType, HistoryEntry, SerializedFooterAction } from './types';
import { renderMarkdown, setCurrentTask, setHasSpecContext, setTaskSummaries } from './markdown';
import { applyHighlighting } from './highlighting';
import { buildToc } from './toc';
import { mockDoc, mockRelatedDoc, mockNavState } from './components/__stories__/mockData';
import { deriveStepHistory, deriveTimingSummary } from '../../../src/features/specs/stepHistoryDerivation';

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
import spec394 from '../../../specs/394-adopt-codex-design/spec.md?raw';
import plan394 from '../../../specs/394-adopt-codex-design/plan.md?raw';
import tasks394 from '../../../specs/394-adopt-codex-design/tasks.md?raw';
import research394 from '../../../specs/394-adopt-codex-design/research.md?raw';
import dataModel394 from '../../../specs/394-adopt-codex-design/data-model.md?raw';
import checklist394 from '../../../specs/394-adopt-codex-design/checklists/requirements.md?raw';
import contract394 from '../../../specs/394-adopt-codex-design/contracts/ui-contract.md?raw';
import ctx394Raw from '../../../specs/394-adopt-codex-design/.spec-context.json?raw';
import spec406 from '../../../specs/406-living-spec-components/spec.md?raw';
import plan406 from '../../../specs/406-living-spec-components/plan.md?raw';
import tasks406 from '../../../specs/406-living-spec-components/tasks.md?raw';
import ctx406Raw from '../../../specs/406-living-spec-components/.spec-context.json?raw';
import viewerUiLiving from './viewer-ui.spec.md?raw';
import specViewerLiving from '../../../src/features/spec-viewer/spec-viewer.spec.md?raw';
import spec393 from '../../../specs/393-implement-button-lost/spec.md?raw';
import plan393 from '../../../specs/393-implement-button-lost/plan.md?raw';
import tasks393 from '../../../specs/393-implement-button-lost/tasks.md?raw';
import ctx393Raw from '../../../specs/393-implement-button-lost/.spec-context.json?raw';

/** The slice of an on-disk .spec-context.json these stories consume. */
interface SpecContextData {
    specName: string;
    branch: string;
    currentStep: string;
    status: string;
    history: HistoryEntry[];
    currentTask?: string;
    approach?: string;
    last_action?: string;
    task_summaries?: ViewerState['taskSummaries'];
    decisions?: ViewerState['decisions'];
    intent?: string;
    expectations?: string[];
    context?: string[];
    verified?: ViewerState['verified'];
    coverage?: Record<string, { title?: string; tasks?: string[]; tests?: string[] }>;
    classification?: ViewerState['classification'];
    livingSpecs?: {
        loaded?: string[];
        synced?: string[];
    };
}

const ctx392 = JSON.parse(ctx392Raw) as SpecContextData;
const ctx172 = JSON.parse(ctx172Raw) as SpecContextData;
const ctx394 = JSON.parse(ctx394Raw) as SpecContextData;
const ctx406 = JSON.parse(ctx406Raw) as SpecContextData;
const ctx393 = JSON.parse(ctx393Raw) as SpecContextData;

/** Every openable document of a spec, keyed by the `documentType` the nav emits. */
interface DocEntry {
    md: string;
    label: string;
    /** Step tab the doc hangs under in the sub-rail (core docs omit it). */
    parentStep?: string;
}
type DocSet = Record<string, DocEntry>;

const CORE_DOCS = ['spec', 'plan', 'tasks'];

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

function relatedDocsFor(docs: DocSet) {
    return Object.entries(docs)
        .filter(([type]) => !CORE_DOCS.includes(type))
        .map(([type, d]) => mockRelatedDoc(type, d.parentStep ?? 'plan', d.label));
}

function stepHistoryFrom(history: HistoryEntry[]): ViewerState['stepHistory'] {
    const out: Record<string, { startedAt?: string; completedAt?: string | null }> = {};
    for (const h of history) {
        const entry = (out[h.step] ??= {});
        if (h.kind === 'start' && !entry.startedAt) entry.startedAt = h.at;
        if (h.kind === 'complete') entry.completedAt = h.at;
    }
    return out as ViewerState['stepHistory'];
}

function formatDate(iso: string | undefined): string | null {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const completedFooter: SerializedFooterAction[] = [
    { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
    { id: 'reactivate', label: 'Reactivate', scope: 'spec', tooltip: 'Reactivate archived spec' },
];

function navFromContext(ctx: SpecContextData, overrides: Partial<NavState>): NavState {
    return mockNavState({
        coreDocs: [
            mockDoc('spec', true, 'Specification'),
            mockDoc('plan', true, 'Plan'),
            mockDoc('tasks', true, 'Tasks'),
        ],
        workflowPhase: 'implement',
        taskCompletionPercent: 100,
        specStatus: ctx.status,
        activeStep: ctx.currentStep,
        currentStep: ctx.currentStep,
        currentTask: ctx.currentTask ?? null,
        stepHistory: stepHistoryFrom(ctx.history),
        badgeText: ctx.status.toUpperCase(),
        createdDate: formatDate(ctx.history[0]?.at),
        specContextName: ctx.specName,
        branch: ctx.branch,
        activityPanelEnabled: true,
        ...overrides,
    });
}

function vsFromContext(
    ctx: SpecContextData,
    footer: SerializedFooterAction[],
    overrides: Partial<ViewerState> = {},
): ViewerState {
    // Use the same production timing derivation as the extension provider so
    // integrated stories never manufacture durations from raw journal events.
    const derivedStepHistory = deriveStepHistory(
        ctx.history as Parameters<typeof deriveStepHistory>[0],
        ctx.currentStep as Parameters<typeof deriveStepHistory>[1],
        ctx.status as Parameters<typeof deriveStepHistory>[2],
    );
    const coverage = ctx.coverage
        ? Object.entries(ctx.coverage).map(([req, row]) => ({
            req,
            title: row.title,
            tasks: row.tasks ?? [],
            tests: row.tests ?? [],
        }))
        : undefined;
    return {
        status: ctx.status,
        activeStep: ctx.currentStep,
        steps: { specify: 'completed', plan: 'completed', tasks: 'completed', implement: 'completed' },
        pulse: null,
        highlights: [],
        activeSubstep: null,
        footer,
        history: ctx.history,
        stepHistory: derivedStepHistory as ViewerState['stepHistory'],
        timing: deriveTimingSummary(derivedStepHistory),
        approach: ctx.approach,
        lastAction: ctx.last_action,
        taskSummaries: ctx.task_summaries,
        decisions: ctx.decisions,
        intent: ctx.intent,
        expectations: ctx.expectations,
        context: ctx.context,
        verified: ctx.verified,
        coverage,
        classification: ctx.classification,
        livingSpecs: ctx.livingSpecs
            ? { loaded: ctx.livingSpecs.loaded ?? [], synced: ctx.livingSpecs.synced ?? [] }
            : undefined,
        ...overrides,
    } as ViewerState;
}

interface FullViewerProps {
    md: string;
    nav: NavState;
    vs: ViewerState;
    /** Pin the shell view; omit to exercise the real landing-view default. */
    view?: 'overview' | 'document';
}

/** Mounts the real App exactly as index.tsx does: signals in, then the
 *  same post-paint pass (highlighting + TOC build) updateContent runs. */
function FullViewer({ md, nav, vs, view }: FullViewerProps) {
    navState.value = nav;
    viewerState.value = vs;
    historyEntries.value = vs.history ?? [];
    setHasSpecContext(!!(nav.specContextName || nav.badgeText));
    setCurrentTask(nav.currentTask ?? null);
    setTaskSummaries(vs.taskSummaries ?? null);
    markdownHtml.value = renderMarkdown(md);

    useEffect(() => {
        viewerMode.value = view ?? null;
        return () => {
            viewerMode.value = null;
        };
    }, [view]);

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            applyHighlighting();
            buildToc(
                document.getElementById('content-area'),
                document.getElementById('markdown-content'),
                document.getElementById('spec-toc'),
            );
        });
        return () => cancelAnimationFrame(id);
    }, [md]);

    return (
        <div class="viewer-container">
            <App specStatus={nav.specStatus ?? 'active'} />
        </div>
    );
}

interface InteractiveViewerProps {
    ctx: SpecContextData;
    docs: DocSet;
    initialDoc: string;
    vs: ViewerState;
    extraNav?: Partial<NavState>;
    view?: 'overview' | 'document';
    livingDocs?: Record<string, DocEntry>;
}

/** FullViewer + working navigation: answers the nav's `stepperClick` /
 *  `switchDocument` messages in-story, standing in for messageHandlers.ts. */
function InteractiveViewer({ ctx, docs, initialDoc, vs, extraNav, view, livingDocs }: InteractiveViewerProps) {
    const [doc, setDoc] = useState(initialDoc);

    useEffect(() => {
        const host = window as unknown as { vscode: { postMessage: (msg: unknown) => void } };
        const original = host.vscode.postMessage;
        host.vscode.postMessage = (msg: unknown) => {
            const m = msg as { type?: string; phase?: string; documentType?: string; capabilityName?: string };
            if (m?.type === 'stepperClick' && m.phase && docs[m.phase]) {
                setDoc(m.phase);
            } else if (m?.type === 'switchDocument' && m.documentType && docs[m.documentType]) {
                setDoc(m.documentType);
            } else if (m?.type === 'openLivingSpec' && m.capabilityName && livingDocs?.[m.capabilityName]) {
                setDoc(`living:${m.capabilityName}`);
            } else {
                original(msg);
            }
        };
        return () => {
            host.vscode.postMessage = original;
        };
    }, [docs, livingDocs]);

    const livingName = doc.startsWith('living:') ? doc.slice('living:'.length) : null;
    const activeDoc = livingName ? livingDocs?.[livingName] : docs[doc];

    const nav = navFromContext(ctx, {
        currentDoc: (livingName ? 'spec' : doc) as DocumentType,
        relatedDocs: relatedDocsFor(docs),
        isViewingRelatedDoc: livingName ? false : !CORE_DOCS.includes(doc),
        docTypeLabel: activeDoc?.label,
        livingMode: livingName !== null,
        specContextName: livingName ?? ctx.specName,
        ...extraNav,
    });

    return <FullViewer md={activeDoc?.md ?? docs[initialDoc].md} nav={nav} vs={vs} view={livingName ? 'document' : view} />;
}

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
