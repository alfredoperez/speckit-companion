import { markClarifications, writtenQuestion } from '../clarifications';
import { renderMarkdown, setReportMode } from '../renderer';

const marked = (n: number, question: string) =>
    `<span class="rp-question" data-question="${n}"><span class="rp-question__text">${question}</span> ` +
    `<span class="rp-question__badge">Needs an answer</span> ` +
    `<button type="button" class="rp-question__answer" data-question="${n}">Answer</button></span>`;

describe('markClarifications', () => {
    it('marks an open question inside a list item', () => {
        const html = '<li class="line"><span class="line-content">[NEEDS CLARIFICATION: Who asked?]</span></li>';

        expect(markClarifications(html)).toBe(
            `<li class="line"><span class="line-content">${marked(0, 'Who asked?')}</span></li>`,
        );
    });

    it('marks an open question in the middle of a paragraph', () => {
        const html = '<p>Each browser holds a private list. [NEEDS CLARIFICATION: how often?] Nobody knows.</p>';

        expect(markClarifications(html)).toBe(
            `<p>Each browser holds a private list. ${marked(0, 'how often?')} Nobody knows.</p>`,
        );
    });

    it('numbers two questions 0 and 1 in document order', () => {
        const html = markClarifications('<p>[NEEDS CLARIFICATION: first]</p><p>[needs clarification second]</p>');

        expect(html).toBe(`<p>${marked(0, 'first')}</p><p>${marked(1, 'second')}</p>`);
    });

    it('keeps a script tag in the question as escaped text', () => {
        const html = markClarifications('<p>[NEEDS CLARIFICATION: &lt;script&gt;alert(1)&lt;/script&gt;]</p>');

        expect(html).toContain('<span class="rp-question__text">&lt;script&gt;alert(1)&lt;/script&gt;</span>');
        expect(html).not.toContain('<script');
    });

    it('returns HTML with no marker unchanged', () => {
        const html = '<p>Nothing is open. See [the fix](fix.md).</p>';

        expect(markClarifications(html)).toBe(html);
    });

    it.each(['<p>[NEEDS CLARIFICATION]</p>', '<p>[NEEDS CLARIFICATION: ]</p>'])('leaves the empty marker %s as written', (html) => {
        expect(markClarifications(html)).toBe(html);
    });

    it('leaves a marker shown as code or held in an attribute alone', () => {
        const html =
            '<pre><code>[NEEDS CLARIFICATION: in a block]</code></pre>' +
            '<p title="[NEEDS CLARIFICATION: in a title]"><code>[NEEDS CLARIFICATION: in a span]</code></p>';

        expect(markClarifications(html)).toBe(html);
    });

    it('keeps inline code inside a question', () => {
        const html = markClarifications('<p>[NEEDS CLARIFICATION: Is <code>qty</code> ever zero?]</p>');

        expect(html).toBe(`<p>${marked(0, 'Is <code>qty</code> ever zero?')}</p>`);
    });
});

describe('renderMarkdown on a report', () => {
    const report = '## Open Questions\n\n- [NEEDS CLARIFICATION: Is `qty` ever zero?]\n\nThe cause is known. [NEEDS CLARIFICATION: since when?]\n';

    afterEach(() => {
        setReportMode(false);
    });

    it('leaves the marker as written when the document is not a report', () => {
        const html = renderMarkdown(report);

        expect(html).not.toContain('rp-question');
        expect(html).toContain('[NEEDS CLARIFICATION: since when?]');
    });

    it('marks every open question when the document is a report', () => {
        setReportMode(true);

        const html = renderMarkdown(report);

        expect(html.match(/class="rp-question__answer"/g)).toHaveLength(2);
        expect(html).toContain('data-question="1"');
        expect(html).not.toContain('[NEEDS CLARIFICATION');
    });

    it('keeps each question as the file writes it, for the answer to quote', () => {
        setReportMode(true);

        renderMarkdown(report);

        expect(writtenQuestion(0)).toBe('Is `qty` ever zero?');
        expect(writtenQuestion(1)).toBe('since when?');
    });

    it('leaves a marker that runs across blocks as written', () => {
        const html = '<p>Intro [NEEDS CLARIFICATION: first</p><p>second] end</p>';
        expect(markClarifications(html)).toBe(html);
    });
});
