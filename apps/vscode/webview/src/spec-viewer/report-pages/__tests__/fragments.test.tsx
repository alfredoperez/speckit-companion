/**
 * @jest-environment jsdom
 */

import { render } from 'preact';
import { Inline, Prose } from '../fragments';

function renderProse(md: string): HTMLDivElement {
    const container = document.createElement('div');
    render(<Prose md={md} />, container);
    return container;
}

describe('Prose', () => {
    it('renders each blank-line separated block as a paragraph', () => {
        const container = renderProse('First line\nstill first.\n\nSecond paragraph.');
        const paragraphs = Array.from(container.querySelectorAll('p')).map(p => p.textContent);
        expect(paragraphs).toEqual(['First line still first.', 'Second paragraph.']);
    });

    it('gathers list items into one list', () => {
        const container = renderProse('Steps:\n\n- one\n* two\n\n1. first\n2. second');
        expect(container.querySelectorAll('ul')).toHaveLength(1);
        expect(Array.from(container.querySelectorAll('ul > li')).map(li => li.textContent)).toEqual(['one', 'two']);
        expect(Array.from(container.querySelectorAll('ol > li')).map(li => li.textContent)).toEqual(['first', 'second']);
    });

    it('renders a blockquote line as a paragraph', () => {
        const container = renderProse('> quoted text');
        expect(container.querySelector('blockquote')).toBeNull();
        expect(container.querySelector('p')?.textContent).toBe('quoted text');
    });

    it('renders a fenced diff as the viewer code block with its text escaped', () => {
        const container = renderProse('```diff\n- if (a < b) {\n+ if (a <= b) { <script>x</script>\n```');
        const pre = container.querySelector('pre.code-block');
        expect(pre?.getAttribute('data-language')).toBe('diff');
        const code = pre?.querySelector('code');
        expect(code?.className).toBe('language-diff');
        expect(code?.textContent).toBe('- if (a < b) {\n+ if (a <= b) { <script>x</script>');
        expect(code?.innerHTML).toContain('&lt;script&gt;');
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('li')).toBeNull();
    });

    it('keeps a fence language from breaking out of its attribute', () => {
        const container = renderProse('```"><img/src=x>\ncode\n```');
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('pre.code-block')?.getAttribute('data-language')).toBe('"><img/src=x>');
    });

    it('renders a fence without a language with no language attributes', () => {
        const pre = renderProse('```\nplain\n```').querySelector('pre.code-block');
        expect(pre?.hasAttribute('data-language')).toBe(false);
        expect(pre?.querySelector('code')?.hasAttribute('class')).toBe(false);
    });

    it('renders a heading as a bold paragraph without an id', () => {
        const container = renderProse('## Root cause\n\nBody.');
        expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
        expect(container.querySelector('[id]')).toBeNull();
        expect(container.querySelector('p > strong')?.textContent).toBe('Root cause');
    });

    it('emits no line wrappers or comment controls', () => {
        const container = renderProse('A paragraph.\n\n- item');
        expect(container.querySelector('.line, button')).toBeNull();
    });

    it('renders nothing for empty input', () => {
        expect(renderProse('').innerHTML).toBe('');
        expect(renderProse('  \n\n ').innerHTML).toBe('');
    });

    it('renders inline code and bold', () => {
        const container = renderProse('Call `run()` with **care**.');
        expect(container.querySelector('p > code')?.textContent).toBe('run()');
        expect(container.querySelector('p > strong')?.textContent).toBe('care');
    });
});

describe('Inline', () => {
    it('renders inline markdown inside a span', () => {
        const container = document.createElement('div');
        render(<Inline md="Uses `x` and **y** <b>" />, container);
        const span = container.querySelector('span');
        expect(span?.querySelector('code')?.textContent).toBe('x');
        expect(span?.querySelector('strong')?.textContent).toBe('y');
        expect(span?.querySelector('b')).toBeNull();
        expect(span?.textContent).toBe('Uses x and y <b>');
    });
});
