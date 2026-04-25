import * as vscode from 'vscode';
import { registerSpecKitCommands } from './specCommands';

// Mock dependencies that specCommands imports
jest.mock('../../extension', () => ({
    getAIProvider: jest.fn().mockReturnValue({
        executeInTerminal: jest.fn(),
        executeSlashCommand: jest.fn(),
    }),
}));

jest.mock('./specExplorerProvider', () => ({
    SpecExplorerProvider: jest.fn(),
}));

jest.mock('../../core/utils/notificationUtils', () => ({
    NotificationUtils: {
        showAutoDismissNotification: jest.fn(),
    },
}));

jest.mock('../../core/specDirectoryResolver', () => ({
    isInsideSpecDirectory: jest.fn(),
    getFileWatcherPatterns: jest.fn().mockReturnValue({
        specs: [],
        tasks: [],
        markdown: [],
    }),
}));

jest.mock('../workflows', () => ({
    getOrSelectWorkflow: jest.fn(),
    resolveStepCommand: jest.fn(),
    executeCheckpointsForTrigger: jest.fn(),
}));

jest.mock('./stepLifecycle', () => ({
    startStep: jest.fn(),
    setStatus: jest.fn().mockResolvedValue(undefined),
    reactivate: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./selectionContextKeys', () => ({
    updateSelectionContextKeys: jest.fn(),
}));

import { setStatus, reactivate } from './stepLifecycle';
import { NotificationUtils } from '../../core/utils/notificationUtils';

const mockCommands = vscode.commands as jest.Mocked<typeof vscode.commands>;

// Capture registered command handlers by name
function captureCommandHandlers(context: vscode.ExtensionContext) {
    const handlers = new Map<string, (...args: any[]) => any>();

    mockCommands.registerCommand.mockImplementation((name: string, handler: any) => {
        handlers.set(name, handler);
        return { dispose: jest.fn() };
    });

    lastMockExplorer = { refresh: jest.fn(), expandAllSpecs: true } as any;
    const mockOutputChannel = { appendLine: jest.fn() } as any;

    registerSpecKitCommands(context, lastMockExplorer as any, mockOutputChannel);

    return handlers;
}

let lastMockExplorer: { refresh: jest.Mock; expandAllSpecs: boolean };

function createMockContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
    } as any;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('registerSpecKitCommands', () => {
    it('has no specKitDetector parameter', () => {
        // Signature is (context, specExplorer, outputChannel, specsTreeView?, filterState?, sortState?) — no specKitDetector.
        expect(registerSpecKitCommands.length).toBe(6);
    });

    it('registers the speckit.create command', () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);

        expect(handlers.has('speckit.create')).toBe(true);
    });

    it('registers the collapse/expand toggle commands', () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);

        expect(handlers.has('speckit.specs.toggleCollapseAll')).toBe(true);
        expect(handlers.has('speckit.specs.collapseAll')).toBe(true);
        expect(handlers.has('speckit.specs.expandAll')).toBe(true);
    });
});

describe('speckit.specs.toggleCollapseAll handler', () => {
    it('first invocation collapses: flips flag, sets context true, refreshes', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        lastMockExplorer.expandAllSpecs = true;
        (mockCommands.executeCommand as jest.Mock).mockClear();

        const handler = handlers.get('speckit.specs.toggleCollapseAll')!;
        await handler();

        expect(lastMockExplorer.expandAllSpecs).toBe(false);
        expect(mockCommands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            'speckit.specs.allCollapsed',
            true
        );
        expect(lastMockExplorer.refresh).toHaveBeenCalledTimes(1);
        // Must NOT call the built-in collapseAll — it would collapse group
        // headers too, which we want left alone.
        expect(mockCommands.executeCommand).not.toHaveBeenCalledWith(
            'workbench.actions.treeView.speckit.views.explorer.collapseAll'
        );
    });

    it('second invocation expands: flips flag, sets context false, refreshes', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        lastMockExplorer.expandAllSpecs = false;
        (mockCommands.executeCommand as jest.Mock).mockClear();

        const handler = handlers.get('speckit.specs.toggleCollapseAll')!;
        await handler();

        expect(lastMockExplorer.expandAllSpecs).toBe(true);
        expect(lastMockExplorer.refresh).toHaveBeenCalledTimes(1);
        expect(mockCommands.executeCommand).toHaveBeenCalledWith(
            'setContext',
            'speckit.specs.allCollapsed',
            false
        );
    });

    it('collapseAll and expandAll forward to the same handler', () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);

        const toggleHandler = handlers.get('speckit.specs.toggleCollapseAll');
        const collapseHandler = handlers.get('speckit.specs.collapseAll');
        const expandHandler = handlers.get('speckit.specs.expandAll');

        expect(collapseHandler).toBe(toggleHandler);
        expect(expandHandler).toBe(toggleHandler);
    });
});

