import { clarificationsIn } from '../../../../src/features/reports/clarifications';

const TAG_OR_MARKER = /<pre\b[\s\S]*?<\/pre>|<code\b[^>]*>[^<]*<\/code>|<[^>]+>|\[NEEDS CLARIFICATION:?\s*([^\]]*)\]/gi;

/** A marker that runs across a block boundary is not one question: leaving it as written keeps the markup whole. */
const BLOCK_TAG = /<\/?(?:p|div|li|ul|ol|h[1-6]|table|tr|td|th|pre|blockquote|button|section)\b/i;

let asked: string[] = [];
let marked = 0;

/** Turn each open question in rendered report HTML into the question, a label and an Answer button. */
export function markClarifications(html: string): string {
    let index = 0;
    const out = html.replace(TAG_OR_MARKER, (match: string, question: string | undefined) => {
        if (question === undefined || question.trim() === '' || BLOCK_TAG.test(question)) return match;
        const n = index++;
        return `<span class="rp-question" data-question="${n}"><span class="rp-question__text">${question.trim()}</span> ` +
            `<span class="rp-question__badge">Needs an answer</span> ` +
            `<button type="button" class="rp-question__answer" data-question="${n}">Answer</button></span>`;
    });
    marked = index;
    return out;
}

/** Remember the questions as the report file writes them, which is what the extension checks an answer against. */
export function rememberClarifications(markdown: string): void {
    asked = clarificationsIn(markdown);
}

/** The question as written in the file, when the file and the page agree on how many there are. */
export function writtenQuestion(index: number): string | undefined {
    return asked.length === marked ? asked[index] : undefined;
}
