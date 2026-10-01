import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SpecExplorerProvider } from '../specExplorerProvider';
import { SpecsFilterState } from '../specsFilterState';

jest.mock('../../../core/specDirectoryResolver', () => ({
    resolveSpecDirectories: jest.fn().mockResolvedValue([]),
    hasDuplicateNames: jest.fn().mockReturnValue(new Set()),
    deriveChangeRoot: jest.fn().mockReturnValue(null),
}));

jest.mock('../specContextReader', () => ({
    ...jest.requireActual('../specContextReader'),
    readSpecContextSyncSafe: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../settings/companionPresetReconciler', () => ({
    isCompanionInstalled: jest.fn().mockReturnValue(true),
}));

import { resolveSpecDirectories } from '../../../core/specDirectoryResolver';

const FIXTURE_ROOT = path.resolve(__dirname, '../../../../tests/fixtures/bug-reports');
const FIXTURE_BUGS = path.join(FIXTURE_ROOT, '.specify', 'bugs');
const ONE_SPEC = [{ name: '001-login', path: 'specs/001-login' }];

function context(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionPath: '/mock/extension',
        extensionUri: vscode.Uri.file('/mock/extension'),
        globalState: { get: jest.fn(), update: jest.fn() } as any,
        workspaceState: { get: jest.fn(), update: jest.fn() } as any,
    } as unknown as vscode.ExtensionContext;
}

function outputChannel(): vscode.OutputChannel {
    return { appendLine: jest.fn(), show: jest.fn(), dispose: jest.fn() } as unknown as vscode.OutputChannel;
}

function openWorkspace(root: string) {
    (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file(root), name: 'ws', index: 0 }];
}

function filterTo(query: string): SpecsFilterState {
    return { getQuery: () => query } as unknown as SpecsFilterState;
}

async function rootLabels(provider: SpecExplorerProvider): Promise<string[]> {
    return (await provider.getChildren()).map(item => String(item.label));
}

describe('Specs tree bug reports', () => {
    beforeEach(() => {
        (resolveSpecDirectories as jest.Mock).mockResolvedValue(ONE_SPEC);
        openWorkspace(FIXTURE_ROOT);
    });

    afterEach(() => {
        (vscode.workspace as any).workspaceFolders = undefined;
    });

    describe('given the real reports from a bug extension run', () => {
        it('adds a collapsed Bugs group after the spec groups', async () => {
            const provider = new SpecExplorerProvider(context(), outputChannel());
            const root = await provider.getChildren();
            expect(root.map(i => i.label)).toEqual(['Active (1)', 'Bugs (2)']);
            const group = root[1];
            expect(group.id).toBe('bug-group');
            expect(group.contextValue).toBe('bug-group');
            expect(group.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
        });

        it('lists one row per bug with its stages and outcome in words', async () => {
            const provider = new SpecExplorerProvider(context(), outputChannel());
            const [, group] = await provider.getChildren();
            const bugs = await provider.getChildren(group);
            expect(bugs.map(b => [b.label, b.description, b.id, b.contextValue])).toEqual([
                ['cartTotal skips the first cart item', 'assess · fix · test · verified', 'bug:cart-total-skips-first', 'bug-report'],
                ['toSlug only replaces the first space', 'assess · valid', 'bug:slug-keeps-spaces', 'bug-report'],
            ]);
        });

        it('opens a bug in the viewer in bug mode, from its first report', async () => {
            const provider = new SpecExplorerProvider(context(), outputChannel());
            const [, group] = await provider.getChildren();
            const [cart] = await provider.getChildren(group);
            expect(cart.command).toEqual(expect.objectContaining({
                command: 'speckit.viewSpecDocument',
                arguments: [path.join(FIXTURE_BUGS, 'cart-total-skips-first', 'assessment.md'), { bug: true }],
            }));
        });

        it('expands a bug into Assessment, Fix and Test, with missing reports not created and not clickable', async () => {
            const provider = new SpecExplorerProvider(context(), outputChannel());
            const [, group] = await provider.getChildren();
            const [, slug] = await provider.getChildren(group);
            const rows = await provider.getChildren(slug);
            expect(rows.map(r => [r.label, r.contextValue, r.description])).toEqual([
                ['Assessment', 'bug-report-doc', undefined],
                ['Fix', 'bug-report-doc-missing', 'not created'],
                ['Test', 'bug-report-doc-missing', 'not created'],
            ]);
            expect(rows[0].command?.arguments).toEqual([path.join(FIXTURE_BUGS, 'slug-keeps-spaces', 'assessment.md'), { bug: true }]);
            expect(rows[1].command).toBeUndefined();
        });

        it('gives no bug row a context value that a spec menu could match', async () => {
            const provider = new SpecExplorerProvider(context(), outputChannel());
            const [, group] = await provider.getChildren();
            const bugs = await provider.getChildren(group);
            const rows = (await Promise.all(bugs.map(b => provider.getChildren(b)))).flat();
            for (const item of [group, ...bugs, ...rows]) {
                expect(item.contextValue?.startsWith('spec-')).toBe(false);
            }
        });
    });

    describe('given a workspace with no bugs folder', () => {
        it('shows only the spec groups', async () => {
            openWorkspace(fs.mkdtempSync(path.join(os.tmpdir(), 'no-bugs-')));
            const provider = new SpecExplorerProvider(context(), outputChannel());
            expect(await rootLabels(provider)).toEqual(['Active (1)']);
        });

        it('stays empty when there are no specs either, so the welcome shows', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([]);
            openWorkspace(fs.mkdtempSync(path.join(os.tmpdir(), 'no-bugs-')));
            const provider = new SpecExplorerProvider(context(), outputChannel());
            expect(await provider.getChildren()).toEqual([]);
        });
    });

    describe('given bug reports and no specs', () => {
        it('shows the Bugs group on its own', async () => {
            (resolveSpecDirectories as jest.Mock).mockResolvedValue([]);
            const provider = new SpecExplorerProvider(context(), outputChannel());
            expect(await rootLabels(provider)).toEqual(['Bugs (2)']);
        });
    });

    describe('given an active filter', () => {
        it('narrows bugs by slug or title', async () => {
            const provider = new SpecExplorerProvider(context(), outputChannel(), filterTo('carttotal'));
            expect(await rootLabels(provider)).toEqual(['Bugs (1)']);
        });

        it('leaves the tree empty when nothing matches, so the clear-filter offer shows', async () => {
            const provider = new SpecExplorerProvider(context(), outputChannel(), filterTo('zzzz'));
            expect(await provider.getChildren()).toEqual([]);
        });
    });
});
