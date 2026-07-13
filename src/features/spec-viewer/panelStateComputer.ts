/**
 * PanelStateComputer — pure derivation of viewer state.
 *
 * `SpecViewerProvider.updateContent()` and `SpecViewerProvider.sendContentUpdateMessage()`
 * were independently deriving the same set of values from the same inputs:
 * stepHistory, badges, phases, task completion %, spec status, badge text,
 * created/lastUpdated dates, footer approve-button state, core/related doc
 * partition. The duplication was the root of the "227-line updateContent"
 * smell — most of those 227 lines were derivation, mixed in with I/O.
 *
 * This module owns that derivation as a single pure function. No `vscode`
 * import, no `fs`, no `path` resolution. The provider owns the I/O (read
 * documents, read tasks.md, read featureCtx, scan staleness, run-step
 * probe); it then calls `computePanelDerivedState()` with the gathered
 * inputs and hands the result to `generateHtml()` or to `postMessage` as a
 * `NavState` ingredient.
 *
 * Testability is the second prize: the pure function can be exercised
 * against synthetic fixtures with no jest.mock(vscode) song-and-dance.
 */

import {
    CORE_DOCUMENTS,
    DocumentType,
    EnhancementButton,
    SpecDocument,
    SpecStatus,
} from "./types";
import { SpecStatuses } from "../../core/constants";
import {
    calculatePhases,
    calculateTaskCompletion,
    calculateWorkflowPhase,
    computeBadgeText,
    computeCreatedDate,
    computeLastUpdatedDate,
    getPhaseNumber,
    mapStepToTab,
} from "./phaseCalculation";
import { isStepCompleted } from "./stateDerivation";
import { computeRunRecovery, RunRecoveryState } from "./runRecovery";
import type { FeatureWorkflowContext } from "../workflows/types";
import { deriveStepHistory, getSpecStatus } from "../specs/stepHistoryDerivation";
import { StepName, Status } from "../../core/types/specContext";
import type { PhaseInfo } from "./types";

// ─── Document resolution ────────────────────────────────────────────────────

/**
 * Resolve the spec document to display, given a requested type. Cascades:
 *   1. Exact `documentType` match.
 *   2. Filename match — e.g. `documentType="spec"` against a doc whose
 *      fileName is `"spec.md"` (handles the spec/specify alias).
 *   3. First core doc that exists on disk.
 *   4. First document in the list.
 * If the resolved doc is a non-existent core doc but a sub-spec of the same
 * type exists, redirect to that sub-spec (lets the viewer surface real
 * content even when the canonical core file is empty).
 */
export function resolveDisplayDocument(
    documents: SpecDocument[],
    requestedType: DocumentType,
): SpecDocument | undefined {
    // Action-only pipeline entries carry no file — they can never be displayed.
    const openable = documents.filter(d => d.category !== 'action');
    if (openable.length === 0) return undefined;

    let doc = openable.find(d => d.type === requestedType);
    if (!doc) {
        const requestedFile = `${requestedType}.md`;
        doc = openable.find(d => d.isCore && d.fileName === requestedFile);
    }
    if (!doc) doc = openable.find(d => d.isCore && d.exists);
    if (!doc) doc = openable[0];

    if (doc && !doc.exists && doc.isCore) {
        const firstSubSpec = documents.find(d => d.parentStep === doc!.type && d.exists);
        if (firstSubSpec) return firstSubSpec;
    }
    return doc;
}

/**
 * Tab-click variant of `resolveDisplayDocument`. The full cascade isn't
 * appropriate when the user is explicitly clicking a tab — we should honour
 * their pick or fail visibly, not silently fall back to a sibling. We only
 * redirect when the chosen core doc doesn't exist but a sub-spec under the
 * same parentStep does.
 */
export function resolveTabClickDocument(
    documents: SpecDocument[],
    documentType: DocumentType,
): SpecDocument | undefined {
    const doc = documents.find(d => d.type === documentType && d.category !== 'action');
    if (!doc) return undefined;
    if (!doc.exists && doc.isCore) {
        const firstSubSpec = documents.find(d => d.parentStep === documentType && d.exists);
        if (firstSubSpec) return firstSubSpec;
    }
    return doc;
}

// ─── Pure derivation ────────────────────────────────────────────────────────

export interface PanelStateInputs {
    /** All documents discovered for the spec (core + related). */
    documents: SpecDocument[];
    /** The document the viewer will render (output of `resolveDisplayDocument` or `resolveTabClickDocument`). */
    doc: SpecDocument | undefined;
    /**
     * Contents of `tasks.md` (may be empty string). Used to compute
     * completion %. When the active doc IS `tasks.md`, callers should
     * substitute the active content here — that decision lives upstream in
     * `specViewerProvider.readTasksContent` so this module stays pure.
     */
    tasksContent: string;
    /** Parsed `.spec-context.json` (undefined when the file is missing/unreadable). */
    featureCtx: FeatureWorkflowContext | undefined;
    /**
     * Newest mtime (ms epoch) across the spec's activity files (spec-context,
     * events log, spec `*.md`). The provider computes this I/O and passes it so
     * run-recovery derivation stays pure. Undefined disables the affordance.
     */
    newestActivityMs?: number;
    /** Now, ms epoch. The provider injects `Date.now()`; tests inject a fixed clock. */
    nowMs?: number;
}

