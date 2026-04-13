/**
 * Reader + validator for `.spec-context.json`.
 *
 * - Tolerates unknown top-level fields (FR-013).
 * - `normalizeSpecContext` coerces legacy shapes into canonical form.
 * - `validateSpecContext` runs a JSON-Schema check and logs (does not throw)
 *   on invalid inbound files.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    SpecContext,
    Status,
    StepName,
    STATUSES,
    STEP_NAMES,
} from '../../core/types/specContext';

export const SPEC_CONTEXT_FILENAME = '.spec-context.json';

/** Load canonical schema (bundled via raw require). */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SPEC_CONTEXT_SCHEMA = require('../../core/types/spec-context.schema.json');

export function getSpecContextSchema(): unknown {
    return SPEC_CONTEXT_SCHEMA;
}

/**
 * Read `.spec-context.json` from a spec directory (or null if absent/invalid).
 */
export async function readSpecContext(specDir: string): Promise<SpecContext | null> {
    const p = path.join(specDir, SPEC_CONTEXT_FILENAME);
    try {
        const raw = await fs.promises.readFile(p, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return normalizeSpecContext(parsed);
    } catch {
        return null;
    }
}

/**
 * Synchronous variant for tree-provider usage.
 */
export function readSpecContextSync(specDir: string): SpecContext | null {
    const p = path.join(specDir, SPEC_CONTEXT_FILENAME);
    try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return normalizeSpecContext(parsed);
    } catch {
        return null;
    }
}

/**
 * Coerce legacy shapes into canonical `SpecContext`.
 *
 * Handles:
 *   - Files that only contain `{ status: "completed" }` (spec 055, 058 cases).
 *   - Old `status` values `"active" | "tasks-done"` — mapped to `"implementing"`
 *     so downstream derivation remains correct.
 *   - Missing `stepHistory`/`transitions` — defaulted to empty containers.
 */
export function normalizeSpecContext(raw: Record<string, unknown>): SpecContext {
    const stepHistory =
        raw.stepHistory && typeof raw.stepHistory === 'object'
            ? (raw.stepHistory as SpecContext['stepHistory'])
            : {};
    const transitions = Array.isArray(raw.transitions)
        ? (raw.transitions as SpecContext['transitions'])
        : [];

    const status = coerceStatus(raw.status, stepHistory);
    const currentStep = coerceCurrentStep(raw.currentStep, stepHistory);

    const out: SpecContext = {
        ...(raw as object),
        workflow: typeof raw.workflow === 'string' && raw.workflow.length > 0
            ? (raw.workflow as string)
            : 'speckit',
        specName: typeof raw.specName === 'string' ? (raw.specName as string) : '',
        branch: typeof raw.branch === 'string' ? (raw.branch as string) : '',
        currentStep,
        status,
        stepHistory,
        transitions,
    };
    return out;
}

function coerceStatus(
    value: unknown,
    stepHistory: SpecContext['stepHistory']
): Status {
    if (typeof value === 'string' && (STATUSES as string[]).includes(value)) {
        return value as Status;
    }
    // Legacy values
    if (value === 'active') return 'implementing';
    if (value === 'tasks-done') return 'ready-to-implement';
    // If there's no status, infer `draft` unless history suggests otherwise.
    if (stepHistory && Object.keys(stepHistory).length > 0) {
        return 'implementing';
    }
    return 'draft';
}

function coerceCurrentStep(
    value: unknown,
    stepHistory: SpecContext['stepHistory']
): StepName {
    if (typeof value === 'string' && (STEP_NAMES as string[]).includes(value)) {
        return value as StepName;
    }
    // Pick the latest step with startedAt, else 'specify'.
    let best: StepName = 'specify';
    let bestTime = '';
    for (const step of STEP_NAMES) {
        const entry = stepHistory[step];
        if (entry?.startedAt && entry.startedAt > bestTime) {
            best = step;
            bestTime = entry.startedAt;
        }
    }
    return best;
}

/**
 * Minimal, tolerant validator. Checks top-level required fields and their
 * coarse types. Returns `{ valid, errors }`; callers log on invalid rather
 * than throw.
 */
export function validateSpecContext(ctx: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!ctx || typeof ctx !== 'object') {
        return { valid: false, errors: ['not an object'] };
    }
    const r = ctx as Record<string, unknown>;
    // workflow/currentStep/status must be non-empty. specName/branch may be
    // blank immediately after migration from legacy shapes (055-style);
    // backfill at the call site fills them in.
    for (const field of ['workflow', 'currentStep', 'status']) {
        if (typeof r[field] !== 'string' || (r[field] as string).length === 0) {
            errors.push(`missing/invalid string field: ${field}`);
        }
    }
    for (const field of ['specName', 'branch']) {
        if (typeof r[field] !== 'string') {
            errors.push(`missing/invalid string field: ${field}`);
        }
    }
    if (!(STATUSES as string[]).includes(r.status as string)) {
        errors.push(`invalid status: ${r.status}`);
    }
    if (!(STEP_NAMES as string[]).includes(r.currentStep as string)) {
        errors.push(`invalid currentStep: ${r.currentStep}`);
    }
    if (!r.stepHistory || typeof r.stepHistory !== 'object') {
        errors.push('missing/invalid stepHistory');
    }
    if (!Array.isArray(r.transitions)) {
        errors.push('missing/invalid transitions');
    }
    return { valid: errors.length === 0, errors };
}
