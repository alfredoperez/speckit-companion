import { fuzzyMatch, normalize } from '../fuzzyMatch';

describe('fuzzyMatch', () => {
    describe('normalize', () => {
        it('lowercases and strips non-alphanumeric characters', () => {
            expect(normalize('Tree-Group-Counts')).toBe('treegroupcounts');
            expect(normalize('  Hello, World! ')).toBe('helloworld');
            expect(normalize('075-filter_specs.tree')).toBe('075filterspecstree');
        });

        it('returns empty string for strings with no alphanumerics', () => {
            expect(normalize('---')).toBe('');
            expect(normalize('')).toBe('');
        });
    });

    describe('fuzzyMatch', () => {
        it('returns true for an empty query', () => {
            expect(fuzzyMatch('', 'anything')).toBe(true);
            expect(fuzzyMatch('   ', 'anything')).toBe(true);
            expect(fuzzyMatch('---', 'anything')).toBe(true);
        });

        it('matches case-insensitively', () => {
            expect(fuzzyMatch('TREE', 'filter-specs-tree')).toBe(true);
            expect(fuzzyMatch('tree', 'FILTER-SPECS-TREE')).toBe(true);
        });

        it('matches subsequences, not just substrings', () => {
            expect(fuzzyMatch('fst', 'filter-specs-tree')).toBe(true);
            expect(fuzzyMatch('ftr', 'filter-specs-tree')).toBe(true);
        });

        it('rejects non-subsequences', () => {
            expect(fuzzyMatch('xyz', 'filter-specs-tree')).toBe(false);
            expect(fuzzyMatch('treef', 'filter-specs-tree')).toBe(false);
        });

        it('normalizes punctuation and whitespace on both sides', () => {
            expect(fuzzyMatch('tree view', 'treeview')).toBe(true);
            expect(fuzzyMatch('tree-view', 'tree view')).toBe(true);
            expect(fuzzyMatch('t_r.e:e', 'tree')).toBe(true);
        });

        it('matches across multiple haystacks concatenated in order', () => {
            expect(fuzzyMatch('filtertree', '075-filter-specs-tree', 'Filter specs tree')).toBe(true);
            expect(fuzzyMatch('filter', '075-foo', 'Filter/search box')).toBe(true);
        });

        it('skips undefined haystacks', () => {
            expect(fuzzyMatch('tree', 'filter-specs-tree', undefined)).toBe(true);
            expect(fuzzyMatch('tree', undefined, 'tree view')).toBe(true);
            expect(fuzzyMatch('tree', undefined, undefined)).toBe(false);
        });

        it('returns false when haystack is empty or only non-alphanumeric', () => {
            expect(fuzzyMatch('a', '---')).toBe(false);
            expect(fuzzyMatch('a', '')).toBe(false);
        });
    });
});
