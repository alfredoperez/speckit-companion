/**
 * @jest-environment jsdom
 *
 * The living-spec outline is the viewer's own table of contents, enriched.
 * These tests run the real markdown through the real renderer into a real DOM
 * and then build the real outline, because every failure this replaced lived in
 * the seam between those three and not inside any one of them.
 */

import { renderMarkdown, setLivingMode } from '../markdown/renderer';
import { setLivingCoverage } from '../markdown/livingComponents';
import { buildToc } from '../toc';

const SPEC = `## Purpose

Why this exists.

## Requirements

### Alpha behaviour
<!-- touches: src/alpha/**, src/alpha/extra.ts -->

Alpha.

### Beta behaviour

Beta, unmarked.

## Uncovered

- \`src/skimmed.ts\`

### Folded in later

Appended past the uncovered section, and still a requirement.
`;

// jsdom ships neither observer; the outline only needs them to construct.
class NoopObserver {
    observe(): void { /* nothing to watch in a static document */ }
    unobserve(): void { /* noop */ }
    disconnect(): void { /* noop */ }
    takeRecords(): [] { return []; }
}
beforeAll(() => {
    (globalThis as Record<string, unknown>).IntersectionObserver = NoopObserver;
    (globalThis as Record<string, unknown>).ResizeObserver = NoopObserver;
});

function mount(markdown: string): { toc: HTMLElement } {
    document.body.innerHTML = `
        <div id="scroll"><div id="markdown-content"></div></div>
        <aside id="toc"></aside>`;
    const scroll = document.getElementById('scroll') as HTMLElement;
    const md = document.getElementById('markdown-content') as HTMLElement;
    const toc = document.getElementById('toc') as HTMLElement;
    md.innerHTML = renderMarkdown(markdown);
    buildToc(scroll, md, toc);
    return { toc };
}

function rows(toc: HTMLElement): HTMLAnchorElement[] {
    return Array.from(
        toc.querySelectorAll<HTMLAnchorElement>('.spec-toc-link--requirement'));
}

describe('the living-spec outline (#672 Wave 1)', () => {
    beforeEach(() => setLivingMode(true));
    afterEach(() => {
        setLivingMode(false);
        setLivingCoverage(null);
    });

    it('lists every requirement, including one appended past Uncovered', () => {
        const labels = rows(mount(SPEC).toc)
            .map((a) => a.querySelector('.spec-toc-text')?.textContent);
        expect(labels).toEqual(['Alpha behaviour', 'Beta behaviour', 'Folded in later']);
    });

    it('shows requirements without waiting for the subsections toggle', () => {
        const { toc } = mount(SPEC);
        expect(toc.querySelector('.spec-toc-toggle')).toBeNull();
        expect(rows(toc)).toHaveLength(3);
    });

    it('points each row at its own card', () => {
        const { toc } = mount(SPEC);
        for (const a of rows(toc)) {
            const id = a.getAttribute('href')!.slice(1);
            expect(document.getElementById(id)).not.toBeNull();
        }
    });

    it('counts the files a marker names, and shows none when unmarked', () => {
        const counts = rows(mount(SPEC).toc)
            .map((a) => a.querySelector('.spec-toc-files')?.textContent ?? null);
        expect(counts).toEqual(['2', null, null]);
    });

    it('says coverage in words, because the dot alone is not announced', () => {
        setLivingCoverage({ 'Alpha behaviour': '3/4' });
        const [alpha, beta] = rows(mount(SPEC).toc);
        expect(alpha.getAttribute('aria-label')).toContain('covered 3/4');
        expect(alpha.querySelector('.spec-toc-cov--unknown')).toBeNull();
        expect(beta.getAttribute('aria-label')).toContain('coverage unknown');
        expect(beta.querySelector('.spec-toc-cov--unknown')).not.toBeNull();
    });

    it('keeps the full heading reachable when the row truncates', () => {
        const long = '### ' + 'A requirement with a very long heading indeed'.repeat(3);
        const { toc } = mount(`## Requirements\n\n${long}\n\nProse.\n`);
        const a = rows(toc)[0];
        expect(a.title).toBe(a.querySelector('.spec-toc-text')!.textContent);
        expect(a.title.length).toBeGreaterThan(60);
    });

    it('leaves a feature spec with the outline it always had', () => {
        setLivingMode(false);
        const { toc } = mount('## Requirements\n\n### FR-001\n\nProse.\n');
        expect(rows(toc)).toHaveLength(0);
        expect(toc.querySelector('.spec-toc-toggle')).not.toBeNull();
    });
});
