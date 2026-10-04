import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    bugDirectoryOf,
    bugReportDocuments,
    parseReportHeader,
    readBugReport,
    readBugReports,
} from '../bugReports';

const FIXTURE_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/bug-reports');
const FIXTURE_BUGS = path.join(FIXTURE_ROOT, '.specify', 'bugs');

const temps: string[] = [];

function tempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-reports-'));
    temps.push(dir);
    return dir;
}

afterAll(() => {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

function writeBug(root: string, slug: string, files: Record<string, string>): string {
    const dir = path.join(root, '.specify', 'bugs', slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
    return dir;
}

describe('readBugReports', () => {
    describe('given the real reports from a bug extension run', () => {
        const bugs = readBugReports(FIXTURE_ROOT);

        it('finds one bug per folder, ordered by slug', () => {
            expect(bugs.map(b => b.slug)).toEqual(['cart-total-skips-first', 'slug-keeps-spaces']);
        });

        it('reads all three stages and the verified test result for a finished bug', () => {
            const cart = bugs[0];
            expect(cart.title).toBe('cartTotal skips the first cart item');
            expect(cart.stages).toEqual(['assessment', 'fix', 'test']);
            expect(cart.verdict).toBe('valid');
            expect(cart.severity).toBe('high');
            expect(cart.fixStatus).toBe('applied');
            expect(cart.testResult).toBe('verified');
            expect(cart.outcome).toBe('verified');
        });

        it('falls back to the assessment verdict when only an assessment exists', () => {
            const slug = bugs[1];
            expect(slug.title).toBe('toSlug only replaces the first space');
            expect(slug.stages).toEqual(['assessment']);
            expect(slug.reports.fix.exists).toBe(false);
            expect(slug.reports.test.exists).toBe(false);
            expect(slug.outcome).toBe('valid');
        });
    });

    describe('given no bugs folder', () => {
        it('returns nothing', () => {
            expect(readBugReports(tempWorkspace())).toEqual([]);
        });
    });

    describe('given an empty bugs folder', () => {
        it('returns nothing', () => {
            const root = tempWorkspace();
            fs.mkdirSync(path.join(root, '.specify', 'bugs'), { recursive: true });
            expect(readBugReports(root)).toEqual([]);
        });
    });

    describe('given a folder with no report file', () => {
        it('skips it', () => {
            const root = tempWorkspace();
            writeBug(root, 'notes-only', { 'notes.md': '# Notes' });
            expect(readBugReports(root)).toEqual([]);
        });
    });

    describe('given a report missing its outcome line and its title', () => {
        it('still lists the bug, under its slug, with no outcome', () => {
            const root = tempWorkspace();
            writeBug(root, 'odd-report', { 'assessment.md': 'Some notes\n\n- **Severity**: low\n' });
            const [bug] = readBugReports(root);
            expect(bug.title).toBe('odd-report');
            expect(bug.verdict).toBeUndefined();
            expect(bug.outcome).toBeUndefined();
        });
    });

    describe('given a bug folder that is a link pointing outside the bugs folder', () => {
        it('ignores it', () => {
            const root = tempWorkspace();
            const outside = tempWorkspace();
            fs.writeFileSync(path.join(outside, 'assessment.md'), '# Bug Assessment: escaped\n');
            fs.mkdirSync(path.join(root, '.specify', 'bugs'), { recursive: true });
            fs.symlinkSync(outside, path.join(root, '.specify', 'bugs', 'escape'), 'dir');
            expect(readBugReports(root)).toEqual([]);
        });
    });

    describe('given a report file that is a link pointing outside the bug folder', () => {
        it('treats that report as not created and never reads it', () => {
            const root = tempWorkspace();
            const outside = tempWorkspace();
            fs.writeFileSync(path.join(outside, 'secret.md'), '# Bug Fix: secret\n\n- **Status**: applied\n');
            const dir = writeBug(root, 'linked', { 'assessment.md': '# Bug Assessment: linked\n\n- **Verdict**: valid\n' });
            fs.symlinkSync(path.join(outside, 'secret.md'), path.join(dir, 'fix.md'));
            const [bug] = readBugReports(root);
            expect(bug.stages).toEqual(['assessment']);
            expect(bug.fixStatus).toBeUndefined();
            expect(bugReportDocuments(dir).find(d => d.type === 'fix')?.exists).toBe(false);
        });
    });
});

describe('parseReportHeader', () => {
    it('reads only the bullet block under the title, never a label further down the body', () => {
        const md = '# Bug Fix: thing\n\n- **Slug**: thing\n- **Status**: partial\n\n## Notes\n\n- **Status**: applied\n';
        const header = parseReportHeader(md);
        expect(header.title).toBe('Bug Fix: thing');
        expect(header.fields.get('status')).toBe('partial');
    });

    it('treats a blank value as absent', () => {
        expect(parseReportHeader('# Bug Verification: x\n\n- **Result**:\n').fields.has('result')).toBe(false);
    });
});

describe('bugReportDocuments', () => {
    it('returns Story, then Assessment, Fix and Test with their existence', () => {
        const docs = bugReportDocuments(path.join(FIXTURE_BUGS, 'slug-keeps-spaces'));
        expect(docs.map(d => [d.type, d.label, d.exists])).toEqual([
            ['story', 'Story', true],
            ['assessment', 'Assessment', true],
            ['fix', 'Fix', false],
            ['test', 'Test', false],
        ]);
    });

    it('gives Story no file, and every report its own', () => {
        const directory = path.join(FIXTURE_BUGS, 'slug-keeps-spaces');
        const docs = bugReportDocuments(directory);
        expect(docs.map(d => d.filePath)).toEqual([
            '',
            path.join(directory, 'assessment.md'),
            path.join(directory, 'fix.md'),
            path.join(directory, 'test.md'),
        ]);
    });
});

describe('bugDirectoryOf', () => {
    it('returns the bug folder for a report inside .specify/bugs/<slug>/', () => {
        const report = path.join(FIXTURE_BUGS, 'cart-total-skips-first', 'fix.md');
        expect(bugDirectoryOf(report)).toBe(path.join(FIXTURE_BUGS, 'cart-total-skips-first'));
    });

    it('returns undefined for a spec document', () => {
        expect(bugDirectoryOf('/repo/specs/001-x/spec.md')).toBeUndefined();
    });
});

describe('where a bug stands', () => {
    const tmpRoots: string[] = [];

    function bugWith(files: Record<string, string>): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-state-'));
        tmpRoots.push(root);
        const dir = path.join(root, '.specify', 'bugs', 'sample');
        fs.mkdirSync(dir, { recursive: true });
        for (const [name, header] of Object.entries(files)) {
            fs.writeFileSync(path.join(dir, name), `# Bug: sample\n\n${header}\n`);
        }
        return dir;
    }

    afterAll(() => tmpRoots.forEach(root => fs.rmSync(root, { recursive: true, force: true })));

    it.each([
        ['an assessment alone is waiting for a fix', { 'assessment.md': '- **Verdict**: valid' }, 'to-fix'],
        ['an unverified report still needs a fix', { 'assessment.md': '- **Verdict**: likely valid, needs reproduction' }, 'to-fix'],
        ['an invalid report is closed', { 'assessment.md': '- **Verdict**: invalid' }, 'closed'],
        ['an invalid report stays closed even with a fix', { 'assessment.md': '- **Verdict**: invalid', 'fix.md': '- **Status**: applied' }, 'closed'],
        ['an applied fix is waiting for a test', { 'assessment.md': '- **Verdict**: valid', 'fix.md': '- **Status**: applied' }, 'to-test'],
        ['a partial fix is waiting for a test', { 'assessment.md': '- **Verdict**: valid', 'fix.md': '- **Status**: partial' }, 'to-test'],
        ['a fix that was not applied goes back to fixing', { 'assessment.md': '- **Verdict**: valid', 'fix.md': '- **Status**: not-applied' }, 'to-fix'],
        ['a verified test is done', { 'assessment.md': '- **Verdict**: valid', 'fix.md': '- **Status**: applied', 'test.md': '- **Result**: verified' }, 'verified'],
        ['a failed test goes back to fixing', { 'assessment.md': '- **Verdict**: valid', 'fix.md': '- **Status**: applied', 'test.md': '- **Result**: failed' }, 'to-fix'],
        ['a partial test goes back to fixing', { 'assessment.md': '- **Verdict**: valid', 'fix.md': '- **Status**: applied', 'test.md': '- **Result**: partial' }, 'to-fix'],
        ['a decorated verified result still counts', { 'assessment.md': '- **Verdict**: valid', 'fix.md': '- **Status**: applied', 'test.md': '- **Result**: Verified ✅ (3/3 checks)' }, 'verified'],
        ['a fix written as "not applied" goes back to fixing', { 'assessment.md': '- **Verdict**: valid', 'fix.md': '- **Status**: not applied' }, 'to-fix'],
        ['an invalid report written with its reason is closed', { 'assessment.md': '- **Verdict**: invalid, expected behaviour' }, 'closed'],
        ['a test with no known result goes back to fixing', { 'assessment.md': '- **Verdict**: valid', 'test.md': '- **Result**: looks fine to me' }, 'to-fix'],
    ])('%s', (_name, files, state) => {
        expect(readBugReport(bugWith(files))?.state).toBe(state);
    });

    it('reads known values whatever their case', () => {
        const bug = readBugReport(bugWith({ 'assessment.md': '- **Verdict**: Valid\n- **Severity**: HIGH' }));
        expect(bug?.verdict).toBe('valid');
        expect(bug?.severity).toBe('high');
    });

    it.each(['constructor', '<img src=x onerror=alert(1)>', 'sev-0', '__proto__'])(
        'drops the unrecognised value %p instead of showing it',
        value => {
            const bug = readBugReport(bugWith({
                'assessment.md': `- **Verdict**: ${value}\n- **Severity**: ${value}`,
                'fix.md': `- **Status**: ${value}`,
                'test.md': `- **Result**: ${value}`,
            }));
            expect(bug?.verdict).toBeUndefined();
            expect(bug?.severity).toBeUndefined();
            expect(bug?.fixStatus).toBeUndefined();
            expect(bug?.testResult).toBeUndefined();
            expect(bug?.outcome).toBeUndefined();
        },
    );
});
