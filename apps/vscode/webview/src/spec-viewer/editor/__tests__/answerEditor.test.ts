/** @jest-environment jsdom */
import { closeInlineEditor, isInlineEditorOpen } from '../editorHost';
import { setupAnswerActions } from '../answerEditor';
import { renderMarkdown, setReportMode } from '../../markdown';
import { navState } from '../../signals';

const postMessage = jest.fn();
(globalThis as unknown as { vscode: unknown }).vscode = { postMessage };

const REPORT = [
    '## Open Questions',
    '',
    '- [NEEDS CLARIFICATION: Is `qty` ever zero?]',
    '',
    'The cause is known. [NEEDS CLARIFICATION: since when?]',
    '',
].join('\n');

function showReport(markdown = REPORT): void {
    document.body.innerHTML = `<div id="markdown-content">${renderMarkdown(markdown)}</div>`;
}

function answerButton(index: number): HTMLButtonElement {
    return document.querySelector(`.rp-question__answer[data-question="${index}"]`) as HTMLButtonElement;
}

function question(index: number): HTMLElement {
    return document.querySelector(`.rp-question[data-question="${index}"]`) as HTMLElement;
}

async function typeAnswer(text: string): Promise<void> {
    const el = document.querySelector('.editor-textarea') as HTMLTextAreaElement;
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
}

beforeAll(() => {
    setupAnswerActions();
    setupAnswerActions();
});

beforeEach(() => {
    closeInlineEditor();
    postMessage.mockClear();
    document.body.innerHTML = '';
    document.body.dataset.readOnly = 'true';
    navState.value = { currentDoc: 'assessment', report: { kind: 'bug' } } as never;
    setReportMode(true);
});

afterAll(() => {
    setReportMode(false);
    delete document.body.dataset.readOnly;
});

describe('answering an open question on a read-only report', () => {
    it('opens the answer box under a question in a list item', () => {
        showReport();

        answerButton(0).click();

        const line = question(0).closest('li.line') as HTMLElement;
        expect(line.querySelector('.line-comment-slot .inline-editor')).not.toBeNull();
        expect(document.querySelectorAll('.inline-editor')).toHaveLength(1);
        expect(document.querySelector('.editor-add')?.textContent).toBe('Send answer');
    });

    it('opens the answer box under a question in a paragraph', () => {
        showReport();

        answerButton(1).click();

        const line = question(1).closest('.line') as HTMLElement;
        expect(line.querySelector('.line-comment-slot .inline-editor')).not.toBeNull();
    });

    it('opens the box inside a list item that has no comment slot', () => {
        showReport();
        const item = document.createElement('li');
        item.appendChild(question(0));
        document.getElementById('markdown-content')!.appendChild(item);

        answerButton(0).click();

        expect(item.querySelector(':scope > .rp-answer-slot .inline-editor')).not.toBeNull();
    });

    it('opens the box right after a paragraph that has no comment slot', () => {
        showReport();
        const paragraph = document.createElement('p');
        paragraph.appendChild(question(1));
        document.getElementById('markdown-content')!.appendChild(paragraph);

        answerButton(1).click();

        expect(paragraph.nextElementSibling?.className).toBe('rp-answer-slot');
        expect(paragraph.nextElementSibling?.querySelector('.inline-editor')).not.toBeNull();
    });

    it('opens only one box at a time', () => {
        showReport();

        answerButton(0).click();
        answerButton(1).click();

        expect(document.querySelectorAll('.inline-editor')).toHaveLength(1);
        expect(question(1).closest('.line')!.querySelector('.inline-editor')).not.toBeNull();
    });

    it('sends the question as the file writes it, the typed answer and the document on screen', async () => {
        showReport();
        answerButton(0).click();

        await typeAnswer('  Never, the cart drops empty lines.  ');
        (document.querySelector('.editor-add') as HTMLButtonElement).click();

        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).toHaveBeenCalledWith({
            type: 'reportAnswer',
            question: 'Is `qty` ever zero?',
            answer: 'Never, the cart drops empty lines.',
            document: 'assessment',
        });
    });

    it('replaces the label and the button with a sent note', async () => {
        showReport();
        answerButton(1).click();

        await typeAnswer('Since the March release.');
        (document.querySelector('.editor-add') as HTMLButtonElement).click();

        const sent = question(1).querySelector('.rp-question__sent') as HTMLElement;
        expect(sent.textContent).toBe('Sent to your assistant');
        expect(sent.getAttribute('role')).toBe('status');
        expect(question(1).querySelector('.rp-question__answer')).toBeNull();
        expect(question(1).querySelector('.rp-question__badge')).toBeNull();
        expect(question(1).querySelector('.rp-question__text')?.textContent).toBe('since when?');
        expect(isInlineEditorOpen()).toBe(false);
        expect(answerButton(0)).not.toBeNull();
    });

    it('closes on Escape without sending anything', async () => {
        showReport();
        answerButton(0).click();

        await typeAnswer('half an answer');
        document.querySelector('.editor-textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(postMessage).not.toHaveBeenCalled();
        expect(document.querySelector('.inline-editor')).toBeNull();
        expect(answerButton(0)).not.toBeNull();
    });

    it('sends nothing when the box is submitted empty', () => {
        showReport();
        answerButton(0).click();

        (document.querySelector('.editor-add') as HTMLButtonElement).click();

        expect(postMessage).not.toHaveBeenCalled();
        expect(answerButton(0)).not.toBeNull();
    });

    it('comes back with its button when the report renders again', async () => {
        showReport();
        answerButton(0).click();
        await typeAnswer('Never.');
        (document.querySelector('.editor-add') as HTMLButtonElement).click();

        showReport();

        expect(answerButton(0)).not.toBeNull();
        expect(document.querySelector('.rp-question__sent')).toBeNull();
    });
});
