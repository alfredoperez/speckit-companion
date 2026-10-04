import * as vscode from 'vscode';
import { SpecEditorProvider } from '../specEditorProvider';
import { registerSpecEditorCommands } from '../specEditorCommands';
import { SIZE_LIMITS } from '../types';

jest.mock('../../workflows', () => ({
    buildWorkflowChoices: jest.fn().mockReturnValue([]),
    resolveEffectiveDefaultWorkflow: jest.fn().mockReturnValue('speckit'),
}));

jest.mock('../../../ai-providers', () => ({
    AIProviderFactory: { getProvider: jest.fn() },
    getConfiguredProviderType: jest.fn().mockReturnValue('claudeCode'),
}));

jest.mock('../../../ai-providers/aiProvider', () => ({
    formatCommandForProvider: (c: string) => c,
}));

jest.mock('../../../speckit/specKitExtensionInstall', () => ({
    resolveInstallPrompt: jest.fn().mockReturnValue(undefined),
    dismissInstallPrompt: jest.fn(),
}));

jest.mock('../tempFileManager', () => ({
    TempFileManager: jest.fn().mockImplementation(() => ({
        cleanupOrphanedFiles: jest.fn().mockResolvedValue([]),
    })),
}));

jest.mock('../specDraftManager', () => ({
    SpecDraftManager: jest.fn().mockImplementation(() => ({
        cleanupOldDrafts: jest.fn().mockResolvedValue([]),
    })),
}));

type Posted = { type: string; prefill?: string; content?: string; replace?: boolean };
type MockPanel = {
    visible: boolean;
    reveal: jest.Mock;
    __posted: Posted[];
    __receive(message: { type: string }): Promise<void>;
    __fireDispose(): void;
};

function createContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionUri: vscode.Uri.file('/ext'),
        globalStorageUri: vscode.Uri.file('/storage'),
        globalState: { get: jest.fn().mockReturnValue(false), update: jest.fn() },
    } as unknown as vscode.ExtensionContext;
}

function createProvider(): SpecEditorProvider {
    const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    return new SpecEditorProvider(createContext(), outputChannel, {} as never, {} as never);
}

function lastPanel(): MockPanel {
    const results = (vscode.window.createWebviewPanel as jest.Mock).mock.results;
    return results[results.length - 1].value as MockPanel;
}

function initMessages(panel: MockPanel): Posted[] {
    return panel.__posted.filter(m => m.type === 'init');
}

function prefillMessages(panel: MockPanel): Posted[] {
    return panel.__posted.filter(m => m.type === 'prefill');
}

function openSpecEditorHandler(): (...args: unknown[]) => unknown {
    const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    registerSpecEditorCommands(createContext(), outputChannel);
    const call = (vscode.commands.registerCommand as jest.Mock).mock.calls
        .find(([name]) => name === 'speckit.openSpecEditor');
    return call[1];
}

