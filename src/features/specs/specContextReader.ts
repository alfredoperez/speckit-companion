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
    HistoryEntry,
    HistoryEntryKind,
    SpecContext,
    Status,
    StepName,
    STATUSES,
    STEP_NAMES,
} from '../../core/types/specContext';

export const SPEC_CONTEXT_FILENAME = '.spec-context.json';

/**
 * Thrown when `.spec-context.json` exists but is not parseable JSON. Lets
 * callers distinguish a corrupt file (recoverable via reset) from a missing
 * one (ENOENT → null) or other read failures, without sniffing message text.
 */
export class SpecContextParseError extends Error {
    constructor(
        readonly filePath: string,
        readonly reason: string,
    ) {
        super(`spec-context.json exists but is invalid JSON (${filePath}): ${reason}`);
        this.name = 'SpecContextParseError';
    }
}

/** Load canonical schema (bundled via raw require). */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SPEC_CONTEXT_SCHEMA = require('../../core/types/spec-context.schema.json');

export function getSpecContextSchema(): unknown {
    return SPEC_CONTEXT_SCHEMA;
}

/**
 * Read `.spec-context.json` from a spec directory.
 *
 * Returns `null` ONLY when the file genuinely does not exist (ENOENT). Any
 * other failure (EACCES, EBUSY, invalid JSON, encoding error) throws — the
 * caller MUST distinguish "no file" from "could not read", otherwise a
 * transient read failure during a concurrent write would let a downstream
 * "ensure" path silently clobber the real file.
 */
export async function readSpecContext(specDir: string): Promise<SpecContext | null> {
    const p = path.join(specDir, SPEC_CONTEXT_FILENAME);
    let raw: string;
    try {
        raw = await fs.promises.readFile(p, 'utf-8');
    } catch (err) {
        if (isEnoent(err)) return null;
        throw err;
    }
    return parseAndNormalize(raw, p);
}

/**
 * Synchronous variant for tree-provider usage. Same ENOENT-vs-other contract
 * as the async reader.
 */
export function readSpecContextSync(specDir: string): SpecContext | null {
    const p = path.join(specDir, SPEC_CONTEXT_FILENAME);
    let raw: string;
    try {
        raw = fs.readFileSync(p, 'utf-8');
    } catch (err) {
        if (isEnoent(err)) return null;
        throw err;
    }
    return parseAndNormalize(raw, p);
}

function isEnoent(err: unknown): boolean {
    return !!err && typeof err === 'object' && (err as NodeJS.ErrnoException).code === 'ENOENT';
}

function parseAndNormalize(raw: string, filePath: string): SpecContext {
    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new SpecContextParseError(filePath, reason);
    }
    return normalizeSpecContext(parsed);
}

/**
 * Coerce legacy shapes into canonical `SpecContext`.
 *
 * Handles:
 *   - Files that only contain `{ status: "completed" }` (spec 055, 058 cases).
 *   - Old `status` values `"active" | "tasks-done"` — mapped to `"implementing"`
 *     so downstream derivation remains correct.
 *   - Missing `history` — defaulted to empty array.
 *   - Legacy `transitions` field — coerced into `history`.
 *   - Legacy `stepHistory` field — ignored (viewer derives it from `history`);
 *     dropped from the in-memory object so it doesn't get re-written.
 */
export function normalizeSpecContext(raw: Record<string, unknown>): SpecContext {
    // Prefer the canonical `history` field; fall back to legacy `transitions`
    // so files written by older versions still load.
    const history: HistoryEntry[] = normalizeHistoryKind(
        Array.isArray(raw.history)
            ? (raw.history as HistoryEntry[])
            : Array.isArray(raw.transitions)
                ? (raw.transitions as HistoryEntry[])
                : []
    );

    const status = coerceStatus(raw.status, history);
    const currentStep = coerceCurrentStep(raw.currentStep, history);

    // Spread `raw` first to retain unknown fields, then strip the legacy
    // names so they don't end up in the in-memory canonical shape.
    const out: SpecContext = {
        ...(raw as object),
        workflow: typeof raw.workflow === 'string' && raw.workflow.length > 0
            ? (raw.workflow as string)
            : 'speckit',
        specName: typeof raw.specName === 'string' ? (raw.specName as string) : '',
        branch: typeof raw.branch === 'string' ? (raw.branch as string) : '',
        workingBranch: typeof raw.workingBranch === 'string'
            ? (raw.workingBranch as string)
            : (raw.workingBranch === null ? null : undefined),
        currentStep,
        status,
        history,
    };
    delete (out as Record<string, unknown>).stepHistory;
    delete (out as Record<string, unknown>).transitions;

    const normalizedTaskSummaries = normalizeTaskSummaries(raw.task_summaries);
    if (normalizedTaskSummaries) {
        out.task_summaries = normalizedTaskSummaries;
    }

    return out;
}

