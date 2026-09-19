/** @jest-environment jsdom */
import { closeInlineEditor, isInlineEditorOpen } from './editorHost';
import { showInlineEditor, showInlineEditorForRow } from './inlineEditor';
import { clearAllRefinements } from './refinements';
import { navState, viewerState } from '../signals';

(globalThis as unknown as { vscode: unknown }).vscode = { postMessage: jest.fn() };

function renderLine(): HTMLElement {
    document.body.innerHTML = `
        <div id="markdown-content">
            <div class="line" data-line="1">
                <div class="line-content">the target line</div>
                <div class="line-comment-slot"></div>
            </div>
        </div>`;
    return document.querySelector('.line') as HTMLElement;
}

function renderScenarioRow(): HTMLElement {
    document.body.innerHTML = `
        <table class="scenario-table">
            <tbody>
                <tr class="scenario-row" data-row="1">
                    <td class="col-id">AC-1</td>
                    <td class="col-given">a spec</td>
                    <td class="col-when">the row is annotated</td>
                    <td class="col-then">a comment lands under it</td>
                </tr>
            </tbody>
        </table>`;
    return document.querySelector('.scenario-row') as HTMLElement;
}

beforeEach(() => {
    clearAllRefinements();
    closeInlineEditor();
    document.body.innerHTML = '';
    document.body.dataset.specStatus = 'specified';
    navState.value = { currentDoc: 'spec' } as never;
    viewerState.value = null;
});

describe('the inline composer clears the editing state it set', () => {
    it('leaves no editing class behind on a line after close', () => {
        const line = renderLine();

        showInlineEditor(line);
        expect(line.classList.contains('editing')).toBe(true);

        closeInlineEditor();

        expect(document.querySelectorAll('.editing')).toHaveLength(0);
        expect(isInlineEditorOpen()).toBe(false);
    });

    it('leaves no editing class behind on a scenario row after close', () => {
        const row = renderScenarioRow();

        showInlineEditorForRow(row, 1);
        expect(row.classList.contains('editing')).toBe(true);

        closeInlineEditor();

        expect(document.querySelectorAll('.editing')).toHaveLength(0);
        expect(isInlineEditorOpen()).toBe(false);
    });

    it('clears the previous target when the composer reopens on another row', () => {
        document.body.innerHTML = `
            <table class="scenario-table">
                <tbody>
                    <tr class="scenario-row" data-row="1"><td class="col-given">a</td><td class="col-when">b</td><td class="col-then">c</td></tr>
                    <tr class="scenario-row" data-row="2"><td class="col-given">d</td><td class="col-when">e</td><td class="col-then">f</td></tr>
                </tbody>
            </table>`;
        const [first, second] = Array.from(document.querySelectorAll<HTMLElement>('.scenario-row'));

        showInlineEditorForRow(first, 1);
        showInlineEditorForRow(second, 2);

        expect(first.classList.contains('editing')).toBe(false);
        expect(second.classList.contains('editing')).toBe(true);
    });
});
