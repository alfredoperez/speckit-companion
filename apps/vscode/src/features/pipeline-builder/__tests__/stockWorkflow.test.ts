import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { projectKind } from '../projectKind';
import { readStockWorkflow, stockWorkflowFile } from '../stockWorkflow';

function project(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'stock-workflow-'));
}

function write(root: string, rel: string, body: string): void {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
}

const WORKFLOW = [
    'schema_version: "1.0"',
    'workflow:',
    '  id: "speckit"',
    '  name: "Full SDD Cycle"',
    '  description: "Runs specify → plan with a review gate"',
    'steps:',
    '  - id: specify',
    '    command: speckit.specify',
    '  - id: review-spec',
    '    type: gate',
    '    message: "Review the generated spec before planning."',
    '  - id: plan',
    '    command: speckit.plan',
    '',
].join('\n');

const REGISTRY = [
    'installed:',
    '- git',
    'hooks:',
    '  before_specify:',
    '  - extension: git',
    '    command: speckit.git.feature',
    '    enabled: true',
    '    optional: false',
    '    description: Create feature branch before specification',
    '    condition: null',
    '  after_specify:',
    '  - extension: git',
    '    command: speckit.git.commit',
    '    enabled: false',
    '    optional: true',
    '    description: Auto-commit after specification',
    '    condition: "spec exists"',
    '',
].join('\n');

describe('the kind of project the builder opened on', () => {
    it('is companion when the spec-kit extension is installed in it', () => {
        const root = project();
        fs.mkdirSync(path.join(root, '.specify', 'extensions', 'companion'), { recursive: true });
        expect(projectKind(root)).toBe('companion');
    });

    it('is stock when there is a .specify and no companion extension', () => {
        const root = project();
        fs.mkdirSync(path.join(root, '.specify'), { recursive: true });
        expect(projectKind(root)).toBe('stock');
    });

    it('is neither when the folder has no Spec Kit', () => {
        expect(projectKind(project())).toBe('none');
    });
});

describe('the stock workflow read from a project', () => {
    it('reads the steps from the installed workflow, in order', () => {
        const root = project();
        write(root, '.specify/workflows/speckit/workflow.yml', WORKFLOW);

        const view = readStockWorkflow(root);

        expect(view.source).toBe('workflow');
        expect(view.workflow?.name).toBe('Full SDD Cycle');
        expect(view.steps.map(step => step.id)).toEqual(['specify', 'review-spec', 'plan']);
        expect(stockWorkflowFile(root))
            .toBe(path.join(root, '.specify', 'workflows', 'speckit', 'workflow.yml'));
    });

    it('says what each step writes, and that a gate writes nothing', () => {
        const root = project();
        write(root, '.specify/workflows/speckit/workflow.yml', WORKFLOW);

        const [specify, gate, plan] = readStockWorkflow(root).steps;

        expect(specify.writes).toEqual(['spec.md']);
        expect(gate.kind).toBe('gate');
        expect(gate.label).toBe('Review the generated spec before planning.');
        expect(gate.writes).toEqual([]);
        expect(plan.writes).toContain('plan.md');
    });

    it('attaches the registry hooks to their step, keeping a disabled one', () => {
        const root = project();
        write(root, '.specify/workflows/speckit/workflow.yml', WORKFLOW);
        write(root, '.specify/extensions.yml', REGISTRY);

        const specify = readStockWorkflow(root).steps[0];

        expect(specify.hooks).toHaveLength(2);
        expect(specify.hooks[0]).toMatchObject({
            when: 'before', step: 'specify', index: 0, enabled: true,
            description: 'Create feature branch before specification',
        });
        expect(specify.hooks[1]).toMatchObject({
            when: 'after', enabled: false, optional: true, conditional: true,
        });
    });

    it('falls back to the installed commands when there is no workflow file', () => {
        const root = project();
        fs.mkdirSync(path.join(root, '.specify'), { recursive: true });
        write(root, '.github/prompts/speckit.plan.prompt.md', 'plan');
        write(root, '.github/prompts/speckit.specify.prompt.md', 'specify');
        write(root, '.claude/skills/speckit-tasks/SKILL.md', 'tasks');
        write(root, '.claude/skills/speckit-companion-auto/SKILL.md', 'not stock');

        const view = readStockWorkflow(root);

        expect(view.source).toBe('commands');
        expect(view.workflow).toBeNull();
        expect(view.steps.map(step => step.id)).toEqual(['specify', 'plan', 'tasks']);
    });

    it('names the presets applied to the project', () => {
        const root = project();
        fs.mkdirSync(path.join(root, '.specify'), { recursive: true });
        write(root, '.specify/presets/companion-standard/preset.yml', [
            'preset:',
            '  id: "companion-standard"',
            '  name: "Companion Standard"',
            '  description: "Stock spec-kit pipeline, unchanged"',
            '',
        ].join('\n'));

        expect(readStockWorkflow(root).presets).toEqual([{
            id: 'companion-standard',
            name: 'Companion Standard',
            description: 'Stock spec-kit pipeline, unchanged',
        }]);
    });

    it('reports no hooks rather than failing on a registry it cannot read', () => {
        const root = project();
        write(root, '.specify/workflows/speckit/workflow.yml', WORKFLOW);
        write(root, '.specify/extensions.yml', 'hooks: [');

        const view = readStockWorkflow(root);

        expect(view.registry).toBe(false);
        expect(view.steps.every(step => step.hooks.length === 0)).toBe(true);
    });
});
