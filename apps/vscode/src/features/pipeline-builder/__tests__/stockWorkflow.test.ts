import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StockWorkflowView } from '../../../protocol/pipeline';
import { projectKind } from '../projectKind';
import { formatStockCommands, readStockWorkflow, stockFileToOpen } from '../stockWorkflow';

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
        expect(view.workflows).toEqual([{
            id: 'speckit',
            name: 'Full SDD Cycle',
            description: 'Runs specify → plan with a review gate',
            path: path.join('.specify', 'workflows', 'speckit', 'workflow.yml'),
            drawn: true,
        }]);
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

        expect(view.registry).toBeNull();
        expect(view.steps.every(step => step.hooks.length === 0)).toBe(true);
    });

    it('lists the templates it has, in run order, each with its path', () => {
        const root = project();
        fs.mkdirSync(path.join(root, '.specify'), { recursive: true });
        for (const file of ['spec-template.md', 'plan-template.md', 'house-template.md']) {
            write(root, `.specify/templates/${file}`, '# shape');
        }

        const view = readStockWorkflow(root);

        expect(view.templates.map(template => template.file))
            .toEqual(['spec-template.md', 'plan-template.md', 'house-template.md']);
        expect(view.templates[0]).toMatchObject({
            label: 'Spec',
            path: path.join('.specify', 'templates', 'spec-template.md'),
            command: 'speckit.specify',
        });
        expect(view.templates[0].note).not.toContain('speckit');
        expect(view.templates[2]).toMatchObject({ label: 'house', command: '' });
    });

    it('says whether the constitution has been written, and names its command', () => {
        const root = project();
        fs.mkdirSync(path.join(root, '.specify'), { recursive: true });

        expect(readStockWorkflow(root).constitution)
            .toEqual({ command: 'speckit.constitution', written: false });

        write(root, '.specify/memory/constitution.md', '# Principles');
        expect(readStockWorkflow(root).constitution?.written).toBe(true);
    });

    it('draws the workflow it is asked for, and marks which one that is', () => {
        const root = project();
        write(root, '.specify/workflows/speckit/workflow.yml', WORKFLOW);
        write(root, '.specify/workflows/quick/workflow.yml', [
            'workflow:', '  id: "quick"', '  name: "Quick fix"',
            'steps:', '  - id: implement', '    command: speckit.implement', '',
        ].join('\n'));

        const drawn = readStockWorkflow(root, 'quick');

        expect(drawn.workflow?.id).toBe('quick');
        expect(drawn.steps.map(step => step.id)).toEqual(['implement']);
        expect(drawn.workflows.map(choice => [choice.id, choice.drawn]))
            .toEqual([['quick', true], ['speckit', false]]);
        // Asked for one that is not installed, it draws the first rather than
        // nothing: a board with no steps says the project has none.
        expect(readStockWorkflow(root, 'invented').workflow?.id).toBe('quick');
    });
});

describe('how the board spells a command', () => {
    /** A project with a command in all three places the board names one. */
    function named(): string {
        const root = project();
        write(root, '.specify/workflows/speckit/workflow.yml', WORKFLOW);
        write(root, '.specify/templates/spec-template.md', '# shape');
        write(root, '.specify/templates/plan-template.md', '# shape');
        return root;
    }

    const DOTTED = (command: string) => command;
    const DASHED = (command: string) => command.replace(/\./g, '-');

    /** The view as a reader sees it, with the file locations taken out. */
    function words(view: StockWorkflowView): string {
        return JSON.stringify(view, (key, value) => (key === 'path' ? undefined : value));
    }

    it.each([['dotted', DOTTED], ['dashed', DASHED]] as const)(
        'emits no command the %s formatter did not produce', (_host, format) => {
            const view = formatStockCommands(readStockWorkflow(named()), format);

            // A leading slash is the board's to draw, so a name carrying one is
            // a name baked into prose that no formatter ever saw.
            expect(words(view)).not.toContain('/speckit');
            for (const command of [
                ...view.steps.map(step => step.command),
                ...view.templates.map(template => template.command),
                view.constitution!.command,
            ].filter(Boolean)) {
                expect(command).toBe(format(command.replace(/-/g, '.')));
            }
        });

    it('leaves a dashed host no dotted name anywhere in the view', () => {
        const view = formatStockCommands(readStockWorkflow(named()), DASHED);

        expect(words(view)).not.toContain('speckit.');
        expect(view.constitution!.command).toBe('speckit-constitution');
        expect(view.steps[0].command).toBe('speckit-specify');
        expect(view.templates.find(template => template.file === 'spec-template.md')!.command)
            .toBe('speckit-specify');
    });

    it('leaves a gate and a template with no command alone', () => {
        const root = named();
        write(root, '.specify/templates/agent-file-template.md', '# context');

        const view = formatStockCommands(readStockWorkflow(root), DASHED);

        expect(view.steps.find(step => step.kind === 'gate')!.command).toBe('');
        expect(view.templates.find(t => t.file === 'agent-file-template.md')!.command).toBe('');
    });
});

describe('the files the board will open', () => {
    it('opens a path it drew', () => {
        const root = project();
        write(root, '.specify/templates/spec-template.md', '# shape');
        write(root, '.specify/extensions.yml', REGISTRY);
        write(root, '.specify/workflows/speckit/workflow.yml', WORKFLOW);

        for (const rel of [
            path.join('.specify', 'templates', 'spec-template.md'),
            path.join('.specify', 'extensions.yml'),
            path.join('.specify', 'workflows', 'speckit', 'workflow.yml'),
        ]) {
            expect(stockFileToOpen(root, rel)).toBe(path.join(root, rel));
        }
    });

    it('refuses anything it did not draw', () => {
        const root = project();
        write(root, '.specify/templates/spec-template.md', '# shape');
        write(root, '.specify/companion.yml', 'steps: {}');
        write(root, 'package.json', '{}');

        for (const rel of [
            path.join('.specify', 'companion.yml'),
            'package.json',
            path.join('.specify', 'templates', '..', '..', 'package.json'),
            path.join('..', 'elsewhere', 'secrets.env'),
            '',
        ]) {
            expect(stockFileToOpen(root, rel)).toBeNull();
        }
    });
});
