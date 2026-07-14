import { specStatusLabel, documentStatusLabel } from '../specStatusLabel';

describe('specStatusLabel', () => {
    it.each([
        ['draft', 'Draft'],
        ['specifying', 'Specifying'],
        ['specified', 'Specified'],
        ['planning', 'Planning'],
        ['planned', 'Planned'],
        ['tasking', 'Tasking'],
        ['ready-to-implement', 'Ready to Implement'],
        ['implementing', 'Implementing'],
        ['implemented', 'Implemented'],
        ['completed', 'Completed'],
        ['archived', 'Archived'],
    ])('maps %s to "%s"', (status, label) => {
        expect(specStatusLabel(status)).toBe(label);
    });

    it('title-cases an unknown value rather than leaking the raw key', () => {
        expect(specStatusLabel('half-baked-thing')).toBe('Half Baked Thing');
    });

    it('returns nothing when there is no status', () => {
        expect(specStatusLabel(undefined)).toBeUndefined();
    });
});

describe('documentStatusLabel', () => {
    it.each([
        ['complete', 'Complete'],
        ['partial', 'In Progress'],
        ['empty', 'Not Created'],
    ] as const)('maps %s to "%s"', (status, label) => {
        expect(documentStatusLabel(status)).toBe(label);
    });
});
