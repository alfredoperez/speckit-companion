/**
 * Pure re-anchoring logic for restoring persisted review comments (R002, R003).
 *
 * Kept free of DOM / preact imports so it is unit-testable in a node
 * environment. `restoreComments.ts` adapts the live DOM into `RenderedLine[]`
 * and feeds it here.
 */
import type { ReviewComment } from '../types';

/** A rendered source line: its 1-based number and trimmed text content. */
export interface RenderedLine {
    line: number;
    content: string;
}

export function firstNonEmptyLine(block: string): string {
    return (block.split('\n').find(l => l.trim()) || '').trim();
}

/**
 * Returns the line number to anchor a restored comment to, or null when
 * nothing matches (the comment stays Activity-only). Precedence: stored line
 * with matching content → any line matching the stored block's first line →
 * first line under the stored heading → stored line if it still exists.
 */
export function resolveAnchorLine(c: ReviewComment, lines: RenderedLine[]): number | null {
    const firstLine = firstNonEmptyLine(c.anchor.blockText);
    const exact = lines.find(l => l.line === c.anchor.line);

    // 1. stored line, if its content still matches the stored block.
    if (exact && firstLine && exact.content === firstLine) return exact.line;

    // 2. any line whose content equals the stored block's first line.
    if (firstLine) {
        const byText = lines.find(l => l.content === firstLine);
        if (byText) return byText.line;
    }

    // 3. first line under the stored nearest-heading.
    if (c.anchor.heading) {
        const headingIdx = lines.findIndex(l => l.content === c.anchor.heading);
        if (headingIdx >= 0) return (lines[headingIdx + 1] ?? lines[headingIdx]).line;
    }

    // 4. fall back to the stored line if it still exists at all.
    return exact ? exact.line : null;
}
