import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { countLivingFacts, buildLivingHeaderMeta } from '../livingHeaderMeta';
import * as model from '../../specs/livingSpecsModel';

describe('countLivingFacts', () => {
    it('counts distinct requirement identifiers', () => {
        const content = [
            '# Todos',
            '- **FR-001** Add a todo',
            '- **FR-002** Remove a todo',
            '- **NFR-001** Renders under 100ms',
            'FR-001 is referenced again here.',
        ].join('\n');

        expect(countLivingFacts(content).requirements).toBe(3);
    });

    it('counts acceptance scenarios', () => {
        const content = [
            '### Acceptance Scenarios',
            '1. **Given** a list **When** I add **Then** it appears',
            '2. **Given** a list **When** I remove **Then** it goes',
        ].join('\n');

        expect(countLivingFacts(content).scenarios).toBe(2);
    });

    it('leaves a count absent rather than zero when nothing is found', () => {
        const facts = countLivingFacts('# Todos\n\nJust prose.\n');

        expect(facts.requirements).toBeUndefined();
        expect(facts.scenarios).toBeUndefined();
    });

    it('leaves both absent for an empty document', () => {
        expect(countLivingFacts('')).toEqual({});
    });

    it('ignores identifiers inside a fenced code block', () => {
        const content = '```\nFR-001 FR-002\n```\n\n- **FR-003** The only real one\n';

        expect(countLivingFacts(content).requirements).toBe(1);
    });
});

describe('buildLivingHeaderMeta', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'living-meta-'));
        fs.mkdirSync(path.join(root, 'capabilities', 'todos'), { recursive: true });
        fs.mkdirSync(path.join(root, '.specify'), { recursive: true });
        fs.writeFileSync(
            path.join(root, '.specify', 'companion.yml'),
            [
                'livingSpecs:',
                '  enabled: true',
                '  capabilities:',
                '    - name: todos',
                '      match:',
                '        - src/store/**',
                '        - src/ui/todos/**',
            ].join('\n')
        );
        fs.writeFileSync(
            path.join(root, 'capabilities', 'todos', 'spec.md'),
            '# Todos — Living Spec\n\n- **FR-001** Add a todo\n'
        );
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    const specFile = () => path.join(root, 'capabilities', 'todos', 'spec.md');

    it('resolves the capability and carries its claimed patterns and location', () => {
        const meta = buildLivingHeaderMeta(root, specFile(), '- **FR-001** Add a todo\n');

        expect(meta).not.toBeNull();
        expect(meta?.capabilityName).toBe('todos');
        expect(meta?.specPath).toBe('capabilities/todos/spec.md');
        expect(meta?.location).toBe('centralized');
        expect(meta?.match).toEqual(['src/store/**', 'src/ui/todos/**']);
        expect(meta?.requirements).toBe(1);
    });

    it('returns nothing when the file belongs to no configured capability', () => {
        const stray = path.join(root, 'capabilities', 'other.spec.md');
        fs.writeFileSync(stray, '# Other\n');

        expect(buildLivingHeaderMeta(root, stray, '# Other\n')).toBeNull();
    });

    it('returns nothing when living specs are switched off', () => {
        fs.writeFileSync(
            path.join(root, '.specify', 'companion.yml'),
            'livingSpecs:\n  enabled: false\n'
        );

        expect(buildLivingHeaderMeta(root, specFile(), '')).toBeNull();
    });

    it('carries no coverage or drift — those arrive from the shared health call', () => {
        const meta = buildLivingHeaderMeta(root, specFile(), '- **FR-001** Add a todo\n');

        expect(meta?.coverage).toBeUndefined();
        expect(meta?.drifted).toBeUndefined();
    });

    it('matches a spec that lives next to the code it describes', () => {
        fs.mkdirSync(path.join(root, 'src', 'store'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'store', 'todos.spec.md'), '# Todos\n');
        fs.writeFileSync(
            path.join(root, '.specify', 'companion.yml'),
            [
                'livingSpecs:',
                '  enabled: true',
                '  capabilities:',
                '    - name: todos',
                '      spec: src/store/todos.spec.md',
                '      match:',
                '        - src/store/**',
            ].join('\n')
        );

        const meta = buildLivingHeaderMeta(
            root,
            path.join(root, 'src', 'store', 'todos.spec.md'),
            '# Todos\n'
        );

        expect(meta?.location).toBe('colocated');
        expect(meta?.specPath).toBe('src/store/todos.spec.md');
    });
});

