/**
 * One-time reconciliation for `.spec-context.json`.
 *
 * With `history[]` as the single source of truth (and `stepHistory` derived
 * in-memory by the viewer), the reconciler is mostly defensive:
 *
 *   - Repairs invalid `status` strings.
 *   - Detects the "currentStep ahead of history" failure mode (the AI
 *     flipped `currentStep` but forgot to append the matching history
 *     entry). Logs a warning so we can see the gap; does not try to
 *     synthesize entries — `history` is append-only and dishonest
 *     backfills are worse than a visible warning.
 *
 * Returns the corrected context if any change was made, or `null` if clean.
 */

import {
    HistoryEntry,
    SpecContext,
    STATUSES,
    STATUS_OWNING_STEP,
    STEP_NAMES,
    Status,
    StepName,
} from '../../core/types/specContext';
import { updateSpecContext } from './specContextWriter';

function deriveStatusFromCurrentStep(currentStep: StepName): Status {
    switch (currentStep) {
        case 'specify':
        case 'clarify':
            return 'specifying';
        case 'plan':
            return 'planning';
        case 'tasks':
        case 'analyze':
            return 'tasking';
        case 'implement':
            return 'implementing';
    }
}

function deriveCompletedStatus(currentStep: StepName): Status {
    switch (currentStep) {
        case 'specify':
        case 'clarify':
            return 'specified';
        case 'plan':
            return 'planned';
        case 'tasks':
        case 'analyze':
            return 'ready-to-implement';
        case 'implement':
            return 'completed';
    }
}

/**
 * Pure function: detect and fix issues in a SpecContext.
 * Returns a corrected copy if changes were needed, or `null` if clean.
 */
export function reconcile(ctx: SpecContext): SpecContext | null {
    let changed = false;
    let result: SpecContext = { ...ctx };

    if (STEP_NAMES.indexOf(ctx.currentStep) < 0) return null;

    // Repair non-canonical status. With history-only, "completed" is decided
    // by whether the last history entry for currentStep was a completion
    // (`from.step === currentStep`).
    if (!(STATUSES as string[]).includes(result.status)) {
        const completed = isLastEntryACompletionFor(result.history, result.currentStep);
        result = {
            ...result,
            status: completed
                ? deriveCompletedStatus(result.currentStep)
                : deriveStatusFromCurrentStep(result.currentStep),
        };
        changed = true;
    }

    // Roll back currentStep when it disagrees with `status`.
    //
    // Failure mode: the old preamble (d) instruction told the AI to
    // atomically advance currentStep + append a start-entry on completion.
    // Single-step commands (e.g. /speckit.specify) wrote `currentStep: plan,
    // status: specified, history: […, plan-start]` — a phantom "Generating
    // Plan…" state with no AI actually planning. The preamble is fixed in
    // v0.21.0, but files already on disk need recovery: trust `status`
    // (which the AI generally gets right for the step it just completed)
    // and roll `currentStep` back to whatever step that completed status
    // belongs to.
    const owner = stepOwningCompletedStatus(result.status);
    if (owner && owner !== result.currentStep) {
        result = { ...result, currentStep: owner };
        changed = true;
    }

    // Settle a lagging in-progress status. When history records the current
    // step's completion but `status` still names that step running — a
    // journal-only `--finish` self-close with no hook to flip the status — move
    // status forward to the step's settled form (`tasking → ready-to-implement`)
    // so the on-disk record matches the run and the panel unlocks. Forward-only
    // and never for implement: reaching the terminal `completed` stays the
    // user's mark-complete action.
    const inProgress = STATUS_OWNING_STEP.get(result.status);
    if (
        inProgress &&
        !inProgress.settled &&
        inProgress.step === result.currentStep &&
        result.currentStep !== 'implement' &&
        isStepCompletedInHistory(result.history, result.currentStep)
    ) {
        result = { ...result, status: deriveCompletedStatus(result.currentStep) };
        changed = true;
    }

    return changed ? result : null;
}

/**
 * A step is settled when its latest step-level entry in history is a completion
 * (`kind === 'complete'`, or the legacy `from.step === step` form). Substep
 * entries are skipped so a `tasks/generate` finish never counts as the
 * step-level close.
 */
function isStepCompletedInHistory(history: HistoryEntry[], step: StepName): boolean {
    for (let i = history.length - 1; i >= 0; i--) {
        const e = history[i];
        if (e.step !== step || e.substep) continue;
        return e.kind === 'complete' || e.from?.step === step;
    }
    return false;
}

/**
 * Reverse map: which step "owns" each completed-form status? E.g. `specified`
 * → `specify`, `planned` → `plan`. Returns `null` for in-progress or terminal
 * statuses (no rollback signal).
 */
function stepOwningCompletedStatus(status: SpecContext['status']): StepName | null {
    switch (status) {
        case 'specified':
            return 'specify';
        case 'planned':
            return 'plan';
        case 'ready-to-implement':
            return 'tasks';
        case 'implemented':
            return 'implement';
        default:
            return null;
    }
}

/**
 * A history entry whose `step === currentStep` AND `from.step === currentStep`
 * marks a completion of that step (vs. a start, where `from.step` is the
 * previous step or null). Used to tell "specified" from "specifying" when the
 * status string is missing or invalid.
 */
function isLastEntryACompletionFor(history: HistoryEntry[], step: StepName): boolean {
    for (let i = history.length - 1; i >= 0; i--) {
        const e = history[i];
        if (e.step !== step) continue;
        return e.from?.step === step;
    }
    return false;
}

/**
 * Warn if `currentStep` doesn't match the last history entry's step. Catches
 * the failure mode where the AI flips `currentStep` without appending the
 * matching start-entry — the viewer would render a fake "Generating <step>…"
 * indefinitely. Returns the offending step (or null when consistent).
 */
export function detectCurrentStepDrift(ctx: SpecContext): StepName | null {
    if (!ctx.history || ctx.history.length === 0) return null;
    const last = ctx.history[ctx.history.length - 1];
    return last.step === ctx.currentStep ? null : ctx.currentStep;
}

/**
 * Read, reconcile, and persist a spec context.
 * Returns the (possibly corrected) context. Side-effect: when `currentStep`
 * drifts ahead of the last history entry, emit a one-line warning to the
 * supplied output channel so the failure mode is observable.
 */
export async function reconcileAndPersist(
    specDir: string,
    ctx: SpecContext,
    log?: (message: string) => void,
): Promise<SpecContext> {
    const drift = detectCurrentStepDrift(ctx);
    if (drift && log) {
        const lastStep = ctx.history?.[ctx.history.length - 1]?.step ?? '(none)';
        log(
            `[SpecKit] currentStep="${drift}" but last history entry is for "${lastStep}" — ` +
            'the viewer will render "Generating <step>…" with no real progress. ' +
            `Inspect ${specDir}/.spec-context.json.`,
        );
    }

    const fixed = reconcile(ctx);
    if (!fixed) return ctx;

    try {
        await updateSpecContext(specDir, () => fixed, fixed);
    } catch {
        // Non-fatal — use the corrected context in memory even if write fails
    }

    return fixed;
}
