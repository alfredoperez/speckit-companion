/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import { render } from 'preact';
import { buildBugStory } from '../../../../../src/features/reports/bugStory';
import type { BugStory } from '../../../../../src/features/reports/reportPageModel';
import { BugStoryPage } from '../BugStoryPage';

const FIXTURES = path.resolve(__dirname, '../../../../../tests/fixtures');
const CART = path.join(FIXTURES, 'bug-reports/.specify/bugs/cart-total-skips-first');
const SLUG = path.join(FIXTURES, 'bug-reports/.specify/bugs/slug-keeps-spaces');
const DISCOUNT = path.join(FIXTURES, 'report-pages/.specify/bugs/discount-applied-twice');
const EXPORT = path.join(FIXTURES, 'report-pages/.specify/bugs/export-drops-header');

function read(dir: string, name: string): string | undefined {
    const file = path.join(dir, name);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
}

function storyOf(dir: string, nextAction?: string): BugStory {
    const story = buildBugStory(
        { assessment: read(dir, 'assessment.md'), fix: read(dir, 'fix.md'), test: read(dir, 'test.md') },
        nextAction
    );
    if (!story) throw new Error(`no story for ${dir}`);
    return story;
}

function renderPage(story: BugStory): HTMLDivElement {
    const container = document.createElement('div');
    render(<BugStoryPage story={story} />, container);
    return container;
}

function texts(container: Element, selector: string): (string | null)[] {
    return Array.from(container.querySelectorAll(selector)).map(node => node.textContent);
}

const bare: BugStory = {
    lead: 'assessed',
    meta: {},
    steps: [
        { id: 'wrong', state: 'done', body: 'It broke.' },
        { id: 'changed', state: 'next' },
        { id: 'verified', state: 'next' },
    ],
    risks: [],
};