export interface PanelDerivedState {
    /** Per-step timing derived from `featureCtx.history` (undefined when no ctx). */
    derivedStepHistory: Record<string, { startedAt?: string; completedAt?: string | null }> | undefined;
    /** Same as `derivedStepHistory` but keyed by *tab* name (collapses `implement` → `tasks`). */
    stepHistoryByTab: Record<string, { startedAt?: string; completedAt?: string | null }> | undefined;
    /** Per-step badge state for the stepper. */
    stepBadges: Record<string, 'not-started' | 'in-progress' | 'completed'> | undefined;

    phases: PhaseInfo[];
    currentPhase: 1 | 2 | 3 | 4;
    workflowPhase: string;

    taskCompletionPercent: number;
    specStatus: SpecStatus;

    badgeText: string | null;
    createdDate: string | null;
    lastUpdatedDate: string | null;

    /** Core + related doc partitions; used to build NavState. */
    coreDocs: SpecDocument[];
    relatedDocs: SpecDocument[];
    /** Ordered pipeline (core + action steps) — what the rail renders. */
    pipelineDocs: SpecDocument[];
    isViewingRelatedDoc: boolean;

    /** Footer approve-button state (the "advance to next phase" affordance). */
    footer: { showApproveButton: boolean; approveText: string };

    /** Run-recovery affordance state (the "still running?" strip). Issue #418. */
    runRecovery: RunRecoveryState;
}

/**
 * Single pure derivation. Hands the provider every value it needs to either
 * render the HTML (full update) or build a NavState (tab click).
 */
export function computePanelDerivedState(
    inputs: PanelStateInputs,
    enhancementButtons: EnhancementButton[],
): PanelDerivedState {
    const { documents, doc, tasksContent, featureCtx, newestActivityMs, nowMs } = inputs;

    const derivedStepHistory = featureCtx
        ? deriveStepHistory(
            (featureCtx.history ?? []) as unknown as Parameters<typeof deriveStepHistory>[0],
            featureCtx.currentStep as StepName | undefined,
            featureCtx.status as Status | undefined,
        )
        : undefined;

    const stepHistoryByTab = mapStepHistoryToTabKeys(derivedStepHistory);

    const stepBadges = derivedStepHistory && featureCtx?.currentStep
        ? deriveStepBadgesWithAlias(derivedStepHistory, featureCtx.currentStep)
        : undefined;

    const docType = doc?.type ?? CORE_DOCUMENTS.SPEC;
    const phases = calculatePhases(documents, docType, tasksContent, undefined, stepBadges);
    const currentPhase = getPhaseNumber(docType);

    const taskCompletionPercent = calculateTaskCompletion(tasksContent, CORE_DOCUMENTS.TASKS);

    const specStatus = resolveSpecStatus(featureCtx, taskCompletionPercent);

    const badgeText = computeBadgeText(featureCtx, derivedStepHistory);
    const createdDate = computeCreatedDate(derivedStepHistory);
    const lastUpdatedDate = computeLastUpdatedDate(derivedStepHistory);

    const coreDocs = documents.filter(d => d.category === 'core');
    const relatedDocs = documents.filter(d => d.category === 'related');
    const pipelineDocs = documents.filter(d => d.category === 'core' || d.category === 'action');
    const coreDocTypes = coreDocs.map(d => d.type);
    const isViewingRelatedDoc = !coreDocTypes.includes(docType);
    const workflowPhase = calculateWorkflowPhase(coreDocs);

    const footer = computeApproveFooter(coreDocs, relatedDocs, docType, isViewingRelatedDoc, taskCompletionPercent);

    const runRecovery = computeRunRecovery({
        currentStep: featureCtx?.currentStep,
        status: featureCtx?.status,
        newestActivityMs,
        nowMs: nowMs ?? 0,
    });

    // `enhancementButtons` is passed through unchanged — it's an input here
    // because resolving customCommands needs vscode.workspace.getConfiguration,
    // which is I/O the provider owns. We return it alongside derived state
    // for symmetric NavState construction at the call site.
    void enhancementButtons;

    return {
        derivedStepHistory,
        stepHistoryByTab,
        stepBadges,
        phases,
        currentPhase,
        workflowPhase,
        taskCompletionPercent,
        specStatus,
        badgeText,
        createdDate,
        lastUpdatedDate,
        coreDocs,
        relatedDocs,
        pipelineDocs,
        isViewingRelatedDoc,
        footer,
        runRecovery,
    };
}

