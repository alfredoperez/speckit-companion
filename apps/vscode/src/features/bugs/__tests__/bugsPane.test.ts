import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProcessPaneProvider, ProcessRow } from '../../processes/processPaneProvider';
import { bugsPaneConfig } from '../bugsPane';
import type { BugReportKind } from '../bugReports';

const FIXTURE_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/bug-reports');
const context = {} as vscode.ExtensionContext;

type Reports = Partial<Record<BugReportKind, string[]>>;

const HEADINGS: Record<BugReportKind, string> = {
    assessment: 'Bug Assessment',
    fix: 'Bug Fix',
    test: 'Bug Verification',
};

const temps: string[] = [];

function project(bugs: Record<string, Reports>, ...folders: string[]): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bugs-pane-'));
    temps.push(root);
    for (const folder of folders) fs.mkdirSync(path.join(root, folder), { recursive: true });
    for (const [slug, reports] of Object.entries(bugs)) {
        const dir = path.join(root, '.specify', 'bugs', slug);
        fs.mkdirSync(dir, { recursive: true });
        for (const [kind, fields] of Object.entries(reports) as [BugReportKind, string[]][]) {
            const lines = fields.map(field => `- **${field.split(': ')[0]}**: ${field.split(': ')[1]}`);
            fs.writeFileSync(path.join(dir, `${kind}.md`), `# ${HEADINGS[kind]}: ${slug}\n\n${lines.join('\n')}\n`);
        }
    }
    return root;
}

function open(root: string | undefined): void {
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = root
        ? [{ uri: { fsPath: root }, name: 'ws' }]
        : undefined;
}

function groups(root: string): ProcessRow[] {
    open(root);
    return new ProcessPaneProvider(context, bugsPaneConfig).getChildren();
}

function bugs(root: string): Record<string, { group: string; description: unknown }> {
    return Object.fromEntries(
        groups(root).flatMap(group =>
            group.children.map(bug => [String(bug.label), { group: String(group.label), description: bug.description }]),
        ),
    );
}

afterEach(() => open(undefined));
afterAll(() => temps.forEach(root => fs.rmSync(root, { recursive: true, force: true })));

