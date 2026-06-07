import * as fs from 'fs';
import * as path from 'path';
import { STEP_NAMES, STATUSES } from '../specContext';

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

    it('historyEntry.from.step enum is STEP_NAMES plus null', () => {
        expect(schema.$defs.historyEntry.properties.from.properties.step.enum).toEqual([
            ...STEP_NAMES,
            null,
        ]);
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
});
