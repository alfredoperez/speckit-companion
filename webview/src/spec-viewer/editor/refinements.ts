/**
 * SpecKit Companion - Refinement State Management
 * Uses Preact render() to mount InlineComment components.
 */

import { render, h } from 'preact';
import type { Refinement, VSCodeApi } from '../types';
import { pendingRefinements } from '../signals';
import { detectLineType } from './lineActions';
import { InlineComment } from '../components/InlineComment';

declare const vscode: VSCodeApi;

// Track mount containers for cleanup
const commentContainers = new Map<string, HTMLElement>();

export function addRefinement(lineNum: number, comment: string, lineEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lineContent = lineEl.querySelector('.line-content')?.textContent?.trim() || '';
    const lineType = detectLineType(lineEl);
    const refinement: Refinement = { id, lineNum, lineContent, comment, lineType };

    pendingRefinements.value = [...pendingRefinements.value, refinement];
    renderComment(lineEl, refinement, 'line');
    updateRefineButton();
}

export function addRefinementForRow(rowNum: number, comment: string, scenarioContent: string, rowEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const refinement: Refinement = {
        id, lineNum: rowNum, lineContent: scenarioContent,
        comment, lineType: 'acceptance'
    };

    pendingRefinements.value = [...pendingRefinements.value, refinement];
    renderComment(rowEl, refinement, 'row');
    updateRefineButton();
}

function renderComment(targetEl: HTMLElement, ref: Refinement, mode: 'line' | 'row'): void {
    targetEl.classList.add('has-refinement');

    const onDelete = (refId: string) => removeRefinement(refId, targetEl);

    if (mode === 'line') {
        const commentSlot = targetEl.querySelector('.line-comment-slot');
        if (commentSlot) {
            const container = document.createElement('div');
            commentSlot.appendChild(container);
            render(h(InlineComment, { refinement: ref, mode: 'line', onDelete }), container);
            commentContainers.set(ref.id, container);
        }
    } else {
        const container = document.createElement('tbody');
        targetEl.parentElement?.insertBefore(container, targetEl.nextSibling);
        render(h(InlineComment, { refinement: ref, mode: 'row', onDelete }), container);
        commentContainers.set(ref.id, container);
    }
}

export function removeRefinement(refId: string, targetEl?: HTMLElement): void {
    const current = pendingRefinements.value;
    const index = current.findIndex(r => r.id === refId);
    if (index < 0) return;
    const refinement = current[index];
    pendingRefinements.value = current.filter((_, i) => i !== index);

    // Unmount and remove container
    const container = commentContainers.get(refId);
    if (container) {
        render(null, container);
        container.remove();
        commentContainers.delete(refId);
    }

    // Find target if not provided
    if (!targetEl) {
        const card = document.querySelector(`[data-ref-id="${refId}"]`);
        targetEl = (card?.closest('.line') || card?.closest('.scenario-row')) as HTMLElement | undefined;
        card?.remove();
    }

    if (targetEl) {
        const hasMore = pendingRefinements.value.some(r => r.lineNum === refinement.lineNum);
        if (!hasMore) targetEl.classList.remove('has-refinement');
    }

    updateRefineButton();
}

export function updateRefineButton(): void {
    const count = pendingRefinements.value.length;
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
        btn.style.display = count > 0 ? 'inline-flex' : 'none';
        btn.textContent = count > 0 ? `✨ Refine (${count})` : '';
    }
}

export function submitAllRefinements(): void {
    const refinements = pendingRefinements.value;
    if (refinements.length === 0) return;

    vscode.postMessage({
        type: 'submitRefinements',
        refinements: refinements.map(r => ({
            lineNum: r.lineNum, lineContent: r.lineContent, comment: r.comment
        }))
    });

    clearAllRefinements();
}

export function clearAllRefinements(): void {
    for (const [, container] of commentContainers) {
        render(null, container);
        container.remove();
    }
    commentContainers.clear();

    document.querySelectorAll('.inline-comment').forEach(el => el.remove());
    document.querySelectorAll('.comment-row').forEach(el => el.remove());
    document.querySelectorAll('.has-refinement').forEach(el => el.classList.remove('has-refinement'));

    pendingRefinements.value = [];
    updateRefineButton();
}
