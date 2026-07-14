/**
 * SpecKit Companion - Refinement State Management
 * Uses Preact render() to mount InlineComment components.
 */

import { render, h } from 'preact';
import type { Refinement, ReviewComment, VSCodeApi } from '../types';
import { pendingRefinements } from '../signals';
import { detectLineType } from './lineActions';
import { currentDoc } from './currentDoc';
import { closeInlineEditor, openInlineEditor } from './editorHost';
import { isReadOnly } from './readOnly';
import { InlineComment } from '../components/InlineComment';
import { InlineEditor } from '../components/InlineEditor';

declare const vscode: VSCodeApi;

interface MountedComment {
    ref: Refinement;
    target: HTMLElement;
    mode: 'line' | 'row';
}

// Track mount containers for cleanup
const commentContainers = new Map<string, HTMLElement>();

/** Every mounted comment, pending AND applied — `pendingRefinements` stays pending-only because it drives the Refine count. */
const mounted = new Map<string, MountedComment>();

export function addRefinement(lineNum: number, comment: string, lineEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lineContent = lineEl.querySelector('.line-content')?.textContent?.trim() || '';
    const lineType = detectLineType(lineEl);
    const refinement: Refinement = { id, lineNum, lineContent, comment, lineType, status: 'pending' };

    pendingRefinements.value = [...pendingRefinements.value, refinement];
    renderComment(lineEl, refinement, 'line');
    updateRefineButton();
    persistAdd(id, lineNum, lineContent, comment);
}

export function addRefinementForRow(rowNum: number, comment: string, scenarioContent: string, rowEl: HTMLElement): void {
    const id = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const refinement: Refinement = {
        id, lineNum: rowNum, lineContent: scenarioContent,
        comment, lineType: 'acceptance', status: 'pending'
    };

    pendingRefinements.value = [...pendingRefinements.value, refinement];
    renderComment(rowEl, refinement, 'row');
    updateRefineButton();
    persistAdd(id, rowNum, scenarioContent, comment);
}

/** Persist a newly added comment to `.spec-context.json` (via the extension). */
function persistAdd(id: string, lineNum: number, lineContent: string, comment: string): void {
    const doc = currentDoc();
    if (!doc) {
        console.warn('[speckit] persistAdd dropped: currentDoc() returned null', { id, lineNum });
        return;
    }
    vscode.postMessage({ type: 'addComment', id, doc, lineNum, lineContent, comment });
}

/**
 * Mount a persisted comment that was restored from `.spec-context.json` onto an
 * already-anchored line element. Unlike `addRefinement`, this does NOT persist
 * (the comment already exists on disk) and reuses the stored id so later
 * edit/remove map back to the same record. A re-restore of an unchanged comment
 * is a no-op; a changed one (a refine run flipped it to `applied`) re-renders in
 * place and leaves the pending set honest.
 */
export function addRestoredRefinement(comment: ReviewComment, lineEl: HTMLElement): void {
    const existing = mounted.get(comment.id);
    const unchanged = existing
        && commentContainers.has(comment.id)
        && existing.ref.comment === comment.comment
        && existing.ref.status === comment.status;
    if (unchanged) return;

    const lineContent = lineEl.querySelector('.line-content')?.textContent?.trim()
        || comment.anchor.blockText.split('\n')[0]
        || '';
    // Re-anchoring can mount a comment on a line other than its stored one — the card speaks for where it now sits.
    const mountedLine = Number(lineEl.dataset.line) || comment.anchor.line;
    const refinement: Refinement = {
        id: comment.id,
        lineNum: mountedLine,
        lineContent,
        comment: comment.comment,
        lineType: detectLineType(lineEl),
        status: comment.status,
    };
    const others = pendingRefinements.value.filter(r => r.id !== comment.id);
    pendingRefinements.value = refinement.status === 'pending' ? [...others, refinement] : others;
    renderComment(lineEl, refinement, 'line');
    updateRefineButton();
}

