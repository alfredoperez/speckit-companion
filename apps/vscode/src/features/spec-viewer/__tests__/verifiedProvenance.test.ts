import { deriveViewerState } from '../stateDerivation';
import type { SpecContext } from '../../../core/types/specContext';

/**
 * A receipt and a claim must not look alike by the time they reach the viewer.
 *
 * Everything in `verified[]` written before provenance existed was the agent's own account —
 * including the command, which was a string it typed rather than evidence anything ran — and
 * the Overview drew a checkmark beside all of it. Absent therefore has to keep meaning
 * claimed, and only what a script actually ran may say otherwise.
 */
const ctx = (verified: unknown[]): SpecContext =>
    ({ verified } as unknown as SpecContext);

const verified = (c: SpecContext) => deriveViewerState(c).verified ?? [];

describe('where a verification came from', () => {
    it('keeps a run-produced outcome marked as derived, with its exit code', () => {
        const [v] = verified(ctx([
            { what: 'Jest suite', command: 'npm test', source: 'derived', exitCode: 0, durationSeconds: 42.1 },
        ]));
        expect(v.source).toBe('derived');
        expect(v.exitCode).toBe(0);
        expect(v.durationSeconds).toBe(42.1);
    });

    it('reads an entry with no source as a claim', () => {
        const [v] = verified(ctx([{ what: 'Checked by hand', result: 'looked fine' }]));
        expect(v.source).toBeUndefined();
    });

    it('reads every entry written before this field existed as a claim', () => {
        // The migration case: there is no migration. Old entries simply have no source,
        // and reading that as unknown-so-assume-verified would relabel history as evidence.
        const [v] = verified(ctx([{ what: 'TypeScript compile', command: 'npm run compile', result: 'clean' }]));
        expect(v.source).toBeUndefined();
        expect(v.command).toBe('npm run compile');
    });

    it('refuses to promote a claim that merely looks derived', () => {
        // A context file is user-writable and an agent writes into it. Anything short of the
        // exact string must stay a claim, or the distinction is decorative.
        for (const source of ['Derived', 'DERIVED', true, 1, 'run', '']) {
            const [v] = verified(ctx([{ what: 'x', source }]));
            expect(v.source).toBeUndefined();
        }
    });

    it('drops an exit code that arrived without a derived source', () => {
        const [v] = verified(ctx([{ what: 'x', exitCode: 0 }]));
        expect(v.exitCode).toBeUndefined();
    });

    it('ignores a non-numeric exit code on a genuine receipt', () => {
        const [v] = verified(ctx([{ what: 'x', source: 'derived', exitCode: 'zero' }]));
        expect(v.source).toBe('derived');
        expect(v.exitCode).toBeUndefined();
    });
});