describe('coverage and drift reuse', () => {
    it('reads the sidebar health through readCapabilityHealth, not a second derivation', async () => {
        const { resolveLivingHealth } = await import('../livingHeaderMeta');
        const spy = jest
            .spyOn(model, 'readCapabilityHealth')
            .mockResolvedValue({ coverage: { covered: 8, total: 12 }, drifted: true });

        const health = await resolveLivingHealth('/root', {
            capabilityName: 'todos',
            specPath: 'capabilities/todos/spec.md',
            location: 'centralized',
            match: ['src/store/**'],
        });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(health).toEqual({ coverage: { covered: 8, total: 12 }, drifted: true });

        spy.mockRestore();
    });

    it('carries per-requirement coverage from a real coverage file to the health it resolves', async () => {
        const { resolveLivingHealth } = await import('../livingHeaderMeta');
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lhm-cov-'));
        fs.mkdirSync(path.join(root, 'capabilities/todos'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src'), { recursive: true });
        fs.writeFileSync(path.join(root, 'capabilities/todos/spec.md'), '# Todos\n\n### Adds a todo\n\nBody.\n\n### Lists todos\n\nBody.\n');
        fs.writeFileSync(path.join(root, 'capabilities/todos/spec.coverage.md'), '| Adds a todo | src/add.test.ts |\n| Lists todos | — |\n');
        fs.writeFileSync(path.join(root, 'src/add.test.ts'), '');

        const health = await resolveLivingHealth(root, {
            capabilityName: 'todos',
            specPath: 'capabilities/todos/spec.md',
            location: 'centralized',
            match: [],
        });

        expect(health.requirementCoverage).toEqual({ 'Adds a todo': '1 test' });
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('leaves the fields absent when the shared computation determines nothing', async () => {
        const { resolveLivingHealth } = await import('../livingHeaderMeta');
        const spy = jest.spyOn(model, 'readCapabilityHealth').mockResolvedValue({});

        const health = await resolveLivingHealth('/root', {
            capabilityName: 'todos',
            specPath: 'capabilities/todos/spec.md',
            location: 'centralized',
            match: [],
        });

        expect(health.coverage).toBeUndefined();
        expect(health.drifted).toBeUndefined();

        spy.mockRestore();
    });

    it('names the requirements whose touched files drifted, never an unmarked one', async () => {
        const { resolveLivingHealth } = await import('../livingHeaderMeta');
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lhm-drift-'));
        fs.mkdirSync(path.join(root, 'capabilities/todos'), { recursive: true });
        fs.writeFileSync(path.join(root, 'capabilities/todos/todos.spec.md'), [
            '# Todos', '', '## Requirements', '',
            '### Adds a todo', '<!-- touches: src/store/add.ts -->', 'Body.', '',
            '### Lists todos', '<!-- touches: src/store/list.ts -->', 'Body.', '',
            '### Unmarked', 'Body.',
        ].join('\n'));
        const spy = jest
            .spyOn(model, 'readCapabilityHealth')
            .mockResolvedValue({ drifted: true, driftedFiles: ['src/store/add.ts'] });

        const health = await resolveLivingHealth(root, {
            capabilityName: 'todos',
            specPath: 'capabilities/todos/todos.spec.md',
            location: 'centralized',
            match: ['src/store/**'],
        });

        expect(health).toEqual({ drifted: true, driftedRequirements: ['Adds a todo'] });
        spy.mockRestore();
    });

    it('never rejects when the shared computation throws', async () => {
        const { resolveLivingHealth } = await import('../livingHeaderMeta');
        const spy = jest
            .spyOn(model, 'readCapabilityHealth')
            .mockRejectedValue(new Error('no git here'));

        await expect(
            resolveLivingHealth('/root', {
                capabilityName: 'todos',
                specPath: 'capabilities/todos/spec.md',
                location: 'centralized',
                match: [],
            })
        ).resolves.toEqual({});

        spy.mockRestore();
    });
});

describe('new requirements', () => {
    const meta = { capabilityName: 'todos', specPath: 'capabilities/todos/todos.spec.md', location: 'centralized' as const, match: [] };
    let root: string;
    let health: jest.SpyInstance;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'lhm-new-'));
        fs.mkdirSync(path.join(root, 'capabilities/todos'), { recursive: true });
        fs.writeFileSync(path.join(root, meta.specPath), [
            '# Todos', '', '## Requirements', '',
            '### Adds a todo', 'Body changed on this branch.', '',
            '### Archives a todo', 'Added here.',
        ].join('\n'));
        health = jest.spyOn(model, 'readCapabilityHealth').mockResolvedValue({});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(root, { recursive: true, force: true });
    });

    it("names the headings main's copy lacks, and not one whose body alone changed", async () => {
        const { resolveLivingHealth } = await import('../livingHeaderMeta');
        const main = jest.spyOn(model, 'readMainCopy').mockResolvedValue('## Requirements\n\n### Adds a todo\nOriginal body.\n');
        const before = fs.readFileSync(path.join(root, meta.specPath), 'utf-8');

        const got = await resolveLivingHealth(root, meta);

        expect(got.newRequirements).toEqual(['Archives a todo']);
        expect(main).toHaveBeenCalledWith(root, meta.specPath);
        expect(fs.readFileSync(path.join(root, meta.specPath), 'utf-8')).toBe(before);
    });

    it("leaves it absent when main's copy cannot be read", async () => {
        const { resolveLivingHealth } = await import('../livingHeaderMeta');
        jest.spyOn(model, 'readMainCopy').mockResolvedValue(undefined);

        expect(await resolveLivingHealth(root, meta)).not.toHaveProperty('newRequirements');
    });

    it('still reports new requirements when the drift computation fails', async () => {
        const { resolveLivingHealth } = await import('../livingHeaderMeta');
        health.mockRejectedValue(new Error('no git here'));
        jest.spyOn(model, 'readMainCopy').mockResolvedValue('### Adds a todo\n');

        expect(await resolveLivingHealth(root, meta)).toEqual({ newRequirements: ['Archives a todo'] });
    });
});
