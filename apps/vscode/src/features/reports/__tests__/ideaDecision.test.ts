import * as fs from 'fs';
import * as path from 'path';
import { buildIdeaDecision } from '../ideaDecision';

const FIXTURES = path.resolve(__dirname, '../../../../tests/fixtures');

function fixture(set: string, slug: string): string {
    return fs.readFileSync(path.join(FIXTURES, set, '.specify/assessments', slug, 'decision.md'), 'utf8');
}

function decision(verdict: string, body: string): string {
    return `# Decision: Sample\n\n- **Slug**: sample\n- **Verdict**: ${verdict}\n\n${body}\n`;
}

function scorecard(...rows: string[]): string {
    return ['## Scorecard', '', '| Criterion | Rating | Justification |', '|---|---|---|', ...rows].join('\n');
}

describe('buildIdeaDecision', () => {
    describe('a go decision', () => {
        const built = buildIdeaDecision(fixture('report-pages', 'saved-filters'));

        it('reads the verdict', () => {
            expect(built?.verdict).toBe('go');
        });

        it('leads with the first sentence of the rationale and says the verdict once', () => {
            expect(built?.lead).toBe(
                'The problem is confirmed by the people who have it, and the recommended option is small because the storage it needs already exists.'
            );
            expect(built?.lead).not.toContain('Go.');
            expect(built?.rationale).not.toContain('**Go.**');
        });

        it('keeps the rest of the rationale, without the lead', () => {
            expect(built?.rationale?.startsWith('No criterion is rated `weak` or `unknown`')).toBe(true);
            expect(built?.rationale).toContain('\n\nOption C is deliberately left out.');
            expect(built?.rationale).not.toContain('The problem is confirmed');
        });

        it('reads every scorecard row with its rating and tone', () => {
            expect(built?.scorecard.map(row => [row.criterion, row.rating, row.tone])).toEqual([
                ['Problem validity', 'strong', 'favourable'],
                ['Evidence strength', 'adequate', 'mixed'],
                ['Value vs. inaction', 'adequate', 'mixed'],
                ['Feasibility / appetite', 'strong', 'favourable'],
                ['Strategic fit', 'strong', 'favourable'],
                ['Risk posture', 'adequate', 'mixed'],
            ]);
            expect(built?.scorecard[3].reason).toContain('`src/prefs.js`');
        });

        it('closes with the handoff fields in document order', () => {
            expect(built?.closing?.verdict).toBe('go');
            const fields = built?.closing?.verdict === 'go' ? built.closing.fields : [];
            expect(fields.map(field => field.term)).toEqual([
                'Problem',
                'Chosen approach',
                'In scope / out of scope',
                'Success metrics',
                'Carried-forward open questions',
            ]);
            expect(fields[0].text.startsWith('People who work the orders list')).toBe(true);
        });
    });

    describe('a needs-clarification decision', () => {
        const built = buildIdeaDecision(fixture('report-pages', 'bulk-archive'));

        it('leads with the first rationale sentence', () => {
            expect(built?.verdict).toBe('needs-clarification');
            expect(built?.lead).toBe(
                'The idea names a solution, bulk archive, for a symptom, a slow list, that the research traces to a different likely cause.'
            );
            expect(built?.rationale).not.toContain('Needs clarification.');
        });

        it('gives weak an unfavourable tone and unknown no tone', () => {
            const byName = new Map(built?.scorecard.map(row => [row.criterion, row]));
            expect(byName.get('Evidence strength')).toMatchObject({ rating: 'weak', tone: 'unfavourable' });
            expect(byName.get('Value vs. inaction')?.rating).toBe('unknown');
            expect(byName.get('Value vs. inaction')?.tone).toBeUndefined();
        });

        it('splits the blocking questions and unwraps each marker', () => {
            expect(built?.closing).toEqual({
                verdict: 'needs-clarification',
                questions: [
                    'Is the orders list slow because of the number of rows rendered or because of the query, measured on the real data?',
                    'Does the requester want old orders out of view, or only a faster page?',
                    'Must archived orders stay in the monthly export?',
                ],
                revisit: 'research',
            });
        });

        it('recognises a verdict written with capitals', () => {
            const guest = buildIdeaDecision(fixture('idea-reports', 'guest-links'));
            expect(guest).toEqual({
                verdict: 'needs-clarification',
                lead: 'Who the guests are is not known yet.',
                scorecard: [],
            });
        });

        it('reads blocking questions written as a nested list', () => {
            const built = buildIdeaDecision(
                decision(
                    'needs-clarification',
                    '## Verdict & Rationale\n\nNot yet.\n\n## If needs-clarification\n\n- **Blocking questions**:\n  - Who asked?\n  - How often?\n- **Revisit stage**: shape'
                )
            );
            expect(built?.closing).toEqual({ verdict: 'needs-clarification', questions: ['Who asked?', 'How often?'], revisit: 'concept' });
        });

        it('maps the define stage to problem', () => {
            const built = buildIdeaDecision(
                decision('needs-clarification', '## Scorecard\n\n## If needs-clarification\n\n- **Blocking questions**: Who asked?\n- **Revisit stage**: define')
            );
            expect(built?.closing).toEqual({ verdict: 'needs-clarification', questions: ['Who asked?'], revisit: 'problem' });
        });

        it('drops an unfilled stage option list', () => {
            const built = buildIdeaDecision(
                decision(
                    'needs-clarification',
                    '## Scorecard\n\n## If needs-clarification\n\n- **Blocking questions**: Who asked?\n- **Revisit stage**: intake | research | define | shape'
                )
            );
            expect(built?.closing).toEqual({ verdict: 'needs-clarification', questions: ['Who asked?'] });
        });

        it('has no closing when the section holds nothing', () => {
            const built = buildIdeaDecision(
                decision('needs-clarification', '## Scorecard\n\n## If needs-clarification\n\n- **Blocking questions**:\n- **Revisit stage**: intake | research')
            );
            expect(built).toBeDefined();
            expect(built?.closing).toBeUndefined();
        });
    });

    describe('a kill decision', () => {
        const built = buildIdeaDecision(fixture('idea-reports', 'shared-lists'));

        it('strips the bold verdict opening so the verdict is said once', () => {
            expect(built?.verdict).toBe('kill');
            expect(built?.lead).toBe('The decisive reason is that no one is on record as needing this.');
            expect(`${built?.lead} ${built?.rationale}`).not.toContain('Kill, for now');
        });

        it('keeps the rest of the paragraph as the rationale', () => {
            expect(built?.rationale?.startsWith('Evidence strength is `weak`, so a `go` is not allowed.')).toBe(true);
        });

        it('closes with the revisit trigger', () => {
            expect(built?.closing?.verdict).toBe('kill');
            const trigger = built?.closing?.verdict === 'kill' ? built.closing.trigger : '';
            expect(trigger.startsWith('Reopen from `/speckit-assess-intake` if a real requester appears')).toBe(true);
        });

        it('has no closing without a revisit trigger section', () => {
            expect(buildIdeaDecision(decision('kill', '## Verdict & Rationale\n\n**Kill.** No demand.'))?.closing).toBeUndefined();
        });
    });

    describe('the scorecard', () => {
        it('is empty when the decision has none', () => {
            const built = buildIdeaDecision(fixture('idea-reports', 'member-badges'));
            expect(built).toEqual({
                verdict: 'go',
                lead: 'Three requesters, a small change, and no constitution conflict.',
                scorecard: [],
            });
        });

        it('keeps a row whose rating is outside the list, without a rating', () => {
            const built = buildIdeaDecision(decision('go', scorecard('| Fit | excellent | Matches the roadmap. |')));
            expect(built?.scorecard).toEqual([{ criterion: 'Fit', reason: 'Matches the roadmap.' }]);
        });

        it('drops a hostile rating', () => {
            const built = buildIdeaDecision(decision('go', scorecard('| Fit | <img src=x onerror=1> | Reason. |')));
            expect(built?.scorecard).toEqual([{ criterion: 'Fit', reason: 'Reason.' }]);
            expect(JSON.stringify(built?.scorecard)).not.toContain('onerror');
        });

        it('does not read an unfilled rating option list as a rating', () => {
            const built = buildIdeaDecision(decision('go', scorecard('| Fit | strong / adequate / weak | Reason. |')));
            expect(built?.scorecard[0].rating).toBeUndefined();
        });

        it('drops a row with no criterion', () => {
            const built = buildIdeaDecision(decision('go', scorecard('|  | strong | Orphan. |', '| Fit | Strong | Kept. |')));
            expect(built?.scorecard).toEqual([{ criterion: 'Fit', rating: 'strong', tone: 'favourable', reason: 'Kept.' }]);
        });

        it('reads the columns by header name', () => {
            const built = buildIdeaDecision(
                decision('go', '## Scorecard\n\n| Rating | Justification | Criterion |\n|---|---|---|\n| weak | Thin. | Evidence |')
            );
            expect(built?.scorecard).toEqual([{ criterion: 'Evidence', rating: 'weak', tone: 'unfavourable', reason: 'Thin.' }]);
        });
    });

    describe('the first sentence', () => {
        function lead(rationale: string) {
            return buildIdeaDecision(decision('go', `## Verdict & Rationale\n\n${rationale}`));
        }

        it('does not break on e.g.', () => {
            const built = lead('**Go.** Small teams, e.g. Support, need it daily. The cost is low.');
            expect(built?.lead).toBe('Small teams, e.g. Support, need it daily.');
            expect(built?.rationale).toBe('The cost is low.');
        });

        it('does not break inside a code span', () => {
            const built = lead('It reuses `prefs. Store` as is. Nothing else changes.');
            expect(built?.lead).toBe('It reuses `prefs. Store` as is.');
            expect(built?.rationale).toBe('Nothing else changes.');
        });

        it('takes the whole first paragraph when no boundary is found', () => {
            const built = lead('**Go**. one sentence only\nacross two lines\n\nSecond paragraph.');
            expect(built?.lead).toBe('one sentence only across two lines');
            expect(built?.rationale).toBe('Second paragraph.');
        });

        it('has no rationale when the lead is all there is', () => {
            const built = lead('**Go.** Just this.');
            expect(built?.lead).toBe('Just this.');
            expect(built).not.toHaveProperty('rationale');
        });

        it('has no lead when only the verdict is written', () => {
            const built = lead('**Go.**');
            expect(built).toEqual({ verdict: 'go', scorecard: [] });
        });

        it('keeps a bold opening that is not a sentence', () => {
            expect(lead('**Three requesters** asked for it. Done.')?.lead).toBe('**Three requesters** asked for it.');
        });
    });

    describe('a document it cannot use', () => {
        it('returns undefined for an unrecognised verdict', () => {
            expect(buildIdeaDecision(decision('maybe', '## Verdict & Rationale\n\nUnsure.'))).toBeUndefined();
            expect(buildIdeaDecision(decision('go | needs-clarification | kill', '## Scorecard'))).toBeUndefined();
        });

        it('returns undefined with neither a rationale nor a scorecard', () => {
            expect(buildIdeaDecision(decision('go', '## Notes\n\nSomething else.'))).toBeUndefined();
        });

        it('never throws on malformed input', () => {
            expect(buildIdeaDecision('')).toBeUndefined();
            expect(buildIdeaDecision(undefined as unknown as string)).toBeUndefined();
            expect(() => buildIdeaDecision(decision('go', '## Scorecard\n\n| Criterion |\n|---|\n| ``` |\n\n```\nunclosed'))).not.toThrow();
        });
    });
});
