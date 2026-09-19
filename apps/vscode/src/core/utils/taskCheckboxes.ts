/**
 * The one reader of task checkboxes in a markdown document: a task is a list item, so only a
 * line-leading `- [ ]` counts — one inside a fenced block or code span is documentation, not work.
 *
 * The grammar matches `parse_task_markers` in
 * `speckit-extension/scripts/task_sync.py`, because the two decide the same
 * question — whether every task is done — from opposite sides of the product.
 * `tests/fixtures/task-grammar/` holds the cases they must agree on, and both
 * test suites read it.
 *
 * A task id is required. Both task templates emit one, and the checkbox lines
 * that lack one are verification notes and prose checklists — counting those as
 * tasks inflated the denominator on this side while the other side ignored them,
 * so the two could disagree about whether implement was finished.
 */

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;
const INLINE_CODE_PATTERN = /(`+)[^`]*?\1/g;
const TASK_LINE_PATTERN = /^\s*[-*+]\s*\[([ xX])\]\s*(?:\*\*)?(T\d+)/;

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

/** The task id of a task list item (`T001`), or null when the line is not one. */
export function taskId(proseLine: string): string | null {
    return proseLine.match(TASK_LINE_PATTERN)?.[2] ?? null;
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
