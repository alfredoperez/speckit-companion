/**
 * Pure derivation from `SpecContext` → `ViewerState`.
 *
 * Never touches the filesystem. Per-step timing (`stepHistory`) is derived
 * in-memory from the canonical `history[]` log — the on-disk file no longer
 * carries a `stepHistory` field. `pulse` is null when
 * `status` ∈ {completed, archived}.
 *
 * **Inferred completion**: a step is treated as completed when it precedes
 * `currentStep` in `STEP_NAMES` ordering, even if it has no history entry
 * at all (common with external skills that advance `currentStep`
 * without writing per-step entries).
 */

import {
    SpecContext,
    StepName,
    StepHistoryEntry,
    StepBadgeState,
    STEP_NAMES,
    ViewerState,
    ViewerDecision,
    ViewerVerification,
    ViewerCoverageRow,
    ClassificationEntry,
    TaskSummary,
    ConcernEntry,
    CheckpointStatus,
    ReviewComment,
    LivingSpecsView,
} from '../../core/types/specContext';
import { getFooterActions } from './footerActions';
import { deriveStepHistory, deriveTimingSummary } from '../specs/stepHistoryDerivation';
import type { WorkflowStepConfig } from '../workflows/types';

type DerivedHistory = Record<string, StepHistoryEntry>;

/**
 * Pull a tolerated extra field from `SpecContext` (it has a permissive
 * `[key: string]: unknown` index signature). Returns `undefined` when the
 * field is missing or doesn't match the expected runtime type.
 */
function pickString(ctx: SpecContext, key: string): string | undefined {
    const v = (ctx as Record<string, unknown>)[key];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function pickNumber(ctx: SpecContext, key: string): number | undefined {
    const v = (ctx as Record<string, unknown>)[key];
    return typeof v === 'number' ? v : undefined;
}

function pickStringArray(ctx: SpecContext, key: string): string[] | undefined {
    const v = (ctx as Record<string, unknown>)[key];
    if (!Array.isArray(v)) return undefined;
    const filtered = v.filter((x): x is string => typeof x === 'string');
    return filtered.length > 0 ? filtered : undefined;
}

function coerceNameList(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const x of v) {
        if (typeof x !== 'string') continue;
        const t = x.trim();
        if (t.length > 0) out.push(t);
    }
    return out;
}

function pickLivingSpecs(ctx: SpecContext): LivingSpecsView | undefined {
    const v = (ctx as Record<string, unknown>)['livingSpecs'];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    const ls = v as Record<string, unknown>;
    const loaded = coerceNameList(ls.loaded);
    const synced = coerceNameList(ls.synced);
    if (loaded.length === 0 && synced.length === 0) return undefined;
    return { loaded, synced };
}

function pickRecord<T>(ctx: SpecContext, key: string): Record<string, T> | undefined {
    const v = (ctx as Record<string, unknown>)[key];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    return v as Record<string, T>;
}

/**
 * Normalize a JSON-or-text capture list: bare strings wrap under the identity
 * key, objects carrying it pass through (extra keys kept), anything else is
 * skipped. Mirrors the writer's tolerance so legacy and structured entries
 * render side by side.
 */
function pickEntryList<T extends Record<string, unknown>>(
    ctx: SpecContext,
    key: string,
    identityKey: string,
): T[] | undefined {
    const v = (ctx as Record<string, unknown>)[key];
    if (!Array.isArray(v) || v.length === 0) return undefined;
    const out: T[] = [];
    for (const entry of v) {
        if (typeof entry === 'string' && entry.trim().length > 0) {
            out.push({ [identityKey]: entry } as T);
        } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            const e = entry as Record<string, unknown>;
            if (typeof e[identityKey] === 'string' && (e[identityKey] as string).trim().length > 0) {
                out.push(e as T);
            }
        }
    }
    return out.length > 0 ? out : undefined;
}

