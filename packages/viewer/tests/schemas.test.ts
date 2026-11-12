import { readFileSync } from 'fs';
import { join } from 'path';
import type { z } from 'zod';
import {
    NavStateSchema,
    SpecContextSchema,
    VIEWER_MESSAGE_TYPES,
    ViewerMessageSchema,
    ViewerStateSchema,
    type SpecContext,
    type ViewerToExtensionMessage,
} from 'speckit-viewer/contract';

// Compile-time ties between the schemas and the hand-written interfaces.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const parsedIsASpecContext = (value: z.output<typeof SpecContextSchema>): SpecContext => value;
// Interfaces carry no index signature, so compare their fields through a deep mapped copy.
type Plain<T> = T extends (infer U)[] ? Plain<U>[] : T extends object ? { [K in keyof T]: Plain<T[K]> } : T;
const everySpecContextParses = (value: Plain<SpecContext>): z.input<typeof SpecContextSchema> => value;
const messageTypesMatch: Equal<(typeof VIEWER_MESSAGE_TYPES)[number], ViewerToExtensionMessage['type']> = true;
void parsedIsASpecContext;
void everySpecContextParses;

const fixture = join(__dirname, '../../../apps/vscode/webview/src/spec-viewer/__fixtures__/teamboard/041-profile-photo-upload/spec-context.completed.json');
const record = (): Record<string, unknown> => JSON.parse(readFileSync(fixture, 'utf8'));

describe('SpecContextSchema', () => {
    it('parses a record a current writer produced and keeps fields it does not know', () => {
        const parsed = SpecContextSchema.parse({ ...record(), futureField: { kept: true } });
        expect(parsed.status).toBe('completed');
        expect(parsed.history.length).toBeGreaterThan(0);
        expect((parsed as Record<string, unknown>).futureField).toEqual({ kept: true });
    });

    it('reads coverage ids written as one comma string as a list', () => {
        const parsed = SpecContextSchema.parse({ ...record(), coverage: { 'FR-001': { tasks: 'T001, T004', tests: ['a.test.ts'] } } });
        expect(parsed.coverage?.['FR-001']).toMatchObject({ tasks: ['T001', 'T004'], tests: ['a.test.ts'] });
    });

    it('parses a record with only the required fields', () => {
        const minimal = { workflow: 'speckit', specName: 'x', branch: '', currentStep: 'specify', status: 'draft', history: [] };
        expect(SpecContextSchema.safeParse(minimal).success).toBe(true);
    });

    it('names the field that is wrong', () => {
        const result = SpecContextSchema.safeParse({ ...record(), status: 'shipped' });
        expect(result.success).toBe(false);
        expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['status']);
    });

    it('rejects a history entry with an unknown author', () => {
        const bad = record();
        (bad.history as Record<string, unknown>[])[0].by = 'robot';
        const result = SpecContextSchema.safeParse(bad);
        expect(result.error?.issues[0].path).toEqual(['history', 0, 'by']);
    });
});

describe('NavStateSchema and ViewerStateSchema', () => {
    it('accept the required fields and pass the rest through', () => {
        const nav = { coreDocs: [], relatedDocs: [], currentDoc: 'spec', workflowPhase: 'plan', taskCompletionPercent: 0, isViewingRelatedDoc: false, badgeText: 'x' };
        expect(NavStateSchema.parse(nav).badgeText).toBe('x');
        const state = { status: 'planned', activeStep: 'plan', steps: { plan: 'completed' }, pulse: null, highlights: [], activeSubstep: null, footer: [], history: [], stepHistory: {} };
        expect(ViewerStateSchema.safeParse(state).success).toBe(true);
    });

    it('reject a viewer state without its footer', () => {
        const result = ViewerStateSchema.safeParse({ status: 'planned', activeStep: 'plan', steps: {}, pulse: null, highlights: [], activeSubstep: null, history: [], stepHistory: {} });
        expect(result.error?.issues[0].path).toEqual(['footer']);
    });
});

describe('ViewerMessageSchema', () => {
    it('accepts every message type the viewer sends and nothing else', () => {
        expect(messageTypesMatch).toBe(true);
        for (const type of VIEWER_MESSAGE_TYPES) expect(ViewerMessageSchema.safeParse({ type }).success).toBe(true);
        expect(ViewerMessageSchema.safeParse({ type: 'deleteEverything' }).success).toBe(false);
    });
});