describe('the Bugs pane', () => {
    describe('given the reports from a real bug extension run', () => {
        it('puts the assessed bug under To fix and the tested one under Verified', () => {
            expect(bugs(FIXTURE_ROOT)).toEqual({
                'toSlug only replaces the first space': { group: 'To fix (1)', description: 'medium · valid' },
                'cartTotal skips the first cart item': { group: 'Verified (1)', description: 'high · verified' },
            });
        });

        it('opens a bug on its landing document in the read-only viewer', () => {
            const [toFix] = groups(FIXTURE_ROOT);
            const [bug] = toFix.children;
            expect(bug.command?.command).toBe('speckit.viewSpecDocument');
            expect(bug.command?.arguments).toEqual([
                path.join(FIXTURE_ROOT, '.specify', 'bugs', 'slug-keeps-spaces', 'assessment.md'),
                { report: 'bugs', landing: true },
            ]);
        });

        it('opens a report row on that report, not on the landing document', () => {
            const [, verified] = groups(FIXTURE_ROOT);
            const [bug] = verified.children;
            expect(bug.children.map(report => report.command?.arguments)).toEqual(
                ['assessment', 'fix', 'test'].map(kind => [
                    path.join(FIXTURE_ROOT, '.specify', 'bugs', 'cart-total-skips-first', `${kind}.md`),
                    { report: 'bugs' },
                ]),
            );
        });

        it('marks every bug with a bug icon', () => {
            const icons = groups(FIXTURE_ROOT).flatMap(group => group.children.map(bug => bug.iconPath as vscode.ThemeIcon));
            expect(icons.map(icon => icon.id)).toEqual(['bug', 'bug']);
        });
    });

    describe('given a bug in every state', () => {
        const assessed = ['Verdict: valid', 'Severity: high'];
        let listed: ReturnType<typeof bugs>;
        let labels: string[];

        beforeAll(() => {
            const root = project({
                'fix-applied': { assessment: assessed, fix: ['Status: applied'] },
                'fix-partial': { assessment: assessed, fix: ['Status: partial'] },
                'fix-not-applied': { assessment: assessed, fix: ['Status: not-applied'] },
                'test-failed': { assessment: assessed, fix: ['Status: applied'], test: ['Result: failed'] },
                'test-partial': { assessment: assessed, fix: ['Status: applied'], test: ['Result: partial'] },
                'test-verified': { assessment: assessed, fix: ['Status: applied'], test: ['Result: verified'] },
                'not-a-bug': { assessment: ['Verdict: invalid'] },
                'needs-repro': { assessment: ['Verdict: likely valid, needs reproduction', 'Severity: low'] },
            });
            labels = groups(root).map(group => String(group.label));
            listed = bugs(root);
        });

        it('lists the groups as To fix, To test, Verified, Closed', () => {
            expect(labels).toEqual(['To fix (4)', 'To test (2)', 'Verified (1)', 'Closed (1)']);
        });

        it('waits for a test once a fix is applied, fully or in part', () => {
            expect(listed['fix-applied']).toEqual({ group: 'To test (2)', description: 'high · fix applied' });
            expect(listed['fix-partial']).toEqual({ group: 'To test (2)', description: 'high · fix partial' });
        });

        it('goes back to To fix when the fix was not applied', () => {
            expect(listed['fix-not-applied']).toEqual({ group: 'To fix (4)', description: 'high · fix not applied' });
        });

        it('goes back to To fix and reads as a failed test when the test did not pass', () => {
            expect(listed['test-failed']).toEqual({ group: 'To fix (4)', description: 'high · test failed' });
            expect(listed['test-partial']).toEqual({ group: 'To fix (4)', description: 'high · test partial' });
        });

        it('says the test result is unclear, and never that the fix stands, when a test report states no known result', () => {
            const root = project({ odd: { assessment: ['Verdict: valid', 'Severity: low'], fix: ['Status: applied'], test: ['Result: looks fine to me'] } });
            expect(bugs(root).odd.description).toBe('low · test result unclear');
        });

        it('is Verified once the test passes', () => {
            expect(listed['test-verified']).toEqual({ group: 'Verified (1)', description: 'high · verified' });
        });

        it('closes a bug judged invalid', () => {
            expect(listed['not-a-bug']).toEqual({ group: 'Closed (1)', description: 'invalid' });
        });

        it('shows the verdict of a bug that is only assessed', () => {
            expect(listed['needs-repro']).toEqual({
                group: 'To fix (4)',
                description: 'low · likely valid, needs reproduction',
            });
        });
    });

    describe('given a report with values nobody recognises', () => {
        it('shows none of them beside the bug', () => {
            const root = project({
                odd: {
                    assessment: ['Verdict: <b>maybe</b>', 'Severity: apocalyptic'],
                    fix: ['Status: sort of'],
                },
            });
            expect(bugs(root)).toEqual({ odd: { group: 'To test (1)', description: undefined } });
        });

        it('keeps the values it does recognise', () => {
            const root = project({ odd: { assessment: ['Verdict: who knows', 'Severity: Critical'] } });
            expect(bugs(root)).toEqual({ odd: { group: 'To fix (1)', description: 'critical' } });
        });
    });

    describe('given no bugs', () => {
        it('offers to install the bug extension when it is missing', () => {
            const [row, ...rest] = groups(project({}, '.specify'));
            expect(rest).toEqual([]);
            expect(row.label).toBe("Install Spec Kit's bug extension");
            expect(row.command?.arguments).toEqual(['bug']);
        });

        it('names the command that starts one, spelled for the assistant, when the extension is installed', () => {
            const [row, ...rest] = groups(project({}, '.specify/extensions/bug'));
            expect(rest).toEqual([]);
            expect(row.label).toBe('No bugs yet. Start one with /speckit-bug-assess.');
        });
    });
});