// ─── Helpers (also exported for tests) ──────────────────────────────────────

/**
 * Spec status derivation — re-exported from the canonical home in
 * `features/specs/stepHistoryDerivation.ts` under the original name
 * `resolveSpecStatus` for back-compat with this module's call sites and
 * tests. New callers should import `getSpecStatus` from `specs/` directly.
 */
export function resolveSpecStatus(
    featureCtx: FeatureWorkflowContext | undefined,
    taskCompletionPercent: number,
): SpecStatus {
    return getSpecStatus(featureCtx, taskCompletionPercent) as SpecStatus;
}

/**
 * Approve-button footer state. The visible "Plan / Tasks / Implement" button
 * surfaces when there is a next core step the user can advance to.
 */
export function computeApproveFooter(
    coreDocs: SpecDocument[],
    relatedDocs: SpecDocument[],
    docType: DocumentType,
    isViewingRelatedDoc: boolean,
    taskCompletionPercent: number,
): { showApproveButton: boolean; approveText: string } {
    let currentIndex = coreDocs.findIndex(d => d.type === docType);
    if (currentIndex < 0 && isViewingRelatedDoc) {
        const parentStep = relatedDocs.find(d => d.type === docType)?.parentStep;
        if (parentStep) currentIndex = coreDocs.findIndex(d => d.type === parentStep);
    }
    if (currentIndex >= 0 && currentIndex < coreDocs.length - 1) {
        const nextDoc = coreDocs[currentIndex + 1];
        if (!nextDoc.exists) return { showApproveButton: true, approveText: nextDoc.label };
    } else if (currentIndex === coreDocs.length - 1) {
        if (taskCompletionPercent < 100) return { showApproveButton: true, approveText: 'Implement' };
    }
    return { showApproveButton: false, approveText: '' };
}

/**
 * Map stepHistory keys from step names to tab names. `mapStepToTab`
 * collapses `tasks` and `implement` onto the `tasks` tab key (Implement has
 * no dedicated tab). When a later step aliases onto the same key, the
 * resolution prefers (1) the entry whose own step name equals the tab key
 * (e.g. `tasks` wins over `implement` for the `tasks` tab), then (2) a
 * completed entry over an in-flight one, then (3) earlier `startedAt` over
 * later. Without this priority, a producer that emits `implement` before
 * `tasks` (or with later `startedAt`) would shadow `tasks`' real duration on
 * the Tasks tab — order-dependence we don't want to rely on.
 */
export function mapStepHistoryToTabKeys(
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>,
): Record<string, { startedAt?: string; completedAt?: string | null }> | undefined {
    if (!stepHistory) return undefined;
    const out: Record<string, { startedAt?: string; completedAt?: string | null }> = {};
    const winningStep: Record<string, string> = {};

    for (const [step, entry] of Object.entries(stepHistory)) {
        const tabName = mapStepToTab(step) || step;
        const incumbent = out[tabName];
        if (!incumbent) {
            out[tabName] = entry;
            winningStep[tabName] = step;
            continue;
        }
        // 1. The entry whose step name equals the tab name wins.
        if (step === tabName) {
            out[tabName] = entry;
            winningStep[tabName] = step;
            continue;
        }
        if (winningStep[tabName] === tabName) continue;
        // 2. Completed entries beat in-flight ones.
        if (entry.completedAt && !incumbent.completedAt) {
            out[tabName] = entry;
            winningStep[tabName] = step;
            continue;
        }
        if (!entry.completedAt && incumbent.completedAt) continue;
        // 3. Earlier startedAt wins (preserves the historical first run).
        if (entry.startedAt && incumbent.startedAt && entry.startedAt < incumbent.startedAt) {
            out[tabName] = entry;
            winningStep[tabName] = step;
        }
    }
    return out;
}

/**
 * Per-step badge state with the `specify` → `spec` alias copy used by the
 * 4-phase fallback stepper.
 */
export function deriveStepBadgesWithAlias(
    stepHistory: Record<string, { startedAt?: string; completedAt?: string | null }>,
    currentStep?: string,
): Record<string, 'not-started' | 'in-progress' | 'completed'> {
    const out: Record<string, 'not-started' | 'in-progress' | 'completed'> = {};
    const cs = (currentStep ?? 'specify') as StepName;
    for (const [step, entry] of Object.entries(stepHistory)) {
        if (!entry?.startedAt) out[step] = 'not-started';
        else if (isStepCompleted(step as StepName, cs, stepHistory)) out[step] = 'completed';
        else out[step] = 'in-progress';
    }
    if (out['specify'] && !out['spec']) out['spec'] = out['specify'];
    return out;
}
