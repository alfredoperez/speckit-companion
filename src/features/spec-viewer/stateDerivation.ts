/**
 * Pure derivation from `SpecContext` → `ViewerState`.
 *
 * Never touches the filesystem. `deriveStepBadges` uses only `stepHistory`.
 * `pulse` is null when `status` ∈ {completed, archived}.
 *
 * **Inferred completion**: a step is treated as completed when it precedes
 * `currentStep` in `STEP_NAMES` ordering, even if it has no `stepHistory`
 * entry at all (common with external SDD skills that advance `currentStep`
 * without populating per-step history).
 */

import {
    SpecContext,
    StepName,
    StepBadgeState,
    STEP_NAMES,
    ViewerState,
    TaskSummary,
    ConcernEntry,
    CheckpointStatus,
    ReviewComment,
} from '../../core/types/specContext';
import { getFooterActions } from './footerActions';
import { deriveStepHistory } from '../specs/stepHistoryDerivation';
import type { WorkflowStepConfig } from '../workflows/types';

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

function pickRecord<T>(ctx: SpecContext, key: string): Record<string, T> | undefined {
    const v = (ctx as Record<string, unknown>)[key];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    return v as Record<string, T>;
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
            (e.doc === 'spec' || e.doc === 'plan' || e.doc === 'tasks') &&
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

/**
 * Determine whether a step should be treated as completed.
 *
 * A step is completed if:
 * 1. It has explicit `completedAt`, OR
 * 2. Its index in STEP_NAMES is before `currentStep`
 *    (the workflow moved past it — inferred completion).
 */
export function isStepCompleted(
    step: StepName,
    currentStep: StepName,
    stepHistory: Record<string, { startedAt?: string; completedAt?: string | null }>
): boolean {
    const entry = stepHistory[step];
    if (entry?.completedAt) return true;
    const stepIdx = STEP_NAMES.indexOf(step);
    const currentIdx = STEP_NAMES.indexOf(currentStep);
    // Inferred completion: the workflow moved past this step.
    if (stepIdx >= 0 && currentIdx >= 0 && stepIdx < currentIdx) return true;
    // No history entry and not before currentStep → not completed.
    if (!entry?.startedAt) return false;
    return false;
}

export function deriveStepBadges(
    ctx: SpecContext
): Record<string, StepBadgeState> {
    const out: Record<string, StepBadgeState> = {};
    for (const step of STEP_NAMES) {
        if (isStepCompleted(step, ctx.currentStep, ctx.stepHistory)) {
            out[step] = 'completed';
        } else {
            const entry = ctx.stepHistory[step];
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

export function derivePulse(ctx: SpecContext): StepName | null {
    if (ctx.status === 'completed' || ctx.status === 'archived') {
        return null;
    }
    for (const step of STEP_NAMES) {
        const entry = ctx.stepHistory[step];
        if (entry?.startedAt && !isStepCompleted(step, ctx.currentStep, ctx.stepHistory)) {
            return step;
        }
    }
    return null;
}

export function deriveHighlights(ctx: SpecContext): StepName[] {
    return STEP_NAMES.filter(s => isStepCompleted(s, ctx.currentStep, ctx.stepHistory));
}

export function deriveActiveSubstep(
    ctx: SpecContext
): ViewerState['activeSubstep'] {
    for (const step of STEP_NAMES) {
        const entry = ctx.stepHistory[step];
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
    return {
        status: ctx.status,
        activeStep,
        steps: deriveStepBadges(ctx),
        pulse: derivePulse(ctx),
        highlights: deriveHighlights(ctx),
        activeSubstep: deriveActiveSubstep(ctx),
        footer: getFooterActions(ctx, activeStep, workflowSteps),
        transitions: ctx.transitions ?? [],
        // Derive stepHistory from the reliable transitions[] sequence rather
        // than trusting the on-disk stepHistory (AI-typed, unreliable).
        stepHistory: deriveStepHistory(ctx.transitions ?? [], ctx.currentStep),
        approach: pickString(ctx, 'approach'),
        lastAction: pickString(ctx, 'last_action'),
        taskSummaries: pickRecord<TaskSummary>(ctx, 'task_summaries'),
        decisions: pickStringArray(ctx, 'decisions'),
        concerns: pickConcerns(ctx),
        filesModified: pickStringArray(ctx, 'files_modified'),
        prUrl: pickString(ctx, 'prUrl'),
        prNumber: pickNumber(ctx, 'prNumber'),
        checkpointStatus: pickCheckpointStatus(ctx),
        stepSummaries: pickRecord<Record<string, unknown>>(ctx, 'step_summaries'),
        reviewComments: pickReviewComments(ctx),
    };
}