describe('bulk status command handlers', () => {
    const originalWorkspaceFolders = (vscode.workspace as any).workspaceFolders;

    beforeEach(() => {
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/ws' } }];
    });

    afterEach(() => {
        (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    });

    const makeItem = (name: string) => ({ label: name, specPath: `specs/${name}`, contextValue: 'spec' });

    it('markCompleted on 3-item selection calls setStatus 3x, refreshes once, shows plural toast', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.markCompleted')!;

        const items = [makeItem('a'), makeItem('b'), makeItem('c')];
        await handler(items[0], items);

        expect(setStatus).toHaveBeenCalledTimes(3);
        expect(setStatus).toHaveBeenCalledWith(expect.stringContaining('specs/a'), 'completed');
        expect(setStatus).toHaveBeenCalledWith(expect.stringContaining('specs/b'), 'completed');
        expect(setStatus).toHaveBeenCalledWith(expect.stringContaining('specs/c'), 'completed');
        expect(lastMockExplorer.refresh).toHaveBeenCalledTimes(1);
        expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalledTimes(1);
        expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalledWith('3 specs marked as completed');
    });

    it('markCompleted with only item (no items) behaves like single-select with singular toast', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.markCompleted')!;

        await handler(makeItem('x'), undefined);

        expect(setStatus).toHaveBeenCalledTimes(1);
        expect(lastMockExplorer.refresh).toHaveBeenCalledTimes(1);
        expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalledWith('1 spec marked as completed');
    });

    it('archive follows bulk semantics', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.archive')!;

        await handler(undefined, [makeItem('a'), makeItem('b')]);

        expect(setStatus).toHaveBeenCalledTimes(2);
        expect(setStatus).toHaveBeenCalledWith(expect.stringContaining('specs/a'), 'archived');
        expect(lastMockExplorer.refresh).toHaveBeenCalledTimes(1);
        expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalledWith('2 specs archived');
    });

    it('reactivate follows bulk semantics', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.reactivate')!;

        await handler(undefined, [makeItem('a'), makeItem('b'), makeItem('c')]);

        expect(reactivate).toHaveBeenCalledTimes(3);
        expect(lastMockExplorer.refresh).toHaveBeenCalledTimes(1);
        expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalledWith('3 specs moved to active');
    });
});

