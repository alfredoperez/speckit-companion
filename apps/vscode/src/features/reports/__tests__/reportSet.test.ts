import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    isReportPath,
    parseReportHeader,
    readReportFolder,
    readReportFolders,
    reportDirectoryOf,
    reportDocuments,
    reportFile,
    reportKindOf,
    type ReportSet,
    knownValue,
} from '../reportSet';

type BugKind = 'assessment' | 'fix' | 'test';
type IdeaKind = 'intake' | 'research' | 'problem' | 'concept' | 'decision';

const BUGS: ReportSet<BugKind> = {
    id: 'bugs',
    dir: path.join('.specify', 'bugs'),
    kinds: ['assessment', 'fix', 'test'],
    labels: { assessment: 'Assessment', fix: 'Fix', test: 'Test' },
    titlePrefixes: { assessment: 'Bug Assessment:', fix: 'Bug Fix:', test: 'Bug Verification:' },
    panelPrefix: 'Bug',
    fallbackBadge: 'BUG',
};

const IDEAS: ReportSet<IdeaKind> = {
    id: 'ideas',
    dir: path.join('.specify', 'assessments'),
    kinds: ['intake', 'research', 'problem', 'concept', 'decision'],
    labels: { intake: 'Intake', research: 'Research', problem: 'Problem', concept: 'Concept', decision: 'Decision' },
    titlePrefixes: {
        intake: 'Idea Intake:',
        research: 'Idea Research:',
        problem: 'Problem Definition:',
        concept: 'Concept:',
        decision: 'Decision:',
    },
    panelPrefix: 'Idea',
    fallbackBadge: 'IDEA',
};

const FIXTURE_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/bug-reports');
const FIXTURE_BUGS = path.join(FIXTURE_ROOT, '.specify', 'bugs');

const temps: string[] = [];

function tempWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-set-'));
    temps.push(dir);
    return dir;
}

