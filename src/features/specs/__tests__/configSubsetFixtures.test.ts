import * as fs from 'fs';
import * as path from 'path';
import { unsupportedForRuntime } from '../livingSpecsModel';

/**
 * `companion.yml` is read by two implementations in two languages: the runtime
 * reader in `speckit-extension/scripts/companion_config.py`, and this side's
 * pre-check, which exists so the editor never presents a configuration the
 * runtime is going to refuse.
 *
 * They cannot share code. Issue #608 asked for one place or shared fixtures, and
 * the duplication landed without the fixtures — so the two rules drifted with
 * nothing to notice. These cases are the shared corpus:
 * `speckit-extension/tests/test_config_subset.py` runs the same file and must
 * reach the same verdict on every one.
 */
const fixture = path.join(__dirname, '..', '..', '..', '..', 'tests', 'fixtures', 'config-subset', 'cases.json');
const { cases } = JSON.parse(fs.readFileSync(fixture, 'utf8')) as {
    cases: { name: string; supported: boolean; yaml: string }[];
};

describe('the supported companion.yml subset', () => {
    it('has cases on both sides of the rule', () => {
        expect(cases.some(c => c.supported)).toBe(true);
        expect(cases.some(c => !c.supported)).toBe(true);
    });

    for (const testCase of cases) {
        const verdict = testCase.supported ? 'accepts' : 'refuses';
        it(`${verdict} ${testCase.name}`, () => {
            const complaint = unsupportedForRuntime(testCase.yaml);
            if (testCase.supported) {
                expect(complaint).toBeNull();
            } else {
                // The complaint names the line, because a configuration that is
                // refused without saying where is one nobody can fix.
                expect(complaint).toMatch(/^line \d+: /);
            }
        });
    }
});
