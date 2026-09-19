import { comparators, ComparatorContext, SortableSpec, StatFn } from '../specsSortMode';

const BASE = '/fake/root';

function ctxWith(
    specNames: Record<string, string | undefined> = {},
    statuses: Record<string, string | undefined> = {},
    statFn?: StatFn
): ComparatorContext {
    return {
        basePath: BASE,
        specNameByPath: new Map(Object.entries(specNames)),
        statusByPath: new Map(Object.entries(statuses)),
        statFn,
    };
}

function specs(...names: string[]): SortableSpec[] {
    return names.map(n => ({ name: n, path: `specs/${n}` }));
}

describe('comparators.number', () => {
    it('sorts numeric-prefix specs in descending order', () => {
        const items = specs('068-foo', '075-bar', '072-baz');
        items.sort(comparators.number(ctxWith()));
        expect(items.map(s => s.name)).toEqual(['075-bar', '072-baz', '068-foo']);
    });

    it('places non-numeric specs after numeric ones, alphabetized', () => {
        const items = specs('070-foo', 'zeta', 'alpha');
        items.sort(comparators.number(ctxWith()));
        expect(items.map(s => s.name)).toEqual(['070-foo', 'alpha', 'zeta']);
    });

    it('breaks prefix ties alphabetically', () => {
        const items = specs('070-zeta', '070-alpha');
        items.sort(comparators.number(ctxWith()));
        expect(items.map(s => s.name)).toEqual(['070-alpha', '070-zeta']);
    });
});

describe('comparators.name', () => {
    it('sorts by spec-context name when present, falling back to slug', () => {
        const items = specs('070-foo', '065-bar', '080-baz');
        const names = {
            'specs/070-foo': 'Apple',
            'specs/065-bar': 'Cherry',
            'specs/080-baz': 'Banana',
        };
        items.sort(comparators.name(ctxWith(names)));
        expect(items.map(s => s.name)).toEqual(['070-foo', '080-baz', '065-bar']);
    });

    it('uses numeric-prefix tie-break when names match', () => {
        const items = specs('070-a', '080-a');
        const names = { 'specs/070-a': 'Same', 'specs/080-a': 'Same' };
        items.sort(comparators.name(ctxWith(names)));
        expect(items.map(s => s.name)).toEqual(['080-a', '070-a']);
    });
});

describe('comparators.status', () => {
    it('orders by workflow step (earliest first)', () => {
        const items = specs('070-a', '071-b', '072-c');
        const statuses = {
            'specs/070-a': 'implement',
            'specs/071-b': 'specify',
            'specs/072-c': 'plan',
        };
        items.sort(comparators.status(ctxWith({}, statuses)));
        expect(items.map(s => s.name)).toEqual(['071-b', '072-c', '070-a']);
    });

    it('sinks specs with missing status to the end', () => {
        const items = specs('070-a', '071-b', '072-c');
        const statuses = {
            'specs/070-a': 'plan',
            'specs/071-b': undefined,
            'specs/072-c': 'specify',
        };
        items.sort(comparators.status(ctxWith({}, statuses)));
        expect(items.map(s => s.name)).toEqual(['072-c', '070-a', '071-b']);
    });

    it('breaks status ties by numeric prefix desc', () => {
        const items = specs('070-a', '071-b', '072-c');
        const statuses = {
            'specs/070-a': 'plan',
            'specs/071-b': 'plan',
            'specs/072-c': 'plan',
        };
        items.sort(comparators.status(ctxWith({}, statuses)));
        expect(items.map(s => s.name)).toEqual(['072-c', '071-b', '070-a']);
    });
});

describe('comparators.dateCreated / dateModified', () => {
    it('sorts newest-first by birthtime', () => {
        const byPath: Record<string, number> = {
            [`${BASE}/specs/070-a`]: 1000,
            [`${BASE}/specs/071-b`]: 3000,
            [`${BASE}/specs/072-c`]: 2000,
        };
        const statFn: StatFn = (p) => ({ birthtimeMs: byPath[p] ?? 0, mtimeMs: byPath[p] ?? 0 });

        const items = specs('070-a', '071-b', '072-c');
        items.sort(comparators.dateCreated(ctxWith({}, {}, statFn)));
        expect(items.map(s => s.name)).toEqual(['071-b', '072-c', '070-a']);
    });

    it('sinks specs that fail to stat to the end', () => {
        const statFn: StatFn = (p) => {
            if (p.endsWith('071-b')) throw new Error('nope');
            return { birthtimeMs: 1000, mtimeMs: 1000 };
        };

        const items = specs('070-a', '071-b', '072-c');
        items.sort(comparators.dateCreated(ctxWith({}, {}, statFn)));
        expect(items[items.length - 1].name).toBe('071-b');
    });

    it('sorts newest-first by mtime for dateModified', () => {
        const byPath: Record<string, number> = {
            [`${BASE}/specs/070-a`]: 2000,
            [`${BASE}/specs/071-b`]: 1000,
            [`${BASE}/specs/072-c`]: 3000,
        };
        const statFn: StatFn = (p) => ({ birthtimeMs: 0, mtimeMs: byPath[p] ?? 0 });

        const items = specs('070-a', '071-b', '072-c');
        items.sort(comparators.dateModified(ctxWith({}, {}, statFn)));
        expect(items.map(s => s.name)).toEqual(['072-c', '070-a', '071-b']);
    });
});