describe('speckit.specs.reveal command handler', () => {
    const originalWorkspaceFolders = (vscode.workspace as any).workspaceFolders;
    const mockWindow = vscode.window as jest.Mocked<typeof vscode.window>;

    beforeEach(() => {
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/ws' } }];
    });

    afterEach(() => {
        (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    });

    it('registers speckit.specs.reveal when registerSpecKitCommands runs', () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);

        expect(handlers.has('speckit.specs.reveal')).toBe(true);
    });

    it('calls revealFileInOS with absolute folder URI resolved from specPath', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.reveal')!;

        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValueOnce({ type: 2 });

        await handler({ label: 'my-spec', specPath: 'specs/my-spec' });

        const calls = (mockCommands.executeCommand as jest.Mock).mock.calls;
        const revealCall = calls.find(c => c[0] === 'revealFileInOS');
        expect(revealCall).toBeDefined();
        expect(revealCall![1].fsPath).toBe('/ws/specs/my-spec');
    });

    it('falls back to specs/<label> when specPath is undefined', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.reveal')!;

        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValueOnce({ type: 2 });

        await handler({ label: 'foo' });

        const revealCall = (mockCommands.executeCommand as jest.Mock).mock.calls
            .find(c => c[0] === 'revealFileInOS');
        expect(revealCall).toBeDefined();
        expect(revealCall![1].fsPath).toBe('/ws/specs/foo');
    });

    it('shows error and does not call revealFileInOS when folder is missing', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.reveal')!;

        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

        await handler({ label: 'gone', specPath: 'specs/gone' });

        expect(mockWindow.showErrorMessage).toHaveBeenCalledTimes(1);
        expect((mockWindow.showErrorMessage as jest.Mock).mock.calls[0][0])
            .toContain('/ws/specs/gone');
        expect(mockCommands.executeCommand).not.toHaveBeenCalledWith(
            'revealFileInOS',
            expect.anything()
        );
    });

    it('calls revealFileInOS with file URI when item has filePath', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.reveal')!;

        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValueOnce({ type: 1 });

        await handler({ label: 'spec.md', filePath: 'specs/080-foo/spec.md', specPath: 'specs/080-foo' });

        const revealCall = (mockCommands.executeCommand as jest.Mock).mock.calls
            .find(c => c[0] === 'revealFileInOS');
        expect(revealCall).toBeDefined();
        expect(revealCall![1].fsPath).toBe('/ws/specs/080-foo/spec.md');
    });

    it('falls back to specPath when filePath is undefined', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.reveal')!;

        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValueOnce({ type: 2 });

        await handler({ label: '080-foo', specPath: 'specs/080-foo' });

        const revealCall = (mockCommands.executeCommand as jest.Mock).mock.calls
            .find(c => c[0] === 'revealFileInOS');
        expect(revealCall).toBeDefined();
        expect(revealCall![1].fsPath).toBe('/ws/specs/080-foo');
    });

    it('shows error when filePath does not exist', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.reveal')!;

        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

        await handler({ label: 'plan.md', filePath: 'specs/080-foo/plan.md' });

        expect(mockWindow.showErrorMessage).toHaveBeenCalledTimes(1);
        expect((mockWindow.showErrorMessage as jest.Mock).mock.calls[0][0])
            .toContain('/ws/specs/080-foo/plan.md');
    });

    it('no-op when no workspace folder is open', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.reveal')!;

        (vscode.workspace as any).workspaceFolders = undefined;
        (vscode.workspace.fs.stat as jest.Mock).mockClear();

        await handler({ label: 'anything', specPath: 'specs/anything' });

        expect(vscode.workspace.fs.stat).not.toHaveBeenCalled();
        expect(mockCommands.executeCommand).not.toHaveBeenCalledWith(
            'revealFileInOS',
            expect.anything()
        );
    });
});

describe('speckit.specs.revealInExplorer command handler', () => {
    const originalWorkspaceFolders = (vscode.workspace as any).workspaceFolders;
    const mockWindow = vscode.window as jest.Mocked<typeof vscode.window>;

    beforeEach(() => {
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/ws' } }];
    });

    afterEach(() => {
        (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    });

    it('registers speckit.specs.revealInExplorer when registerSpecKitCommands runs', () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        expect(handlers.has('speckit.specs.revealInExplorer')).toBe(true);
    });

    it('calls revealInExplorer with file URI when item has filePath', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.revealInExplorer')!;

        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValueOnce({ type: 1 });

        await handler({ label: 'spec.md', filePath: 'specs/080-foo/spec.md' });

        const revealCall = (mockCommands.executeCommand as jest.Mock).mock.calls
            .find(c => c[0] === 'revealInExplorer');
        expect(revealCall).toBeDefined();
        expect(revealCall![1].fsPath).toBe('/ws/specs/080-foo/spec.md');
    });

    it('falls back to specPath when filePath is undefined', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.revealInExplorer')!;

        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValueOnce({ type: 2 });

        await handler({ label: '080-foo', specPath: 'specs/080-foo' });

        const revealCall = (mockCommands.executeCommand as jest.Mock).mock.calls
            .find(c => c[0] === 'revealInExplorer');
        expect(revealCall).toBeDefined();
        expect(revealCall![1].fsPath).toBe('/ws/specs/080-foo');
    });

    it('shows error when target does not exist', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const handler = handlers.get('speckit.specs.revealInExplorer')!;

        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

        await handler({ label: 'plan.md', filePath: 'specs/080-foo/plan.md' });

        expect(mockWindow.showErrorMessage).toHaveBeenCalledTimes(1);
        expect((mockWindow.showErrorMessage as jest.Mock).mock.calls[0][0])
            .toContain('/ws/specs/080-foo/plan.md');
        expect(mockCommands.executeCommand).not.toHaveBeenCalledWith(
            'revealInExplorer',
            expect.anything()
        );
    });
});

describe('speckit.create command handler', () => {
    it('always opens the spec editor without any initialization check', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const createHandler = handlers.get('speckit.create')!;

        await createHandler();

        expect(mockCommands.executeCommand).toHaveBeenCalledWith('speckit.openSpecEditor');
    });

    it('does not check workspaceInitialized or show any init warning', async () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);
        const createHandler = handlers.get('speckit.create')!;

        await createHandler();

        // Should not show any error or warning messages
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
});
