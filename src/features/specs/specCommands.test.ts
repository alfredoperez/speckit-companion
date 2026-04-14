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

    lastMockExplorer = { refresh: jest.fn() } as any;
    const mockOutputChannel = { appendLine: jest.fn() } as any;

    registerSpecKitCommands(context, lastMockExplorer as any, mockOutputChannel);

    return handlers;
}

let lastMockExplorer: { refresh: jest.Mock };

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
        // Signature is (context, specExplorer, outputChannel, specsTreeView?) — no specKitDetector.
        expect(registerSpecKitCommands.length).toBe(4);
    });

    it('registers the speckit.create command', () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);

        expect(handlers.has('speckit.create')).toBe(true);
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
