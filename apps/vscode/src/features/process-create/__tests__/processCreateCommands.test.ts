import * as vscode from 'vscode';
import { registerProcessCreateCommands } from '../processCreateCommands';
import { processExtensionState } from '../../../speckit/processExtensions';

jest.mock('../../../speckit/processExtensions', () => ({
    processExtensionState: jest.fn(),
}));

const state = processExtensionState as jest.Mock;
const provider = { show: jest.fn() };

function handlerFor(command: string): () => Promise<void> {
    const call = (vscode.commands.registerCommand as jest.Mock).mock.calls.find(c => c[0] === command);
    return call![1];
}

beforeEach(() => {
    jest.clearAllMocks();
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: '/ws' }, name: 'ws' }];
    registerProcessCreateCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, provider);
});

afterEach(() => {
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
});

describe.each([
    ['speckit.bugs.create', 'bug', 'bug', "Starting a bug needs Spec Kit's bug extension."],
    ['speckit.ideas.create', 'idea', 'assess', "Assessing an idea needs Spec Kit's assess extension."],
])('%s', (command, kind, extensionId, warning) => {
    it.each(['present', 'unknown'])('opens the screen when the extension is %s', async found => {
        state.mockReturnValue(found);
        await handlerFor(command)();

        expect(state).toHaveBeenCalledWith('/ws', extensionId);
        expect(provider.show).toHaveBeenCalledWith(kind);
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('offers the install and opens nothing when the extension is missing', async () => {
        state.mockReturnValue('absent');
        await handlerFor(command)();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(warning, 'Install');
        expect(provider.show).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('runs the install for its extension when Install is chosen', async () => {
        state.mockReturnValue('absent');
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Install');
        await handlerFor(command)();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('speckit.processes.installExtension', extensionId);
        expect(provider.show).not.toHaveBeenCalled();
    });

    it('says a project folder is needed and opens nothing without one', async () => {
        (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
        await handlerFor(command)();

        expect(vscode.window.showErrorMessage).toHaveBeenCalled();
        expect(state).not.toHaveBeenCalled();
        expect(provider.show).not.toHaveBeenCalled();
    });

    it('returns a promise so the command can be awaited', () => {
        state.mockReturnValue('present');
        expect(handlerFor(command)()).toBeInstanceOf(Promise);
    });
});
