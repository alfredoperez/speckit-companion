/**
 * Shared harness for every story that mounts the WHOLE spec viewer.
 *
 * This was inlined in `FullViewer.stories.tsx` until the video-capture
 * stories needed the same thing. It is a plain module, not a CSF file, so
 * both story files can import it without Storybook mistaking a helper for a
 * story.
 *
 * Two rules it exists to enforce:
 *
 *  1. Mount the REAL `App`, exactly as `index.tsx` does — signals in, then
 *     the same post-paint pass (highlighting + TOC build) that
 *     `updateContent` runs. No story-only rendering path.
 *  2. Derive from PRODUCTION code. `deriveStepHistory` / `deriveTimingSummary`
 *     are the extension provider's own pure functions, so a story can never
 *     manufacture a duration the product would not show.
 */

import { useEffect, useState } from 'preact/hooks';
import { App } from '../App';
import { navState, viewerState, markdownHtml, historyEntries, viewerMode } from '../signals';
import type { NavState, ViewerState, DocumentType, HistoryEntry, SerializedFooterAction } from '../types';
import { renderMarkdown, setCurrentTask, setHasSpecContext, setTaskSummaries } from '../markdown';
import { applyHighlighting } from '../highlighting';
import { buildToc } from '../toc';
import { mockDoc, mockRelatedDoc, mockNavState } from '../components/__stories__/mockData';
import { deriveStepHistory, deriveTimingSummary } from '../../../../src/features/specs/stepHistoryDerivation';

/** The slice of an on-disk .spec-context.json these stories consume. */
export interface SpecContextData {
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

/** Every openable document of a spec, keyed by the `documentType` the nav emits. */
export interface DocEntry {
    md: string;
    label: string;
    /** Step tab the doc hangs under in the sub-rail (core docs omit it). */
    parentStep?: string;
}
export type DocSet = Record<string, DocEntry>;

export const CORE_DOCS = ['spec', 'plan', 'tasks'];

export function relatedDocsFor(docs: DocSet) {
    return Object.entries(docs)
        .filter(([type]) => !CORE_DOCS.includes(type))
        .map(([type, d]) => mockRelatedDoc(type, d.parentStep ?? 'plan', d.label));
}

export function stepHistoryFrom(history: HistoryEntry[]): ViewerState['stepHistory'] {
    const out: Record<string, { startedAt?: string; completedAt?: string | null }> = {};
    for (const h of history) {
        const entry = (out[h.step] ??= {});
        if (h.kind === 'start' && !entry.startedAt) entry.startedAt = h.at;
        if (h.kind === 'complete') entry.completedAt = h.at;
    }
    return out as ViewerState['stepHistory'];
}

export function formatDate(iso: string | undefined): string | null {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const completedFooter: SerializedFooterAction[] = [
    { id: 'archive', label: 'Archive', scope: 'spec', tooltip: 'Archive this spec' },
    { id: 'reactivate', label: 'Reactivate', scope: 'spec', tooltip: 'Reactivate archived spec' },
];

export function navFromContext(ctx: SpecContextData, overrides: Partial<NavState>): NavState {
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

export function vsFromContext(
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

export interface FullViewerProps {
    md: string;
    nav: NavState;
    vs: ViewerState;
    /** Pin the shell view; omit to exercise the real landing-view default. */
    view?: 'overview' | 'document';
}

/** Mounts the real App exactly as index.tsx does: signals in, then the
 *  same post-paint pass (highlighting + TOC build) updateContent runs. */
export function FullViewer({ md, nav, vs, view }: FullViewerProps) {
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

export interface InteractiveViewerProps {
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
export function InteractiveViewer({ ctx, docs, initialDoc, vs, extraNav, view, livingDocs }: InteractiveViewerProps) {
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
