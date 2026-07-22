import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    updateSpecContext,
    setStepStarted,
    appendHistory,
    writeSpecContext,
} from '../../../src/features/specs/specContextWriter';
import { readSpecContext } from '../../../src/features/specs/specContextReader';
import { backfillMinimalContext } from '../../../src/features/specs/specContextBackfill';
import { SpecContext } from '../../../src/core/types/specContext';

function mkTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-writer-'));
}

function fresh(): SpecContext {
    return backfillMinimalContext({
        workflow: 'speckit-companion',
        specName: 'x',
        branch: 'main',
    });
}

function ctxPath(dir: string): string {
    return path.join(dir, '.spec-context.json');
}

describe('updateSpecContext — per-spec write serialization', () => {
    it('applies both overlapping same-spec writes, keeps history append-only, and the start entry survives (FR-001, FR-003, FR-006)', async () => {
        const dir = mkTmp();
        await writeSpecContext(dir, fresh());

        // Two updates issued in the same tick: a step-start and a second entry.
        // Before serialization these both read the same base `history` and the
        // loser's change was lost. Both must now land.
        const p1 = updateSpecContext(
            dir,
            ctx => setStepStarted(ctx, 'plan', 'extension'),
            fresh()
        );
        const p2 = updateSpecContext(
            dir,
            ctx =>
                appendHistory(ctx, {
                    step: 'plan',
                    substep: 'research',
                    kind: 'complete',
                    by: 'ai',
                    at: new Date().toISOString(),
                }),
            fresh()
        );
        await Promise.all([p1, p2]);

        const loaded = await readSpecContext(dir);
        expect(loaded).not.toBeNull();
        const kinds = loaded!.history.map(h => `${h.step}/${h.substep ?? ''}/${h.kind}`);
        // The step-start write was not overwritten.
        expect(kinds).toContain('plan//start');
        // The second write also landed.
        expect(kinds).toContain('plan/research/complete');
        // Append-only: the original entry from the seed write is still first.
        expect(loaded!.history.length).toBeGreaterThanOrEqual(2);
    });

    it('a stress of many overlapping same-spec writes loses no entry (SC-001)', async () => {
        const dir = mkTmp();
        await writeSpecContext(dir, fresh());
        const N = 25;
        const writes = Array.from({ length: N }, (_, i) =>
            updateSpecContext(
                dir,
                ctx =>
                    appendHistory(ctx, {
                        step: 'implement',
                        substep: `t${i}`,
                        kind: 'complete',
                        by: 'ai',
                        at: new Date().toISOString(),
                    }),
                fresh()
            )
        );
        await Promise.all(writes);

        const loaded = await readSpecContext(dir);
        const subs = new Set(
            loaded!.history.filter(h => h.substep?.startsWith('t')).map(h => h.substep)
        );
        expect(subs.size).toBe(N);
    });

    it('writes to two different specs run on independent queues — spec B completes while spec A is gated (FR-002, SC-003)', async () => {
        const dirA = mkTmp();
        const dirB = mkTmp();
        await writeSpecContext(dirA, fresh());
        await writeSpecContext(dirB, fresh());

        // Hold spec A's write open by gating its file read; spec B must still
        // finish. Under a single global queue, B would chain behind the gated A
        // and this test would deadlock (time out) — that's the point.
        let releaseA: () => void = () => {};
        const aGate = new Promise<void>(r => { releaseA = r; });
        const realRead = fs.promises.readFile;
        const spy = jest.spyOn(fs.promises, 'readFile').mockImplementation(
            async (p: any, ...args: any[]) => {
                if (String(p) === ctxPath(dirA)) await aGate;
                return (realRead as any)(p, ...args);
            }
        );

        const slowA = updateSpecContext(dirA, ctx => setStepStarted(ctx, 'plan', 'extension'), fresh());
        const fastB = updateSpecContext(dirB, ctx => setStepStarted(ctx, 'plan', 'extension'), fresh());

        // B resolves while A is still gated → the queues are independent.
        await fastB;
        const b = await readSpecContext(dirB);
        expect(b!.history.some(h => h.step === 'plan' && h.kind === 'start')).toBe(true);

        releaseA();
        await slowA;
        spy.mockRestore();
        const a = await readSpecContext(dirA);
        expect(a!.history.some(h => h.step === 'plan' && h.kind === 'start')).toBe(true);
    });

    it('a throwing queued write releases the lock so the next same-spec write still runs, and its error propagates (FR-004, SC-004)', async () => {
        const dir = mkTmp();
        await writeSpecContext(dir, fresh());

        const boom = updateSpecContext(
            dir,
            () => {
                throw new Error('mutate failed');
            },
            fresh()
        );
        const next = updateSpecContext(
            dir,
            ctx => setStepStarted(ctx, 'plan', 'extension'),
            fresh()
        );

        // The failed write surfaces its error to the caller (not swallowed).
        await expect(boom).rejects.toThrow('mutate failed');
        // The queue advanced: the following write still completed.
        await expect(next).resolves.toBeDefined();

        const loaded = await readSpecContext(dir);
        expect(loaded!.history.some(h => h.step === 'plan' && h.kind === 'start')).toBe(true);
    });

    it('still refuses to overwrite an existing non-JSON file (FR-005)', async () => {
        const dir = mkTmp();
        fs.writeFileSync(ctxPath(dir), 'not json {{{', 'utf-8');
        await expect(
            updateSpecContext(dir, ctx => ctx, fresh())
        ).rejects.toThrow(/not valid JSON/);
    });
});