function renderComment(targetEl: HTMLElement, ref: Refinement, mode: 'line' | 'row'): void {
    targetEl.classList.add('has-refinement');
    mounted.set(ref.id, { ref, target: targetEl, mode });

    const props = {
        refinement: ref,
        mode,
        readOnly: isReadOnly(),
        onDelete: (refId: string) => removeRefinement(refId, targetEl),
        onEdit: showInlineEditorForEdit,
        onRefine: submitAllRefinements,
    };

    const existing = commentContainers.get(ref.id);
    if (existing) {
        render(h(InlineComment, props), existing);
        return;
    }

    if (mode === 'line') {
        const commentSlot = targetEl.querySelector('.line-comment-slot');
        if (commentSlot) {
            const container = document.createElement('div');
            commentSlot.appendChild(container);
            render(h(InlineComment, props), container);
            commentContainers.set(ref.id, container);
        }
    } else {
        const container = document.createElement('tbody');
        targetEl.parentElement?.insertBefore(container, targetEl.nextSibling);
        render(h(InlineComment, props), container);
        commentContainers.set(ref.id, container);
    }
}

/** The mounted comment behind an id, for the edit flow. */
export function mountedRefinement(refId: string): MountedComment | undefined {
    return mounted.get(refId);
}

/** Reopen the composer on an existing comment, pre-filled with its current text. */
export function showInlineEditorForEdit(refId: string): void {
    if (isReadOnly()) return;

    const entry = mounted.get(refId);
    if (!entry) return;

    closeInlineEditor();

    const { ref, target, mode } = entry;
    const container = document.createElement(mode === 'row' ? 'tbody' : 'div');
    if (mode === 'row') {
        target.parentElement?.insertBefore(container, target.nextSibling);
    } else {
        const commentSlot = target.querySelector('.line-comment-slot');
        if (!commentSlot) return;
        commentSlot.appendChild(container);
    }

    render(h(InlineEditor, {
        mode,
        lineNum: ref.lineNum,
        lineType: ref.lineType,
        initialValue: ref.comment,
        submitLabel: 'Save',
        onSubmit: (comment: string) => {
            editRefinement(refId, comment);
            closeInlineEditor();
        },
        onCancel: () => closeInlineEditor(),
        onContextAction: () => closeInlineEditor(),
    }), container);

    openInlineEditor(container, target);
}

/** Replace a mounted comment's text and persist the revision; an unchanged text is a no-op. */
export function editRefinement(refId: string, comment: string): void {
    const entry = mounted.get(refId);
    const text = comment.trim();
    if (!entry || !text || text === entry.ref.comment) return;

    const updated: Refinement = { ...entry.ref, comment: text };
    pendingRefinements.value = pendingRefinements.value.map(r => (r.id === refId ? updated : r));
    renderComment(entry.target, updated, entry.mode);

    vscode.postMessage({ type: 'editComment', id: refId, comment: text });
}

export function removeRefinement(refId: string, targetEl?: HTMLElement): void {
    const entry = mounted.get(refId);
    pendingRefinements.value = pendingRefinements.value.filter(r => r.id !== refId);
    mounted.delete(refId);

    const container = commentContainers.get(refId);
    if (container) {
        render(null, container);
        container.remove();
        commentContainers.delete(refId);
    }

    const target = targetEl ?? entry?.target;
    if (target) {
        const stillAnnotated = [...mounted.values()].some(m => m.target === target);
        if (!stillAnnotated) target.classList.remove('has-refinement');
        // Delete unmounts the button that had focus — hand it back to the line.
        target.querySelector<HTMLElement>('.line-add-btn, .row-add-btn')?.focus();
    }

    updateRefineButton();

    // Persist the removal so it survives reopen.
    vscode.postMessage({ type: 'removeComment', id: refId });
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

    const doc = currentDoc();
    if (!doc) return;

    // Comments are already persisted on add; the extension dispatches the doc's pending ones and marks them applied, and the refreshed context re-restores the cards cleared below.
    vscode.postMessage({ type: 'runDocRefinement', doc });

    clearAllRefinements();
}

export function clearAllRefinements(): void {
    for (const [, container] of commentContainers) {
        render(null, container);
        container.remove();
    }
    commentContainers.clear();
    mounted.clear();

    document.querySelectorAll('.inline-comment').forEach(el => el.remove());
    document.querySelectorAll('.comment-row').forEach(el => el.remove());
    document.querySelectorAll('.has-refinement').forEach(el => el.classList.remove('has-refinement'));

    pendingRefinements.value = [];
    updateRefineButton();
}
