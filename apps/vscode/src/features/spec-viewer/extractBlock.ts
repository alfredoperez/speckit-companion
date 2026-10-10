export interface ExtractedBlock {
    /** 1-based first line of the block. */
    startLine: number;
    /** 1-based last line of the block. */
    endLine: number;
    /** Joined block text (raw source lines). */
    text: string;
    /** Nearest preceding heading title, or null if none. */
    heading: string | null;
}

const CARD_FENCE = /^(calls(\s|$)|\S+\s+(sketch\s+\S|\S+:\d+-\d+(\s|$)))/i;
const PIN_LINE = /^\s*pin\s+\d+:/i;

/** Index of the opening line of the `calls` or code card fence that holds line `idx` strictly inside it, or -1. */
function openCardFence(lines: string[], idx: number): number {
    let open = -1;
    for (let i = 0; i < idx; i++) {
        if (!lines[i].trim().startsWith('```')) continue;
        open = open < 0 ? i : -1;
    }
    if (open < 0 || lines[idx].trim().startsWith('```')) return -1;
    return CARD_FENCE.test(lines[open].trim().slice(3).trim()) ? open : -1;
}

/** Index of the closing fence a `pin` line at `idx` belongs to, or -1. */
function pinnedFence(lines: string[], idx: number): number {
    if (!PIN_LINE.test(lines[idx])) return -1;
    let i = idx - 1;
    while (i >= 0 && PIN_LINE.test(lines[i])) i--;
    while (i >= 0 && !lines[i].trim()) i--;
    return i >= 0 && lines[i].trim().startsWith('```') ? i : -1;
}

/**
 * Walk the source markdown to find the block (paragraph or list item) that
 * contains the clicked line, plus the nearest preceding heading. The result
 * gives the AI stable context even after the source doc has been edited and
 * line numbers have shifted.
 */
export function extractBlock(lines: string[], lineNum: number): ExtractedBlock | null {
    const idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return null;

    const isBlank = (s: string) => !s.trim();
    const isHeading = (s: string) => /^#{1,6}\s/.test(s);
    const isHr = (s: string) => /^[-*_]{3,}\s*$/.test(s.trim());
    const isListItem = (s: string) => /^\s*([-*+]|\d+\.)\s/.test(s);
    const isIndentedContinuation = (s: string) => /^\s+\S/.test(s) && !isListItem(s);
    const isBoundary = (s: string) => isBlank(s) || isHeading(s) || isHr(s);

    const findHeading = (from: number): string | null => {
        for (let i = from - 1; i >= 0; i--) {
            const m = lines[i].match(/^#{1,6}\s+(.+)$/);
            if (m) return m[1].trim();
        }
        return null;
    };

    const cardFence = Math.max(openCardFence(lines, idx), pinnedFence(lines, idx));
    if (cardFence >= 0) {
        return { startLine: lineNum, endLine: lineNum, text: lines[idx], heading: findHeading(cardFence) };
    }

    if (isHeading(lines[idx]) || isHr(lines[idx]) || isBlank(lines[idx])) {
        return {
            startLine: lineNum,
            endLine: lineNum,
            text: lines[idx],
            heading: findHeading(idx),
        };
    }

    const clickedIsListItem = isListItem(lines[idx]);
    let start = idx;
    let end = idx;

    while (start > 0) {
        const dest = lines[start - 1];
        if (isBoundary(dest)) break;
        if (clickedIsListItem) {
            if (isListItem(dest) || isIndentedContinuation(dest)) break;
        } else {
            // For paragraph clicks, a preceding list-item line means the
            // clicked text is a continuation; pull the bullet into the block.
            if (isListItem(dest)) { start--; break; }
        }
        start--;
    }

    while (end < lines.length - 1) {
        const next = lines[end + 1];
        if (isBoundary(next)) break;
        if (isListItem(next)) break;
        if (clickedIsListItem && !isIndentedContinuation(next)) break;
        end++;
    }

    return {
        startLine: start + 1,
        endLine: end + 1,
        text: lines.slice(start, end + 1).join('\n'),
        heading: findHeading(start),
    };
}
