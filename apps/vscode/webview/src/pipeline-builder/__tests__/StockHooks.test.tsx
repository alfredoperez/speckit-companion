/**
 * @jest-environment jsdom
 *
 * A hook of your own on a stock step: the modal asks only what the registry
 * holds, says the writer's rule before it is asked, and holds the keyboard;
 * the popover says what a hook is and becomes a sheet when narrow.
 */
import { StockHookModal } from '../StockHookModal';
import { StockHookPopover } from '../StockHookPopover';
import type { StockHookDraft, StockHookRow } from '../../../../src/protocol/pipeline';
import { flush, mount } from './support';

const noop = () => undefined;

function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function button(host: ParentNode, text: string): HTMLButtonElement {
    return Array.from(host.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === text) as HTMLButtonElement;
}

const OWN: StockHookRow = {
    when: 'after', step: 'plan', index: 1, extension: 'house', command: 'house-note',
    description: 'Write a house note', enabled: true, optional: true, conditional: false,
    own: true, prompt: 'Write it now?',
};

describe('the stock add modal', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('puts the keyboard in the name field and keeps Add off until both fields are filled', async () => {
        const host = mount(<StockHookModal step="plan" label="Plan the work" when="before"
            onCancel={noop} onSave={noop} />);
        await flush();

        const [name, description] = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="text"]'));
        expect(document.activeElement).toBe(name);
        expect(button(host, 'Add').disabled).toBe(true);
        type(name, 'house-note');
        type(description, 'Write a house note');
        await flush();
        expect(button(host, 'Add').disabled).toBe(false);
    });

    it('says the name rule before the writer refuses it', async () => {
        const host = mount(<StockHookModal step="plan" label="Plan the work" when="before"
            onCancel={noop} onSave={noop} />);
        type(host.querySelector<HTMLInputElement>('input[type="text"]')!, 'two words');
        await flush();

        expect(host.querySelector('.pb-field-problem')!.textContent).toContain('letters, digits');
        expect(button(host, 'Add').disabled).toBe(true);
    });

    it('asks what an optional hook says only once it is optional, and sends it', async () => {
        const saved: Array<[StockHookDraft, boolean]> = [];
        const host = mount(<div />);
        const { render } = await import('preact');
        const draw = (written = false) => render(<StockHookModal step="plan" label="Plan the work" when="after"
            answer={{ written }}
            onCancel={noop} onSave={(hook, keep) => saved.push([hook, keep])} />, host);
        draw();
        const [name, description] = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="text"]'));
        type(name, 'house-note');
        type(description, 'Write a house note');
        expect(host.textContent).not.toContain('What it asks');

        (host.querySelector('[role="radio"][aria-checked="false"]') as HTMLButtonElement).click();
        await flush();
        type(host.querySelectorAll<HTMLInputElement>('input[type="text"]')[2], 'Now?');
        (host.querySelector('.pb-modal-keep input') as HTMLInputElement).click();
        await flush();
        button(host, 'Add').click();
        await flush();

        expect(saved).toEqual([[
            { command: 'house-note', description: 'Write a house note', optional: true, prompt: 'Now?' }, true,
        ]]);
        expect(host.querySelector('.pb-modal-added')!.textContent).toBe('');
        draw(true);
        await flush();
        expect(host.querySelector('.pb-modal-added')!.textContent).toBe('Added house-note');
    });

    it('closes on Escape', async () => {
        let closed = 0;
        mount(<StockHookModal step="plan" label="Plan the work" when="after"
            onCancel={() => { closed += 1; }} onSave={noop} />);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(closed).toBe(1);
    });

    it('offers Remove and Save, not keep-open, when editing your own', () => {
        const host = mount(<StockHookModal step="plan" label="Plan the work" when="after"
            editing={OWN} onCancel={noop} onSave={noop} onRemove={noop} />);

        expect(host.querySelector('.pb-modal-title')!.textContent).toBe('Edit your hook');
        expect(button(host, 'Remove')).toBeDefined();
        expect(button(host, 'Save')).toBeDefined();
        expect(host.querySelector('.pb-modal-keep')).toBeNull();
    });
});

describe('a stock hook\'s popover', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('shows the hook\'s real fields', () => {
        const host = mount(<StockHookPopover hook={{ ...OWN, conditional: true }} command="speckit-plan" inline
            onClose={noop} onToggle={noop} onEdit={noop} onRemove={noop} />);

        const facts = host.querySelector('.pb-pop-facts')!.textContent!;
        expect(facts).toContain('After /speckit-plan');
        expect(facts).toContain('house-note');
        expect(facts).toContain('Optional');
        expect(facts).toContain('"Write it now?"');
        expect(facts).toContain('may not run');
    });

    it('is a modal sheet when narrow, and switches the hook', () => {
        let toggles = 0;
        const host = mount(<StockHookPopover hook={OWN} command="speckit-plan" narrow
            onClose={noop} onToggle={() => { toggles += 1; }} onEdit={noop} onRemove={noop} />);

        expect(host.querySelector('.pb-popover--sheet')!.getAttribute('aria-modal')).toBe('true');
        (host.querySelector('[role="switch"]') as HTMLButtonElement).click();
        expect(toggles).toBe(1);
    });
});
