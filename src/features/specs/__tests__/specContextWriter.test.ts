import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appendHistory, setStepStarted, setStepCompleted, setSubstepStarted, setSubstepCompleted, updateSpecContext } from '../specContextWriter';
import type { HistoryEntry, SpecContext } from '../../../core/types/specContext';

function makeContext(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'speckit',
        specName: 'test',
        branch: 'main',
        currentStep: 'specify',
        status: 'draft',
        history: [],
        ...overrides,
    };
}

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    step: 'specify',
    substep: null,
    kind: 'start',
    from: { step: null, substep: null },
    by: 'extension',
    at: '2026-04-29T00:00:00Z',
    ...overrides,
});

describe('appendHistory', () => {
    // The writer is a faithful append-only log of every lifecycle boundary.
    // Redundant *display* rows are collapsed downstream (stepHistoryDerivation
    // `dedupeConsecutive` + PhasesCard), not here — de-duping in the writer
    // would wrongly drop legitimate start/complete boundaries that share
    // (step, substep, from). See stepHistoryDerivation.test.ts for the
    // view-layer dedup.
    it('appends even when (step, substep, from) matches the last one (boundaries are preserved)', () => {
        const last = entry({ step: 'specify', substep: null, at: '2026-04-29T00:00:00Z' });
        const ctx = makeContext({ history: [last] });
        const same = entry({ step: 'specify', substep: null, at: '2026-04-29T00:01:00Z' });

        const result = appendHistory(ctx, same);

        expect(result.history).toHaveLength(2);
    });

    it('appends an entry with a distinct substep on the same step', () => {
        const last = entry({ step: 'specify', substep: null });
        const ctx = makeContext({ history: [last] });
        const next = entry({ step: 'specify', substep: 'outline', by: 'cli', at: '2026-04-29T00:00:05Z' });

        const result = appendHistory(ctx, next);

        expect(result.history).toHaveLength(2);
        expect(result.history[1].substep).toBe('outline');
    });

    it('appends the first entry into an empty array', () => {
        const ctx = makeContext({ history: [] });
        const first = entry({ step: 'specify' });

        const result = appendHistory(ctx, first);

        expect(result.history).toHaveLength(1);
        expect(result.history[0]).toEqual(first);
    });
});

describe('setStepStarted', () => {
    it('emits kind:start on the history entry', () => {
        const ctx = makeContext({ currentStep: 'specify', status: 'specified' });
        const result = setStepStarted(ctx, 'plan', 'extension', '2026-04-29T01:00:00Z');
        const e = result.history[0];
        expect(e.kind).toBe('start');
        expect(e.step).toBe('plan');
        expect(e.substep).toBeNull();
        expect(e.from?.step).toBe('specify');
    });

    it('sets from.step to null when restarting the same step', () => {
        const ctx = makeContext({ currentStep: 'specify', status: 'specifying' });
        const result = setStepStarted(ctx, 'specify', 'extension', '2026-04-29T01:00:00Z');
        const e = result.history[0];
        expect(e.kind).toBe('start');
        expect(e.from?.step).toBeNull();
    });
});

describe('setStepCompleted', () => {
    it('emits kind:complete with no from field', () => {
        const ctx = makeContext({ currentStep: 'specify', status: 'specifying' });
        const result = setStepCompleted(ctx, 'specify', 'extension', '2026-04-29T01:00:00Z');
        const e = result.history[0];
        expect(e.kind).toBe('complete');
        expect(e.step).toBe('specify');
        expect(e.substep).toBeNull();
        expect(e.from).toBeUndefined();
    });
});

describe('setSubstepStarted', () => {
    it('emits kind:start with substep name and from pointing at the step', () => {
        const ctx = makeContext({ currentStep: 'specify', status: 'specifying' });
        const result = setSubstepStarted(ctx, 'specify', 'outline', 'extension', '2026-04-29T01:00:00Z');
        const e = result.history[0];
        expect(e.kind).toBe('start');
        expect(e.substep).toBe('outline');
        expect(e.from?.substep).toBeNull();
    });
});

describe('setSubstepCompleted', () => {
    it('emits kind:complete with substep name and no from field', () => {
        const ctx = makeContext({ currentStep: 'specify', status: 'specifying' });
        const result = setSubstepCompleted(ctx, 'specify', 'outline', 'extension', '2026-04-29T01:00:00Z');
        const e = result.history[0];
        expect(e.kind).toBe('complete');
        expect(e.substep).toBe('outline');
        expect(e.from).toBeUndefined();
    });
});

describe('updateSpecContext — profile pin back-fill', () => {
    let specDir: string;
    const ctxPath = (): string => path.join(specDir, '.spec-context.json');
    const writeFile = (obj: object): void => fs.writeFileSync(ctxPath(), JSON.stringify(obj), 'utf8');
    const readProfile = (): unknown => JSON.parse(fs.readFileSync(ctxPath(), 'utf8')).profile;
    const base = { workflow: 'speckit', specName: 'demo', branch: 'main', currentStep: 'plan', status: 'planned', history: [] };

    beforeEach(() => { specDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-writer-')); });
    afterEach(() => { fs.rmSync(specDir, { recursive: true, force: true }); });

    it('back-fills the profile from the fallback when the existing context has none', async () => {
        writeFile(base); // no profile (as the spec-kit capture script writes it)
        await updateSpecContext(specDir, c => c, makeContext({ profile: 'lean' }));
        expect(readProfile()).toBe('lean');
    });

    it('never overwrites an existing profile pin', async () => {
        writeFile({ ...base, profile: 'standard' });
        await updateSpecContext(specDir, c => c, makeContext({ profile: 'lean' }));
        expect(readProfile()).toBe('standard');
    });

    it('uses the fallback profile when no context file exists yet', async () => {
        await updateSpecContext(specDir, c => c, makeContext({ profile: 'lean' }));
        expect(readProfile()).toBe('lean');
    });
});
