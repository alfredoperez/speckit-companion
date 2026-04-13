import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    writeSpecContext,
    appendTransition,
    setStepStarted,
    setStepCompleted,
    setSubstepStarted,
    setSubstepCompleted,
} from '../../../src/features/specs/specContextWriter';
import {
    readSpecContext,
    normalizeSpecContext,
} from '../../../src/features/specs/specContextReader';
import { backfillMinimalContext } from '../../../src/features/specs/specContextBackfill';
import { SpecContext, Transition } from '../../../src/core/types/specContext';

function mkTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-context-'));
}

function fresh(): SpecContext {
    return backfillMinimalContext({
        workflow: 'speckit-companion',
        specName: 'x',
        branch: 'main',
    });
}

describe('writeSpecContext (US3 — unknown-field preservation & append-only)', () => {
    it('preserves unknown top-level fields across a round-trip (FR-013)', async () => {
        const dir = mkTmp();
        const initial = { ...fresh(), extraField: { foo: 'bar' } } as SpecContext;
        await writeSpecContext(dir, initial);
        // Modify and rewrite
        const loaded = await readSpecContext(dir);
        expect(loaded).not.toBeNull();
        const updated = setStepStarted(loaded!, 'specify', 'extension');
        (updated as Record<string, unknown>).extraField = { foo: 'bar' };
        await writeSpecContext(dir, updated);
        const raw = JSON.parse(fs.readFileSync(path.join(dir, '.spec-context.json'), 'utf-8'));
        expect(raw.extraField).toEqual({ foo: 'bar' });
    });

    it('rejects shrinking the transitions array (FR-005)', async () => {
        const dir = mkTmp();
        const ctx = setStepStarted(fresh(), 'specify', 'extension');
        await writeSpecContext(dir, ctx);
        const shrunk: SpecContext = { ...ctx, transitions: [] };
        await expect(writeSpecContext(dir, shrunk)).rejects.toThrow(/append-only/);
    });

    it('rejects modifying an existing transition entry (FR-012)', async () => {
        const dir = mkTmp();
        const ctx = setStepStarted(fresh(), 'specify', 'extension');
        await writeSpecContext(dir, ctx);
        const modified: SpecContext = {
            ...ctx,
            transitions: ctx.transitions.map((t, i) =>
                i === 0 ? ({ ...t, by: 'user' } as Transition) : t
            ),
        };
        await expect(writeSpecContext(dir, modified)).rejects.toThrow(/append-only/);
    });

    it('allows appending new transitions', async () => {
        const dir = mkTmp();
        const ctx = setStepStarted(fresh(), 'specify', 'extension');
        await writeSpecContext(dir, ctx);
        const next = setStepCompleted(ctx, 'specify', 'extension');
        await writeSpecContext(dir, next);
        const loaded = await readSpecContext(dir);
        expect(loaded!.transitions.length).toBeGreaterThanOrEqual(2);
    });
});

describe('normalizeSpecContext (US3 — legacy shape migration)', () => {
    it('coerces `{ status: "completed" }` into canonical empty-history shape', () => {
        const out = normalizeSpecContext({ status: 'completed' });
        expect(out.status).toBe('completed');
        expect(out.stepHistory).toEqual({});
        expect(out.transitions).toEqual([]);
        expect(out.currentStep).toBe('specify');
    });

    it('coerces legacy status="active" → implementing', () => {
        const out = normalizeSpecContext({ status: 'active' });
        expect(out.status).toBe('implementing');
    });
});

describe('substep helpers (US4)', () => {
    it('setSubstepStarted appends substep + non-null-substep transition', () => {
        const ctx = setStepStarted(fresh(), 'specify', 'extension');
        const next = setSubstepStarted(ctx, 'specify', 'validate-checklist', 'extension');
        expect(next.stepHistory.specify!.substeps).toHaveLength(1);
        expect(next.stepHistory.specify!.substeps![0].name).toBe('validate-checklist');
        const last = next.transitions[next.transitions.length - 1];
        expect(last.substep).toBe('validate-checklist');
    });

    it('setSubstepCompleted marks completedAt on matching substep', () => {
        let ctx = setStepStarted(fresh(), 'specify', 'extension');
        ctx = setSubstepStarted(ctx, 'specify', 'validate-checklist', 'extension');
        ctx = setSubstepCompleted(ctx, 'specify', 'validate-checklist', 'extension');
        expect(ctx.stepHistory.specify!.substeps![0].completedAt).toBeTruthy();
    });
});

describe('backfillMinimalContext (FR-011)', () => {
    it('produces a draft context with empty history', () => {
        const ctx = backfillMinimalContext({
            workflow: 'speckit',
            specName: 'foo',
            branch: 'b',
        });
        expect(ctx.status).toBe('draft');
        expect(ctx.currentStep).toBe('specify');
        expect(ctx.stepHistory).toEqual({});
        expect(ctx.transitions).toEqual([]);
    });
});

describe('appendTransition', () => {
    it('returns a new object with the transition at the end', () => {
        const ctx = fresh();
        const t: Transition = {
            step: 'specify',
            substep: null,
            from: { step: null, substep: null },
            by: 'extension',
            at: '2026-04-01T00:00:00Z',
        };
        const next = appendTransition(ctx, t);
        expect(next.transitions).toHaveLength(1);
        expect(ctx.transitions).toHaveLength(0); // immutable
    });
});
