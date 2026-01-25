/**
 * SpecKit Companion - Refinement State Management
 * Handles pending refinements for GitHub-style review
 */

import type { Refinement, VSCodeApi } from '../types';
import { escapeHtml } from '../markdown';
import {
    pendingRefinements,
    addPendingRefinement,
    removePendingRefinement,
    clearPendingRefinements,
    getPendingRefinementsCount,
    getPendingRefinements
} from '../state';
import { detectLineType } from './lineActions';

declare const vscode: VSCodeApi;

/**
 * Add a refinement comment for a line
 */
export function addRefinement(lineNum: number, comment: string, lineEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lineContent = lineEl.querySelector('.line-content')?.textContent?.trim() || '';
    const lineType = detectLineType(lineEl);

    const refinement: Refinement = {
        id,
        lineNum,
        lineContent,
        comment,
        lineType
    };

    addPendingRefinement(refinement);
    renderInlineComment(lineEl, refinement);
    updateRefineButton();
}

/**
 * Remove a refinement by ID
 */
export function removeRefinement(refId: string): void {
    const refinement = removePendingRefinement(refId);
    if (!refinement) return;

    // Remove the comment card from DOM
    const commentCard = document.querySelector(`.inline-comment[data-ref-id="${refId}"]`);
    const lineEl = commentCard?.closest('.line');

    commentCard?.remove();

    // Remove has-refinement class if no more refinements on this line
    if (lineEl) {
        const hasMoreRefinements = getPendingRefinements().some(r => r.lineNum === refinement.lineNum);
        if (!hasMoreRefinements) {
            lineEl.classList.remove('has-refinement');
        }
    }

    updateRefineButton();
}

/**
 * Render an inline comment card below a line
 */
export function renderInlineComment(lineEl: HTMLElement, ref: Refinement): void {
    lineEl.classList.add('has-refinement');

    const commentCard = document.createElement('div');
    commentCard.className = 'inline-comment';
    commentCard.dataset.refId = ref.id;
    commentCard.innerHTML = `
        <span class="comment-icon">💬</span>
        <span class="comment-text">${escapeHtml(ref.comment)}</span>
        <button class="comment-delete" data-ref-id="${ref.id}" title="Remove comment">×</button>
    `;

    // Add to comment slot
    const commentSlot = lineEl.querySelector('.line-comment-slot');
    if (commentSlot) {
        commentSlot.appendChild(commentCard);
    }

    // Setup delete button
    const deleteBtn = commentCard.querySelector('.comment-delete');
    deleteBtn?.addEventListener('click', () => {
        removeRefinement(ref.id);
    });
}

/**
 * Add a refinement comment for a scenario table row
 */
export function addRefinementForRow(rowNum: number, comment: string, scenarioContent: string, rowEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const refinement: Refinement = {
        id,
        lineNum: rowNum,  // Use row number as line number
        lineContent: scenarioContent,
        comment,
        lineType: 'acceptance'
    };

    addPendingRefinement(refinement);
    renderInlineCommentForRow(rowEl, refinement);
    updateRefineButton();
}

/**
 * Render an inline comment card below a scenario table row
 */
export function renderInlineCommentForRow(rowEl: HTMLElement, ref: Refinement): void {
    rowEl.classList.add('has-refinement');

    // Create a new row for the comment
    const commentRow = document.createElement('tr');
    commentRow.className = 'comment-row';
    commentRow.dataset.refId = ref.id;
    commentRow.innerHTML = `
        <td colspan="4" class="comment-cell">
            <div class="inline-comment">
                <span class="comment-icon">💬</span>
                <span class="comment-text">${escapeHtml(ref.comment)}</span>
                <button class="comment-delete" data-ref-id="${ref.id}" title="Remove comment">×</button>
            </div>
        </td>
    `;

    // Insert comment row after the scenario row
    rowEl.after(commentRow);

    // Setup delete button
    const deleteBtn = commentRow.querySelector('.comment-delete');
    deleteBtn?.addEventListener('click', () => {
        removeRefinementForRow(ref.id, rowEl, commentRow);
    });
}

/**
 * Remove a refinement for a scenario table row
 */
export function removeRefinementForRow(refId: string, rowEl: HTMLElement, commentRow: HTMLElement): void {
    const refinement = removePendingRefinement(refId);
    if (!refinement) return;

    commentRow.remove();

    // Remove has-refinement class if no more refinements on this row
    const rowNum = parseInt(rowEl.dataset.row || '0', 10);
    const hasMoreRefinements = getPendingRefinements().some(r => r.lineNum === rowNum && r.lineType === 'acceptance');
    if (!hasMoreRefinements) {
        rowEl.classList.remove('has-refinement');
    }

    updateRefineButton();
}

/**
 * Update the refine button visibility and count
 */
export function updateRefineButton(): void {
    const count = getPendingRefinementsCount();
    let btn = document.getElementById('refine-submit-btn') as HTMLButtonElement | null;

    // Create button in footer if it doesn't exist
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
            btn.textContent = `📝 Refine (${count} comment${count > 1 ? 's' : ''}) →`;
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

    // Send refinements to extension
    vscode.postMessage({
        type: 'submitRefinements',
        refinements: refinements.map(r => ({
            lineNum: r.lineNum,
            lineContent: r.lineContent,
            comment: r.comment
        }))
    });

    // Clear all refinements
    clearAllRefinements();
}

/**
 * Clear all pending refinements
 */
export function clearAllRefinements(): void {
    // Remove all comment cards
    document.querySelectorAll('.inline-comment').forEach(el => el.remove());

    // Remove has-refinement class from all lines
    document.querySelectorAll('.line.has-refinement').forEach(el => {
        el.classList.remove('has-refinement');
    });

    clearPendingRefinements();
    updateRefineButton();
}
