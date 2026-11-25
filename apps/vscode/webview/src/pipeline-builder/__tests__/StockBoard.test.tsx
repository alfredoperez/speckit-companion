/**
 * @jest-environment jsdom
 *
 * What a project without the Companion extension sees: the same lanes and
 * cards as a Companion board, its hooks inside the cards, the gates on the
 * joins, and every stock-owned thing still reachable. Build is not.
 */
import { StockBoard, lanesOf, laneCounts } from '../StockBoard';
import type { StockHookRow, StockWorkflowView } from '../../../../src/protocol/pipeline';
import { flush, mount } from './support';

function hook(over: Partial<StockHookRow> = {}): StockHookRow {
    return {
        when: 'before', step: 'specify', index: 0, extension: 'git',
        command: 'speckit.git.feature', description: 'Create feature branch',
        enabled: true, optional: false, conditional: false, own: false, ...over,
    };
}

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
                id: 'specify', command: 'speckit-specify', kind: 'command', hookStep: 'specify',
                label: 'Write the spec', writes: ['spec.md'],
                hooks: [
                    hook(),
                    hook({
                        when: 'after', index: 0, extension: 'house', command: 'house-note',
                        description: 'Write a house note', own: true, optional: true,
                        prompt: 'Write the note now?',
                    }),
                ],
            },
            {
                id: 'review', command: '', kind: 'gate',
                label: 'Review the spec', writes: [], hooks: [],
            },
            {
                id: 'plan', command: 'speckit-plan', kind: 'command', hookStep: 'plan',
                label: 'Plan the work', writes: ['plan.md'], hooks: [],
            },
        ],
        templates: [{
            file: 'spec-template.md', path: '.specify/templates/spec-template.md',
            label: 'Spec', note: 'The shape of spec.md, filled in by',
            command: 'speckit-specify', inForce: 'core',
            layers: [{ kind: 'core', source: '', path: '.specify/templates/spec-template.md', strategy: 'replace' }],
        }],
        constitution: { command: 'speckit-constitution', written: true },
        registry: { path: '.specify/extensions.yml' },
        buildBlocked: 'Nothing here is built.',
        ...over,
    };
}

const noop = () => undefined;
const ACTIONS = {
    onSetHook: noop, onOpenFile: noop, onSelectWorkflow: noop, onRunCommand: noop,
    onAddHook: noop, onUpdateHook: noop, onRemoveHook: noop, onInstallCompanion: noop,
};

function button(host: ParentNode, text: string): HTMLButtonElement {
    return Array.from(host.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === text) as HTMLButtonElement;
}