describe('Create Spec opened with a description', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: (_k: string, d?: unknown) => d,
        });
    });

    it('sends the description with the first init of a new panel', async () => {
        const provider = createProvider();
        await provider.show('Dark mode for the viewer');
        const panel = lastPanel();
        await panel.__receive({ type: 'ready' });
        expect(initMessages(panel)).toHaveLength(1);
        expect(initMessages(panel)[0].prefill).toBe('Dark mode for the viewer');
    });

    it('does not send the description again when the webview asks for init a second time', async () => {
        const provider = createProvider();
        await provider.show('Dark mode for the viewer');
        const panel = lastPanel();
        await panel.__receive({ type: 'ready' });
        await panel.__receive({ type: 'ready' });
        expect(initMessages(panel)[1]).not.toHaveProperty('prefill');
    });

    it('does not reuse the description on the next plain open', async () => {
        const provider = createProvider();
        await provider.show('Dark mode for the viewer');
        const first = lastPanel();
        await first.__receive({ type: 'ready' });
        first.__fireDispose();

        await provider.show();
        const second = lastPanel();
        await second.__receive({ type: 'ready' });
        expect(second).not.toBe(first);
        expect(initMessages(second)[0]).not.toHaveProperty('prefill');
    });

    it('drops a description that was never delivered when the panel closes', async () => {
        const provider = createProvider();
        await provider.show('Dark mode for the viewer');
        lastPanel().__fireDispose();

        await provider.show();
        const panel = lastPanel();
        await panel.__receive({ type: 'ready' });
        expect(initMessages(panel)[0]).not.toHaveProperty('prefill');
    });

    it('posts a prefill message to a panel that is already open and visible', async () => {
        const provider = createProvider();
        await provider.show();
        const panel = lastPanel();
        panel.visible = true;
        await panel.__receive({ type: 'ready' });

        await provider.show('Dark mode for the viewer');
        expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
        expect(panel.reveal).toHaveBeenCalled();
        expect(prefillMessages(panel)).toEqual([{ type: 'prefill', content: 'Dark mode for the viewer' }]);
    });

    it('holds the description for the next init when the open panel is hidden', async () => {
        const provider = createProvider();
        await provider.show();
        const panel = lastPanel();
        panel.visible = false;
        await panel.__receive({ type: 'ready' });

        await provider.show('Dark mode for the viewer');
        expect(prefillMessages(panel)).toHaveLength(0);
        await panel.__receive({ type: 'ready' });
        expect(initMessages(panel)[1].prefill).toBe('Dark mode for the viewer');
    });

    it('replaces typed text only after the developer chooses Replace', async () => {
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Replace');
        const provider = createProvider();
        await provider.show('Dark mode for the viewer');
        const panel = lastPanel();
        await panel.__receive({ type: 'ready' });

        await panel.__receive({ type: 'confirmPrefill' });
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Replace the description you have typed with the idea?',
            { modal: true },
            'Replace'
        );
        expect(prefillMessages(panel)).toEqual([
            { type: 'prefill', content: 'Dark mode for the viewer', replace: true },
        ]);
    });

    it('leaves typed text alone when the replace question is dismissed', async () => {
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
        const provider = createProvider();
        await provider.show('Dark mode for the viewer');
        const panel = lastPanel();
        await panel.__receive({ type: 'ready' });

        await panel.__receive({ type: 'confirmPrefill' });
        expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
        expect(prefillMessages(panel)).toHaveLength(0);
    });

    it('asks nothing when no description was offered', async () => {
        const provider = createProvider();
        await provider.show();
        const panel = lastPanel();
        await panel.__receive({ type: 'ready' });

        await panel.__receive({ type: 'confirmPrefill' });
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });
});

describe('speckit.openSpecEditor argument', () => {
    let show: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        show = jest.spyOn(SpecEditorProvider.prototype, 'show').mockResolvedValue();
    });

    afterEach(() => {
        show.mockRestore();
    });

    it('forwards a description string', () => {
        openSpecEditorHandler()('Dark mode for the viewer');
        expect(show).toHaveBeenCalledWith('Dark mode for the viewer');
    });

    it('ignores the tree item a menu passes', () => {
        openSpecEditorHandler()({ label: 'Specs', contextValue: 'spec' });
        expect(show).toHaveBeenCalledWith(undefined);
    });

    it('ignores an empty or blank string', () => {
        const handler = openSpecEditorHandler();
        handler('');
        handler('   \n');
        expect(show.mock.calls).toEqual([[undefined], [undefined]]);
    });

    it('opens plainly with no argument', () => {
        openSpecEditorHandler()();
        expect(show).toHaveBeenCalledWith(undefined);
    });

    it('returns the promise of the open so a caller can wait for it', () => {
        const returned = openSpecEditorHandler()('Dark mode for the viewer');
        expect(returned).toBe(show.mock.results[0].value);
        expect(returned).toBeInstanceOf(Promise);
    });

    it('caps a description over the size limit', () => {
        openSpecEditorHandler()('x'.repeat(SIZE_LIMITS.DRAFT_CONTENT_CHARS + 500));
        expect((show.mock.calls[0][0] as string)).toHaveLength(SIZE_LIMITS.DRAFT_CONTENT_CHARS);
    });
});
