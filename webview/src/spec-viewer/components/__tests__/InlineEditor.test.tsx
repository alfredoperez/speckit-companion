/** @jest-environment jsdom */
import { render, h } from 'preact';
import { InlineEditor, type InlineEditorProps } from '../InlineEditor';

function baseProps(over: Partial<InlineEditorProps> = {}): InlineEditorProps {
    return {
        mode: 'line',
        lineNum: 12,
        lineType: 'paragraph',
        onSubmit: () => undefined,
        onCancel: () => undefined,
        onContextAction: () => undefined,
        ...over,
    };
}

function mount(props: InlineEditorProps): HTMLDivElement {
    const host = document.createElement('div');
    document.body.appendChild(host);
    render(h(InlineEditor, props), host);
    return host;
}

/** Re-render the same vnode tree into the same container — what a parent re-render does. */
function rerender(host: HTMLElement, props: InlineEditorProps): void {
    render(h(InlineEditor, props), host);
}

function textarea(host: HTMLElement): HTMLTextAreaElement {
    return host.querySelector('.editor-textarea') as HTMLTextAreaElement;
}

/** Preact re-renders on a microtask — let the keystroke land before asserting. */
async function type(host: HTMLElement, text: string): Promise<void> {
    const el = textarea(host);
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
}

function submit(host: HTMLElement): void {
    (host.querySelector('.editor-add') as HTMLButtonElement).click();
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('InlineEditor — the textarea is the user\'s text, not the prop\'s', () => {
    it('holds what the user typed on a fresh composer', async () => {
        const host = mount(baseProps());

        await type(host, 'Name the auth methods in scope');

        expect(textarea(host).value).toBe('Name the auth methods in scope');
    });

    it('keeps the typed text across a re-render of the composer', async () => {
        const host = mount(baseProps());

        await type(host, 'Name the auth methods in scope');
        rerender(host, baseProps({ lineNum: 13 }));

        expect(textarea(host).value).toBe('Name the auth methods in scope');
    });

    it('submits the typed text, not an empty prop', async () => {
        const onSubmit = jest.fn();
        const host = mount(baseProps({ onSubmit }));

        await type(host, '  Name the auth methods  ');
        submit(host);

        expect(onSubmit).toHaveBeenCalledWith('Name the auth methods');
    });

    it('cancels instead of submitting when nothing was typed', () => {
        const onSubmit = jest.fn();
        const onCancel = jest.fn();
        const host = mount(baseProps({ onSubmit, onCancel }));

        submit(host);

        expect(onSubmit).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalled();
    });

    it('submits the typed text on Ctrl+Enter', async () => {
        const onSubmit = jest.fn();
        const host = mount(baseProps({ onSubmit }));

        await type(host, 'Ship it');
        textarea(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));

        expect(onSubmit).toHaveBeenCalledWith('Ship it');
    });
});

describe('InlineEditor — edit mode never saves the text the user replaced', () => {
    const original = 'Name the auth methods in scope';
    const editProps = (over: Partial<InlineEditorProps> = {}) =>
        baseProps({ initialValue: original, submitLabel: 'Save', ...over });

    it('pre-fills the composer with the comment being edited', () => {
        const host = mount(editProps());

        expect(textarea(host).value).toBe(original);
    });

    it('keeps the revised text across a re-render — it must not revert to the original comment', async () => {
        const host = mount(editProps());

        await type(host, 'Name the auth methods in scope for v1');
        rerender(host, editProps({ lineNum: 13 }));

        expect(textarea(host).value).toBe('Name the auth methods in scope for v1');
    });

    it('saves the revised text, not the original comment', async () => {
        const onSubmit = jest.fn();
        const host = mount(editProps({ onSubmit }));

        await type(host, 'Name the auth methods in scope for v1');
        rerender(host, editProps({ onSubmit, lineNum: 13 }));
        submit(host);

        expect(onSubmit).toHaveBeenCalledWith('Name the auth methods in scope for v1');
    });

    it('drops the line-removal actions while editing an existing comment', () => {
        const host = mount(editProps());

        expect(host.querySelector('.context-action')).toBeNull();
        expect(host.querySelector('.editor-add')?.textContent).toBe('Save');
    });
});
