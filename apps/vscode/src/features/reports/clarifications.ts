const FENCE = /^\s*(```|~~~)/;
const MARKER_OR_CODE = /`[^`\n]*`|\[NEEDS CLARIFICATION:?\s*([^\]]*)\]/gi;

/** The question inside each `[NEEDS CLARIFICATION: …]` marker, in document order; code is skipped. */
export function clarificationsIn(markdown: string): string[] {
    let fence: string | undefined;
    const prose: string[] = [];
    for (const line of markdown.split(/\r?\n/)) {
        const marker = FENCE.exec(line)?.[1];
        if (fence) {
            if (marker === fence) fence = undefined;
            continue;
        }
        if (marker) {
            fence = marker;
            continue;
        }
        prose.push(line);
    }
    const questions: string[] = [];
    for (const match of prose.join('\n').matchAll(MARKER_OR_CODE)) {
        const question = match[1]?.replace(/\s+/g, ' ').trim();
        if (question) questions.push(question);
    }
    return questions;
}
