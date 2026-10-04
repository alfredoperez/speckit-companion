import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IDEA_SET, ideaDirectoryOf, readIdeaReport, readIdeaReports } from '../ideaReports';
import { isReportPath, reportDocuments, reportKindOf } from '../../reports/reportSet';
import { bugDirectoryOf } from '../../bugs/bugReports';

const FIXTURE_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/idea-reports');
const FIXTURE_IDEAS = path.join(FIXTURE_ROOT, '.specify', 'assessments');

const byslug = (slug: string) => readIdeaReports(FIXTURE_ROOT).find(idea => idea.slug === slug)!;

describe('reading ideas', () => {
    it('lists every idea folder by name', () => {
        expect(readIdeaReports(FIXTURE_ROOT).map(idea => idea.slug)).toEqual([
            'guest-links',
            'member-badges',
            'offline-mode',
            'shared-lists',
        ]);
    });

    it('is empty when the project has no assessments folder', () => {
        expect(readIdeaReports(os.tmpdir())).toEqual([]);
    });

    it('names an idea by its title with the stage prefix removed', () => {
        expect(byslug('shared-lists').title).toBe('Shared todo lists');
        expect(byslug('offline-mode').title).toBe('Offline mode');
    });

    it('is still assessing until a decision exists, and says how far it got', () => {
        const idea = byslug('offline-mode');
        expect(idea.state).toBe('assessing');
        expect(idea.latestStage).toBe('research');
        expect(idea.verdict).toBeUndefined();
    });

    it('is decided once a decision exists, even when stages were skipped', () => {
        const idea = byslug('member-badges');
        expect(idea.state).toBe('decided');
        expect(idea.stages).toEqual(['intake', 'decision']);
        expect(idea.verdict).toBe('go');
    });

    it('reads each known verdict, whatever its case', () => {
        expect(byslug('shared-lists').verdict).toBe('kill');
        expect(byslug('guest-links').verdict).toBe('needs-clarification');
    });

    it.each([
        ['Go ✅', 'go'],
        ['`kill`', 'kill'],
        ['needs clarification (two open questions)', 'needs-clarification'],
        ['**go**', 'go'],
    ])('reads the decorated verdict %p as %s', (stated, verdict) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'idea-'));
        const dir = path.join(root, '.specify', 'assessments', 'x');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'decision.md'), `# Decision: X\n\n- **Verdict**: ${stated}\n`);
        expect(readIdeaReport(dir)?.verdict).toBe(verdict);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it.each(['constructor', 'ship it', '<b>go</b>', '', 'gone', 'killer feature? no: going'])('drops the unrecognised verdict %p', verdict => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'idea-'));
        const dir = path.join(root, '.specify', 'assessments', 'x');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'decision.md'), `# Decision: X\n\n- **Verdict**: ${verdict}\n`);

        const idea = readIdeaReport(dir);

        expect(idea?.state).toBe('decided');
        expect(idea?.verdict).toBeUndefined();
        fs.rmSync(root, { recursive: true, force: true });
    });
});

describe('idea paths', () => {
    const decision = path.join(FIXTURE_IDEAS, 'shared-lists', 'decision.md');

    it('finds the idea folder and the stage of a stage file', () => {
        expect(isReportPath(IDEA_SET, decision)).toBe(true);
        expect(ideaDirectoryOf(decision)).toBe(path.join(FIXTURE_IDEAS, 'shared-lists'));
        expect(reportKindOf(IDEA_SET, decision)).toBe('decision');
    });

    it('does not mistake a bug assessment for an idea, or an idea for a bug', () => {
        const bugAssessment = path.join('/ws', '.specify', 'bugs', 'cart', 'assessment.md');
        expect(isReportPath(IDEA_SET, bugAssessment)).toBe(false);
        expect(ideaDirectoryOf(bugAssessment)).toBeUndefined();
        expect(bugDirectoryOf(decision)).toBeUndefined();
    });

    it('lists all five stages as documents, marking the ones not written', () => {
        const documents = reportDocuments(IDEA_SET, path.join(FIXTURE_IDEAS, 'offline-mode'));
        expect(documents.map(d => d.type)).toEqual(['intake', 'research', 'problem', 'concept', 'decision']);
        expect(documents.map(d => d.exists)).toEqual([true, true, false, false, false]);
    });
});