describe('BugStoryPage', () => {
    describe('lead and meta', () => {
        it.each([
            ['assessed', 'Assessed, not fixed yet.'],
            ['fixed-untested', 'Fixed, not tested yet.'],
            ['verified', 'Fixed and verified.'],
            ['test-failed', 'The fix did not hold.'],
            ['test-unclear', 'Tested, result unclear.'],
            ['closed', 'Closed without a fix.'],
        ] as const)('says the %s lead in bold', (lead, sentence) => {
            const container = renderPage({ ...bare, lead });
            expect(container.querySelector('p.rp-lead > strong')?.textContent).toBe(sentence);
            expect(container.querySelector('h1')).toBeNull();
        });

        it('joins the facts present on one line', () => {
            const container = renderPage({
                ...bare,
                meta: { reported: 'Oct 1, 2026', source: 'support ticket', verdict: 'valid', severity: 'high', fixStatus: 'applied' },
            });
            expect(texts(container, 'p.rp-meta')).toEqual([
                'Reported Oct 1, 2026 from support ticket · valid · high severity · fix applied',
            ]);
        });

        it('shows only the facts it was given', () => {
            expect(renderPage({ ...bare, meta: { severity: 'low' } }).querySelector('.rp-meta')?.textContent).toBe('low severity');
            expect(renderPage({ ...bare, meta: { source: 'a call' } }).querySelector('.rp-meta')?.textContent).toBe(
                'Reported from a call'
            );
        });

        it('renders no meta line without a fact', () => {
            expect(renderPage(bare).querySelector('.rp-meta')).toBeNull();
        });

        it('shows a hostile source as text', () => {
            const container = renderPage({ ...bare, meta: { source: '<img src=x onerror=1>' } });
            expect(container.querySelector('img')).toBeNull();
            expect(container.querySelector('.rp-meta')?.textContent).toContain('<img src=x onerror=1>');
        });
    });

    describe('steps', () => {
        it('renders three done steps for a verified bug', () => {
            const container = renderPage(storyOf(CART));
            const steps = Array.from(container.querySelectorAll('ol.rp-line > li.rp-step'));
            expect(steps.map(step => step.className)).toEqual([
                'rp-step rp-step--done',
                'rp-step rp-step--done',
                'rp-step rp-step--done',
            ]);
            expect(texts(container, '.rp-step > h2')).toEqual(['What was wrong', 'What changed', 'How it was verified']);
            expect(texts(container, '.rp-step__when')).toEqual(['Assess · Oct 1, 2026', 'Fix · Oct 1, 2026', 'Test · Oct 1, 2026']);
            expect(container.querySelector('.rp-next')).toBeNull();
        });

        it('marks the steps without a report as next', () => {
            const container = renderPage(storyOf(SLUG));
            expect(texts(container, '.rp-step').length).toBe(3);
            expect(Array.from(container.querySelectorAll('.rp-step')).map(step => step.classList.contains('rp-step--next'))).toEqual([
                false,
                true,
                true,
            ]);
            expect(texts(container, '.rp-step__when')).toEqual(['Assess · Oct 1, 2026']);
        });

        it('gives every step a hidden mark and a state a screen reader can read', () => {
            const container = renderPage(storyOf(SLUG));
            const marks = Array.from(container.querySelectorAll('.rp-step > .rp-step__mark'));
            expect(marks).toHaveLength(3);
            expect(marks.every(mark => mark.getAttribute('aria-hidden') === 'true')).toBe(true);
            expect(texts(container, '.rp-step > .sr-only')).toEqual(['Done:', 'Next:', 'Next:']);
            expect(container.querySelector('[hidden]')).toBeNull();
        });

        it('renders the fixed heading ids in order', () => {
            const container = renderPage(storyOf(CART));
            expect(Array.from(container.querySelectorAll('h2[id]')).map(h => h.id)).toEqual([
                'what-was-wrong',
                'what-changed',
                'how-it-was-verified',
                'risks-and-open-questions',
            ]);
        });

        it('shows only the first step for a closed bug', () => {
            const container = renderPage(storyOf(EXPORT, 'Fix bug'));
            expect(container.querySelector('.rp-lead')?.textContent).toBe('Closed without a fix.');
            expect(texts(container, '.rp-step > h2')).toEqual(['What was wrong']);
            expect(container.querySelector('.rp-next')).toBeNull();
        });

        it('lists the changed files and the diffs', () => {
            const container = renderPage(storyOf(CART));
            const changed = container.querySelectorAll('.rp-step')[1];
            const rows = Array.from(changed.querySelectorAll('ul.rp-rows > li'));
            expect(rows).toHaveLength(2);
            expect(Array.from(rows[0].children).map(cell => cell.textContent)).toEqual([
                'src/cart.js',
                'modified',
                'Loop start let i = 1 → let i = 0 (line 3)',
            ]);
            expect(rows[0].children[0].tagName).toBe('CODE');
            expect(changed.querySelector('.rp-rows button')).toBeNull();
            const blocks = changed.querySelectorAll('pre.code-block');
            expect(blocks).toHaveLength(2);
            expect(blocks[0].getAttribute('data-language')).toBe('diff');
            expect(blocks[0].querySelector('code.language-diff')?.textContent).toContain('+  for (let i = 0;');
        });

        it('escapes diff code and keeps its language inside the attribute', () => {
            const container = renderPage({
                ...bare,
                steps: [
                    bare.steps[0],
                    { id: 'changed', state: 'done', diffs: [{ language: '"><img src=x>', code: '+ <script>alert(1)</script>' }] },
                    bare.steps[2],
                ],
            });
            expect(container.querySelector('script, img')).toBeNull();
            const pre = container.querySelector('pre.code-block');
            expect(pre?.getAttribute('data-language')).toBe('"><img src=x>');
            expect(pre?.querySelector('code')?.textContent).toBe('+ <script>alert(1)</script>');
        });

        it('shows a hostile file path as text', () => {
            const container = renderPage({
                ...bare,
                steps: [bare.steps[0], { id: 'changed', state: 'done', files: [{ path: '<img src=x onerror=1>' }] }, bare.steps[2]],
            });
            expect(container.querySelector('img')).toBeNull();
            expect(container.querySelector('.rp-rows > li')?.textContent).toBe('<img src=x onerror=1>');
        });

        it('lists each check with its result word and note', () => {
            const container = renderPage(storyOf(DISCOUNT));
            const rows = Array.from(container.querySelectorAll('.rp-step')[2].querySelectorAll('ul.rp-rows > li'));
            expect(rows.map(row => row.children[0].textContent)).toEqual([
                'Reproduction (post-fix)',
                'Fixed-amount code',
                'Lint / type-check',
            ]);
            expect(rows.map(row => row.children[1].textContent)).toEqual(['pass', 'fail', 'not run']);
            expect(rows[2].children[2].textContent).toBe('No linter and no TypeScript config in the project');
        });

        it('keeps a note in the third column when the result is absent', () => {
            const container = renderPage({
                ...bare,
                steps: [bare.steps[0], bare.steps[1], { id: 'verified', state: 'done', checks: [{ name: 'Lint', note: 'skipped' }, { name: 'Types' }] }],
            });
            const rows = container.querySelectorAll('ul.rp-rows > li');
            expect(Array.from(rows[0].children).map(cell => cell.textContent)).toEqual(['Lint', '', 'skipped']);
            expect(rows[1].children).toHaveLength(1);
        });
    });

    describe('next sentence', () => {
        it('says what has not happened yet, without naming a button it was not given', () => {
            const container = renderPage(storyOf(SLUG));
            expect(texts(container, 'p.rp-next')).toEqual(['It has not been fixed yet.', 'It has not been verified yet.']);
            expect(container.querySelector('.rp-next strong')).toBeNull();
        });

        it('names the button once, on the first step that is next', () => {
            const container = renderPage(storyOf(SLUG, 'Fix bug'));
            const next = container.querySelectorAll('p.rp-next');
            expect(next[0].textContent).toMatch(/^It has not been fixed yet\. Fix bug /);
            expect(texts(container, '.rp-next strong')).toEqual(['Fix bug']);
            expect(next[1].textContent).toBe('It has not been verified yet.');
        });

        it('names the test button on the verified step of a fixed bug', () => {
            const story = buildBugStory({ assessment: read(CART, 'assessment.md'), fix: read(CART, 'fix.md') }, 'Test fix');
            const container = renderPage(story as BugStory);
            const next = container.querySelectorAll('p.rp-next');
            expect(next).toHaveLength(1);
            expect(next[0].closest('.rp-step')?.querySelector('h2')?.id).toBe('how-it-was-verified');
            expect(next[0].querySelector('strong')?.textContent).toBe('Test fix');
        });

        it('shows the content of a fix that was not applied instead of the sentence', () => {
            const fix = read(CART, 'fix.md')?.replace('**Status**: applied', '**Status**: not-applied');
            const story = buildBugStory({ assessment: read(CART, 'assessment.md'), fix }, 'Fix bug') as BugStory;
            const container = renderPage(story);
            const changed = container.querySelectorAll('.rp-step')[1];
            expect(changed.className).toBe('rp-step rp-step--next');
            expect(changed.querySelector('.rp-next')).toBeNull();
            expect(changed.querySelectorAll('ul.rp-rows > li')).toHaveLength(2);
            expect(container.querySelector('.rp-next strong')).toBeNull();
            expect(texts(container, 'p.rp-next')).toEqual(['It has not been verified yet.']);
        });
    });

    describe('risks', () => {
        it('lists the risks under their heading', () => {
            const container = renderPage(storyOf(CART));
            const heading = container.querySelector('#risks-and-open-questions');
            expect(heading?.tagName).toBe('H2');
            expect(heading?.textContent).toBe('Risks and open questions');
            const list = heading?.nextElementSibling;
            expect(list?.tagName).toBe('UL');
            expect(list?.className).toBe('');
            expect(list?.children).toHaveLength(3);
            expect(list?.querySelector('code')?.textContent).toBe('price');
        });

        it('renders no heading without risks', () => {
            const container = renderPage(bare);
            expect(container.querySelector('#risks-and-open-questions')).toBeNull();
            expect(container.textContent).not.toContain('Risks and open questions');
        });

        it('shows hostile risk text as text', () => {
            const container = renderPage({ ...bare, risks: ['<img src=x onerror=1> and `code`'] });
            expect(container.querySelector('img')).toBeNull();
            expect(container.querySelector('#risks-and-open-questions + ul code')?.textContent).toBe('code');
        });
    });

    describe('repetition', () => {
        it.each([
            ['verified', CART],
            ['assessed', SLUG],
            ['failed', DISCOUNT],
            ['closed', EXPORT],
        ])('says no long sentence twice on the %s story', (_name, dir) => {
            const container = renderPage(storyOf(dir, 'Fix bug'));
            const blocks = Array.from(container.querySelectorAll('p, li:not(.rp-step), h2')).filter(
                node => !node.querySelector('p, li, h2')
            );
            const sentences = blocks
                .flatMap(node => (node.textContent ?? '').split(/(?<=[.!?])\s+/))
                .map(sentence => sentence.trim().toLowerCase())
                .filter(sentence => sentence.length > 30);
            expect(sentences.length).toBeGreaterThan(3);
            const repeated = sentences.filter((sentence, index) => sentences.indexOf(sentence) !== index);
            expect(repeated).toEqual([]);
        });
    });
});
