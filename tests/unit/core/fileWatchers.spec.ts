import * as vscode from 'vscode';
import { setupFileWatchers } from '../../../src/core/fileWatchers';
import { getFileWatcherPatterns } from '../../../src/core/specDirectoryResolver';

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Guards the watcher-scoping miss that produced #277 Child 3 / #270 / #278: a
 * `.spec-context.json` write under the default `specs/` layout must be observed
 * and must dispatch the open viewer's refresh. The original defect was that this
 * path had no coverage.
 */
describe('setupSpecContextWatchers (via setupFileWatchers)', () => {
    let specExplorer: any;
    let steeringExplorer: any;
    let specViewer: any;
    let outputChannel: any;
    let context: any;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn().mockReturnValue(['specs', '.specify/specs']),
        });
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
            Buffer.from(JSON.stringify({ currentStep: 'plan', status: 'planning', history: [] })),
        );
        specExplorer = { refresh: jest.fn() };
        steeringExplorer = { refresh: jest.fn() };
        specViewer = { refreshContextIfDisplaying: jest.fn().mockResolvedValue(undefined) };
        outputChannel = { appendLine: jest.fn() };
        context = { subscriptions: [] };
    });

    function specContextWatchers(): any[] {
        const results = (vscode.workspace.createFileSystemWatcher as jest.Mock).mock.results;
        return results
            .map(r => r.value)
            .filter(w => typeof w.pattern === 'string' && w.pattern.endsWith('.spec-context.json'));
    }

    it('registers one spec-context watcher per configured spec-directory pattern', () => {
        setupFileWatchers(context, specExplorer, steeringExplorer, specViewer, outputChannel);

        const patterns = getFileWatcherPatterns().specContext;
        const watchers = specContextWatchers();

        expect(patterns.length).toBeGreaterThan(0);
        expect(watchers).toHaveLength(patterns.length);
        expect(watchers.map(w => w.pattern).sort()).toEqual([...patterns].sort());
    });

    it('an onDidChange on a .spec-context.json dispatches the viewer refresh', async () => {
        setupFileWatchers(context, specExplorer, steeringExplorer, specViewer, outputChannel);
        const uri = vscode.Uri.file('/repo/specs/161-change/.spec-context.json');

        await specContextWatchers()[0].fireChange(uri);

        expect(specViewer.refreshContextIfDisplaying).toHaveBeenCalledWith(uri.fsPath);
    });

    it('an onDidCreate refreshes the sidebar and the viewer', async () => {
        setupFileWatchers(context, specExplorer, steeringExplorer, specViewer, outputChannel);
        const uri = vscode.Uri.file('/repo/specs/161-create/.spec-context.json');

        await specContextWatchers()[0].fireCreate(uri);
        await flushPromises();

        expect(specExplorer.refresh).toHaveBeenCalled();
        expect(specViewer.refreshContextIfDisplaying).toHaveBeenCalledWith(uri.fsPath);
    });
});
