/**
 * SpecKit Companion - Refine Modal
 * Handles the refine modal dialog using viewerStore.
 */

import type { VSCodeApi } from './types';
import { getElements } from './elements';
import { viewerStore } from './viewerStore';

declare const vscode: VSCodeApi;

/**
 * Setup the refine modal event handlers
 */
export function setupRefineModal(): void {
    const { refineBackdrop, refinePopover, refineInput, refineCancel, refineSubmit } = getElements();

    if (!refineBackdrop || !refinePopover) return;

    refineCancel?.addEventListener('click', () => hideRefineModal());
    refineBackdrop?.addEventListener('click', () => hideRefineModal());
    refineSubmit?.addEventListener('click', () => submitRefine());

    refineInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitRefine();
        }
        if (e.key === 'Escape') {
            hideRefineModal();
        }
    });
}

/**
 * Show the refine modal for a specific line
 */
export function showRefineModal(lineNum: number, content: string): void {
    const { refineBackdrop, refinePopover, refineOriginalText, refineInput } = getElements();

    viewerStore.batch((s) => {
        s.set('currentRefineLineNum', lineNum);
        s.set('currentRefineContent', content);
    });

    if (refineOriginalText) {
        refineOriginalText.textContent = content;
    }
    if (refineInput) {
        refineInput.value = '';
    }

    refineBackdrop.style.display = 'block';
    refinePopover.style.display = 'block';

    setTimeout(() => refineInput?.focus(), 100);
}

/**
 * Hide the refine modal
 */
export function hideRefineModal(): void {
    const { refineBackdrop, refinePopover, refineInput } = getElements();

    refineBackdrop.style.display = 'none';
    refinePopover.style.display = 'none';

    if (refineInput) {
        refineInput.value = '';
    }

    viewerStore.batch((s) => {
        s.set('currentRefineLineNum', null);
        s.set('currentRefineContent', '');
    });
}

/**
 * Submit the refine request
 */
function submitRefine(): void {
    const { refineInput } = getElements();
    const lineNum = viewerStore.get('currentRefineLineNum');
    const content = viewerStore.get('currentRefineContent');

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
