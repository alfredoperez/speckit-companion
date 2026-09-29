import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../markdown.mjs';

describe('renderMarkdown', () => {
    it('escapes raw HTML from the spec', () => {
        const html = renderMarkdown('Hello <script>alert(1)</script> <img src=x onerror=alert(1)>');
        assert.ok(!html.includes('<script>'));
        assert.ok(!html.includes('<img'));
        assert.match(html, /&lt;script&gt;/);
    });

    it('renders task items as disabled checkboxes', () => {
        const html = renderMarkdown('- [x] **T001** Done thing\n- [ ] T002 Open thing');
        assert.match(html, /<li class="task done"><input type="checkbox" disabled checked/);
        assert.match(html, /<li class="task"><input type="checkbox" disabled aria-label="Not done">/);
        assert.match(html, /<strong>T001<\/strong>/);
    });

    it('keeps fenced code verbatim', () => {
        const html = renderMarkdown('```md\n- [x] T901 **not bold**\n```');
        assert.match(html, /<pre data-lang="md"><code>- \[x\] T901 \*\*not bold\*\*<\/code><\/pre>/);
    });

    it('renders tables, headings and inline code', () => {
        const html = renderMarkdown('## Plan `x`\n\n| A | B |\n|---|---|\n| 1 | `two` |');
        assert.match(html, /<h2 id="plan-x">Plan <code>x<\/code><\/h2>/);
        assert.match(html, /<th>A<\/th><th>B<\/th>/);
        assert.match(html, /<td><code>two<\/code><\/td>/);
    });

    it('opens web links safely and leaves relative links as references', () => {
        const html = renderMarkdown('[site](https://example.com) and [plan](./plan.md) and [bad](javascript:alert(1))');
        assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">site<\/a>/);
        assert.match(html, /<span class="md-ref" title=".\/plan.md">plan<\/span>/);
        assert.ok(!html.includes('href="javascript'));
    });

    it('drops front matter and HTML comments', () => {
        const html = renderMarkdown('---\ntitle: x\n---\n<!-- touches: a -->\n# Title');
        assert.equal(html, '<h1 id="title">Title</h1>');
    });

    it('nests lists by indent', () => {
        const html = renderMarkdown('- one\n  - two\n- three');
        assert.equal(html, '<ul><li>one<ul><li>two</li></ul></li><li>three</li></ul>');
    });
});
