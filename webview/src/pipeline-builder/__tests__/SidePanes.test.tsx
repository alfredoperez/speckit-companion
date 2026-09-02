/**
 * @jest-environment jsdom
 */
import { Inspector } from '../Inspector';
import { NewStepForm, NewWorkflowForm } from '../AttachForm';
import type { PipelineNode } from '../../../../src/protocol/pipeline';
import { flush, mount, node } from './support';

afterEach(() => { document.body.innerHTML = ''; });

describe('the inspector reads a node here', () => {
    const noop = () => undefined;
    const actions = {
        onClose: noop, onOpenFile: noop, onSave: noop, onRestore: noop, onAttach: noop,
        onUseVariant: noop, onRemove: noop, onMove: noop,
        editable: 'the stored text',
    };

    it('renders the instructions instead of the raw file', () => {
        const host = mount(
            <Inspector node={node({ name: 'Draft the spec' })} step="specify"
                body={'## Write it\n\n- Load `spec-template.md`\n- Keep every section'}
                parts={[]} {...actions} />,
        );
        expect(host.querySelector('.pb-doc-heading')?.textContent).toBe('Write it');
        expect(host.querySelectorAll('.pb-doc-list li')).toHaveLength(2);
        expect(host.querySelector('.pb-doc-inline')?.textContent).toBe('spec-template.md');
    });

    it('names the shared blocks rather than showing the fences', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="" parts={['timing', 'self-advance']}
                {...actions} />,
        );
        expect(host.querySelector('.pb-doc-parts')?.textContent).toContain('timing, self-advance');
        expect(host.textContent).toContain('no instructions of its own');
    });

    it('says why a node is held in place', () => {
        const host = mount(
            <Inspector node={node({ pinned: 'quality-checklist has to run after it' })}
                step="specify" body="x" parts={[]} {...actions} />,
        );
        expect(host.textContent).toContain('quality-checklist has to run after it');
    });

    // Editing a node is what makes it yours, so there is no separate step to
    // press first. Only a node already yours offers the way back.
    it('offers to edit either node, and to hand a replaced one back', () => {
        const shipped = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        expect(shipped.textContent).toContain('Edit');
        expect(shipped.textContent).not.toContain('Make it mine');
        expect(shipped.textContent).not.toContain('Use the shipped node');

        document.body.innerHTML = '';
        const ours = mount(
            <Inspector node={node({ replaced: true })} step="specify" body="x" parts={[]}
                {...actions} />);
        expect(ours.textContent).toContain('Edit');
        expect(ours.textContent).toContain('Use the shipped node');
    });

    it('edits in place, and saves the stored text rather than the rendered text', async () => {
        const saved: string[] = [];
        const host = mount(
            <Inspector node={node()} step="specify"
                body={'Load `spec-template.md`'} parts={['timing']} {...actions}
                editable={'Load `spec-template.md`\n<!-- speckit-companion:part timing -->'}
                onSave={(text: string) => saved.push(text)} />);

        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Edit') as HTMLButtonElement).click();
        await flush();

        const box = host.querySelector('.pb-doc-edit') as HTMLTextAreaElement;
        // The fences come with it: they are where the shared blocks land, and
        // saving the rendered text back would delete every one of them.
        expect(box.value).toContain('speckit-companion:part timing');

        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Save') as HTMLButtonElement).click();
        expect(saved).toHaveLength(1);
        expect(saved[0]).toContain('speckit-companion:part timing');
    });

    it('says that saving a shipped node writes your own copy', async () => {
        const host = mount(
            <Inspector node={node()} step="specify" body="x" parts={[]} {...actions} />);
        (Array.from(host.querySelectorAll('.pb-inspector-action'))
            .find(el => el.textContent === 'Edit') as HTMLButtonElement).click();
        await flush();
        expect(host.textContent).toContain('writes your own copy');
        expect(host.textContent).toContain('shipped one is left alone');
    });

    it('waits visibly rather than showing an empty body', () => {
        const host = mount(
            <Inspector node={node()} step="specify" body={null} parts={[]} {...actions} />);
        expect(host.querySelector('.pb-doc-waiting')?.textContent).toBe('Reading…');
    });
});

