/**
 * The one reader of task checkboxes in a markdown document: a task is a list item, so only a
 * line-leading `- [ ]` counts — one inside a fenced block or code span is documentation, not work.
 */

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;
const INLINE_CODE_PATTERN = /(`+)[^`]*?\1/g;
const TASK_LINE_PATTERN = /^\s*-\s+\[([ xX])\]/;

export interface TaskCounts {
    checked: number;
    total: number;
}

/** The document's lines with fenced code blocks dropped and inline code spans blanked out. */
export function* proseLines(content: string): Generator<string> {
    let openFence: string | null = null;

    for (const rawLine of content.split('\n')) {
        const fence = rawLine.match(FENCE_PATTERN)?.[1];
        if (openFence) {
            if (fence && fence[0] === openFence[0] && fence.length >= openFence.length) openFence = null;
            continue;
        }
        if (fence) {
            openFence = fence;
            continue;
        }
        yield rawLine.replace(INLINE_CODE_PATTERN, '');
    }
}

/** The checkbox marker of a task list item (`' '`, `'x'`, `'X'`), or null when the line is not one. */
export function taskCheckboxMarker(proseLine: string): string | null {
    return proseLine.match(TASK_LINE_PATTERN)?.[1] ?? null;
}

export function countTaskCheckboxes(content: string): TaskCounts {
    let checked = 0;
    let total = 0;

    for (const line of proseLines(content)) {
        const marker = taskCheckboxMarker(line);
        if (!marker) continue;
        total++;
        if (marker.toLowerCase() === 'x') checked++;
    }

    return { checked, total };
}
