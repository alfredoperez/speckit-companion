/**
 * Tests for the defensive `toStringArray` helper that prevents
 * `TasksCard` from crashing on non-array `concerns` / `files` shapes.
 *
 * Render tests are not feasible under the current Jest config
 * (testEnvironment: 'node', no jsdom, no preact-testing-library), so we
 * exercise the helper directly — which is the actual crash boundary the
 * panel relied on before this fix. See spec 095 §R001 and §R006.
 */

import { toStringArray } from '../toStringArray';

describe('TasksCard.toStringArray', () => {
    it('passes through a string[] unchanged', () => {
        const input = ['a', 'b', 'c'];
        expect(toStringArray(input)).toEqual(['a', 'b', 'c']);
    });

    it('filters non-string elements from an array', () => {
        const input = ['a', 1, null, 'b', undefined];
        expect(toStringArray(input)).toEqual(['a', 'b']);
    });

    it('treats the literal "None" string as empty', () => {
        expect(toStringArray('None')).toEqual([]);
    });

    it('treats "none", "N/A", "  " case-insensitively as empty', () => {
        expect(toStringArray('none')).toEqual([]);
        expect(toStringArray('N/A')).toEqual([]);
        expect(toStringArray('  ')).toEqual([]);
    });

    it('wraps a real concern string as a single-entry array', () => {
        expect(toStringArray('Fees-Tax has no @else branch')).toEqual([
            'Fees-Tax has no @else branch',
        ]);
    });

    it('trims surrounding whitespace before wrapping', () => {
        expect(toStringArray('  real concern  ')).toEqual(['real concern']);
    });

    it('returns [] for null / undefined / unsupported primitives', () => {
        expect(toStringArray(null)).toEqual([]);
        expect(toStringArray(undefined)).toEqual([]);
        expect(toStringArray(42)).toEqual([]);
        expect(toStringArray(true)).toEqual([]);
        expect(toStringArray({})).toEqual([]);
    });

    it('matches the FIRM-11132 task_summaries shape — every entry yields a safe string[]', () => {
        // Exact values from the FIRM-11132 bundle's mutation 9 (final on-disk state).
        const firm11132Concerns: Record<string, unknown> = {
            'T001-T004': 'Spec Exploration Findings were wrong — superseded by RT1-RT3',
            RT1: 'None',
            RT2: 'Fees-Tax has no @else read-only branch (excluded). PDF preview tab still ART-7889. No SCSS change.',
            RT3: 'None',
        };
        const result: Record<string, string[]> = {};
        for (const [id, raw] of Object.entries(firm11132Concerns)) {
            result[id] = toStringArray(raw);
        }
        expect(result).toEqual({
            'T001-T004': ['Spec Exploration Findings were wrong — superseded by RT1-RT3'],
            RT1: [],
            RT2: ['Fees-Tax has no @else read-only branch (excluded). PDF preview tab still ART-7889. No SCSS change.'],
            RT3: [],
        });
    });
});
