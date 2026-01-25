/**
 * SpecKit Companion - Refine Modal
 * Handles the refine modal dialog
 */

import type { VSCodeApi } from './types';
import { getElements } from './elements';
import {
    currentRefineLineNum,
    currentRefineContent,
    setCurrentRefineLineNum,
    setCurrentRefineContent
} from './state';

declare const vscode: VSCodeApi;

/**
 * Setup the refine modal event handlers
 */
export function setupRefineModal(): void {
    const { refineBackdrop, refinePopover, refineInput, refineCancel, refineSubmit } = getElements();

    if (!refineBackdrop || !refinePopover) return;

    // Cancel button
    refineCancel?.addEventListener('click', () => {
        hideRefineModal();
    });

    // Backdrop click to close
    refineBackdrop?.addEventListener('click', () => {
        hideRefineModal();
    });

    // Submit button
    refineSubmit?.addEventListener('click', () => {
        submitRefine();
    });

    // Enter key to submit
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

    setCurrentRefineLineNum(lineNum);
    setCurrentRefineContent(content);

    if (refineOriginalText) {
        refineOriginalText.textContent = content;
    }
    if (refineInput) {
        refineInput.value = '';
    }

    refineBackdrop.style.display = 'block';
    refinePopover.style.display = 'block';

    // Focus input after animation
    setTimeout(() => {
        refineInput?.focus();
    }, 100);
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

    setCurrentRefineLineNum(null);
    setCurrentRefineContent('');
}

/**
 * Submit the refine request
 */
function submitRefine(): void {
    const { refineInput } = getElements();

    if (currentRefineLineNum === null || !refineInput?.value.trim()) {
        hideRefineModal();
        return;
    }

    vscode.postMessage({
        type: 'refineLine',
        lineNum: currentRefineLineNum,
        content: currentRefineContent,
        instruction: refineInput.value.trim()
    });

    hideRefineModal();
}
