import * as fs from 'fs';
import * as path from 'path';
import {
    FeatureWorkflowContext,
    SpecStatus,
    StepHistoryEntry,
    FEATURE_CONTEXT_FILE,
    LEGACY_CONTEXT_FILE,
} from '../workflows/types';

/** SDD state.json filename */
const STATE_FILE = 'state.json';

/**
 * Infer FeatureWorkflowContext from an SDD state.json file.
 * Maps SDD fields to extension fields and infers status from step/substep.
 */
function inferContextFromState(state: Record<string, unknown>): FeatureWorkflowContext {
    const step = state.step as string | undefined;

    // Use explicit status if present; otherwise default to active
    const validStatuses: SpecStatus[] = ['active', 'completed', 'archived'];
    let status: SpecStatus = validStatuses.includes(state.status as SpecStatus)
        ? (state.status as SpecStatus)
        : 'active';

    // A spec is completed only when the pipeline explicitly signals done
    if (status === 'active' && state.next === 'done') {
        status = 'completed';
    }

    // Build stepHistory using workflow order — all steps before currentStep are completed
    const stepHistory: Record<string, StepHistoryEntry> = {};
    const updated = (state.updated as string) || new Date().toISOString();
    const defaultStepOrder = ['specify', 'plan', 'tasks', 'implement'];

    // Find where the current step is in the workflow order
    const currentStepIndex = step ? defaultStepOrder.indexOf(step) : -1;

    if (currentStepIndex >= 0) {
        // All steps before currentStep are completed
        for (let i = 0; i < currentStepIndex; i++) {
            stepHistory[defaultStepOrder[i]] = {
                startedAt: updated,
                completedAt: updated,
            };
        }
        // Current step: completed if spec is completed, otherwise in-progress
        stepHistory[step!] = {
            startedAt: updated,
            completedAt: status === 'completed' ? updated : null,
        };
    }

    // If spec is completed, mark ALL steps as completed
    if (status === 'completed') {
        for (const stepName of defaultStepOrder) {
            if (!stepHistory[stepName]) {
                stepHistory[stepName] = { startedAt: updated, completedAt: updated };
            } else if (!stepHistory[stepName].completedAt) {
                stepHistory[stepName].completedAt = updated;
            }
        }
    }

    return {
        workflow: 'default',
        selectedAt: updated,
        currentStep: step,
        status,
        stepHistory,
        // Preserve SDD fields
        step: step,
        substep: state.substep as string | null | undefined,
        task: state.task as string | null | undefined,
        next: state.next as string | null | undefined,
        updated: state.updated as string | undefined,
        approach: state.approach as string | undefined,
        last_action: state.last_action as string | undefined,
        task_summaries: state.task_summaries as Record<string, unknown> | undefined,
        step_summaries: state.step_summaries as Record<string, unknown> | undefined,
        files_modified: state.files_modified as string[] | undefined,
    };
}

/**
 * Try reading a JSON file, return parsed content or undefined.
 */
function tryReadJsonSync(filePath: string): Record<string, unknown> | undefined {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return undefined;
    }
}

/**
 * Try reading a JSON file async, return parsed content or undefined.
 */
async function tryReadJson(filePath: string): Promise<Record<string, unknown> | undefined> {
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return undefined;
    }
}

/**
 * Read .spec-context.json from a spec directory.
 * Falls back to legacy .speckit.json, then state.json (read-only, infers status).
 */
export async function readSpecContext(specDir: string): Promise<FeatureWorkflowContext | undefined> {
    // Try .spec-context.json first
    const data = await tryReadJson(path.join(specDir, FEATURE_CONTEXT_FILE));
    if (data) {
        // If the file uses SDD format (has `step` but no `currentStep`), infer context
        if (data.step && !data.currentStep) {
            return inferContextFromState(data);
        }
        return data as unknown as FeatureWorkflowContext;
    }

    // Fall back to legacy .speckit.json
    const legacy = await tryReadJson(path.join(specDir, LEGACY_CONTEXT_FILE));
    if (legacy) return legacy as unknown as FeatureWorkflowContext;

    // Fall back to state.json (SDD) — read-only, infer status
    const state = await tryReadJson(path.join(specDir, STATE_FILE));
    if (state) return inferContextFromState(state);

    return undefined;
}

/**
 * Synchronous version of readSpecContext for use in tree providers.
 */
export function readSpecContextSync(specDir: string): FeatureWorkflowContext | undefined {
    // Try .spec-context.json first
    const data = tryReadJsonSync(path.join(specDir, FEATURE_CONTEXT_FILE));
    if (data) {
        // If the file uses SDD format (has `step` but no `currentStep`), infer context
        if (data.step && !data.currentStep) {
            return inferContextFromState(data);
        }
        return data as unknown as FeatureWorkflowContext;
    }

    // Fall back to legacy .speckit.json
    const legacy = tryReadJsonSync(path.join(specDir, LEGACY_CONTEXT_FILE));
    if (legacy) return legacy as unknown as FeatureWorkflowContext;

    // Fall back to state.json (SDD) — read-only, infer status
    const state = tryReadJsonSync(path.join(specDir, STATE_FILE));
    if (state) return inferContextFromState(state);

    return undefined;
}

/**
 * Update .spec-context.json with a partial update (read-then-merge).
 * Auto-migrates from legacy .speckit.json if present.
 */
export async function updateSpecContext(
    specDir: string,
    partial: Partial<FeatureWorkflowContext>
): Promise<void> {
    const contextPath = path.join(specDir, FEATURE_CONTEXT_FILE);
    const legacyPath = path.join(specDir, LEGACY_CONTEXT_FILE);

    let existing: Record<string, unknown> = {};
    let hadLegacy = false;

    // Try reading .spec-context.json first
    try {
        const content = await fs.promises.readFile(contextPath, 'utf-8');
        existing = JSON.parse(content);
    } catch {
        // Try legacy .speckit.json
        try {
            const content = await fs.promises.readFile(legacyPath, 'utf-8');
            existing = JSON.parse(content);
            hadLegacy = true;
        } catch {
            // No existing file, start fresh
        }
    }

    const merged = { ...existing, ...partial };
    await fs.promises.writeFile(contextPath, JSON.stringify(merged, null, 2), 'utf-8');

    // Clean up legacy file after successful migration
    if (hadLegacy) {
        try {
            await fs.promises.unlink(legacyPath);
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Update step progress when user clicks a step command.
 * Sets currentStep, adds stepHistory entry, completes previous step.
 */
export async function updateStepProgress(
    specDir: string,
    stepName: string,
    workflowStepNames: string[]
): Promise<void> {
    const context = await readSpecContext(specDir) || {} as FeatureWorkflowContext;
    const now = new Date().toISOString();

    const stepHistory = context.stepHistory || {};

    // Complete the previous currentStep if it exists and is different
    if (context.currentStep && context.currentStep !== stepName) {
        const prevEntry = stepHistory[context.currentStep];
        if (prevEntry && !prevEntry.completedAt) {
            prevEntry.completedAt = now;
        }
    }

    // Start the new step if not already started
    if (!stepHistory[stepName]) {
        stepHistory[stepName] = { startedAt: now, completedAt: null };
    }

    // Set status to active if not already set
    const status = context.status || 'active';

    await updateSpecContext(specDir, {
        currentStep: stepName,
        stepHistory,
        status,
    });
}

/**
 * Set the spec status (active, completed, archived).
 */
export async function setSpecStatus(
    specDir: string,
    status: SpecStatus
): Promise<void> {
    await updateSpecContext(specDir, { status });
}
