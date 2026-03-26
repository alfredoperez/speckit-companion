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

const mockCommands = vscode.commands as jest.Mocked<typeof vscode.commands>;

// Capture registered command handlers by name
function captureCommandHandlers(context: vscode.ExtensionContext) {
    const handlers = new Map<string, (...args: any[]) => any>();

    mockCommands.registerCommand.mockImplementation((name: string, handler: any) => {
        handlers.set(name, handler);
        return { dispose: jest.fn() };
    });

    const mockExplorer = { refresh: jest.fn() } as any;
    const mockOutputChannel = { appendLine: jest.fn() } as any;

    registerSpecKitCommands(context, mockExplorer, mockOutputChannel);

    return handlers;
}

function createMockContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
    } as any;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('registerSpecKitCommands', () => {
    it('accepts three parameters without specKitDetector', () => {
        // The function signature should be (context, specExplorer, outputChannel)
        // with no specKitDetector parameter. Verify it can be called with exactly 3 args.
        expect(registerSpecKitCommands.length).toBe(3);
    });

    it('registers the speckit.create command', () => {
        const context = createMockContext();
        const handlers = captureCommandHandlers(context);

        expect(handlers.has('speckit.create')).toBe(true);
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
