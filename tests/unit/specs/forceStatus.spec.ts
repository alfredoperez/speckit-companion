import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { forceStatus, setStatus } from '../../../src/features/specs/stepLifecycle';
import { readSpecContext } from '../../../src/features/specs/specContextReader';
import { deriveViewerState } from '../../../src/features/spec-viewer/stateDerivation';
import { SpecContext, Status } from '../../../src/core/types/specContext';

function mkTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'force-status-'));
}

/** A spec stranded mid-implement: every step started, none after specify completed. */
function strandedAtImplement(): SpecContext {
    return {
        workflow: 'speckit',
        specName: 'x',
        branch: '',
        currentStep: 'implement',
        status: 'implementing',
        history: [
            { step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-01-01T00:00:00Z' },
            { step: 'plan', substep: null, kind: 'start', by: 'extension', at: '2026-01-01T00:01:00Z' },
            { step: 'tasks', substep: null, kind: 'start', by: 'extension', at: '2026-01-01T00:02:00Z' },
            { step: 'implement', substep: null, kind: 'start', by: 'extension', at: '2026-01-01T00:03:00Z' },
        ],
    };
}

async function seed(dir: string, ctx: SpecContext): Promise<void> {
    fs.writeFileSync(path.join(dir, '.spec-context.json'), JSON.stringify(ctx, null, 2));
}

describe('forceStatus (manual recovery escape hatch, #347)', () => {
    let dir: string;
    beforeEach(() => { dir = mkTmp(); });
    afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

    it('realigns currentStep to the forced status owning step (in-flight)', async () => {
        await seed(dir, strandedAtImplement());
        const ok = await forceStatus(dir, 'planning', 'user');
        expect(ok).toBe(true);

        const ctx = await readSpecContext(dir);
        expect(ctx!.status).toBe('planning');
        expect(ctx!.currentStep).toBe('plan');
        // Honest override: the appended entry is a `start` for `plan`, by user.
        const last = ctx!.history[ctx!.history.length - 1];
        expect(last).toMatchObject({ step: 'plan', kind: 'start', by: 'user' });
    });

    it('realigns currentStep + status + history for a settled status', async () => {
        await seed(dir, strandedAtImplement());
        const ok = await forceStatus(dir, 'planned', 'user');
        expect(ok).toBe(true);

        const ctx = await readSpecContext(dir);
        expect(ctx!.status).toBe('planned');
        expect(ctx!.currentStep).toBe('plan');
        const last = ctx!.history[ctx!.history.length - 1];
        expect(last).toMatchObject({ step: 'plan', kind: 'complete', by: 'user' });

        // Always coherent: at minimum the footer offers Regenerate against the
        // now-correct step, so the spec is workable rather than stranded.
        const vs = deriveViewerState(ctx!, ctx!.currentStep, undefined);
        expect(vs.footer.map(a => a.id)).toContain('regenerate');
    });

    it('surfaces Approve when recovering a spec clicked one step ahead', async () => {
        // Common #347 case: at specify, user clicks Plan early → plan started,
        // specify never completed. Forcing `specified` rewinds to specify.
        await seed(dir, {
            workflow: 'speckit', specName: 'x', branch: '', currentStep: 'plan', status: 'planning',
            history: [
                { step: 'specify', substep: null, kind: 'start', by: 'extension', at: '2026-01-01T00:00:00Z' },
                { step: 'plan', substep: null, kind: 'start', by: 'extension', at: '2026-01-01T00:01:00Z' },
            ],
        });
        await forceStatus(dir, 'planned', 'user');
        const ctx = await readSpecContext(dir);
        expect(ctx!.currentStep).toBe('plan');
        expect(ctx!.status).toBe('planned');
        // No later step has started → Approve (forward to Tasks) surfaces.
        const vs = deriveViewerState(ctx!, ctx!.currentStep, undefined);
        expect(vs.footer.map(a => a.id)).toContain('approve');
    });

    it('does NOT record a misleading "implement completed" when forcing planning', async () => {
        await seed(dir, strandedAtImplement());
        await forceStatus(dir, 'planning', 'user');
        const ctx = await readSpecContext(dir);
        const last = ctx!.history[ctx!.history.length - 1];
        expect(last.step).not.toBe('implement');
    });

    it.each<[Status, string, 'start' | 'complete']>([
        ['specifying', 'specify', 'start'],
        ['specified', 'specify', 'complete'],
        ['planning', 'plan', 'start'],
        ['planned', 'plan', 'complete'],
        ['tasking', 'tasks', 'start'],
        ['ready-to-implement', 'tasks', 'complete'],
        ['implementing', 'implement', 'start'],
        ['implemented', 'implement', 'complete'],
    ])('force %s → currentStep %s, kind %s', async (status, step, kind) => {
        await seed(dir, strandedAtImplement());
        await forceStatus(dir, status, 'user');
        const ctx = await readSpecContext(dir);
        expect(ctx!.status).toBe(status);
        expect(ctx!.currentStep).toBe(step);
        expect(ctx!.history[ctx!.history.length - 1]).toMatchObject({ step, kind });
    });

    it('terminal statuses route through setStatus unchanged (currentStep untouched)', async () => {
        await seed(dir, strandedAtImplement());
        await forceStatus(dir, 'completed', 'user');
        const forced = await readSpecContext(dir);

        // Independently apply setStatus to a fresh copy and compare the result.
        const dir2 = mkTmp();
        try {
            await seed(dir2, strandedAtImplement());
            await setStatus(dir2, 'completed', 'user');
            const direct = await readSpecContext(dir2);
            expect(forced!.currentStep).toBe(direct!.currentStep);
            expect(forced!.currentStep).toBe('implement');
            expect(forced!.status).toBe('completed');
            const last = forced!.history[forced!.history.length - 1];
            expect(last).toMatchObject({ step: 'implement', kind: 'complete' });
        } finally {
            fs.rmSync(dir2, { recursive: true, force: true });
        }
    });
});
