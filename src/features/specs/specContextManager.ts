import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
    FeatureWorkflowContext,
    SpecStatus,
    FEATURE_CONTEXT_FILE,
} from '../workflows/types';
import { SpecStatuses } from '../../core/constants';

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
 */
export async function readSpecContext(specDir: string): Promise<FeatureWorkflowContext | undefined> {
    const data = await tryReadJson(path.join(specDir, FEATURE_CONTEXT_FILE));
    if (data) {
        return data as unknown as FeatureWorkflowContext;
    }
    return undefined;
}

/**
 * Synchronous version of readSpecContext for use in tree providers.
 */
export function readSpecContextSync(specDir: string): FeatureWorkflowContext | undefined {
    const data = tryReadJsonSync(path.join(specDir, FEATURE_CONTEXT_FILE));
    if (data) {
        return data as unknown as FeatureWorkflowContext;
    }
    return undefined;
}

/**
 * Update .spec-context.json with a partial update (read-then-merge).
 */
export async function updateSpecContext(
    specDir: string,
    partial: Partial<FeatureWorkflowContext>
): Promise<void> {
    const contextPath = path.join(specDir, FEATURE_CONTEXT_FILE);

    let existing: Record<string, unknown> = {};

    try {
        const content = await fs.promises.readFile(contextPath, 'utf-8');
        existing = JSON.parse(content);
    } catch {
        // No existing file, start fresh
    }

    const merged = { ...existing, ...partial };
    await fs.promises.writeFile(contextPath, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * Derive a human-readable spec name from a directory slug.
 * E.g., "046-spec-viewer-header-redesign" → "Spec Viewer Header Redesign"
 */
export function deriveSpecName(specDir: string): string {
    const slug = path.basename(specDir);
    // Strip leading number prefix (e.g., "046-")
    const withoutPrefix = slug.replace(/^\d+-/, '');
    return withoutPrefix
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Get the current git branch name. Returns undefined on failure.
 */
function getCurrentBranch(cwd?: string): string | undefined {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            cwd,
            encoding: 'utf-8',
            timeout: 3000,
        }).trim() || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Update step progress when user clicks a step command.
 * Sets currentStep, adds stepHistory entry, completes previous step.
 * Also populates specName and branch if missing.
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
    const status = context.status || SpecStatuses.ACTIVE;

    // Populate specName and branch if not already set
    const specName = context.specName || deriveSpecName(specDir);
    const branch = context.branch || getCurrentBranch(specDir);

    const update: Partial<FeatureWorkflowContext> = {
        currentStep: stepName,
        stepHistory,
        status,
        specName,
    };
    if (branch) {
        update.branch = branch;
    }

    await updateSpecContext(specDir, update);
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
