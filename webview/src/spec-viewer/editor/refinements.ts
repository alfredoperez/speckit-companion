/**
 * SpecKit Companion - Refinement State Management
 * Uses InlineComment component for rendering.
 */

import type { Refinement, VSCodeApi } from '../types';
import {
    addPendingRefinement,
    removePendingRefinement,
    clearPendingRefinements,
    getPendingRefinementsCount,
    getPendingRefinements
} from '../state';
import { detectLineType } from './lineActions';
import { InlineComment } from '../components/InlineComment';

declare const vscode: VSCodeApi;

// Track mounted InlineComment components for cleanup
const commentComponents = new Map<string, InlineComment>();

/**
 * Add a refinement comment for a line
 */
export function addRefinement(lineNum: number, comment: string, lineEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lineContent = lineEl.querySelector('.line-content')?.textContent?.trim() || '';
    const lineType = detectLineType(lineEl);

    const refinement: Refinement = { id, lineNum, lineContent, comment, lineType };

    addPendingRefinement(refinement);
    renderComment(lineEl, refinement, 'line');
    updateRefineButton();
}

/**
 * Add a refinement comment for a scenario table row
 */
export function addRefinementForRow(rowNum: number, comment: string, scenarioContent: string, rowEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const refinement: Refinement = {
        id,
        lineNum: rowNum,
        lineContent: scenarioContent,
        comment,
        lineType: 'acceptance'
    };

    addPendingRefinement(refinement);
    renderComment(rowEl, refinement, 'row');
    updateRefineButton();
}

/**
 * Render an inline comment — unified for both line and row modes.
 */
function renderComment(targetEl: HTMLElement, ref: Refinement, mode: 'line' | 'row'): void {
    targetEl.classList.add('has-refinement');

    const component = new InlineComment({
        refinement: ref,
        mode,
        onDelete: (refId) => removeRefinement(refId, targetEl, mode),
    });

    if (mode === 'line') {
        const commentSlot = targetEl.querySelector('.line-comment-slot');
        if (commentSlot) {
            component.mount(commentSlot as HTMLElement);
        }
    } else {
        // For row mode, mount after the target row
        const parent = targetEl.parentElement;
        if (parent) {
            component.mount(parent, targetEl.nextElementSibling as HTMLElement);
        }
    }

    commentComponents.set(ref.id, component);
}

/**
 * Remove a refinement by ID
 */
export function removeRefinement(refId: string, targetEl?: HTMLElement, mode?: 'line' | 'row'): void {
    const refinement = removePendingRefinement(refId);
    if (!refinement) return;

    // Unmount the component
    const component = commentComponents.get(refId);
    if (component) {
        component.unmount();
        commentComponents.delete(refId);
    }

    // Find the target element if not provided
    if (!targetEl) {
        const commentCard = document.querySelector(`[data-ref-id="${refId}"]`);
        targetEl = (commentCard?.closest('.line') || commentCard?.closest('.scenario-row')) as HTMLElement | undefined;
        commentCard?.remove();
    }

    // Remove has-refinement class if no more refinements on this element
    if (targetEl) {
        const hasMore = getPendingRefinements().some(r => r.lineNum === refinement.lineNum);
        if (!hasMore) {
            targetEl.classList.remove('has-refinement');
        }
    }

    updateRefineButton();
}

/**
 * Update the refine button visibility and count
 */
export function updateRefineButton(): void {
    const count = getPendingRefinementsCount();
    let btn = document.getElementById('refine-submit-btn') as HTMLButtonElement | null;

    if (!btn) {
        const actionsRight = document.querySelector('.actions-right');
        if (actionsRight) {
            btn = document.createElement('button');
            btn.id = 'refine-submit-btn';
            btn.className = 'refine-submit-btn';
            btn.addEventListener('click', submitAllRefinements);
            actionsRight.appendChild(btn);
        }
    }

    if (btn) {
        if (count > 0) {
            btn.style.display = 'inline-flex';
            btn.textContent = `✨ Refine (${count})`;
        } else {
            btn.style.display = 'none';
        }
    }
}

/**
 * Submit all refinements to the extension
 */
export function submitAllRefinements(): void {
    const refinements = getPendingRefinements();
    if (refinements.length === 0) return;

    vscode.postMessage({
        type: 'submitRefinements',
        refinements: refinements.map(r => ({
            lineNum: r.lineNum,
            lineContent: r.lineContent,
            comment: r.comment
        }))
    });

    clearAllRefinements();
}

/**
 * Clear all pending refinements
 */
export function clearAllRefinements(): void {
    // Unmount all comment components
    for (const component of commentComponents.values()) {
        component.unmount();
    }
    commentComponents.clear();

    // Fallback: remove any orphaned comment cards
    document.querySelectorAll('.inline-comment').forEach(el => el.remove());
    document.querySelectorAll('.comment-row').forEach(el => el.remove());

    document.querySelectorAll('.line.has-refinement, .scenario-row.has-refinement').forEach(el => {
        el.classList.remove('has-refinement');
    });

    clearPendingRefinements();
    updateRefineButton();
}

// Re-export for backward compatibility
export { renderComment as renderInlineComment };
export { renderComment as renderInlineCommentForRow };
export { removeRefinement as removeRefinementForRow };