describe('giving a node back to the shipped one', () => {
    const noop = () => undefined;

    function inspect(over: Partial<PipelineNode>) {
        const host = mount(
            <Inspector node={node(over)} step="specify" body="Words." editable="Words."
                parts={[]} onClose={noop} onOpenFile={noop} onSave={noop}
                onRestore={noop} onAttach={noop} onUseVariant={noop}
                onRemove={noop} onMove={noop} />,
        );
        return Array.from(host.querySelectorAll('.pb-inspector-action'))
            .map(el => el.textContent);
    }

    it('offers it for a node this project rewrote', () => {
        expect(inspect({ replaced: true, shipped: true })).toContain('Use the shipped node');
    });

    // The bug this exists for: a step handed to one document, or a node someone
    // wrote, is `replaced` and ships nowhere. Giving it "back" deleted the only
    // copy while the configuration still ordered it, and the pipeline read as
    // broken with no way out from inside the panel.
    it('does not offer it for a node that ships nowhere', () => {
        expect(inspect({ id: 'specify-ours', replaced: true, shipped: false }))
            .not.toContain('Use the shipped node');
    });

    it('does not offer it for a node the project never touched', () => {
        expect(inspect({ replaced: false, shipped: true })).not.toContain('Use the shipped node');
    });
});

describe('starting a workflow from something', () => {
    const noop = () => undefined;

    function form(presets = PRESETS, from = '') {
        const made: Array<[string, string]> = [];
        const host = mount(
            <NewWorkflowForm from={from} taken={['shipped']} presets={presets}
                onCancel={noop} onCreate={(name, seed) => made.push([name, seed])} />,
        );
        return { host, made };
    }

    const PRESETS = [
        { name: 'classic', label: 'Classic spec-kit', summary: 'Stock shapes.' },
        { name: 'brownfield', label: 'Brownfield', summary: 'For an existing system.' },
    ];

    const type = (host: HTMLElement, value: string) => {
        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    it('offers every shipped preset by its label', () => {
        const { host } = form();
        const options = Array.from(host.querySelectorAll('optgroup option'));
        expect(options.map(el => el.textContent)).toEqual(['Classic spec-kit', 'Brownfield']);
    });

    // The default is what you are on. A picker that started at a preset would
    // quietly discard the configuration someone is already running.
    it('starts from the workflow in force', async () => {
        const { host, made } = form(PRESETS, 'bugfix');
        type(host, 'mine');
        await flush();
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(made).toEqual([['mine', 'bugfix']]);
    });

    it('sends the preset someone picked, prefixed so it is not read as a workflow', async () => {
        const { host, made } = form();
        type(host, 'mine');
        const select = host.querySelector('select') as HTMLSelectElement;
        select.value = 'preset:brownfield';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(made).toEqual([['mine', 'preset:brownfield']]);
    });

    it('says what a picked preset does before it is committed to', async () => {
        const { host } = form();
        const select = host.querySelector('select') as HTMLSelectElement;
        select.value = 'preset:classic';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
        expect(host.querySelector('.pb-field-note')?.textContent).toBe('Stock shapes.');
    });

    it('shows no preset group when none ship', () => {
        const { host } = form([]);
        expect(host.querySelector('optgroup')).toBeNull();
    });
});

describe('naming a new step', () => {
    const noop = () => undefined;
    const SEQUENCE = ['specify', 'plan', 'tasks', 'implement'];

    function form() {
        const made: Array<Record<string, string>> = [];
        const host = mount(
            <NewStepForm sequence={SEQUENCE} taken={[...SEQUENCE, 'auto']}
                onCancel={noop} onCreate={step => made.push(step)} />,
        );
        return { host, made };
    }

    const type = (host: HTMLElement, value: string) => {
        const input = host.querySelector('.pb-input--mono') as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const submit = (host: HTMLElement) =>
        (host.querySelector('form') as HTMLFormElement)
            .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    it('places it after the last step in the run by default', async () => {
        const { host, made } = form();
        type(host, 'review');
        await flush();
        submit(host);
        expect(made[0].after).toBe('implement');
    });

    it('offers to leave it out of the run', () => {
        const { host } = form();
        const options = Array.from(host.querySelectorAll('select option'));
        expect(options[options.length - 1].textContent).toContain('I launch it myself');
    });

    // The name becomes a command, so a space or a capital produces something
    // nobody can type.
    it('refuses a name that cannot be a command', async () => {
        const { host } = form();
        type(host, 'Review This');
        await flush();
        expect(host.querySelector('.pb-field-problem')?.textContent)
            .toContain('it becomes a command');
        expect((host.querySelector('.pb-action--primary') as HTMLButtonElement).disabled)
            .toBe(true);
    });

    it('refuses a name a step already has', async () => {
        const { host } = form();
        type(host, 'plan');
        await flush();
        expect(host.querySelector('.pb-field-problem')?.textContent)
            .toContain('already a step called plan');
    });

    it('says what it will write and what the assistant will be able to run', async () => {
        const { host } = form();
        type(host, 'review');
        await flush();
        const preview = host.querySelector('.pb-form-preview')?.textContent ?? '';
        expect(preview).toContain('.specify/companion/nodes/review/');
        expect(preview).toContain('/speckit.companion.review');
    });
});
