import { navState, pendingRefinements, viewerState } from '../signals';
import { addRefinement } from './refinements';
import { currentDoc } from './currentDoc';
import { isReadOnly } from './readOnly';

export const STRIKE_TEXT = 'Remove this call from the plan.';

const rowText = (lineEl: Element): string => lineEl.querySelector('.line-content')?.textContent?.trim() ?? '';

function isStruck(lineEl: HTMLElement): boolean {
    const doc = currentDoc();
    const lineNum = Number(lineEl.dataset.line);
    const text = rowText(lineEl);
    const firstLine = (block: string): string => (block.split('\n').find((l) => l.trim()) ?? '').trim();
    if (pendingRefinements.value.some((r) => r.lineNum === lineNum && r.comment === STRIKE_TEXT && r.lineContent.trim() === text)) return true;
    return !!viewerState.value?.reviewComments?.some(
        (c) => c.doc === doc && c.anchor.line === lineNum && c.comment === STRIKE_TEXT && firstLine(c.anchor.blockText) === text,
    );
}

/** Draws a call row struck when it carries the removal comment, pending or applied. */
export function markStruckRows(): void {
    Array.from(document.querySelectorAll('.calls-row')).forEach((row) => {
        const lineEl = row.closest('.line') as HTMLElement | null;
        row.classList.toggle('calls-row--struck', !!lineEl && isStruck(lineEl));
    });
}

export function strikeRow(lineEl: HTMLElement): void {
    const lineNum = Number(lineEl.dataset.line);
    if (isReadOnly() || !Number.isInteger(lineNum) || lineNum < 1 || isStruck(lineEl)) return;
    addRefinement(lineNum, STRIKE_TEXT, lineEl);
    markStruckRows();
}

export function setupCallsStrike(): void {
    document.addEventListener('click', (e) => {
        const button = (e.target as HTMLElement).closest('.calls-strike');
        const lineEl = button?.closest('.line') as HTMLElement | null | undefined;
        if (lineEl && navState.value) strikeRow(lineEl);
    });
}
