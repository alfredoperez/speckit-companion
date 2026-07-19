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
