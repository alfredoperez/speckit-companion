/**
 * @jest-environment jsdom
 *
 * What a project without the Companion extension sees. The board is the only
 * thing telling it what it can change, so what is pinned here is: the steps are
 * its own, each stock-owned thing is reachable, and Build cannot run.
 */
import { StockBoard } from '../StockBoard';
import type { StockWorkflowView } from '../../../../src/protocol/pipeline';
import { flush, mount } from './support';

function view(over: Partial<StockWorkflowView> = {}): StockWorkflowView {
    return {
        source: 'workflow',
        workflow: { id: 'speckit', name: 'Full SDD Cycle', description: 'specify then plan' },
        workflows: [{
            id: 'speckit', name: 'Full SDD Cycle', description: 'specify then plan',
            path: '.specify/workflows/speckit/workflow.yml', drawn: true,
        }],
        steps: [
            {
                id: 'specify', command: 'speckit.specify', kind: 'command',
                label: 'Write the spec', writes: ['spec.md'],
                hooks: [{
                    when: 'before', step: 'specify', index: 0, extension: 'git',
                    command: 'speckit.git.feature', description: 'Create feature branch',
                    enabled: true, optional: false, conditional: false,
                }],
            },
            {
                id: 'review', command: '', kind: 'gate',
                label: 'Review the spec before planning.', writes: [], hooks: [],
            },
        ],
        templates: [{
            file: 'spec-template.md', path: '.specify/templates/spec-template.md',
            label: 'Spec', note: 'The shape of spec.md, filled in by',
            command: 'speckit-specify',
        }],
        constitution: { command: 'speckit-constitution', written: true },
        presets: [],
        registry: { path: '.specify/extensions.yml' },
        buildBlocked: 'Nothing here is built.',
        ...over,
    };
}

const noop = () => undefined;
const ACTIONS = {
    onSetHook: noop, onOpenFile: noop, onSelectWorkflow: noop, onRunCommand: noop,
};

function rowNamed(host: HTMLElement, name: string): HTMLButtonElement {
    return Array.from(host.querySelectorAll('.pb-stock-row'))
        .find(row => row.querySelector('.pb-stock-row-name')?.textContent === name
        ) as HTMLButtonElement;
}

describe('the board on a stock Spec Kit project', () => {
    it('draws the project\'s own steps, with what each writes', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const steps = Array.from(host.querySelectorAll('.pb-stock-step-name'))
            .map(el => el.textContent);
        expect(steps).toEqual(['Write the spec', 'Review the spec before planning.']);
        expect(host.querySelector('.pb-stock-file')!.textContent).toBe('spec.md');
        expect(host.querySelector('.pb-stock-step--gate')).not.toBeNull();
    });

    it('offers no way to build, and says why once', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const build = Array.from(host.querySelectorAll('button'))
            .find(b => b.textContent === 'Build') as HTMLButtonElement;
        expect(build.disabled).toBe(true);
        expect(host.querySelector('#stock-build-reason')!.textContent)
            .toContain('Nothing here is built');
    });

    it('does not list what Companion would add, and keeps one way to it', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        expect(host.textContent).not.toContain('What Companion would add');
        expect(host.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0);
        const foot = host.querySelectorAll('.pb-stock-foot');
        expect(foot).toHaveLength(1);
        expect(foot[0].querySelector('a')!.getAttribute('href'))
            .toContain('/docs/ide/install/');
    });

    it('asks for one hook to be switched off, by its address in the registry', async () => {
        const flips: unknown[] = [];
        const host = mount(
            <StockBoard view={view()} status={null} {...ACTIONS}
                onSetHook={flip => flips.push(flip)} />);

        (host.querySelector('.pb-stock-switch') as HTMLInputElement).click();
        await flush();

        expect(flips).toEqual([
            { step: 'specify', when: 'before', index: 0, enabled: false },
        ]);
    });

    it('opens a template by the path it was given, and says what the step uses it for', () => {
        const opened: string[] = [];
        const host = mount(
            <StockBoard view={view()} status={null} {...ACTIONS}
                onOpenFile={path => opened.push(path)} />);

        const row = rowNamed(host, 'Spec');
        expect(row.querySelector('.pb-stock-row-note')!.textContent)
            .toContain('filled in by /speckit-specify');
        row.click();

        expect(opened).toEqual(['.specify/templates/spec-template.md']);
    });

    it('runs the command that owns the constitution, in this project\'s spelling', () => {
        const ran: string[] = [];
        const host = mount(
            <StockBoard
                view={view({ constitution: { command: 'speckit-constitution', written: false } })}
                status={null} {...ACTIONS} onRunCommand={command => ran.push(command)} />);

        const row = rowNamed(host, 'Set the constitution');
        expect(row.textContent).toContain('/speckit-constitution');
        row.click();

        expect(ran).toEqual(['constitution']);
    });

    it('draws another installed workflow, and opens the one it is drawing', () => {
        const picked: string[] = [];
        const opened: string[] = [];
        const host = mount(
            <StockBoard
                view={view({
                    workflows: [
                        {
                            id: 'speckit', name: 'Full SDD Cycle', description: 'the long way',
                            path: '.specify/workflows/speckit/workflow.yml', drawn: true,
                        },
                        {
                            id: 'quick-fix', name: 'Quick fix', description: 'the short way',
                            path: '.specify/workflows/quick-fix/workflow.yml', drawn: false,
                        },
                    ],
                })}
                status={null} {...ACTIONS}
                onSelectWorkflow={id => picked.push(id)}
                onOpenFile={path => opened.push(path)} />);

        expect(rowNamed(host, 'Full SDD Cycle').getAttribute('aria-pressed')).toBe('true');
        rowNamed(host, 'Quick fix').click();
        expect(picked).toEqual(['quick-fix']);

        const line = rowNamed(host, 'Quick fix').closest('.pb-stock-rowline')!;
        (line.querySelector('.builder-action') as HTMLButtonElement).click();
        expect(opened).toEqual(['.specify/workflows/quick-fix/workflow.yml']);
    });

    it('says the run picks its own workflow, since the registry names none', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        expect(host.textContent).toContain('specify workflow run');
        expect(host.textContent).toContain('nothing here to set');
    });

    it('names the installed commands as the source when there is no workflow file', () => {
        const host = mount(
            <StockBoard view={view({ source: 'commands', workflow: null, workflows: [] })}
                status={null} {...ACTIONS} />);

        expect(host.querySelector('.pb-stock-workflow')!.textContent)
            .toBe('The installed commands');
        expect(host.querySelector('#stock-build-reason')!.textContent)
            .toContain('no workflow file');
    });

    it('lists a preset that is applied to the project', () => {
        const host = mount(
            <StockBoard
                view={view({
                    presets: [{
                        id: 'companion-standard', name: 'Companion Standard',
                        description: 'Stock commands with timing capture',
                    }],
                })}
                status={null} {...ACTIONS} />);

        expect(host.querySelector('.pb-stock-preset-name')!.textContent)
            .toBe('Companion Standard');
    });
});