describe('the board on a stock Spec Kit project', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('draws one lane per command, with its card and a count line (FR-001, FR-002)', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const lanes = Array.from(host.querySelectorAll('.pb-sl'));
        expect(lanes.map(l => l.querySelector('.pb-sl-name')!.textContent)).toEqual(['specify', 'plan']);
        expect(lanes[0].querySelector('.pb-sl-counts')!.textContent).toBe('1 command · 2 hooks');
        expect(lanes[0].querySelector('.pb-sc-name')!.textContent).toBe('Write the spec');
        expect(lanes[0].querySelector('.pb-sc-meta')!.textContent).toBe('/speckit-specify · spec.md');
    });

    it('draws a review gate as a chip on the join, not as a lane (FR-003)', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const gate = host.querySelector('.pb-sj .pb-sj-gate')!;
        expect(gate.textContent).toContain('Review the spec');
        expect(gate.textContent).toContain('waits for you');
        expect(host.querySelectorAll('.pb-sl')).toHaveLength(2);
    });

    it('puts each lane\'s before hooks above its command and after hooks below it', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const card = host.querySelector('.pb-sc')!;
        const parts = Array.from(card.children).map(el => el.className);
        expect(parts).toEqual(['pb-sh-slot pb-sh-slot--before', 'pb-sc-command', 'pb-sh-slot pb-sh-slot--after']);
    });

    it('says under each card what Companion adds there, and invents no counts (FR-004)', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        const blocks = host.querySelectorAll('.pb-sl-companion');
        expect(blocks).toHaveLength(2);
        expect(blocks[0].textContent).toContain('With Companion');
        expect(blocks[0].textContent).not.toMatch(/\d/);
    });

    it('offers one Add Companion button that runs the install (FR-005)', () => {
        let installs = 0;
        const host = mount(
            <StockBoard view={view()} status={null} {...ACTIONS}
                onInstallCompanion={() => { installs += 1; }} />);

        expect(host.querySelectorAll('.pb-sb-banner')).toHaveLength(1);
        expect(host.querySelector('.pb-sb-banner')!.textContent).toContain('This project runs stock Spec Kit.');
        button(host, 'Add Companion').click();
        expect(installs).toBe(1);
    });

    it('says changes apply at once and offers no Build (FR-006)', () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        expect(host.querySelector('.builder-header')!.textContent).toContain('Changes apply at once');
        expect(button(host, 'Build')).toBeUndefined();
    });

    it('switches an extension\'s hook by its address, and gives your own no switch on the row (FR-007, FR-008)', async () => {
        const flips: unknown[] = [];
        const host = mount(
            <StockBoard view={view()} status={null} {...ACTIONS} onSetHook={flip => flips.push(flip)} />);

        const rows = host.querySelectorAll('.pb-sh-row');
        expect(rows[0].querySelector('.pb-sh-meta')!.textContent).toBe('from git');
        expect(rows[1].classList.contains('pb-sh-row--yours')).toBe(true);
        expect(rows[1].querySelector('[role="switch"]')).toBeNull();

        (rows[0].querySelector('[role="switch"]') as HTMLButtonElement).click();
        await flush();
        expect(flips).toEqual([{ step: 'specify', when: 'before', index: 0, enabled: false }]);
    });

    it('opens the add modal for that step and side from + after, and sends what was typed (FR-009, FR-010)', async () => {
        const added: unknown[] = [];
        const host = mount(
            <StockBoard view={view()} status={null} {...ACTIONS} onAddHook={add => added.push(add)} />);

        const lane = host.querySelectorAll('.pb-sl')[1];
        (lane.querySelector('.pb-edge-add--after') as HTMLButtonElement).click();
        await flush();

        const modal = document.querySelector('.pb-modal.pb-sh')!;
        expect(modal.querySelector('.pb-modal-title')!.textContent).toBe('Add after Plan the work');
        const [name, description] = Array.from(modal.querySelectorAll<HTMLInputElement>('input[type="text"]'));
        name.value = 'house-note';
        name.dispatchEvent(new Event('input', { bubbles: true }));
        description.value = 'Write a house note';
        description.dispatchEvent(new Event('input', { bubbles: true }));
        await flush();
        button(modal, 'Add').click();
        await flush();

        expect(added).toEqual([{
            step: 'plan', when: 'after',
            hook: { command: 'house-note', description: 'Write a house note', optional: false },
        }]);
        expect(document.querySelector('.pb-modal.pb-sh')).toBeNull();
    });

    it('opens your own hook with Edit and Remove, and sends each by its address (FR-011)', async () => {
        const updated: unknown[] = [];
        const removed: unknown[] = [];
        const host = mount(
            <StockBoard view={view()} status={null} {...ACTIONS}
                onUpdateHook={u => updated.push(u)} onRemoveHook={r => removed.push(r)} />);

        (host.querySelectorAll('.pb-sh-open')[1] as HTMLButtonElement).click();
        await flush();
        const pop = document.querySelector('.pb-shp')!;
        expect(pop.textContent).toContain('Yours');
        expect(pop.textContent).toContain('"Write the note now?"');
        button(pop, 'Edit').click();
        await flush();

        const modal = document.querySelector('.pb-modal.pb-sh')!;
        expect((modal.querySelector('input') as HTMLInputElement).value).toBe('house-note');
        button(modal, 'Save').click();
        await flush();
        expect(updated).toEqual([{
            step: 'specify', when: 'after', index: 0,
            hook: { command: 'house-note', description: 'Write a house note', optional: true, prompt: 'Write the note now?' },
        }]);

        (host.querySelectorAll('.pb-sh-open')[1] as HTMLButtonElement).click();
        await flush();
        button(document.querySelector('.pb-shp')!, 'Remove').click();
        await flush();
        expect(removed).toEqual([{ step: 'specify', when: 'after', index: 0 }]);
    });

    it('gives an extension\'s hook neither Edit nor Remove, and names who owns it', async () => {
        const host = mount(<StockBoard view={view()} status={null} {...ACTIONS} />);

        (host.querySelectorAll('.pb-sh-open')[0] as HTMLButtonElement).click();
        await flush();
        const pop = document.querySelector('.pb-shp')!;
        expect(pop.textContent).toContain('from git');
        expect(button(pop, 'Edit')).toBeUndefined();
        expect(button(pop, 'Remove')).toBeUndefined();
        expect(button(pop, 'Open extensions.yml')).toBeDefined();
    });

    it('switches the drawn workflow from Workflows and presets (FR-013)', async () => {
        const picked: string[] = [];
        const host = mount(
            <StockBoard
                view={view({
                    workflows: [
                        { id: 'speckit', name: 'Full SDD Cycle', description: '', path: '.specify/workflows/speckit/workflow.yml', drawn: true },
                        { id: 'quick-fix', name: 'Quick fix', description: '', path: '.specify/workflows/quick-fix/workflow.yml', drawn: false },
                    ],
                })}
                status={null} {...ACTIONS} onSelectWorkflow={id => picked.push(id)} />);

        expect(host.querySelector('.builder-header')!.textContent).not.toContain('Full SDD Cycle');
        Array.from(host.querySelectorAll<HTMLButtonElement>('.builder-header button'))
            .find(el => el.textContent?.trim() === 'Workflows and presets')!.click();
        await flush();
        const draw = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
            .find(el => el.textContent === 'Draw' && el.closest('li')?.textContent?.includes('Quick fix'))!;
        draw.click();
        expect(picked).toEqual(['quick-fix']);
    });

    it('keeps every earlier stock action reachable (FR-015)', async () => {
        const opened: string[] = [];
        const ran: string[] = [];
        const picked: string[] = [];
        const host = mount(
            <StockBoard
                view={view({
                    workflows: [
                        { id: 'speckit', name: 'Full SDD Cycle', description: '', path: '.specify/workflows/speckit/workflow.yml', drawn: true },
                        { id: 'quick-fix', name: 'Quick fix', description: '', path: '.specify/workflows/quick-fix/workflow.yml', drawn: false },
                    ],
                })}
                status={null} {...ACTIONS} onOpenFile={p => opened.push(p)}
                onRunCommand={c => ran.push(c)} onSelectWorkflow={id => picked.push(id)} />);

        button(host, 'Revise').click();
        expect(ran).toEqual(['constitution']);

        button(host, 'Workflows and presets').click();
        await flush();
        const setup = document.querySelector('.pb-ss')!;
        (setup.querySelector('[aria-label="Draw Quick fix on the board"]') as HTMLButtonElement).click();
        (setup.querySelector('[aria-label="Open .specify/workflows/quick-fix/workflow.yml"]') as HTMLButtonElement).click();
        button(setup, 'Open extensions.yml').click();
        expect(picked).toEqual(['quick-fix']);
        expect(opened).toEqual(['.specify/workflows/quick-fix/workflow.yml', '.specify/extensions.yml']);
        expect(setup.textContent).toContain('No Spec Kit presets installed here.');
    });

    it('says when the lanes are the installed commands because there is no workflow file', () => {
        const host = mount(
            <StockBoard view={view({ source: 'commands', workflow: null, workflows: [] })}
                status={null} {...ACTIONS} />);

        expect(host.querySelector('.pb-sb-banner')!.textContent).toContain('no workflow file');
    });
});

describe('the lanes a stock run makes', () => {
    it('hangs gates on the join before the next command, and keeps trailing ones', () => {
        const steps = view().steps;
        const { lanes, tail } = lanesOf([...steps, { ...steps[1], id: 'last' }]);

        expect(lanes.map(l => [l.step.id, l.number, l.gates.map(g => g.id)]))
            .toEqual([['specify', 1, []], ['plan', 2, ['review']]]);
        expect(tail.map(g => g.id)).toEqual(['last']);
    });

    it('counts the hooks that are off', () => {
        const step = { ...view().steps[0], hooks: [hook(), hook({ index: 1, enabled: false })] };
        expect(laneCounts(step)).toBe('1 command · 2 hooks, 1 off');
    });
});
