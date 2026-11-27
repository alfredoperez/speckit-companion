/**
 * @jest-environment jsdom
 */
import { HookModal, NewStep, StepForm, autoWarning, defaultPhase } from '../HookModal';
import { flush, mount, node, step } from './support';

afterEach(() => { document.body.innerHTML = ''; });

const noop = () => undefined;
const CHOICES = { skills: [], nodes: [], commands: [], fragments: [], presets: [] };
const SEQUENCE = ['specify', 'plan', 'tasks', 'implement'];
const FORM: StepForm = { sequence: SEQUENCE, taken: [...SEQUENCE, 'auto'], autoRuns: SEQUENCE };

const OFFERING = step({
    name: 'implement',
    dropped: ['branch', 'review-gaps'], addOns: ['review-gaps'],
    offers: {
        branch: { name: 'Create the feature branch', summary: 'Creates the feature branch' },
        'review-gaps': { name: 'Review the gaps', summary: 'Attacks the task list for gaps' },
    },
    phases: [
        { name: 'execute', hooks: [], nodes: [node({ id: 'execute', name: 'Execute' })] },
        { name: 'wrap-up', hooks: [], nodes: [node({ id: 'handoff', name: 'Hand off', pinned: 'it hands off' })] },
    ],
});

function modal(over: Partial<Parameters<typeof HookModal>[0]> = {}) {
    const nodes: Array<[string, string, boolean]> = [];
    const steps: NewStep[] = [];
    const host = mount(
        <HookModal step={OFFERING} anchor="execute" choices={CHOICES}
            modes={['hook', 'node', 'step']} stepForm={FORM}
            onCancel={noop} onAttach={noop}
            onAddNode={(phase, id, keep) => nodes.push([phase, id, keep])}
            onNewStep={s => steps.push(s)} {...over} />,
    );
    return { host, nodes, steps };
}

const modeButtons = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('.pb-modal-mode'));

async function choose(host: HTMLElement, label: string) {
    modeButtons(host).find(b => b.textContent === label)!.click();
    await flush();
}

function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

const submit = (host: HTMLElement) =>
    (host.querySelector('form') as HTMLFormElement)
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

describe('the add modal offers Hook, Node and Step from a lane', () => {
    it('shows the choice row as a radio group, Hook first', () => {
        const { host } = modal();
        const row = host.querySelector('.pb-modal-modes')!;
        expect(row.getAttribute('role')).toBe('radiogroup');
        expect(modeButtons(host).map(b => [b.textContent, b.getAttribute('aria-checked')]))
            .toEqual([['Hook', 'true'], ['Node', 'false'], ['Step', 'false']]);
        expect(host.querySelector('.pb-modal-title')?.textContent).toBe('Add to implement');
    });

    it('shows no choice row when a hook is being edited', () => {
        const { host } = modal({
            editing: { when: 'before', type: 'prompt', summary: 'x', anchor: 'execute', index: 0, note: '' },
        });
        expect(host.querySelector('.pb-modal-modes')).toBeNull();
        expect(host.querySelector('.pb-modal-title')?.textContent).toBe('Edit hook');
    });

    it('moves the choice with the arrow keys', async () => {
        const { host } = modal();
        modeButtons(host)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flush();
        expect(modeButtons(host)[1].getAttribute('aria-checked')).toBe('true');
        expect(document.activeElement).toBe(modeButtons(host)[1]);
    });
});

describe('Node lists what the step has on offer', () => {
    it('names each node, says where it came from, and shows its id', async () => {
        const { host } = modal();
        await choose(host, 'Node');
        const rows = Array.from(host.querySelectorAll('.pb-modal-row')).map(el => ({
            name: el.querySelector('.pb-modal-row-name')?.textContent,
            note: el.querySelector('.pb-modal-row-note')?.textContent,
            id: el.querySelector('.pb-modal-row-id')?.textContent,
        }));
        expect(rows).toEqual([
            { name: 'Create the feature branch', note: 'Removed from this run · Creates the feature branch', id: 'branch' },
            { name: 'Review the gaps', note: 'Shipped, optional · Attacks the task list for gaps', id: 'review-gaps' },
        ]);
        expect(host.querySelector('.pb-action--primary')?.textContent).toBe('Add node');
    });

    it('narrows the list as you type', async () => {
        const { host } = modal({ mode: 'node' });
        type(host.querySelector('.pb-modal-search input') as HTMLInputElement, 'gaps');
        await flush();
        expect(Array.from(host.querySelectorAll('.pb-modal-row-id')).map(el => el.textContent))
            .toEqual(['review-gaps']);
    });

    it('adds the chosen node at the end of the phase it shows, which skips a phase ending on a held node', async () => {
        const { host, nodes } = modal({ mode: 'node' });
        expect(host.querySelector('.pb-modal-runs .pb-trigger-text')?.textContent).toBe('execute');
        const search = host.querySelector('.pb-modal-search input') as HTMLInputElement;
        search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flush();
        submit(host);
        expect(nodes).toEqual([['execute', 'review-gaps', false]]);
    });

    it('says why nothing is on offer, and where a node of your own goes', () => {
        const { host } = modal({ mode: 'node', step: step({ name: 'tasks', dropped: [] }) });
        expect(host.querySelector('.pb-modal-empty')?.textContent)
            .toContain('.specify/companion/nodes/tasks/');
        expect((host.querySelector('.pb-action--primary') as HTMLButtonElement).disabled).toBe(true);
    });

    it('closes on Escape while the list has rows, typed or not', async () => {
        let closed = 0;
        const { host } = modal({ mode: 'node', onCancel: () => { closed += 1; } });
        const search = host.querySelector('.pb-modal-search input') as HTMLInputElement;
        expect(search.getAttribute('aria-expanded')).toBe('true');
        search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        type(search, 'gaps');
        await flush();
        search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(closed).toBe(2);
    });
});

