jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return { ...actual, statSync: jest.fn(actual.statSync) };
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readLivingSpecs, readCapabilityHealth, __test } from '../livingSpecsModel';

const realStatSync = jest.requireActual('fs').statSync;
const statSyncMock = fs.statSync as unknown as jest.Mock;

const { globMatches } = __test;

/**
 * Build a temp workspace from a flat map of repo-relative path -> file contents,
 * plus an optional `.specify/companion.yml` body. Returns the root.
 */
function makeWorkspace(files: Record<string, string>, companionYml?: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'living-specs-'));
    const write = (rel: string, body: string): void => {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    };
    for (const [rel, body] of Object.entries(files)) {
        write(rel, body);
    }
    if (companionYml !== undefined) {
        write('.specify/companion.yml', companionYml);
    }
    return root;
}

describe('readLivingSpecs', () => {
    const created: string[] = [];
    const ws = (files: Record<string, string>, yml?: string): string => {
        const root = makeWorkspace(files, yml);
        created.push(root);
        return root;
    };
    afterAll(() => {
        for (const root of created) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('returns an inert empty listing when there is no companion.yml', () => {
        const root = ws({ 'capabilities/x/spec.md': '# x' });
        const listing = readLivingSpecs(root);
        expect(listing).toEqual({ enabled: false, capabilities: [], orphans: [] });
    });

    it('returns an inert empty listing when livingSpecs.enabled is false', () => {
        const root = ws(
            { 'capabilities/x/spec.md': '# x' },
            'livingSpecs:\n  enabled: false\n  capabilities:\n    - name: x\n'
        );
        const listing = readLivingSpecs(root);
        expect(listing.enabled).toBe(false);
        expect(listing.capabilities).toEqual([]);
        expect(listing.orphans).toEqual([]);
    });

    it('does not throw on a malformed companion.yml — treats it as disabled', () => {
        const root = ws({ 'capabilities/x/spec.md': '# x' }, ':::not: valid: yaml: [');
        expect(() => readLivingSpecs(root)).not.toThrow();
        expect(readLivingSpecs(root).enabled).toBe(false);
    });

    it('resolves a centralized capability to capabilities/<name>/spec.md', () => {
        const root = ws(
            { 'capabilities/checkout/spec.md': '# checkout' },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: checkout\n      match: ["src/checkout/**"]\n'
        );
        const listing = readLivingSpecs(root);
        expect(listing.capabilities).toHaveLength(1);
        const cap = listing.capabilities[0];
        expect(cap.name).toBe('checkout');
        expect(cap.spec).toBe('capabilities/checkout/spec.md');
        expect(cap.location).toBe('centralized');
        expect(cap.exists).toBe(true);
    });

    it('resolves a colocated capability with an explicit spec path', () => {
        const root = ws(
            { 'src/billing/billing.spec.md': '# billing' },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: billing\n      spec: src/billing/billing.spec.md\n'
        );
        const cap = readLivingSpecs(root).capabilities[0];
        expect(cap.spec).toBe('src/billing/billing.spec.md');
        expect(cap.location).toBe('colocated');
        expect(cap.exists).toBe(true);
    });

    it('marks a capability whose spec file is missing as not existing but still lists it', () => {
        const root = ws(
            {},
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: ghost\n'
        );
        const cap = readLivingSpecs(root).capabilities[0];
        expect(cap.name).toBe('ghost');
        expect(cap.exists).toBe(false);
    });

    it('reports tier siblings only when the files exist on disk', () => {
        const root = ws(
            {
                'capabilities/checkout/spec.md': '# checkout',
                'capabilities/checkout/spec.arch.md': '# arch',
                // no coverage sibling
            },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: checkout\n'
        );
        const cap = readLivingSpecs(root).capabilities[0];
        const kinds = cap.tiers.map(t => t.kind);
        expect(kinds).toContain('arch');
        expect(kinds).not.toContain('coverage');
        expect(cap.tiers.find(t => t.kind === 'arch')!.path).toBe('capabilities/checkout/spec.arch.md');
    });

    it('derives colocated tier siblings from a *.spec.md base', () => {
        const root = ws(
            {
                'src/billing/billing.spec.md': '# billing',
                'src/billing/billing.coverage.md': '# coverage',
            },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: billing\n      spec: src/billing/billing.spec.md\n'
        );
        const cap = readLivingSpecs(root).capabilities[0];
        expect(cap.tiers.map(t => t.kind)).toEqual(['coverage']);
        expect(cap.tiers[0].path).toBe('src/billing/billing.coverage.md');
    });

    it('de-dupes capabilities that resolve to the same spec path', () => {
        const root = ws(
            { 'capabilities/x/spec.md': '# x' },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: x\n    - name: x\n'
        );
        expect(readLivingSpecs(root).capabilities).toHaveLength(1);
    });

    it('lists a genuine orphan spec but excludes specs/, reserved tiers, claimed and owned files', () => {
        const root = ws(
            {
                // claimed centralized spec + a reserved tier sibling
                'capabilities/checkout/spec.md': '# checkout',
                'capabilities/checkout/spec.arch.md': '# arch',
                // another file inside the owned capability dir — not an orphan
                'capabilities/checkout/legacy.spec.md': '# legacy',
                // a feature spec under specs/ — never an orphan
                'specs/100-feature/feature.spec.md': '# feature',
                // a genuine orphan elsewhere
                'src/payments/payments.spec.md': '# payments',
            },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: checkout\n'
        );
        const listing = readLivingSpecs(root);
        expect(listing.orphans).toEqual(['src/payments/payments.spec.md']);
    });

    it('stops at a nested project that carries its own companion.yml', () => {
        const root = ws(
            {
                'capabilities/checkout/spec.md': '# checkout',
                'src/payments/payments.spec.md': '# payments',
                'examples/sample/.specify/companion.yml':
                    'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: todos\n',
                'examples/sample/src/store/todos.spec.md': '# todos',
                'examples/optout/.specify/companion.yml': 'livingSpecs:\n  enabled: false\n',
                'examples/optout/notes/stray.spec.md': '# stray',
            },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: checkout\n'
        );
        expect(readLivingSpecs(root).orphans).toEqual(['src/payments/payments.spec.md']);
    });

    it('stops at a nested project whose companion.yml cannot be read', () => {
        const root = ws(
            {
                'capabilities/checkout/spec.md': '# checkout',
                'src/payments/payments.spec.md': '# payments',
                'examples/locked/.specify/companion.yml':
                    'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: todos\n',
                'examples/locked/src/store/todos.spec.md': '# todos',
            },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: checkout\n'
        );
        const blocked = path.join(root, 'examples', 'locked', '.specify', 'companion.yml');
        statSyncMock.mockImplementation((p: fs.PathLike, ...rest: unknown[]) => {
            if (p === blocked) {
                const denied = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
                denied.code = 'EACCES';
                throw denied;
            }
            return realStatSync(p, ...rest);
        });
        try {
            expect(readLivingSpecs(root).orphans).toEqual(['src/payments/payments.spec.md']);
        } finally {
            statSyncMock.mockImplementation(realStatSync);
        }
    });

    it('treats a plain directory with no companion.yml as walkable, not a boundary', () => {
        const root = ws(
            {
                'capabilities/checkout/spec.md': '# checkout',
                'examples/plain/src/store/todos.spec.md': '# todos',
            },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: checkout\n'
        );
        expect(readLivingSpecs(root).orphans).toEqual(['examples/plain/src/store/todos.spec.md']);
    });

    it('drops a capability whose spec path is absolute', () => {
        const root = ws(
            { 'capabilities/x/spec.md': '# x' },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: evil\n      spec: /etc/passwd\n'
        );
        expect(readLivingSpecs(root).capabilities).toEqual([]);
    });

    it('drops a capability whose spec path escapes the workspace root', () => {
        const root = ws(
            { 'capabilities/x/spec.md': '# x' },
            'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: evil\n      spec: ../escape.md\n'
        );
        expect(readLivingSpecs(root).capabilities).toEqual([]);
    });

    describe('glob semantics — a single * never crosses /', () => {
        it('matches direct children only for src/*.ts', () => {
            expect(globMatches('src/*.ts', 'src/a.ts')).toBe(true);
            expect(globMatches('src/*.ts', 'src/deep/a.ts')).toBe(false);
        });

        it('** matches any depth and the bare directory for a trailing /**', () => {
            expect(globMatches('src/checkout/**', 'src/checkout/cart/x.ts')).toBe(true);
            expect(globMatches('src/checkout/**', 'src/checkout')).toBe(true);
            expect(globMatches('src/checkout/**', 'src/other/x.ts')).toBe(false);
        });
    });
});

describe('readCapabilityHealth', () => {
    const created: string[] = [];
    afterAll(() => {
        for (const root of created) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    const YML = 'livingSpecs:\n  enabled: true\n  capabilities:\n    - name: checkout\n      match: ["src/checkout/**"]\n';

    function capFor(root: string) {
        const listing = readLivingSpecs(root);
        return listing.capabilities[0];
    }

    it('counts covered/total requirements from the coverage tier (CLI rule)', async () => {
        const root = makeWorkspace(
            {
                'capabilities/checkout/spec.md': '# Checkout\n\nFR-001 add\nFR-002 remove\nFR-003 persist\n',
                'capabilities/checkout/spec.coverage.md': '- FR-001 → src/cart.test.ts::adds\n- FR-003 covered by tests/persist.test.ts\n- FR-002 planned, no test yet\n',
            },
            YML
        );
        created.push(root);
        const health = await readCapabilityHealth(root, capFor(root), { git: async () => '' });
        expect(health.coverage).toEqual({ covered: 2, total: 3 });
    });

    it('omits coverage when there is no coverage tier', async () => {
        const root = makeWorkspace({ 'capabilities/checkout/spec.md': '# Checkout\nFR-001\n' }, YML);
        created.push(root);
        const health = await readCapabilityHealth(root, capFor(root), { git: async () => '' });
        expect(health.coverage).toBeUndefined();
    });

    it('reports drift when a matched file changed since the spec commit', async () => {
        const root = makeWorkspace(
            { 'capabilities/checkout/spec.md': '# Checkout\nFR-001\n' },
            YML
        );
        created.push(root);
        const git = async (args: string[]) =>
            args[0] === 'log' ? 'abc123\n' : 'src/checkout/cart.ts\nREADME.md\n';
        const health = await readCapabilityHealth(root, capFor(root), { git });
        expect(health.drifted).toBe(true);
    });

    it('does not report drift for excluded/exempt/own-spec files', async () => {
        const root = makeWorkspace(
            { 'capabilities/checkout/spec.md': '# Checkout\nFR-001\n' },
            YML
        );
        created.push(root);
        const git = async (args: string[]) =>
            args[0] === 'log'
                ? 'abc123\n'
                : 'src/checkout/cart.test.ts\ncapabilities/checkout/spec.md\nREADME.md\n';
        const health = await readCapabilityHealth(root, capFor(root), { git });
        expect(health.drifted).toBe(false);
    });

    it('omits drift entirely when git fails or the spec was never committed', async () => {
        const root = makeWorkspace({ 'capabilities/checkout/spec.md': '# Checkout\nFR-001\n' }, YML);
        created.push(root);
        const failing = await readCapabilityHealth(root, capFor(root), {
            git: async () => { throw new Error('not a repo'); },
        });
        expect(failing.drifted).toBeUndefined();
        const uncommitted = await readCapabilityHealth(root, capFor(root), { git: async () => '' });
        expect(uncommitted.drifted).toBeUndefined();
    });

    it('never rejects — total failure yields an empty health object', async () => {
        const root = makeWorkspace({}, YML); // spec file itself missing
        created.push(root);
        const cap = { ...capFor(root) };
        await expect(readCapabilityHealth(root, cap, { git: async () => { throw new Error('boom'); } }))
            .resolves.toEqual({});
    });
});
