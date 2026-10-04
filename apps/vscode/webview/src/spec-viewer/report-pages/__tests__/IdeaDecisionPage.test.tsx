/**
 * @jest-environment jsdom
 */

import * as fs from 'fs';
import * as path from 'path';
import { render } from 'preact';
import { buildIdeaDecision } from '../../../../../src/features/reports/ideaDecision';
import type { IdeaDecision } from '../../../../../src/features/reports/reportPageModel';
import { IdeaDecisionPage } from '../IdeaDecisionPage';

const FIXTURES = path.resolve(__dirname, '../../../../../tests/fixtures');

function fixture(set: string, slug: string): IdeaDecision {
    const text = fs.readFileSync(path.join(FIXTURES, set, '.specify/assessments', slug, 'decision.md'), 'utf8');
    const decision = buildIdeaDecision(text);
    if (!decision) {
        throw new Error(`no decision built for ${slug}`);
    }
    return decision;
}

function renderPage(decision: IdeaDecision): HTMLDivElement {
    const container = document.createElement('div');
    render(<IdeaDecisionPage decision={decision} />, container);
    return container;
}

function headingIds(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('h2')).map(h => h.id);
}

describe('IdeaDecisionPage', () => {
    describe('the lead', () => {
        it('opens with the verdict sentence in bold, then the lead', () => {
            const lead = renderPage({ verdict: 'go', lead: 'It reuses `prefs.js`.', scorecard: [] }).querySelector('p.rp-lead');
            expect(lead?.querySelector('strong')?.textContent).toBe('Go.');
            expect(lead?.textContent).toBe('Go. It reuses prefs.js.');
            expect(lead?.querySelector('code, .file-ref')).not.toBeNull();
        });

        it('uses the three verdict sentences verbatim', () => {
            const sentence = (verdict: IdeaDecision['verdict']) =>
                renderPage({ verdict, scorecard: [] }).querySelector('.rp-lead')?.textContent;
            expect(sentence('go')).toBe('Go.');
            expect(sentence('needs-clarification')).toBe('Needs clarification.');
            expect(sentence('kill')).toBe('Kill.');
        });

        it('renders no title and no meta line', () => {
            const container = renderPage(fixture('report-pages', 'saved-filters'));
            expect(container.querySelector('h1, .rp-meta')).toBeNull();
        });
    });

    describe('the rationale', () => {
        it('renders the rest of the rationale as paragraphs after the lead', () => {
            const container = renderPage({ verdict: 'go', lead: 'Lead.', rationale: 'One.\n\nTwo with **bold**.', scorecard: [] });
            const paragraphs = Array.from(container.querySelectorAll('p:not(.rp-lead)')).map(p => p.textContent);
            expect(paragraphs).toEqual(['One.', 'Two with bold.']);
            expect(container.firstElementChild?.className).toBe('rp-lead');
        });
    });

    describe('the scorecard', () => {
        it('renders one row per criterion with the rating word and its tone class', () => {
            const container = renderPage(fixture('report-pages', 'bulk-archive'));
            expect(container.querySelector('h2#scorecard')?.textContent).toBe('Scorecard');
            const rows = Array.from(container.querySelectorAll('ul.rp-score > li'));
            expect(rows).toHaveLength(6);
            expect(rows[0].firstElementChild?.textContent).toBe('Problem validity');
            const ratings = rows.map(row => row.querySelector('.rp-score__rating'));
            expect(ratings.map(rating => rating?.textContent)).toEqual(['adequate', 'weak', 'unknown', 'adequate', 'adequate', 'weak']);
            expect(ratings[0]?.className).toBe('rp-score__rating rp-tone--mixed');
            expect(ratings[1]?.className).toBe('rp-score__rating rp-tone--unfavourable');
            expect(ratings[2]?.className).toBe('rp-score__rating');
            expect(rows[1].lastElementChild?.textContent).toContain('Nothing was measured.');
        });

        it('marks a strong rating as favourable', () => {
            const rating = renderPage(fixture('report-pages', 'saved-filters')).querySelector('.rp-score__rating');
            expect(rating?.textContent).toBe('strong');
            expect(rating?.classList.contains('rp-tone--favourable')).toBe(true);
        });

        it('renders a row with no rating without a rating element', () => {
            const container = renderPage({ verdict: 'go', scorecard: [{ criterion: 'Fit', reason: 'Matches <b>.' }] });
            const row = container.querySelector('ul.rp-score > li');
            expect(row?.querySelector('.rp-score__rating')).toBeNull();
            expect(row?.children).toHaveLength(2);
            expect(row?.querySelector('b')).toBeNull();
            expect(row?.textContent).toBe('FitMatches <b>.');
        });

        it('renders a row with only a criterion', () => {
            const row = renderPage({ verdict: 'go', scorecard: [{ criterion: 'Fit' }] }).querySelector('ul.rp-score > li');
            expect(row?.children).toHaveLength(1);
        });
    });

    describe('the closing section', () => {
        it('renders the handoff as a definition list for a go', () => {
            const container = renderPage(fixture('report-pages', 'saved-filters'));
            expect(headingIds(container)).toEqual(['scorecard', 'handoff']);
            expect(container.querySelector('h2#handoff')?.textContent).toBe('Handoff');
            const rows = Array.from(container.querySelectorAll('dl.rp-defs > div'));
            expect(rows.map(row => row.querySelector('dt')?.textContent)).toEqual([
                'Problem',
                'Chosen approach',
                'In scope / out of scope',
                'Success metrics',
                'Carried-forward open questions',
            ]);
            expect(rows[0].querySelector('dd > p')?.textContent).toContain('People who work the orders list');
        });

        it('renders the blocking questions and the stage to revisit for a needs-clarification', () => {
            const container = renderPage(fixture('report-pages', 'bulk-archive'));
            expect(headingIds(container)).toEqual(['scorecard', 'what-is-blocking']);
            const heading = container.querySelector('h2#what-is-blocking');
            expect(heading?.textContent).toBe('What is blocking');
            const list = heading?.nextElementSibling;
            expect(list?.tagName).toBe('UL');
            expect(list?.className).toBe('');
            expect(Array.from(list?.children ?? []).map(li => li.textContent)).toEqual([
                'Is the orders list slow because of the number of rows rendered or because of the query, measured on the real data?',
                'Does the requester want old orders out of view, or only a faster page?',
                'Must archived orders stay in the monthly export?',
            ]);
            expect(list?.nextElementSibling?.textContent).toBe('Revisit the Research stage.');
            expect(container.textContent).not.toContain('NEEDS CLARIFICATION');
        });

        it('leaves the revisit sentence out when no stage is set', () => {
            const container = renderPage({
                verdict: 'needs-clarification',
                scorecard: [],
                closing: { verdict: 'needs-clarification', questions: ['Who asked?'] },
            });
            expect(container.textContent).not.toContain('Revisit the');
            expect(container.querySelectorAll('ul > li')).toHaveLength(1);
        });

        it('renders the revisit trigger for a kill', () => {
            const container = renderPage(fixture('idea-reports', 'shared-lists'));
            expect(headingIds(container)).toEqual(['scorecard', 'revisit-trigger']);
            const heading = container.querySelector('h2#revisit-trigger');
            expect(heading?.textContent).toBe('Revisit trigger');
            expect(heading?.nextElementSibling?.textContent).toContain('Reopen from /speckit-assess-intake if a real requester appears');
            expect(container.querySelector('.rp-lead')?.textContent).toBe(
                'Kill. The decisive reason is that no one is on record as needing this.'
            );
            expect(container.textContent).not.toContain('Kill, for now');
        });
    });

    describe('a missing part', () => {
        it('renders only the lead for a decision with nothing else', () => {
            const container = renderPage(fixture('idea-reports', 'member-badges'));
            expect(container.children).toHaveLength(1);
            expect(container.querySelector('h2, ul, dl')).toBeNull();
            expect(container.textContent).toBe('Go. Three requesters, a small change, and no constitution conflict.');
        });

        it('renders no empty section for an empty closing', () => {
            const closings: IdeaDecision['closing'][] = [
                { verdict: 'go', fields: [] },
                { verdict: 'needs-clarification', questions: [] },
                { verdict: 'kill', trigger: '  ' },
            ];
            for (const closing of closings) {
                const container = renderPage({ verdict: closing!.verdict, scorecard: [], closing });
                expect(container.querySelector('h2, ul, dl')).toBeNull();
            }
        });

        it('renders the heading and the revisit sentence without an empty list', () => {
            const container = renderPage({
                verdict: 'needs-clarification',
                scorecard: [],
                closing: { verdict: 'needs-clarification', questions: [], revisit: 'problem' },
            });
            expect(container.querySelector('ul')).toBeNull();
            expect(container.querySelector('h2#what-is-blocking + p')?.textContent).toBe('Revisit the Problem stage.');
        });
    });

    describe('hostile text', () => {
        it('renders markup in report text as text', () => {
            const container = renderPage({
                verdict: 'go',
                lead: '<img src=x onerror=1>',
                scorecard: [{ criterion: '<script>x</script>', reason: '"><img src=x>' }],
                closing: { verdict: 'go', fields: [{ term: '<i>Term</i>', text: '<img src=x>' }] },
            });
            expect(container.querySelector('img, script, i')).toBeNull();
            expect(container.querySelector('dt')?.textContent).toBe('<i>Term</i>');
        });
    });

    describe('the full go fixture', () => {
        it('says no long sentence twice', () => {
            const container = renderPage(fixture('report-pages', 'saved-filters'));
            const blocks = Array.from(container.querySelectorAll('p, li > span, dt, h2')).map(el => el.textContent ?? '');
            const sentences = blocks
                .flatMap(block => block.split(/(?<=[.!?])\s+/))
                .map(sentence => sentence.trim())
                .filter(sentence => sentence.length > 30);
            expect(sentences.length).toBeGreaterThan(10);
            expect(new Set(sentences).size).toBe(sentences.length);
        });
    });
});
