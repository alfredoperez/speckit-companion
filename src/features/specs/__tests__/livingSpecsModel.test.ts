import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readLivingSpecs, __test } from '../livingSpecsModel';

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
