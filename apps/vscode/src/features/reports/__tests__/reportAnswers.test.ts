import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildAnswerPrompt, stageReportAnswer } from '../reportAnswers';

describe('stageReportAnswer', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'report-answers-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    const answer = (question: string, text: string) =>
        stageReportAnswer(root, { kind: 'bug', slug: 'total-wrong', document: 'assessment', question, answer: text });

    it('returns the workspace-relative path with forward slashes', () => {
        const staged = answer('Since when?', 'Since the March release.');

        expect(staged).toBe('.speckit-companion/report-answers/bug-total-wrong-assessment.md');
        expect(fs.existsSync(path.join(root, ...staged.split('/')))).toBe(true);
    });

    it('holds only the answer being sent, so an earlier one is never read again', () => {
        answer('Since when?', 'Since the March release.');
        const staged = answer('Who asked?', 'Support, twice.');

        expect(fs.readFileSync(path.join(root, staged), 'utf8')).toBe('## Question\nWho asked?\n\n## Answer\nSupport, twice.\n\n');
    });

    it('refuses to write through a cache folder that links outside the project', () => {
        const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
        fs.symlinkSync(outside, path.join(root, '.speckit-companion'));

        expect(() => answer('Since when?', 'March.')).toThrow(/outside the project/);
        expect(fs.readdirSync(outside)).toEqual([]);
    });

    it('keeps one file per item and document', () => {
        answer('Since when?', 'March.');
        const staged = stageReportAnswer(root, { kind: 'idea', slug: 'shared-lists', document: 'intake', question: 'Who asked?', answer: 'Support.' });

        expect(staged).toBe('.speckit-companion/report-answers/idea-shared-lists-intake.md');
        expect(fs.readdirSync(path.join(root, '.speckit-companion', 'report-answers')).sort()).toEqual([
            'bug-total-wrong-assessment.md',
            'idea-shared-lists-intake.md',
        ]);
    });

    it('writes the ignore file once and leaves a later edit to it alone', () => {
        const ignore = path.join(root, '.speckit-companion', '.gitignore');
        answer('Since when?', 'March.');
        expect(fs.readFileSync(ignore, 'utf8')).toBe('*\n');

        fs.writeFileSync(ignore, '*\n!keep.md\n');
        answer('Who asked?', 'Support.');

        expect(fs.readFileSync(ignore, 'utf8')).toBe('*\n!keep.md\n');
    });
});

describe('buildAnswerPrompt', () => {
    const target = { kind: 'idea', folder: '.specify/assessments/x', document: 'intake', staged: '.speckit-companion/report-answers/a.md', reviseDecision: true } as const;

    it('names the document by its project-relative path and never starts a stage', () => {
        const prompt = buildAnswerPrompt({ ...target, kind: 'bug' });

        expect(prompt).toContain('Update .specify/assessments/x/intake.md');
        expect(prompt).not.toMatch(/^\/|slug=/);
        expect(prompt).not.toContain('decision.md');
    });

    it('asks an idea to revise decision.md only when it exists', () => {
        expect(buildAnswerPrompt(target)).toContain('revise .specify/assessments/x/decision.md');
        expect(buildAnswerPrompt({ ...target, reviseDecision: false })).not.toContain('decision.md');
    });
});
