/**
 * SpecKit Companion - Refine Modal
 * Uses signals for state.
 */

import type { VSCodeApi } from './types';
import { getElements } from './elements';
import { refineLineNum, refineContent } from './signals';

declare const vscode: VSCodeApi;

export function setupRefineModal(): void {
    const { refineBackdrop, refinePopover, refineInput, refineCancel, refineSubmit } = getElements();
    if (!refineBackdrop || !refinePopover) return;

    refineCancel?.addEventListener('click', () => hideRefineModal());
    refineBackdrop?.addEventListener('click', () => hideRefineModal());
    refineSubmit?.addEventListener('click', () => submitRefine());

    refineInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitRefine(); }
        if (e.key === 'Escape') hideRefineModal();
    });
}

export function showRefineModal(lineNum: number, content: string): void {
    const { refineBackdrop, refinePopover, refineOriginalText, refineInput } = getElements();

    refineLineNum.value = lineNum;
    refineContent.value = content;

    if (refineOriginalText) refineOriginalText.textContent = content;
    if (refineInput) refineInput.value = '';

    refineBackdrop.style.display = 'block';
    refinePopover.style.display = 'block';
    setTimeout(() => refineInput?.focus(), 100);
}

export function hideRefineModal(): void {
    const { refineBackdrop, refinePopover, refineInput } = getElements();

    refineBackdrop.style.display = 'none';
    refinePopover.style.display = 'none';
    if (refineInput) refineInput.value = '';

    refineLineNum.value = null;
    refineContent.value = '';
}

function submitRefine(): void {
    const { refineInput } = getElements();
    const lineNum = refineLineNum.value;
    const content = refineContent.value;

    if (lineNum === null || !refineInput?.value.trim()) {
        hideRefineModal();
        return;
    }

    vscode.postMessage({
        type: 'refineLine',
        lineNum,
        content,
        instruction: refineInput.value.trim()
    });

    hideRefineModal();
}
