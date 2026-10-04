import * as fs from 'fs';
import * as path from 'path';
import { buildBugStory } from '../bugStory';

const FIXTURES = path.resolve(__dirname, '../../../../tests/fixtures');
const CART = path.join(FIXTURES, 'bug-reports/.specify/bugs/cart-total-skips-first');
const SLUG = path.join(FIXTURES, 'bug-reports/.specify/bugs/slug-keeps-spaces');
const DISCOUNT = path.join(FIXTURES, 'report-pages/.specify/bugs/discount-applied-twice');
const EXPORT = path.join(FIXTURES, 'report-pages/.specify/bugs/export-drops-header');

function read(dir: string, name: string): string {
    return fs.readFileSync(path.join(dir, name), 'utf8');
}

function texts(dir: string) {
    return { assessment: read(dir, 'assessment.md'), fix: read(dir, 'fix.md'), test: read(dir, 'test.md') };
}

describe('buildBugStory', () => {
    describe('lead', () => {
        it('is closed for an invalid verdict, whatever else exists', () => {
            expect(buildBugStory({ assessment: read(EXPORT, 'assessment.md') })?.lead).toBe('closed');
            const cart = texts(CART);
            const invalid = cart.assessment.replace('**Verdict**: valid', '**Verdict**: invalid');
            expect(buildBugStory({ ...cart, assessment: invalid })?.lead).toBe('closed');
        });

        it('is verified when the test report says verified', () => {
            expect(buildBugStory(texts(CART))?.lead).toBe('verified');
        });

        it('is fixed-untested when a fix exists and no test does', () => {
            const { assessment, fix } = texts(CART);
            expect(buildBugStory({ assessment, fix })?.lead).toBe('fixed-untested');
        });

        it('is test-failed when the test report says failed or partial', () => {
            const discount = texts(DISCOUNT);
            expect(buildBugStory(discount)?.lead).toBe('test-failed');
            const partial = discount.test.replace('**Result**: failed', '**Result**: partial');
            expect(buildBugStory({ ...discount, test: partial })?.lead).toBe('test-failed');
        });

        it('is test-unclear when the test result is not recognised', () => {
            const cart = texts(CART);
            const unclear = cart.test.replace('**Result**: verified', '**Result**: verified | partial | failed');
            const story = buildBugStory({ ...cart, test: unclear });
            expect(story?.lead).toBe('test-unclear');
            expect(story?.steps[2].state).toBe('done');
        });

        it('is assessed when only the assessment exists', () => {
            expect(buildBugStory({ assessment: read(SLUG, 'assessment.md') })?.lead).toBe('assessed');
        });

        it('is assessed for a fix that was not applied, keeping the fix content on a next step', () => {
            const { assessment, fix } = texts(CART);
            const story = buildBugStory({ assessment, fix: fix.replace('**Status**: applied', '**Status**: not-applied') });
            expect(story?.lead).toBe('assessed');
            const changed = story?.steps[1];
            expect(changed?.state).toBe('next');
            expect(changed?.body).toContain('start at index 0');
            expect(changed?.files).toHaveLength(2);
            expect(changed?.diffs).toHaveLength(2);
        });
    });

    describe('meta', () => {
        it('formats the reported date and keeps the source', () => {
            const meta = buildBugStory(texts(CART))?.meta;
            expect(meta).toEqual({
                reported: 'Oct 1, 2026',
                source: 'pasted text',
                verdict: 'valid',
                severity: 'high',
                fixStatus: 'applied',
            });
        });

        it('leaves out the verdict when the badge shows it', () => {
            const meta = buildBugStory({ assessment: read(SLUG, 'assessment.md') })?.meta;
            expect(meta).toEqual({ reported: 'Oct 1, 2026', source: 'pasted text', severity: 'medium' });
            expect(meta && 'verdict' in meta).toBe(false);
        });

        it('leaves out the fix status when the badge shows it', () => {
            const { assessment, fix } = texts(CART);
            const meta = buildBugStory({ assessment, fix })?.meta;
            expect(meta?.verdict).toBe('valid');
            expect(meta && 'fixStatus' in meta).toBe(false);
        });

        it('drops unknown values, placeholders and an unparseable date', () => {
            const cart = texts(CART);
            const assessment = cart.assessment
                .replace('**Created**: 2026-10-01', '**Created**: [DATE]')
                .replace('**Source**: pasted text', '**Source**: [NEEDS CLARIFICATION: where did this come from?]')
                .replace('**Verdict**: valid', '**Verdict**: valid | likely valid, needs reproduction | invalid')
                .replace('**Severity**: high', '**Severity**: catastrophic');
            const fix = cart.fix.replace('**Status**: applied', '**Status**: shipped');
            expect(buildBugStory({ ...cart, assessment, fix })?.meta).toEqual({});
        });

        it('drops a hostile verdict', () => {
            const cart = texts(CART);
            const assessment = cart.assessment.replace('**Verdict**: valid', '**Verdict**: <img src=x onerror=1>');
            const story = buildBugStory({ ...cart, assessment });
            expect(story?.meta.verdict).toBeUndefined();
            expect(JSON.stringify(story?.meta)).not.toContain('<img');
        });
    });

    describe('steps', () => {
        it('always returns the three steps in order', () => {
            const story = buildBugStory({ assessment: read(SLUG, 'assessment.md') });
            expect(story?.steps.map(step => [step.id, step.state])).toEqual([
                ['wrong', 'done'],
                ['changed', 'next'],
                ['verified', 'next'],
            ]);
            expect(story?.steps[1]).toEqual({ id: 'changed', state: 'next' });
            expect(story?.steps[2]).toEqual({ id: 'verified', state: 'next' });
        });

        it('joins the symptom and the root cause for what was wrong', () => {
            const wrong = buildBugStory(texts(CART))?.steps[0];
            expect(wrong?.when).toBe('Oct 1, 2026');
            const [symptom, cause, ...rest] = (wrong?.body ?? '').split('\n\n');
            expect(symptom).toMatch(/^`cartTotal` leaves out the first item/);
            expect(cause).toMatch(/^Off-by-one in the loop start index/);
            expect(rest).toEqual([]);
        });

        it('reads the summary, the changed files and every diff for what changed', () => {
            const changed = buildBugStory(texts(CART))?.steps[1];
            expect(changed?.state).toBe('done');
            expect(changed?.when).toBe('Oct 1, 2026');
            expect(changed?.body).toMatch(/^Changed the loop in `cartTotal`/);
            expect(changed?.files).toEqual([
                { path: '`src/cart.js`', change: 'modified', note: 'Loop start `let i = 1` → `let i = 0` (line 3)' },
                {
                    path: '`src/cart.test.js`',
                    change: 'added tests',
                    note: 'Single-item and reported two-item cases; empty-cart test kept',
                },
            ]);
            expect(changed?.diffs?.map(diff => diff.language)).toEqual(['diff', 'diff']);
            expect(changed?.diffs?.[0].code).toBe(
                '-  for (let i = 1; i < items.length; i++) {\n+  for (let i = 0; i < items.length; i++) {'
            );
        });

        it('reads the changed files by header name when the columns are reordered', () => {
            const cart = texts(CART);
            const fix = cart.fix.replace(
                /\| File \| Change \| Notes \|[\s\S]*?\n\n/,
                '| Notes | File | Change |\n|---|---|---|\n| why | `a.js` | modified |\n|  | `b.js` |  |\n| orphan |  | added |\n\n'
            );
            expect(buildBugStory({ ...cart, fix })?.steps[1].files).toEqual([
                { path: '`a.js`', change: 'modified', note: 'why' },
                { path: '`b.js`' },
            ]);
        });

        it('reads the summary and the checks for how it was verified', () => {
            const verified = buildBugStory(texts(DISCOUNT))?.steps[2];
            expect(verified?.state).toBe('done');
            expect(verified?.when).toBe('Oct 2, 2026');
            expect(verified?.body).toMatch(/^The reported percent-code case is fixed/);
            expect(verified?.checks?.map(check => [check.name, check.result])).toEqual([
                ['Reproduction (post-fix)', 'pass'],
                ['Fixed-amount code', 'fail'],
                ['Lint / type-check', 'not-run'],
            ]);
            expect(verified?.checks?.[2].note).toBe('No linter and no TypeScript config in the project');
        });

        it('leaves an unrecognised check result out', () => {
            const discount = texts(DISCOUNT);
            const test = discount.test.replace('| fail |', '| <b>exploded</b> |');
            const check = buildBugStory({ ...discount, test })?.steps[2].checks?.[1];
            expect(check?.name).toBe('Fixed-amount code');
            expect(check && 'result' in check).toBe(false);
        });

        it('leaves a missing section out instead of emptying it', () => {
            const cart = texts(CART);
            const fix = cart.fix.replace(/## Changes[\s\S]*?(?=## Tests Added)/, '');
            const test = cart.test.replace(/## Summary[\s\S]*?(?=## Checks Performed)/, '').replace('**Tested**: 2026-10-01', '**Tested**: soon');
            const story = buildBugStory({ ...cart, fix, test });
            const changed = story?.steps[1];
            expect(changed?.body).toBeDefined();
            expect(changed && 'files' in changed).toBe(false);
            expect(changed && 'diffs' in changed).toBe(false);
            const verified = story?.steps[2];
            expect(verified && 'body' in verified).toBe(false);
            expect(verified && 'when' in verified).toBe(false);
            expect(verified?.checks).toHaveLength(5);
        });

        it('keeps one half of what was wrong when the other section is missing', () => {
            const assessment = read(SLUG, 'assessment.md').replace(/## Symptom[\s\S]*?(?=## Reproduction)/, '');
            expect(buildBugStory({ assessment })?.steps[0].body).toMatch(/^`replace` receives a string literal/);
        });
    });

    describe('risks', () => {
        it('lists the assessment risks then its open questions before the bug is tested', () => {
            const { test: _test, ...untested } = texts(CART);
            const risks = buildBugStory(untested)?.risks ?? [];
            expect(risks).toHaveLength(3);
            expect(risks[0]).toMatch(/^Any downstream code/);
            expect(risks[2]).toBe(
                'Did wrong totals reach users or orders in production, and does anything need correcting after the fix?'
            );
            expect(risks.join('\n')).not.toContain('NEEDS CLARIFICATION');
        });

        it('lists only what the test report says is left once the bug is tested', () => {
            const risks = buildBugStory(texts(CART))?.risks ?? [];
            expect(risks).toHaveLength(3);
            expect(risks[0]).toMatch(/^The production impact is still unknown/);
        });

        it('leaves fix follow-ups out', () => {
            const risks = buildBugStory(texts(CART))?.risks ?? [];
            expect(risks.some(risk => risk.startsWith('Open question from the assessment'))).toBe(false);
        });

        it('drops items that only say there is nothing, and exact duplicates', () => {
            const cart = texts(CART);
            const assessment = cart.assessment.replace(
                /## Risks & Considerations[\s\S]*$/,
                '## Risks & Considerations\n\n- None.\n- Totals are stored.\n\n## Open Questions\n\n- N/A\n- totals are stored.  \n'
            );
            const test = cart.test.replace(
                /## Residual Risks[\s\S]*?(?=## Recommendation)/,
                '## Residual Risks\n\n- None identified.\n- [NEEDS CLARIFICATION: Totals are stored.]\n- No lint exists.\n\n'
            );
            expect(buildBugStory({ ...cart, assessment, test })?.risks).toEqual(['Totals are stored.', 'No lint exists.']);
        });

        it('is empty when no section lists a risk', () => {
            const assessment = read(SLUG, 'assessment.md').replace(/## Risks & Considerations[\s\S]*$/, '');
            expect(buildBugStory({ assessment })?.risks).toEqual([]);
        });
    });

    describe('next action', () => {
        it('carries the label it was given', () => {
            expect(buildBugStory({ assessment: read(SLUG, 'assessment.md') }, 'Fix bug')?.nextAction).toBe('Fix bug');
        });

        it('is absent when none was given', () => {
            const story = buildBugStory({ assessment: read(SLUG, 'assessment.md') });
            expect(story && 'nextAction' in story).toBe(false);
        });
    });

    describe('no story', () => {
        it('returns undefined without an assessment', () => {
            const { fix, test } = texts(CART);
            expect(buildBugStory({ fix, test })).toBeUndefined();
            expect(buildBugStory({})).toBeUndefined();
        });

        it('returns undefined when the assessment has none of the sections', () => {
            expect(buildBugStory({ assessment: '# Bug Assessment: x\n\n- **Verdict**: valid\n\n## Notes\n\nSomething.' })).toBeUndefined();
            expect(buildBugStory({ assessment: '' })).toBeUndefined();
        });

        it('ignores a section heading inside a code fence', () => {
            expect(buildBugStory({ assessment: '# Bug\n\n```md\n## Symptom\n\nNot a section.\n```\n' })).toBeUndefined();
        });

        it('never throws on malformed input', () => {
            const hostile = [undefined, null, 42, {}, { assessment: 42 }, { assessment: '## Symptom\n\n|||\n|-|\n```' }];
            for (const input of hostile) {
                expect(() => buildBugStory(input as never)).not.toThrow();
            }
        });
    });
});
