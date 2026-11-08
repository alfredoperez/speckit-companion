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

        it('is test-failed when the test report says failed, and test-partial when it says partial', () => {
            const discount = texts(DISCOUNT);
            expect(buildBugStory(discount)?.lead).toBe('test-failed');
            const partial = discount.test.replace('**Result**: failed', '**Result**: partial');
            expect(buildBugStory({ ...discount, test: partial })?.lead).toBe('test-partial');
        });

        it('is test-unclear when the test result is not recognised', () => {
            const cart = texts(CART);
            const unclear = cart.test.replace('**Result**: verified', '**Result**: verified | partial | failed');
            const story = buildBugStory({ ...cart, test: unclear });
            expect(story?.lead).toBe('test-unclear');
            expect(story?.steps[2].state).toBe('next');
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
            expect(verified?.state).toBe('next');
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

    it('marks How it was verified done only when the test verified the fix', () => {
        expect(buildBugStory(texts(CART))?.steps[2].state).toBe('done');
        expect(buildBugStory(texts(DISCOUNT))?.steps[2].state).toBe('next');
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

describe('buildBugStory with a spec-kit run and report freshness', () => {
    const SEARCH = path.join(FIXTURES, 'report-pages/.specify/bugs/search-ignores-case');
    const paused = {
        runId: '3471d74b',
        workflowId: 'bugfix',
        slug: 'cart',
        status: 'paused',
        workSeconds: 108,
        pausedAt: 'review-assessment',
        steps: [
            { id: 'assess', state: 'done' as const, gate: false, seconds: 108 },
            { id: 'review-assessment', state: 'paused' as const, gate: true },
        ],
    };

    it('words the run log and the paused gate for the page', () => {
        const story = buildBugStory({ assessment: read(DISCOUNT, 'assessment.md') }, undefined, { engine: paused });
        expect(story?.lead).toBe('in-review');
        expect(story?.engine).toEqual({
            runId: '3471d74b',
            workflow: 'bugfix',
            steps: [
                { label: 'Assess', detail: '1m 48s', state: 'done' },
                { label: 'Review', detail: 'Waiting for you', state: 'waiting' },
            ],
            paused: { gate: 'review', resume: 'specify workflow resume 3471d74b' },
        });
    });

    it('leaves out the resume command when the run id is not a plain id', () => {
        const story = buildBugStory({ assessment: read(DISCOUNT, 'assessment.md') }, undefined, { engine: { ...paused, runId: 'x; echo hi' } });
        expect(story?.engine?.paused).toEqual({ gate: 'review' });
    });

    it('has no run log for a bug typed in chat, and none when the log held no steps', () => {
        expect(buildBugStory(texts(CART))?.engine).toBeUndefined();
        expect(buildBugStory(texts(CART), undefined, { engine: { ...paused, steps: [], pausedAt: undefined } })?.engine).toBeUndefined();
    });

    it('keeps the paused notice and resume command when the log gave no steps', () => {
        const story = buildBugStory({ assessment: read(DISCOUNT, 'assessment.md') }, undefined, { engine: { ...paused, steps: [] } });
        expect(story?.engine?.paused).toEqual({ gate: 'review', resume: 'specify workflow resume 3471d74b' });
        expect(story?.engine?.steps).toEqual([]);
    });

    it('marks old reports and sends the story back to a fix', () => {
        const story = buildBugStory(texts(CART), undefined, { freshness: { fix: 'stale', test: 'stale' } });
        expect(story?.lead).toBe('stale');
        expect(story?.stale).toEqual(['fix', 'test']);
        expect(story?.steps[1]).toMatchObject({ id: 'changed', state: 'next', old: true });
        expect(story?.steps[2]).toMatchObject({ id: 'verified', state: 'next', old: true });
    });

    it('stays quiet about reports of unknown freshness', () => {
        const story = buildBugStory(texts(CART), undefined, { freshness: { fix: 'unknown', test: 'unknown' } });
        expect(story?.lead).toBe('verified');
        expect(story?.stale).toBeUndefined();
        expect(story?.steps[1].old).toBeUndefined();
    });

    it('says a partial test is unconfirmed, and keeps the failed wording for a failed one', () => {
        expect(buildBugStory(texts(SEARCH))?.lead).toBe('test-partial');
        expect(buildBugStory(texts(DISCOUNT))?.lead).toBe('test-failed');
    });

    it('reads a skipped check as its own result', () => {
        const checks = buildBugStory(texts(SEARCH))?.steps[2].checks;
        expect(checks?.map(check => check.result)).toEqual(['pass', 'skipped', 'not-run']);
    });
});

describe('step times from file writes', () => {
    // Noon local time on the header's day, so the file times fall on Oct 1 in any time zone.
    const base = new Date(2026, 9, 1, 12, 0, 0).getTime();
    const steps = (story: ReturnType<typeof buildBugStory>) => story?.steps.map(step => step.when);

    it('shows a time and how long each step took when the headers carry only a day', () => {
        const story = buildBugStory(texts(CART), undefined, {
            writtenAt: { assessment: base, fix: base + 39_000, test: base + 99_000 },
        });
        const [wrong, changed, verified] = steps(story) ?? [];
        expect(wrong).toMatch(/^Oct 1, 2026, \d{1,2}:\d{2}\s?[AP]M · time from this machine$/);
        expect(changed).toContain('39s later');
        expect(verified).toContain('1m 00s later');
        expect(changed).toContain('time from this machine');
    });

    it('prefers a full timestamp in the header over the file time', () => {
        const cart = texts(CART);
        const assessment = cart.assessment.replace('**Created**: 2026-10-01', '**Created**: 2026-10-01T09:30:00Z');
        const story = buildBugStory({ ...cart, assessment }, undefined, { writtenAt: { assessment: base } });
        const at = new Date('2026-10-01T09:30:00Z');
        const expected = `${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        expect(steps(story)?.[0]).toBe(expected);
    });

    it('never measures across a step with no date', () => {
        const cart = texts(CART);
        const fix = cart.fix.replace('- **Fixed**: 2026-10-01\n', '');
        const story = buildBugStory({ ...cart, fix }, undefined, { writtenAt: { assessment: base, fix: base + 1, test: base + 600_000 } });
        expect(steps(story)?.[2]).not.toContain('later');
    });

    it('ignores a file time from another day, as after a checkout', () => {
        const later = new Date(2026, 10, 8, 16, 12).getTime();
        const story = buildBugStory(texts(CART), undefined, { writtenAt: { assessment: later, fix: later, test: later } });
        expect(steps(story)).toEqual(['Oct 1, 2026', 'Oct 1, 2026', 'Oct 1, 2026']);
    });

    it('keeps the day alone when there is no time to show', () => {
        expect(steps(buildBugStory(texts(CART)))).toEqual(['Oct 1, 2026', 'Oct 1, 2026', 'Oct 1, 2026']);
    });
});
