import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProcessPaneConfig, ProcessPaneProvider, ProcessRow } from '../processPaneProvider';
import { BUG_SET, BugReport, BugReportKind, readBugReports } from '../../bugs/bugReports';

const FIXTURE_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/bug-reports');
const context = {} as vscode.ExtensionContext;

const config: ProcessPaneConfig<BugReportKind, BugReport> = {
    name: 'Bugs',
    set: BUG_SET,
    read: readBugReports,
    groups: [
        { id: 'to-fix', label: 'To fix', icon: 'wrench' },
        { id: 'to-test', label: 'To test', icon: 'beaker' },
        { id: 'verified', label: 'Verified', icon: 'pass' },
        { id: 'closed', label: 'Closed', icon: 'circle-slash' },
    ],
    groupOf: bug => bug.state,
    describe: bug => bug.severity,
    icon: () => new vscode.ThemeIcon('bug'),
    extensionId: 'bug',
    installLabel: "Install Spec Kit's bug extension",
    emptyLabel: () => 'No bugs yet.',
};

function open(root: string | undefined): void {
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = root
        ? [{ uri: { fsPath: root }, name: 'ws' }]
        : undefined;
}

function pane(): ProcessPaneProvider<BugReportKind, BugReport> {
    return new ProcessPaneProvider(context, config);
}

const temps: string[] = [];
function emptyProject(...make: string[]): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pane-'));
    temps.push(root);
    for (const dir of make) fs.mkdirSync(path.join(root, dir), { recursive: true });
    return root;
}

afterEach(() => open(undefined));
afterAll(() => temps.forEach(root => fs.rmSync(root, { recursive: true, force: true })));

describe('a process pane with items', () => {
    let groups: ProcessRow[];

    beforeEach(() => {
        open(FIXTURE_ROOT);
        groups = pane().getChildren();
    });

    it('shows only the groups that have something in them, with a count, in config order', () => {
        expect(groups.map(g => g.label)).toEqual(['To fix (1)', 'Verified (1)']);
        expect(groups.every(g => g.contextValue === 'process-group')).toBe(true);
    });

    it('names an item by its title and puts the detail beside it', () => {
        const [bug] = pane().getChildren(groups[1]);
        expect(bug.label).toBe('cartTotal skips the first cart item');
        expect(bug.description).toBe('high');
        expect(bug.contextValue).toBe('process-item');
    });

    it('opens the first report that exists when the item is clicked', () => {
        const [bug] = pane().getChildren(groups[0]);
        expect(bug.command?.command).toBe('speckit.viewSpecDocument');
        expect(bug.command?.arguments?.[0]).toMatch(/slug-keeps-spaces\/assessment\.md$/);
        expect(bug.command?.arguments?.[1]).toEqual({ report: 'bugs' });
    });

    it('lists every report under an item, and says which are not written', () => {
        const [bug] = pane().getChildren(groups[0]);
        const reports = pane().getChildren(bug);
        expect(reports.map(r => r.label)).toEqual(['Assessment', 'Fix', 'Test']);
        expect(reports.map(r => r.contextValue)).toEqual([
            'process-report',
            'process-report-missing',
            'process-report-missing',
        ]);
        expect(reports[1].description).toBe('not created');
        expect(reports[1].command).toBeUndefined();
    });

    it('gives every row its own id', () => {
        const all = groups.flatMap(g => [g, ...g.children, ...g.children.flatMap(i => i.children)]);
        expect(new Set(all.map(r => r.id)).size).toBe(all.length);
    });
});

describe('a process pane with nothing to list', () => {
    it('offers the install when the extension is not there', () => {
        open(emptyProject('.specify'));
        const [row, ...rest] = pane().getChildren();
        expect(rest).toEqual([]);
        expect(row.label).toBe("Install Spec Kit's bug extension");
        expect(row.contextValue).toBe('process-install');
        expect(row.command?.command).toBe('speckit.processes.installExtension');
        expect(row.command?.arguments).toEqual(['bug']);
    });

    it('says there is nothing yet when the extension is installed', () => {
        open(emptyProject('.specify/extensions/bug'));
        const [row, ...rest] = pane().getChildren();
        expect(rest).toEqual([]);
        expect(row.label).toBe('No bugs yet.');
        expect(row.contextValue).toBe('process-empty');
        expect(row.command).toBeUndefined();
    });

    it('lists reports and no install row when reports exist without the extension', () => {
        const root = emptyProject('.specify/bugs/one');
        fs.writeFileSync(path.join(root, '.specify/bugs/one/assessment.md'), '# Bug Assessment: One\n\n- **Verdict**: valid\n');
        open(root);
        const rows = pane().getChildren();
        expect(rows.map(r => r.contextValue)).toEqual(['process-group']);
    });

    it('offers nothing in a folder that is not a Spec Kit project', () => {
        open(emptyProject('src'));
        expect(pane().getChildren()).toEqual([]);
    });

    it('is empty when no folder is open', () => {
        open(undefined);
        expect(pane().getChildren()).toEqual([]);
    });
});

describe('refreshing a process pane', () => {
    it('tells the tree to redraw', () => {
        const provider = pane();
        const heard = jest.fn();
        provider.onDidChangeTreeData(heard);
        provider.refresh();
        expect(heard).toHaveBeenCalledTimes(1);
    });
});
