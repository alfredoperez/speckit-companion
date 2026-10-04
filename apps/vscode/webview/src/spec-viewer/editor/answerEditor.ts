import { render, h } from 'preact';
import type { VSCodeApi } from '../types';
import { InlineEditor } from '../components/InlineEditor';
import { navState } from '../signals';
import { writtenQuestion } from '../markdown/clarifications';
import { closeInlineEditor, openInlineEditor } from './editorHost';

declare const vscode: VSCodeApi;

const HOLDS_ITS_OWN_SLOT = 'li, td, th, dd';
const SLOT_GOES_AFTER = 'p, blockquote, h1, h2, h3, h4, h5, h6, div';

function mountPoint(question: HTMLElement): HTMLElement {
    const container = document.createElement('div');
    const lineSlot = question.closest('.line')?.querySelector('.line-comment-slot');
    if (lineSlot) {
        lineSlot.appendChild(container);
        return container;
    }
    container.className = 'rp-answer-slot';
    const holder = question.closest(HOLDS_ITS_OWN_SLOT);
    if (holder) {
        holder.appendChild(container);
    } else {
        (question.closest(SLOT_GOES_AFTER) ?? question).after(container);
    }
    return container;
}

function markSent(question: HTMLElement): void {
    question.querySelector('.rp-question__badge')?.remove();
    question.querySelector('.rp-question__answer')?.remove();
    const sent = document.createElement('span');
    sent.className = 'rp-question__sent';
    sent.setAttribute('role', 'status');
    sent.textContent = 'Sent to your assistant';
    question.appendChild(sent);
}

/** Open the answer box under an open question. A report is read-only, and this is the one thing it lets a reader send. */
export function showAnswerEditor(button: HTMLElement): void {
    const question = button.closest<HTMLElement>('.rp-question');
    const reportDocument = navState.value?.currentDoc;
    if (!question || !reportDocument) return;
    const index = parseInt(question.dataset.question ?? '', 10);
    const asked = writtenQuestion(index) ?? question.querySelector('.rp-question__text')?.textContent?.trim() ?? '';
    if (!asked) return;

    closeInlineEditor();
    const container = mountPoint(question);

    render(h(InlineEditor, {
        mode: 'answer',
        lineNum: 0,
        lineType: 'paragraph',
        submitLabel: 'Send answer',
        onSubmit: (answer: string) => {
            vscode.postMessage({ type: 'reportAnswer', question: asked, answer, document: reportDocument });
            closeInlineEditor();
            markSent(question);
        },
        onCancel: () => closeInlineEditor(),
        onContextAction: () => undefined,
    }), container);

    openInlineEditor(container, question);
}

let listening = false;

export function setupAnswerActions(): void {
    if (listening) return;
    listening = true;
    document.addEventListener('click', (e) => {
        if (!(e.target instanceof Element)) return;
        const button = e.target.closest<HTMLElement>('.rp-question__answer');
        if (button) showAnswerEditor(button);
    });
}
