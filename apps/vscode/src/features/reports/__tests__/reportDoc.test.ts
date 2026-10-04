import * as fs from 'fs';
import * as path from 'path';
import { fencedBlocks, findSection, parseFields, parseItems, parseReportDoc, parseTable, sectionProse } from '../reportDoc';

const FIXTURES = path.resolve(__dirname, '../../../../tests/fixtures');
const BUG = path.join(FIXTURES, 'bug-reports/.specify/bugs/cart-total-skips-first');
const IDEA = path.join(FIXTURES, 'idea-reports/.specify/assessments/shared-lists');

function fixture(dir: string, name: string) {
    return parseReportDoc(fs.readFileSync(path.join(dir, name), 'utf8'));
}

function body(dir: string, name: string, prefix: string): string {
    const section = findSection(fixture(dir, name), prefix);
    if (!section) {
        throw new Error(`fixture ${name} has no "${prefix}" section`);
    }
    return section.body;
}

describe('reportDoc', () => {
    describe('parseReportDoc', () => {
        it('lists the fix report sections in order', () => {
            expect(fixture(BUG, 'fix.md').sections.map((s) => s.heading)).toEqual([
                'Summary',
                'Changes',
                'Diff Highlights',
                'Tests Added or Updated',
                'Local Verification',
                'Deviations from Assessment',
                'Follow-ups',
            ]);
        });

        it('leaves the title and header bullets out of every section', () => {
            const doc = fixture(BUG, 'fix.md');
            expect(doc.sections.some((s) => s.body.includes('**Slug**'))).toBe(false);
        });

        it('does not read a heading inside a code fence', () => {
            const doc = parseReportDoc(['## Real', 'before', '```md', '## Not a heading', '# Nor this', '```', 'after', '## Next', 'x'].join('\n'));
            expect(doc.sections.map((s) => s.heading)).toEqual(['Real', 'Next']);
            expect(doc.sections[0].body).toContain('## Not a heading');
        });

        it('keeps a longer fence open across a shorter one', () => {
            const doc = parseReportDoc(['## A', '````', '```', '## Inside', '```', '````', '## B'].join('\n'));
            expect(doc.sections.map((s) => s.heading)).toEqual(['A', 'B']);
        });

        it('folds a third-level heading into its section body', () => {
            const doc = parseReportDoc(['## Parent', 'intro', '### Child', 'detail', '## Next'].join('\n'));
            expect(doc.sections.map((s) => s.heading)).toEqual(['Parent', 'Next']);
            expect(doc.sections[0].body).toBe('intro\n### Child\ndetail');
        });

        it('returns no sections for empty input', () => {
            expect(parseReportDoc('')).toEqual({ sections: [] });
        });

        it('does not throw on input that is not text', () => {
            expect(parseReportDoc(undefined as unknown as string)).toEqual({ sections: [] });
        });

        it('reads an unclosed fence to the end without throwing', () => {
            const doc = parseReportDoc('## A\n```\n## Still code');
            expect(doc.sections.map((s) => s.heading)).toEqual(['A']);
        });
    });

    describe('findSection', () => {
        it('matches a heading by prefix, whatever the case', () => {
            expect(findSection(fixture(BUG, 'fix.md'), 'diff high')?.heading).toBe('Diff Highlights');
            expect(findSection(fixture(IDEA, 'decision.md'), 'VERDICT')?.heading).toBe('Verdict & Rationale');
        });

        it('returns undefined for a missing section', () => {
            expect(findSection(fixture(BUG, 'fix.md'), 'Checks Performed')).toBeUndefined();
        });

        it('returns undefined for an empty prefix', () => {
            expect(findSection(fixture(BUG, 'fix.md'), '')).toBeUndefined();
        });
    });

    describe('parseTable', () => {
        it('reads the fix report Changes table by header', () => {
            expect(parseTable(body(BUG, 'fix.md', 'Changes'))).toEqual([
                { file: '`src/cart.js`', change: 'modified', notes: 'Loop start `let i = 1` → `let i = 0` (line 3)' },
                {
                    file: '`src/cart.test.js`',
                    change: 'added tests',
                    notes: 'Single-item and reported two-item cases; empty-cart test kept',
                },
            ]);
        });

        it('reads the test report Checks Performed table', () => {
            const rows = parseTable(body(BUG, 'test.md', 'Checks Performed'));
            expect(rows).toHaveLength(5);
            expect(rows.map((r) => r.result)).toEqual(['pass', 'pass', 'pass', 'pass', 'not-run']);
            expect(rows[0].check).toBe('Reproduction (post-fix)');
            expect(rows[0]['command / action']).toContain('cartTotal([{price:5,qty:2},{price:3,qty:1}])');
            expect(rows[4].notes).toBe('No linter, no TypeScript config, no `node_modules` in the project');
        });

        it('reads the decision Scorecard', () => {
            const rows = parseTable(body(IDEA, 'decision.md', 'Scorecard'));
            expect(rows.map((r) => [r.criterion, r.rating])).toEqual([
                ['Problem validity', 'weak'],
                ['Evidence strength', 'weak'],
                ['Value vs. inaction', 'weak'],
                ['Feasibility / appetite', 'adequate'],
                ['Strategic fit', 'weak'],
                ['Risk posture', 'adequate'],
            ]);
            expect(rows[4].justification).toContain('Principle III');
        });

        it('lands a reordered column in the right field', () => {
            const rows = parseTable('| Notes | File |\n| --- | --- |\n| why | `a.ts` |');
            expect(rows).toEqual([{ notes: 'why', file: '`a.ts`' }]);
        });

        it('keeps a pipe inside a code span or behind a backslash in its cell', () => {
            const rows = parseTable('| Check | Notes |\n|---|---|\n| `a | b` | one \\| two |');
            expect(rows).toEqual([{ check: '`a | b`', notes: 'one | two' }]);
        });

        it('fills a short row with empty cells', () => {
            expect(parseTable('| A | B |\n|---|---|\n| only |')).toEqual([{ a: 'only', b: '' }]);
        });

        it('ignores a table inside a code fence', () => {
            expect(parseTable('```\n| A |\n|---|\n| 1 |\n```')).toEqual([]);
        });

        it('returns no rows when the body has no table', () => {
            expect(parseTable(body(BUG, 'fix.md', 'Summary'))).toEqual([]);
            expect(parseTable('')).toEqual([]);
        });
    });

    describe('fencedBlocks', () => {
        it('returns the two Diff Highlights blocks in order', () => {
            const blocks = fencedBlocks(body(BUG, 'fix.md', 'Diff Highlights'));
            expect(blocks.map((b) => b.language)).toEqual(['diff', 'diff']);
            expect(blocks[0].code).toBe(
                '-  for (let i = 1; i < items.length; i++) {\n+  for (let i = 0; i < items.length; i++) {'
            );
            expect(blocks[1].code.split('\n')).toHaveLength(3);
            expect(blocks[1].code).toContain('+assert.strictEqual(cartTotal([{ price: 4, qty: 1 }]), 4);');
        });

        it('gives an empty language to a bare fence', () => {
            const blocks = fencedBlocks(body(BUG, 'test.md', 'Output Excerpts'));
            expect(blocks).toHaveLength(1);
            expect(blocks[0].language).toBe('');
            expect(blocks[0].code).toContain('13 4 0');
        });

        it('returns nothing when the body has no fence', () => {
            expect(fencedBlocks(body(BUG, 'fix.md', 'Summary'))).toEqual([]);
            expect(fencedBlocks('')).toEqual([]);
        });
    });

    describe('parseItems', () => {
        it('reads the top-level items of a list', () => {
            const items = parseItems(body(BUG, 'test.md', 'Residual Risks'));
            expect(items).toHaveLength(3);
            expect(items[0]).toMatch(/^The production impact is still unknown\./);
        });

        it('keeps nested lines with their parent', () => {
            const items = parseItems('- first\n  - nested\n  more\n- second\n\ntrailing prose');
            expect(items).toEqual(['first\n- nested\nmore', 'second']);
        });

        it('does not read a list marker inside a code fence as an item', () => {
            expect(parseItems('- one\n  ```\n  - not an item\n  ```\n- two')).toHaveLength(2);
        });

        it('returns nothing for prose', () => {
            expect(parseItems(body(BUG, 'fix.md', 'Deviations from Assessment'))).toEqual([]);
        });
    });

    describe('parseFields', () => {
        it('reads term and text from bold-led items', () => {
            const fields = parseFields('- **Next command**: `/speckit.specify`\n- **Scope:** Option B only\n- a loose item');
            expect(fields).toEqual([
                { term: 'Next command', text: '`/speckit.specify`' },
                { term: 'Scope', text: 'Option B only' },
            ]);
        });

        it('returns nothing when no item is a field', () => {
            expect(parseFields(body(BUG, 'test.md', 'Residual Risks'))).toEqual([]);
        });
    });

    describe('sectionProse', () => {
        it('drops the table and keeps nothing for a table-only section', () => {
            expect(sectionProse(body(BUG, 'fix.md', 'Changes'))).toBe('');
        });

        it('drops fenced blocks', () => {
            expect(sectionProse(body(BUG, 'fix.md', 'Diff Highlights'))).toBe('');
        });

        it('keeps the prose around a table and a fence', () => {
            const prose = sectionProse('Before.\n\n| A |\n|---|\n| 1 |\n\nMiddle.\n\n```\ncode\n```\n\nAfter.');
            expect(prose).toBe('Before.\n\nMiddle.\n\nAfter.');
        });

        it('returns a prose section unchanged', () => {
            const summary = body(BUG, 'fix.md', 'Summary');
            expect(sectionProse(summary)).toBe(summary);
        });
    });
});

describe('given a heading padded with thousands of spaces', () => {
    it('reads it in linear time', () => {
        const started = Date.now();
        const doc = parseReportDoc(`## Symptom${' '.repeat(20000)}x ##\n\nbody\n`);
        expect(Date.now() - started).toBeLessThan(500);
        expect(doc.sections[0].heading.startsWith('Symptom')).toBe(true);
    });

    it('drops closing hashes', () => {
        expect(parseReportDoc('## Symptom ##\n').sections[0].heading).toBe('Symptom');
    });
});
