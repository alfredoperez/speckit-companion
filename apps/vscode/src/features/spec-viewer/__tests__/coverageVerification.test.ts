import { markMissingTests } from '../stateDerivation';
import type { ViewerCoverageRow } from '../../../core/types/specContext';

/**
 * Every cell in the coverage table was a string an assistant typed once, rendered
 * with the authority of a check (#612). These assert the check now happens.
 */
describe('markMissingTests', () => {
    const rows = (tests: string[]): ViewerCoverageRow[] => [
        { req: 'FR-1', tasks: ['T001'], tests },
    ];

    it('flags a named test that is not on disk', () => {
        const out = markMissingTests(rows(['src/a.test.ts']), () => false);
        expect(out?.[0].missingTests).toEqual(['src/a.test.ts']);
    });

    it('leaves a test that exists alone', () => {
        const out = markMissingTests(rows(['src/a.test.ts']), () => true);
        expect(out?.[0].missingTests).toBeUndefined();
    });

    it('reports only the ones that are missing', () => {
        const out = markMissingTests(
            rows(['src/a.test.ts', 'src/b.test.ts']),
            p => p === 'src/a.test.ts'
        );
        expect(out?.[0].missingTests).toEqual(['src/b.test.ts']);
    });

    it('ignores references that do not name a file', () => {
        // A suite or case name is not a path and must not be reported as missing —
        // the point is catching a file that should be there, not enforcing a format.
        const out = markMissingTests(rows(['renders the header', 'AddTodo']), () => false);
        expect(out?.[0].missingTests).toBeUndefined();
    });

    it('resolves a path carrying a case suffix', () => {
        const seen: string[] = [];
        markMissingTests(rows(['src/a.test.ts::renders', 'src/b.test.ts#adds']), p => {
            seen.push(p);
            return true;
        });
        expect(seen).toEqual(['src/a.test.ts', 'src/b.test.ts']);
    });

    it('leaves a requirement with no tests untouched', () => {
        const out = markMissingTests(rows([]), () => false);
        expect(out?.[0].missingTests).toBeUndefined();
        expect(out?.[0].tests).toEqual([]);
    });

    it('passes undefined through', () => {
        expect(markMissingTests(undefined, () => true)).toBeUndefined();
    });
});
