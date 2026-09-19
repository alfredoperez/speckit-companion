import * as fs from 'fs';
import * as path from 'path';
import { STEP_NAMES, STATUSES, completedStatusForStep, StepName } from '../specContext';

/**
 * The data contract for `.spec-context.json` is defined in two in-repo
 * artifacts that MUST agree: the JSON schema (`spec-context.schema.json`, the
 * single source of truth) and the TypeScript runtime arrays (`STEP_NAMES`,
 * `STATUSES`). The Python writers in `speckit-extension/` target the same
 * shape. This test fails the build the moment the schema and the TS enums
 * drift — which is exactly how `write-context.py` silently diverged before
 * (writing `transitions[]` while the canonical field had become `history[]`).
 */
const schema = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'spec-context.schema.json'), 'utf8'),
);

describe('spec-context.schema.json stays in sync with the TS contract', () => {
    it('currentStep enum matches STEP_NAMES (same values + order)', () => {
        expect(schema.properties.currentStep.enum).toEqual([...STEP_NAMES]);
    });

    it('status enum matches STATUSES (same values + order)', () => {
        expect(schema.properties.status.enum).toEqual([...STATUSES]);
    });

    it('historyEntry no longer declares `from` (writers stopped emitting it; legacy tolerated via permissive additionalProperties)', () => {
        expect(schema.$defs.historyEntry.properties.from).toBeUndefined();
        expect(schema.$defs.historyEntry.required).not.toContain('from');
        // additionalProperties stays permissive so legacy records with `from` still validate.
        expect(schema.additionalProperties).toBe(true);
    });

    it('historyEntry.by enum covers every author the writers emit', () => {
        const by: string[] = schema.$defs.historyEntry.properties.by.enum;
        for (const author of ['extension', 'user', 'cli', 'ai', 'derive']) {
            expect(by).toContain(author);
        }
    });

    it('historyEntry.kind enum is start/complete', () => {
        expect(schema.$defs.historyEntry.properties.kind.enum).toEqual(['start', 'complete']);
    });

    it('historyEntry.task is an optional string (per-task journaling field)', () => {
        expect(schema.$defs.historyEntry.properties.task).toEqual({ type: 'string' });
        expect(schema.$defs.historyEntry.required).not.toContain('task');
    });
});

/**
 * The third leg of the contract: the Python writers in `speckit-extension/`
 * declare the same vocabulary in their own source, and until now nothing
 * compared the two. A copy of the step-to-status map there once disagreed with
 * this side about where a finished implement step lands, and the only way to
 * find out was to read both files.
 *
 * These tests parse the literals out of `spec_context.py` rather than importing
 * it — jest cannot run Python — so they are deliberately strict about the shape
 * they expect. A rewrite that defeats the parser fails loudly rather than
 * passing vacuously.
 */
const pythonSource = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', '..', 'speckit-extension', 'scripts', 'spec_context.py'),
    'utf8',
);

/** Values of a `NAME = {"a", "b"}` set literal. */
function pythonSet(name: string): string[] {
    const match = pythonSource.match(new RegExp(`^${name} = \\{([^}]*)\\}`, 'm'));
    if (!match) throw new Error(`${name} is no longer a flat set literal in spec_context.py`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

/** Entries of a `NAME = {"k": "v" | 0}` dict literal. */
function pythonDict(name: string): Record<string, string> {
    const match = pythonSource.match(new RegExp(`^${name} = \\{([^}]*)\\}`, 'ms'));
    if (!match) throw new Error(`${name} is no longer a flat dict literal in spec_context.py`);
    const out: Record<string, string> = {};
    for (const entry of match[1].matchAll(/"([^"]+)":\s*"?([^",\s]+)"?/g)) {
        out[entry[1]] = entry[2];
    }
    return out;
}

describe('spec_context.py stays in sync with the TS contract', () => {
    it('knows the same steps', () => {
        expect(pythonSet('CANONICAL_STEPS').sort()).toEqual([...STEP_NAMES].sort());
    });

    it('orders those steps the same way', () => {
        const order = pythonDict('STEP_ORDER');
        const pythonOrder = Object.keys(order).sort((a, b) => Number(order[a]) - Number(order[b]));
        expect(pythonOrder).toEqual([...STEP_NAMES]);
    });

    it('settles each step at the same status this side does', () => {
        const completed = pythonDict('STEP_COMPLETED_STATUS');
        for (const [step, status] of Object.entries(completed)) {
            expect(completedStatusForStep(step as StepName)).toBe(status);
        }
        // clarify and analyze are sub-phases and advance no status, so Python
        // omits them; every step Python does map must be a real step here.
        expect(Object.keys(completed).every(step => (STEP_NAMES as string[]).includes(step))).toBe(true);
    });

    it('uses statuses this side declares', () => {
        const declared = new Set<string>(STATUSES);
        for (const status of Object.values(pythonDict('STEP_COMPLETED_STATUS'))) {
            expect(declared.has(status)).toBe(true);
        }
        for (const status of [...pythonSet('TERMINAL_STATUSES'), ...pythonSet('CROSS_STEP_TERMINAL')]) {
            expect(declared.has(status)).toBe(true);
        }
    });

    it('keeps the cross-step terminal set a subset of the terminal set', () => {
        const terminal = new Set(pythonSet('TERMINAL_STATUSES'));
        for (const status of pythonSet('CROSS_STEP_TERMINAL')) {
            expect(terminal.has(status)).toBe(true);
        }
    });
});