const EMPTY_CONCERN_SENTINELS = new Set(['', 'none', 'n/a']);

/**
 * AI writers occasionally emit `task_summaries[*].concerns` / `.files` as a
 * plain string (`"None"`, a sentence) instead of `string[]`. Coerce inbound
 * shapes so downstream consumers see the canonical `string[]` contract from
 * `TaskSummary`. Returns `undefined` when the input is not a coercible
 * object (preserves existing absence semantics).
 */
function normalizeTaskSummaries(raw: unknown): Record<string, unknown> | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const out: Record<string, unknown> = {};
    let changed = false;
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            out[id] = value;
            continue;
        }
        const entry = value as Record<string, unknown>;
        const concernsCoerced = coerceStringArrayField(entry.concerns);
        const filesCoerced = coerceStringArrayField(entry.files);
        if (concernsCoerced.changed || filesCoerced.changed) {
            const next: Record<string, unknown> = { ...entry };
            applyCoercion(next, 'concerns', concernsCoerced);
            applyCoercion(next, 'files', filesCoerced);
            out[id] = next;
            changed = true;
        } else {
            out[id] = entry;
        }
    }
    return changed ? out : (raw as Record<string, unknown>);
}

interface CoerceResult {
    changed: boolean;
    drop: boolean;
    value: string[];
}

function coerceStringArrayField(value: unknown): CoerceResult {
    if (value === undefined) return { changed: false, drop: false, value: [] };
    if (Array.isArray(value)) {
        const filtered = value.filter((v): v is string => typeof v === 'string');
        if (filtered.length === value.length) return { changed: false, drop: false, value: filtered };
        return { changed: true, drop: false, value: filtered };
    }
    if (value === null) return { changed: true, drop: true, value: [] };
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (EMPTY_CONCERN_SENTINELS.has(trimmed.toLowerCase())) {
            return { changed: true, drop: false, value: [] };
        }
        return { changed: true, drop: false, value: [trimmed] };
    }
    return { changed: true, drop: true, value: [] };
}

function applyCoercion(target: Record<string, unknown>, key: string, result: CoerceResult): void {
    if (!result.changed) return;
    if (result.drop) {
        delete target[key];
        return;
    }
    target[key] = result.value;
}

/**
 * Back-fill `kind` on legacy history entries that pre-date the explicit field.
 * Rule:
 *   - If `kind` is already set → pass through unchanged.
 *   - Step entry (`substep == null`): self-loop (`from.step === step`) → `complete`; else → `start`.
 *   - Substep entry (`substep != null`): self-loop (`from.substep === substep`) → `complete`; else → `start`.
 *   - Complete entries: strip `from` so the schema invariant holds.
 *   - Malformed entries (no matching rule) → `start` (safe fallback).
 */
function normalizeHistoryKind(entries: HistoryEntry[]): HistoryEntry[] {
    return entries.map(e => {
        if (e.kind) return e;
        let kind: HistoryEntryKind;
        // Keyed on `substep` alone (not the task-aware isStepLevelEntry): a legacy
        // per-task entry must keep using the step self-loop rule, so substituting
        // the predicate would change its backfilled kind.
        if (e.substep == null) {
            kind = e.from?.step === e.step ? 'complete' : 'start';
        } else {
            kind = e.from?.substep === e.substep ? 'complete' : 'start';
        }
        return { ...e, kind };
    });
}

function coerceStatus(value: unknown, history: HistoryEntry[]): Status {
    if (typeof value === 'string' && (STATUSES as string[]).includes(value)) {
        return value as Status;
    }
    // Legacy values
    if (value === 'active') return 'implementing';
    if (value === 'tasks-done') return 'ready-to-implement';
    // If there's no status, infer `draft` unless history suggests otherwise.
    if (history.length > 0) {
        return 'implementing';
    }
    return 'draft';
}

function coerceCurrentStep(value: unknown, history: HistoryEntry[]): StepName {
    if (typeof value === 'string' && (STEP_NAMES as string[]).includes(value)) {
        return value as StepName;
    }
    // Pick the step with the latest `at` timestamp (chronology, not array
    // order). AI-written history can be appended out of wall-clock order
    // when the model backdates a substep boundary; sort by `at` so the
    // recovered currentStep matches what most recently happened.
    let best: StepName = 'specify';
    let bestTime = '';
    for (const entry of history) {
        const step = entry?.step;
        const at = entry?.at;
        if (!step || !at) continue;
        if (!(STEP_NAMES as string[]).includes(step)) continue;
        if (at > bestTime) {
            best = step as StepName;
            bestTime = at;
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
    // Accept either `history` (canonical) or legacy `transitions` so older
    // files still validate at read time; the writer migrates them.
    if (!Array.isArray(r.history) && !Array.isArray(r.transitions)) {
        errors.push('missing/invalid history');
    }
    return { valid: errors.length === 0, errors };
}