afterAll(() => {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

function writeIdea(root: string, slug: string, files: Record<string, string>): string {
    const dir = path.join(root, '.specify', 'assessments', slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
    return dir;
}

describe('readReportFolders', () => {
    describe('given the real reports from a bug extension run', () => {
        const bugs = readReportFolders(BUGS, FIXTURE_ROOT);

        it('finds one folder per bug, ordered by folder name', () => {
            expect(bugs.map(b => b.slug)).toEqual(['cart-total-skips-first', 'slug-keeps-spaces']);
        });

        it('takes the title from the heading with the stage prefix removed', () => {
            expect(bugs[0].title).toBe('cartTotal skips the first cart item');
            expect(bugs[1].title).toBe('toSlug only replaces the first space');
        });

        it('lists the stages that exist in the set order', () => {
            expect(bugs[0].stages).toEqual(['assessment', 'fix', 'test']);
            expect(bugs[1].stages).toEqual(['assessment']);
            expect(bugs[1].reports.fix.exists).toBe(false);
        });

        it('reads the header fields of each stage and leaves a missing stage empty', () => {
            expect(bugs[0].fields.assessment.get('verdict')).toBe('valid');
            expect(bugs[0].fields.assessment.get('severity')).toBe('high');
            expect(bugs[0].fields.fix.get('status')).toBe('applied');
            expect(bugs[0].fields.test.get('result')).toBe('verified');
            expect(bugs[1].fields.fix.size).toBe(0);
        });
    });

    describe('given ideas at different stages', () => {
        const root = tempWorkspace();
        writeIdea(root, 'b-offline-mode', {
            'decision.md': '# Decision: Offline mode\n\n- **Verdict**: go\n',
            'research.md': '# Notes without the prefix\n\n- **Sources**: 3\n',
            'intake.md': 'No heading here\n',
        });
        writeIdea(root, 'a-untitled', { 'problem.md': 'Just some notes\n' });
        writeIdea(root, 'c-notes-only', { 'notes.md': '# Idea Intake: not a report\n' });
        const ideas = readReportFolders(IDEAS, root);

        it('skips a folder with no known file', () => {
            expect(ideas.map(i => i.slug)).toEqual(['a-untitled', 'b-offline-mode']);
        });

        it('falls back to the folder name when no stage has a title', () => {
            expect(ideas[0].title).toBe('a-untitled');
        });

        it('takes the title from the first stage that has one', () => {
            expect(ideas[1].title).toBe('Offline mode');
        });

        it('lists the stages in the set order, whatever order the files were written in', () => {
            expect(ideas[1].stages).toEqual(['intake', 'research', 'decision']);
        });

        it('keeps the header fields per stage', () => {
            expect(ideas[1].fields.decision.get('verdict')).toBe('go');
            expect(ideas[1].fields.research.get('sources')).toBe('3');
            expect(ideas[1].fields.concept.size).toBe(0);
        });
    });

    describe('given no folder for the set', () => {
        it('returns nothing', () => {
            expect(readReportFolders(IDEAS, tempWorkspace())).toEqual([]);
            expect(readReportFolders(IDEAS, FIXTURE_ROOT)).toEqual([]);
        });
    });

    describe('given an item folder that is a link pointing outside the set folder', () => {
        it('ignores it', () => {
            const root = tempWorkspace();
            const outside = tempWorkspace();
            fs.writeFileSync(path.join(outside, 'intake.md'), '# Idea Intake: escaped\n');
            fs.mkdirSync(path.join(root, '.specify', 'assessments'), { recursive: true });
            fs.symlinkSync(outside, path.join(root, '.specify', 'assessments', 'escape'), 'dir');
            expect(readReportFolders(IDEAS, root)).toEqual([]);
        });
    });

    describe('given a set folder that is a link pointing outside the workspace', () => {
        it('returns nothing', () => {
            const root = tempWorkspace();
            const outside = tempWorkspace();
            fs.mkdirSync(path.join(outside, 'idea'));
            fs.writeFileSync(path.join(outside, 'idea', 'intake.md'), '# Idea Intake: escaped\n');
            fs.mkdirSync(path.join(root, '.specify'));
            fs.symlinkSync(outside, path.join(root, '.specify', 'assessments'), 'dir');
            expect(readReportFolders(IDEAS, root)).toEqual([]);
        });
    });

    describe('given a report file that is a link pointing outside its folder', () => {
        it('treats that report as not created and never reads it', () => {
            const root = tempWorkspace();
            const outside = tempWorkspace();
            fs.writeFileSync(path.join(outside, 'secret.md'), '# Decision: secret\n\n- **Verdict**: kill\n');
            const dir = writeIdea(root, 'linked', { 'intake.md': '# Idea Intake: linked\n' });
            fs.symlinkSync(path.join(outside, 'secret.md'), path.join(dir, 'decision.md'));
            const [idea] = readReportFolders(IDEAS, root);
            expect(idea.stages).toEqual(['intake']);
            expect(idea.fields.decision.size).toBe(0);
            expect(reportFile(IDEAS, dir, 'decision').exists).toBe(false);
        });
    });
});

describe('readReportFolder', () => {
    it('returns nothing for a folder with no known file', () => {
        expect(readReportFolder(IDEAS, path.join(FIXTURE_BUGS, 'slug-keeps-spaces'))).toBeUndefined();
    });

    it('reads one folder by its path', () => {
        const bug = readReportFolder(BUGS, path.join(FIXTURE_BUGS, 'slug-keeps-spaces'));
        expect(bug?.slug).toBe('slug-keeps-spaces');
        expect(bug?.reports.assessment.label).toBe('Assessment');
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
        expect(parseReportHeader('# Decision: x\n\n- **Verdict**:\n').fields.has('verdict')).toBe(false);
    });
});

describe('the path helpers', () => {
    const bugFile = path.join(FIXTURE_BUGS, 'cart-total-skips-first', 'assessment.md');
    const ideaFile = '/repo/.specify/assessments/offline-mode/decision.md';

    describe('given a report inside the set folder', () => {
        it('recognises the path, its folder and its kind', () => {
            expect(isReportPath(BUGS, bugFile)).toBe(true);
            expect(reportDirectoryOf(BUGS, bugFile)).toBe(path.join(FIXTURE_BUGS, 'cart-total-skips-first'));
            expect(reportKindOf(BUGS, bugFile)).toBe('assessment');
            expect(isReportPath(IDEAS, ideaFile)).toBe(true);
            expect(reportDirectoryOf(IDEAS, ideaFile)).toBe('/repo/.specify/assessments/offline-mode');
            expect(reportKindOf(IDEAS, ideaFile)).toBe('decision');
        });

        it('recognises the set folder itself and an item folder as report paths', () => {
            expect(isReportPath(BUGS, FIXTURE_BUGS)).toBe(true);
            expect(isReportPath(IDEAS, '/repo/.specify/assessments/offline-mode')).toBe(true);
        });

        it('reads a path written with backslashes', () => {
            expect(isReportPath(IDEAS, 'C:\\repo\\.specify\\assessments\\offline-mode\\intake.md')).toBe(true);
            expect(reportKindOf(IDEAS, 'C:\\repo\\.specify\\assessments\\offline-mode\\intake.md')).toBe('intake');
        });
    });

    describe('given a bug report named assessment.md', () => {
        it('is not mistaken for the ideas folder', () => {
            expect(isReportPath(IDEAS, bugFile)).toBe(false);
            expect(reportDirectoryOf(IDEAS, bugFile)).toBeUndefined();
            expect(reportKindOf(IDEAS, bugFile)).toBeUndefined();
        });
    });

    describe('given an idea report', () => {
        it('is not a bug path', () => {
            expect(isReportPath(BUGS, ideaFile)).toBe(false);
            expect(reportDirectoryOf(BUGS, ideaFile)).toBeUndefined();
            expect(reportKindOf(BUGS, ideaFile)).toBeUndefined();
        });
    });

    describe('given a look-alike folder next to the set folder', () => {
        const lookAlike = '/repo/.specify/bugs-old/x/assessment.md';

        it('is not a report path', () => {
            expect(isReportPath(BUGS, lookAlike)).toBe(false);
            expect(reportDirectoryOf(BUGS, lookAlike)).toBeUndefined();
            expect(reportKindOf(BUGS, lookAlike)).toBeUndefined();
        });

        it('needs the whole set folder, not only its last part', () => {
            expect(isReportPath(BUGS, '/repo/docs/bugs/x/assessment.md')).toBe(false);
            expect(reportDirectoryOf(BUGS, '/repo/docs/bugs/x/assessment.md')).toBeUndefined();
        });
    });

    describe('given a file in the set folder that is not a report', () => {
        it('is a report path with no folder and no kind', () => {
            const notes = '/repo/.specify/bugs/x/notes.md';
            expect(isReportPath(BUGS, notes)).toBe(true);
            expect(reportDirectoryOf(BUGS, notes)).toBeUndefined();
            expect(reportKindOf(BUGS, notes)).toBeUndefined();
        });

        it('does not take a report nested deeper than an item folder', () => {
            expect(reportDirectoryOf(BUGS, '/repo/.specify/bugs/x/deep/fix.md')).toBeUndefined();
            expect(reportDirectoryOf(BUGS, '/repo/.specify/bugs/fix.md')).toBeUndefined();
        });
    });

    describe('given a spec document', () => {
        it('is not a report path', () => {
            expect(isReportPath(BUGS, '/repo/specs/001-x/spec.md')).toBe(false);
            expect(reportDirectoryOf(IDEAS, '/repo/specs/001-x/research.md')).toBeUndefined();
        });
    });
});

describe('reportDocuments', () => {
    it('lists every bug kind with its label and whether it exists', () => {
        const docs = reportDocuments(BUGS, path.join(FIXTURE_BUGS, 'slug-keeps-spaces'));
        expect(docs.map(d => [d.type, d.label, d.exists])).toEqual([
            ['assessment', 'Assessment', true],
            ['fix', 'Fix', false],
            ['test', 'Test', false],
        ]);
    });

    it('puts a set\'s overview first, with no file, always present', () => {
        const docs = reportDocuments({ ...BUGS, overview: { type: 'story', label: 'Story' } }, path.join(FIXTURE_BUGS, 'slug-keeps-spaces'));
        expect(docs.map(d => [d.type, d.label, d.exists, d.filePath])).toEqual([
            ['story', 'Story', true, ''],
            ['assessment', 'Assessment', true, expect.any(String)],
            ['fix', 'Fix', false, expect.any(String)],
            ['test', 'Test', false, expect.any(String)],
        ]);
    });

    it('lists all five idea kinds in the set order', () => {
        const root = tempWorkspace();
        const dir = writeIdea(root, 'offline-mode', { 'research.md': '# Idea Research: Offline mode\n' });
        const docs = reportDocuments(IDEAS, dir);
        expect(docs.map(d => [d.label, d.fileName, d.exists])).toEqual([
            ['Intake', 'intake.md', false],
            ['Research', 'research.md', true],
            ['Problem', 'problem.md', false],
            ['Concept', 'concept.md', false],
            ['Decision', 'decision.md', false],
        ]);
        expect(docs[1]).toEqual({
            type: 'research',
            label: 'Research',
            fileName: 'research.md',
            filePath: path.join(dir, 'research.md'),
            exists: true,
            isCore: true,
            category: 'core',
        });
    });
});

describe('reading a known value from a report line', () => {
    const results = ['verified', 'partial', 'failed'] as const;
    const verdicts = ['go', 'needs-clarification', 'kill'] as const;
    const statuses = ['applied', 'partial', 'not-applied'] as const;

    it.each([
        ['verified', 'verified'],
        ['Verified ✅ (3/3 checks)', 'verified'],
        ['`verified`', 'verified'],
        ['✅ Verified', 'verified'],
        ['**verified**.', 'verified'],
        ['failed, symptom still reproduces', 'failed'],
    ])('reads %p as %s', (stated, value) => {
        expect(knownValue(results, stated)).toBe(value);
    });

    it('accepts a space where the value has a hyphen', () => {
        expect(knownValue(statuses, 'not applied')).toBe('not-applied');
        expect(knownValue(verdicts, 'Needs clarification (two questions)')).toBe('needs-clarification');
    });

    it.each([
        'verified | partial | failed',
        '[verified / partial / failed]',
        'verified-pending',
        'verified partially',
        'not verified',
        'partial pass, then verified',
        'failed to run',
        '',
        '<img src=x onerror=alert(1)>',
        'constructor',
    ])('does not read %p as a result', stated => {
        expect(knownValue(results, stated)).toBeUndefined();
    });

    it.each(['go/no-go pending', 'go | needs-clarification | kill', 'kill switch needed first', 'gone', 'go-no-go'])(
        'does not read %p as a verdict',
        stated => {
            expect(knownValue(verdicts, stated)).toBeUndefined();
        },
    );

    it('is nothing for a missing or non-text value', () => {
        expect(knownValue(results, undefined)).toBeUndefined();
        expect(knownValue(results, 42 as unknown as string)).toBeUndefined();
    });
});
