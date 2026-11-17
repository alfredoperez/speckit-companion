/**
 * @jest-environment jsdom
 */

import { applyHighlighting } from '../highlighting';

describe('bundled highlighting', () => {
    it('colours TypeScript and Python code with no highlighter loaded on the page', () => {
        expect((globalThis as { hljs?: unknown }).hljs).toBeUndefined();
        document.body.innerHTML = `
            <pre class="code-block"><code class="language-typescript">const x: number = 1;</code></pre>
            <pre class="code-block"><code class="language-python">def f():\n    return None</code></pre>`;

        applyHighlighting();

        const [ts, py] = Array.from(document.querySelectorAll('code'));
        expect(ts!.classList.contains('hljs')).toBe(true);
        expect(ts!.querySelector('.hljs-keyword')?.textContent).toBe('const');
        expect(py!.querySelector('.hljs-keyword')?.textContent).toBe('def');
    });
});
