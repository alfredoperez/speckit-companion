import * as fs from 'fs';
import * as path from 'path';
import { formatReportDate, reportHeaderFacts, withHeaderLine } from '../reportMeta';

const FIXTURES = path.resolve(__dirname, '../../../../tests/fixtures');
const CART = path.join(FIXTURES, 'bug-reports', '.specify', 'bugs', 'cart-total-skips-first');
const read = (...parts: string[]) => fs.readFileSync(path.join(...parts), 'utf-8');

describe('formatReportDate', () => {
    it('formats a day without shifting it', () => {
        expect(formatReportDate('2026-10-01')).toBe('Oct 1, 2026');
    });

    it('returns nothing for text that is not a date', () => {
        expect(formatReportDate('[NEEDS CLARIFICATION: when?]')).toBeUndefined();
        expect(formatReportDate(undefined)).toBeUndefined();
    });
});

describe('reportHeaderFacts', () => {
    it.each([
        ['assessment', ['Reported Oct 1, 2026 from pasted text', 'valid', 'high severity']],
        ['fix', ['Fixed Oct 1, 2026', 'fix applied']],
        ['test', ['Tested Oct 1, 2026', 'verified']],
    ])('reads the facts of a bug %s', (kind, facts) => {
        expect(reportHeaderFacts(kind, read(CART, `${kind}.md`))).toEqual(facts);
    });

    it('reads a decision', () => {
        const decision = read(FIXTURES, 'idea-reports', '.specify', 'assessments', 'shared-lists', 'decision.md');
        expect(reportHeaderFacts('decision', decision)[1]).toBe('kill');
    });

    it('keeps every field of another stage but the slug', () => {
        const md = '# Idea Research: x\n\n- **Slug**: x\n- **Created**: 2026-09-30\n- **Evidence confidence (overall)**: medium\n';
        expect(reportHeaderFacts('research', md)).toEqual(['Created Sep 30, 2026', 'Evidence confidence (overall): medium']);
    });

    it('leaves out a value it does not recognise, a placeholder and the slug', () => {
        const md = '# Bug Assessment: x\n\n- **Slug**: x\n- **Created**: soon\n- **Source**: [NEEDS CLARIFICATION: where?]\n- **Verdict**: <img src=x onerror=1>\n- **Severity**: low\n';
        expect(reportHeaderFacts('assessment', md)).toEqual(['low severity']);
    });
});

describe('withHeaderLine', () => {
    it('replaces the bullets under the title with one line and keeps the rest', () => {
        const out = withHeaderLine('assessment', read(CART, 'assessment.md'));
        expect(out).toContain('<p class="rp-meta">Reported Oct 1, 2026 from pasted text · valid · high severity</p>');
        expect(out).not.toContain('**Slug**');
        expect(out).toContain('## Symptom');
        expect(out.startsWith('# Bug Assessment:')).toBe(true);
    });

    it('escapes free text from the report', () => {
        const out = withHeaderLine('assessment', '# Bug Assessment: x\n\n- **Created**: 2026-10-01\n- **Source**: a <b>ticket</b> & more\n\n## Symptom\n');
        expect(out).toContain('from a &lt;b&gt;ticket&lt;/b&gt; &amp; more');
    });

    it('leaves a report alone when its bullets state nothing it recognises', () => {
        const md = '# Bug Assessment: x\n\n- **Slug**: x\n\n## Symptom\n';
        expect(withHeaderLine('assessment', md)).toBe(md);
    });

    it('leaves a report with no bullets alone', () => {
        const md = '# Idea Intake: x\n\nSome prose.\n';
        expect(withHeaderLine('intake', md)).toBe(md);
    });
});