/** Keep an optional field only when it's a non-empty string — a malformed capture must not reach the renderer. */
function optString(v: unknown): string | undefined {
    return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

function pickDecisions(ctx: SpecContext): ViewerDecision[] | undefined {
    const raw = pickEntryList<Record<string, unknown>>(ctx, 'decisions', 'decision');
    return raw?.map(e => ({
        decision: e.decision as string,
        why: optString(e.why),
        rejected: optString(e.rejected),
    }));
}

function pickVerified(ctx: SpecContext): ViewerVerification[] | undefined {
    const raw = pickEntryList<Record<string, unknown>>(ctx, 'verified', 'what');
    return raw?.map(e => {
        const warnings = coerceNameList(e.warnings);
        return {
            what: e.what as string,
            result: optString(e.result),
            command: optString(e.command),
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    });
}

function pickCoverage(ctx: SpecContext): ViewerCoverageRow[] | undefined {
    const v = (ctx as Record<string, unknown>)['coverage'];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    const rows: ViewerCoverageRow[] = [];
    for (const [req, entry] of Object.entries(v as Record<string, unknown>)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const e = entry as Record<string, unknown>;
        rows.push({
            req,
            title: typeof e.title === 'string' && e.title.trim() ? e.title : undefined,
            tasks: coerceNameList(e.tasks),
            tests: coerceNameList(e.tests),
        });
    }
    if (rows.length === 0) return undefined;
    rows.sort((a, b) => a.req.localeCompare(b.req, undefined, { numeric: true }));
    return rows;
}

function pickClassification(ctx: SpecContext): ClassificationEntry | undefined {
    const v = (ctx as Record<string, unknown>)['classification'];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    const e = v as Record<string, unknown>;
    if (typeof e.verdict !== 'string') return undefined;
    return e as unknown as ClassificationEntry;
}

function pickConcerns(ctx: SpecContext): ConcernEntry[] | undefined {
    const v = (ctx as Record<string, unknown>)['concerns'];
    if (!Array.isArray(v) || v.length === 0) return undefined;
    const out: ConcernEntry[] = [];
    for (const entry of v) {
        if (typeof entry === 'string') {
            out.push({ note: entry });
        } else if (entry && typeof entry === 'object') {
            const e = entry as Record<string, unknown>;
            if (typeof e.note === 'string') {
                out.push({ task: typeof e.task === 'string' ? e.task : undefined, note: e.note });
            }
        }
    }
    return out.length > 0 ? out : undefined;
}

function pickReviewComments(ctx: SpecContext): ReviewComment[] | undefined {
    const v = (ctx as Record<string, unknown>)['reviewComments'];
    if (!Array.isArray(v) || v.length === 0) return undefined;
    const out: ReviewComment[] = [];
    for (const entry of v) {
        if (!entry || typeof entry !== 'object') continue;
        const e = entry as Record<string, unknown>;
        const anchor = e.anchor as Record<string, unknown> | undefined;
        if (
            typeof e.id === 'string' &&
            typeof e.doc === 'string' && e.doc.length > 0 &&
            typeof e.comment === 'string' &&
            (e.status === 'pending' || e.status === 'applied') &&
            typeof e.createdAt === 'string' &&
            anchor && typeof anchor === 'object' &&
            typeof anchor.blockText === 'string' &&
            typeof anchor.line === 'number'
        ) {
            out.push({
                id: e.id,
                doc: e.doc,
                anchor: {
                    heading: typeof anchor.heading === 'string' ? anchor.heading : null,
                    blockText: anchor.blockText,
                    line: anchor.line,
                },
                comment: e.comment,
                status: e.status,
                createdAt: e.createdAt,
            });
        }
    }
    return out.length > 0 ? out : undefined;
}

function pickCheckpointStatus(ctx: SpecContext): CheckpointStatus | undefined {
    const v = (ctx as Record<string, unknown>)['checkpointStatus'];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    const r = v as Record<string, unknown>;
    const out: CheckpointStatus = {};
    if (typeof r.commit === 'boolean') out.commit = r.commit;
    if (typeof r.pr === 'boolean') out.pr = r.pr;
    return out.commit !== undefined || out.pr !== undefined ? out : undefined;
}

// `isStepCompleted` lives in `src/features/specs/stepHistoryDerivation.ts`
// (the canonical home for spec-state queries — the sidebar imports from
// there too). Re-exported here for backward compatibility with the test
// suite and any external callers.
import { isStepCompleted, isTerminalStatus } from '../specs/stepHistoryDerivation';
export { isStepCompleted };

export function deriveStepBadges(
    ctx: SpecContext,
    stepHistory: DerivedHistory = deriveStepHistory(ctx.history ?? [], ctx.currentStep, ctx.status)
): Record<string, StepBadgeState> {
    const out: Record<string, StepBadgeState> = {};
    for (const step of STEP_NAMES) {
        if (isStepCompleted(step, ctx.currentStep, stepHistory)) {
            out[step] = 'completed';
        } else {
            const entry = stepHistory[step];
            out[step] = entry?.startedAt ? 'in-progress' : 'not-started';
        }
    }
    return out;
}

/**
 * The step currently in flight: `startedAt` set, no `completedAt`. Distinct from
 * `derivePulse`, which also treats steps before `currentStep` as complete
 * (inferred completion). This is the literal "running" entry used for the
 * footer's Generating state and the manual mark-complete action.
 */
export function findRunningStep(
    stepHistory: Record<string, { startedAt?: string; completedAt?: string | null }> | undefined
): { step: string; startedAt: string | null } | null {
    if (!stepHistory) return null;
    for (const [step, entry] of Object.entries(stepHistory)) {
        if (entry?.startedAt && !entry?.completedAt) {
            return { step, startedAt: entry.startedAt ?? null };
        }
    }
    return null;
}

export function derivePulse(
    ctx: SpecContext,
    stepHistory: DerivedHistory = deriveStepHistory(ctx.history ?? [], ctx.currentStep, ctx.status)
): StepName | null {
    if (isTerminalStatus(ctx.status)) {
        return null;
    }
    for (const step of STEP_NAMES) {
        const entry = stepHistory[step];
        if (entry?.startedAt && !isStepCompleted(step, ctx.currentStep, stepHistory)) {
            return step;
        }
    }
    return null;
}

export function deriveHighlights(
    ctx: SpecContext,
    stepHistory: DerivedHistory = deriveStepHistory(ctx.history ?? [], ctx.currentStep, ctx.status)
): StepName[] {
    return STEP_NAMES.filter(s => isStepCompleted(s, ctx.currentStep, stepHistory));
}

export function deriveActiveSubstep(
    ctx: SpecContext,
    stepHistory: DerivedHistory = deriveStepHistory(ctx.history ?? [], ctx.currentStep, ctx.status)
): ViewerState['activeSubstep'] {
    for (const step of STEP_NAMES) {
        const entry = stepHistory[step];
        const active = entry?.substeps?.find(s => !s.completedAt);
        if (active) return { step, name: active.name };
    }
    const progress = (ctx as { progress?: string | null }).progress;
    if (progress) return { step: ctx.currentStep, name: progress };
    return null;
}

export function deriveViewerState(
    ctx: SpecContext,
    activeStep: StepName = ctx.currentStep,
    workflowSteps?: WorkflowStepConfig[]
): ViewerState {
    // Derive stepHistory once from the canonical history[] sequence and reuse
    // it across all the per-step derivations below.
    const stepHistory = deriveStepHistory(ctx.history ?? [], ctx.currentStep, ctx.status);
    const expectedTimingPhases = workflowSteps?.length
        ? workflowSteps.map(step => step.name)
        : ['specify', 'plan', 'tasks', 'implement'];
    return {
        status: ctx.status,
        activeStep,
        steps: deriveStepBadges(ctx, stepHistory),
        pulse: derivePulse(ctx, stepHistory),
        highlights: deriveHighlights(ctx, stepHistory),
        activeSubstep: deriveActiveSubstep(ctx, stepHistory),
        footer: getFooterActions(ctx, activeStep, workflowSteps),
        history: ctx.history ?? [],
        stepHistory,
        timing: deriveTimingSummary(stepHistory, expectedTimingPhases),
        approach: pickString(ctx, 'approach'),
        lastAction: pickString(ctx, 'last_action'),
        taskSummaries: pickRecord<TaskSummary>(ctx, 'task_summaries'),
        decisions: pickDecisions(ctx),
        concerns: pickConcerns(ctx),
        filesModified: pickStringArray(ctx, 'files_modified'),
        prUrl: pickString(ctx, 'prUrl'),
        prNumber: pickNumber(ctx, 'prNumber'),
        checkpointStatus: pickCheckpointStatus(ctx),
        stepSummaries: pickRecord<Record<string, unknown>>(ctx, 'step_summaries'),
        reviewComments: pickReviewComments(ctx),
        livingSpecs: pickLivingSpecs(ctx),
        intent: pickString(ctx, 'intent'),
        expectations: pickStringArray(ctx, 'expectations'),
        context: pickStringArray(ctx, 'context'),
        verified: pickVerified(ctx),
        coverage: pickCoverage(ctx),
        classification: pickClassification(ctx),
    };
}
