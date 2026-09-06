import * as fs from 'fs';
import * as path from 'path';
import {
    requirementSlices,
    requirementsForChange,
    hasNoMarkers,
    requirementIds,
} from '../livingSpecsModel';

/**
 * The TypeScript half of a parser that has to exist twice.
 *
 * The viewer has no Python and the command bodies have no TypeScript, so the
 * risk is divergence, not duplication. These are the same fixtures
 * `speckit-extension/tests/test_resolve_spec_paths.py` reads; the drift guard
 * over there fails if either suite stops reading one.
 */
const FIXTURES = path.join(
    __dirname, '..', '..', '..', '..',
    'speckit-extension', 'tests', 'fixtures', 'requirement-slices',
);

const read = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
const expected = (): Record<string, Array<{ heading: string; touches: string[] | null }>> =>
    JSON.parse(read('expected.json'));

describe('requirementSlices — against the shared fixtures', () => {
    it.each(Object.keys(expected()))('%s slices as the contract says', name => {
        const want = expected()[name];
        const got = requirementSlices(read(name));
        expect(got.map(s => s.heading)).toEqual(want.map(w => w.heading));
        expect(got.map(s => s.touches ?? null)).toEqual(want.map(w => w.touches));
    });

    it('a marker inside a fence is not a marker', () => {
        const slices = requirementSlices(read('marker-in-fence.md'));
        expect(slices).toHaveLength(1);
        expect(slices[0].touches).toBeUndefined();
    });

    it('a marker one line too far down is body', () => {
        expect(requirementSlices(read('marker-too-far.md'))[0].touches).toBeUndefined();
    });

    it('duplicate headings both appear, with their own markers', () => {
        const slices = requirementSlices(read('duplicate-headings.md'));
        expect(slices.map(s => s.heading)).toEqual(['Same name', 'Same name']);
        expect(slices[0].touches).not.toEqual(slices[1].touches);
    });

    it('a spec with no markers reads whole', () => {
        expect(hasNoMarkers(requirementSlices(read('no-markers.md')))).toBe(true);
        expect(hasNoMarkers(requirementSlices(read('mixed.md')))).toBe(false);
    });
});

describe('requirementsForChange — a marker can only narrow', () => {
    it('an unmarked requirement is contributed even when nothing matches', () => {
        const picked = requirementsForChange(
            requirementSlices(read('mixed.md')), ['src/nothing/at/all.ts'],
        );
        expect(picked.map(s => s.heading)).toEqual(['Unmarked one']);
    });

    it('a matching marker contributes its requirement alongside the unmarked ones', () => {
        const picked = requirementsForChange(
            requirementSlices(read('mixed.md')), ['src/marked/thing.ts'],
        );
        expect(picked.map(s => s.heading)).toEqual(['Marked one', 'Unmarked one']);
    });

    it('a marker claiming everything behaves like no marker', () => {
        const slices = requirementSlices(read('marker-matches-everything.md'));
        expect(requirementsForChange(slices, ['src/anything.ts'])).toHaveLength(1);
    });

    it('a marker matching nothing on disk still loads its requirement when it matches the change', () => {
        // Reporting an unmatched marker is Wave 2's validator, not this.
        const slices = requirementSlices(read('marker-matches-nothing.md'));
        expect(requirementsForChange(slices, ['src/does-not-exist/x.ts'])).toHaveLength(1);
        expect(requirementsForChange(slices, ['src/elsewhere/y.ts'])).toHaveLength(0);
    });
});

describe('the two counters agree', () => {
    it('slicing counts the headings the coverage denominator counts', () => {
        // requirementIds counts FR-ids; slicing counts headings. Both must strip
        // fences the same way, so a fenced example never inflates either.
        const fenced = read('marker-in-fence.md');
        expect(requirementSlices(fenced)).toHaveLength(1);
        expect(requirementIds(fenced)).toEqual([]);
    });
});

describe('a requirement body is what a load step reads', () => {
    it('keeps a fenced example, which fence-stripping would have deleted silently', () => {
        const body = requirementSlices(read('fenced-body.md'))[0].body.join('\n');
        expect(body).toContain('```json');
        expect(body).toContain('{"heading": "…", "touches": []}');
    });

    it('never hands the marker over as prose', () => {
        for (const name of ['fenced-body.md', 'all-marked.md', 'mixed.md']) {
            for (const slice of requirementSlices(read(name))) {
                expect(slice.body.join('\n')).not.toContain('touches:');
            }
        }
    });
});