describe('Step adds a lane of its own', () => {
    const name = (host: HTMLElement) =>
        host.querySelector('.pb-modal-fields input') as HTMLInputElement;

    it('starts Runs after on the lane it was opened from, and sends the step', async () => {
        const { host, steps } = modal({ mode: 'step', stepForm: { ...FORM, after: 'tasks' } });
        expect(host.querySelector('.pb-modal-select .pb-trigger-text')?.textContent).toBe('3 tasks');
        type(name(host), 'review');
        await flush();
        submit(host);
        expect(steps).toEqual([{ name: 'review', label: '', after: 'tasks', writes: '' }]);
    });

    it('places it after the last step in the run by default, and offers to leave it out', async () => {
        const { host, steps } = modal({ mode: 'step' });
        (host.querySelector('.pb-modal-select') as HTMLButtonElement).click();
        await flush();
        const labels = Array.from(host.querySelectorAll('.pb-menu-option .pb-menu-label'))
            .map(el => el.textContent);
        expect(labels.at(-1)).toContain('I launch it myself');
        type(name(host), 'review');
        await flush();
        submit(host);
        expect(steps[0].after).toBe('implement');
    });

    it('refuses a name that cannot be a command, or one a step already has', async () => {
        const { host, steps } = modal({ mode: 'step' });
        type(name(host), 'Review This');
        await flush();
        expect(host.querySelector('.pb-field-problem')?.textContent).toContain('it becomes a command');
        expect((host.querySelector('.pb-action--primary') as HTMLButtonElement).disabled).toBe(true);
        type(name(host), 'plan');
        await flush();
        expect(host.querySelector('.pb-field-problem')?.textContent).toContain('already a step called plan');
        submit(host);
        expect(steps).toEqual([]);
    });

    it('asks only for a name, where it runs and what it writes, and says how files separate on hover', () => {
        const { host } = modal({ mode: 'step' });
        const labels = Array.from(host.querySelectorAll('.pb-modal-field-label'))
            .map(el => el.textContent);
        expect(labels).toEqual(['Name', 'Runs after', 'Writes']);
        const writes = host.querySelector<HTMLInputElement>('.pb-modal-text--mono')!;
        expect(writes.title).toContain('[review.md, notes.md]');
    });

    it('warns that auto will not run it, naming the steps auto does run', () => {
        const { host } = modal({ mode: 'step', stepForm: { ...FORM, after: 'implement' } });
        const warning = host.querySelector('.pb-modal-warning')!;
        expect(warning.getAttribute('role')).toBe('note');
        expect(warning.textContent).toContain('The hands-off auto command stops before it');
        expect(warning.textContent).toContain('Auto runs specify through implement.');
    });

    it('says nothing about auto when the project has none', () => {
        const { host } = modal({ mode: 'step', stepForm: { ...FORM, autoRuns: null } });
        expect(host.querySelector('.pb-modal-warning')).toBeNull();
    });
});

describe('the defaults the modal chooses', () => {
    it('lands a node in the last phase that does not end on a held node', () => {
        expect(defaultPhase(OFFERING)).toBe('execute');
        expect(defaultPhase(step({ phases: [] }))).toBe('new phase');
    });

    it('says auto skips a step placed mid-run, and stops before one placed at its end', () => {
        expect(autoWarning(SEQUENCE, 'plan').title).toBe('The hands-off auto command will not run it');
        expect(autoWarning(SEQUENCE, 'implement').title).toBe('The hands-off auto command stops before it');
    });
});
