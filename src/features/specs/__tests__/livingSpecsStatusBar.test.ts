import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerLivingSpecsStatusBar, __statusBarTest } from '../livingSpecsStatusBar';
import type { FileClaim } from '../livingSpecsModel';

const { buildPicks } = __statusBarTest;

const ALPHA_SPEC = [
    '# Alpha',
    '',
    '### Users can set a due date',
    '<!-- touches: src/alpha/due-date/** -->',
    '',
    'Prose.',
    '',
].join('\n');

const REGISTRY = [
    'enabled: true',
    'capabilities:',
    '  - name: alpha',
    '    match: ["src/alpha/**"]',
    '    spec: src/alpha/alpha.spec.md',
    '',
].join('\n');

function workspace(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'living-status-'));
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    return root;
}

function activate(root: string, relPath: string | null): void {
    (vscode.workspace as unknown as { workspaceFolders: unknown }).workspaceFolders = [
        { uri: { fsPath: root }, name: 'ws', index: 0 },
    ];
    (vscode.window as unknown as { activeTextEditor: unknown }).activeTextEditor = relPath
        ? { document: { uri: { scheme: 'file', fsPath: path.join(root, relPath) } } }
        : undefined;
}

function register(): { text: string; shown: number; hidden: number } {
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    const item = registerLivingSpecsStatusBar(context) as unknown as {
        text: string;
        show: jest.Mock;
        hide: jest.Mock;
    };
    return { text: item.text, shown: item.show.mock.calls.length, hidden: item.hide.mock.calls.length };
}

describe('living specs status bar', () => {
    const roots: string[] = [];
    const ws = (files: Record<string, string>): string => {
        const root = workspace(files);
        roots.push(root);
        return root;
    };

    afterAll(() => {
        for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const FILES = { 'living-specs.yml': REGISTRY, 'src/alpha/alpha.spec.md': ALPHA_SPEC };

    it('names the number of living specs that claim the active file', () => {
        activate(ws(FILES), 'src/alpha/due-date/index.ts');
        const item = register();
        expect(item.text).toContain('1 living spec');
        expect(item.shown).toBe(1);
    });

    it('stays hidden when nothing claims the active file', () => {
        activate(ws(FILES), 'src/other/thing.ts');
        const item = register();
        expect(item.hidden).toBe(1);
        expect(item.shown).toBe(0);
    });

    it('stays hidden when living specs are off', () => {
        const root = ws({ 'living-specs.yml': 'enabled: false\ncapabilities: []\n' });
        activate(root, 'src/alpha/index.ts');
        expect(register().hidden).toBe(1);
    });

    it('stays hidden when there is no active editor', () => {
        activate(ws(FILES), null);
        expect(register().hidden).toBe(1);
    });

    it('refreshes when the active editor changes', () => {
        activate(ws(FILES), 'src/alpha/due-date/index.ts');
        register();
        expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
    });

    it('registers the picker command', () => {
        activate(ws(FILES), 'src/alpha/due-date/index.ts');
        register();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            'speckit.livingSpecs.forFile',
            expect.any(Function)
        );
    });
});

describe('the picker list', () => {
    const claim = (over: Partial<FileClaim> = {}): FileClaim => ({
        capability: 'alpha',
        specPath: 'src/alpha/alpha.spec.md',
        exists: true,
        readable: true,
        requirements: ['Users can set a due date'],
        ...over,
    });

    it('groups requirements under their capability', () => {
        const picks = buildPicks([claim(), claim({ capability: 'platform', requirements: ['Everything is logged'] })]);
        expect(picks.map(p => p.label)).toEqual([
            'alpha',
            'Users can set a due date',
            'platform',
            'Everything is logged',
        ]);
        expect(picks[0].kind).toBe(vscode.QuickPickItemKind.Separator);
    });

    it('offers a way into a capability that claims the file but marks no requirement', () => {
        const picks = buildPicks([claim({ requirements: [] })]);
        expect(picks[1].specPath).toBe('src/alpha/alpha.spec.md');
        expect(picks[1].requirement).toBeUndefined();
    });

    it('says so, and offers nothing to open, when the spec file is missing', () => {
        const picks = buildPicks([claim({ exists: false, readable: false, requirements: [] })]);
        expect(picks[1].label).toContain('no spec file on disk');
        expect(picks[1].specPath).toBeUndefined();
    });

    it('distinguishes a spec it could not read from one that is not there', () => {
        const picks = buildPicks([claim({ readable: false, requirements: [] })]);
        expect(picks[1].label).toContain('could not be read');
    });
});
