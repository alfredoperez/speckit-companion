/**
 * @jest-environment jsdom
 *
 * The living-spec outline is the viewer's own table of contents, enriched.
 * These tests run the real markdown through the real renderer into a real DOM
 * and then build the real outline, because every failure this replaced lived in
 * the seam between those three and not inside any one of them.
 */

import { renderMarkdown, setLivingMode } from '../markdown/renderer';
import { setLivingCoverage, setLivingDrifted, setLivingNew } from '../markdown/livingComponents';
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
        setLivingDrifted(null);
        setLivingNew(null);
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
            .map((a) => a.querySelector('.spec-toc-patterns')?.textContent ?? null);
        expect(counts).toEqual(['2', null, null]);
    });

    it('says known coverage in words and draws no coverage mark', () => {
        setLivingCoverage({ 'Alpha behaviour': '3/4' });
        const [alpha, beta] = rows(mount(SPEC).toc);
        expect(alpha.getAttribute('aria-label')).toContain('covered 3/4');
        expect(beta.getAttribute('aria-label') ?? '').not.toContain('coverage');
        expect(alpha.querySelector('.spec-toc-cov')).toBeNull();
        expect(beta.querySelector('.spec-toc-cov')).toBeNull();
    });

    it('keeps the full heading reachable when the row truncates', () => {
        const long = '### ' + 'A requirement with a very long heading indeed'.repeat(3);
        const { toc } = mount(`## Requirements\n\n${long}\n\nProse.\n\n### Short\n\nProse.\n`);
        const a = rows(toc)[0];
        expect(a.title).toBe(a.querySelector('.spec-toc-text')!.textContent);
        expect(a.title.length).toBeGreaterThan(60);
    });

    it('shows no rail for a capability with a single requirement', () => {
        const { toc } = mount('## Requirements\n\n### Only one\n\nProse.\n');
        expect(toc.classList.contains('spec-toc--empty')).toBe(true);
    });

    it('dots only the rows that need attention', () => {
        setLivingDrifted(['Moved']);
        setLivingNew(['Fresh', 'Moved']);
        const { toc } = mount('## Requirements\n\n### Plain\n\nProse.\n\n### Taken\n<!-- adopted: CLAUDE.md:1 -->\n\nProse.\n\n### Moved\n\nProse.\n\n### Fresh\n\nProse.\n');
        const [plain, taken, moved, fresh] = rows(toc);
        expect(plain.querySelector('.spec-toc-cov')).toBeNull();
        expect(taken.querySelector('.spec-toc-cov')!.className).toBe('spec-toc-cov spec-toc-cov--state-adopted');
        expect(moved.querySelector('.spec-toc-cov')!.className).toBe('spec-toc-cov spec-toc-cov--state-drifted');
        expect(fresh.querySelector('.spec-toc-cov')!.className).toBe('spec-toc-cov spec-toc-cov--state-new');
        expect(toc.querySelector('.spec-toc-cov--unknown')).toBeNull();
        expect(taken.getAttribute('aria-label')).toContain('adopted');
        expect(fresh.getAttribute('aria-label')).toContain('new');
    });

    it('ranks new above adopted, like the card edge', () => {
        setLivingNew(['Taken']);
        const { toc } = mount('## Requirements\n\n### Plain\n\nProse.\n\n### Taken\n<!-- adopted: CLAUDE.md:1 -->\n\nProse.\n');
        expect(rows(toc)[1].querySelector('.spec-toc-cov')!.className).toBe('spec-toc-cov spec-toc-cov--state-new');
    });

    it('cancels the heading guide on requirement rows only', () => {
        const css = require('fs').readFileSync(require('path').join(__dirname, '../../../styles/spec-viewer/_toc.css'), 'utf8') as string;
        const rule = /\.spec-toc-link--requirement\s*\{([^}]*)\}/.exec(css)![1];
        expect(rule).toContain('border-left: 0');
        expect(rule).toContain('margin-left: 0');
        expect(rule).toContain('padding-left: 8px');
        expect(css).toMatch(/\.spec-toc-link--h3\s*\{[^}]*border-left: 1px solid/);
        expect(css).not.toContain('spec-toc-cov--unknown');
    });

    it('leaves a feature spec with the outline it always had', () => {
        setLivingMode(false);
        const { toc } = mount('## Requirements\n\n### FR-001\n\nProse.\n');
        expect(rows(toc)).toHaveLength(0);
        expect(toc.querySelector('.spec-toc-toggle')).not.toBeNull();
    });
});
