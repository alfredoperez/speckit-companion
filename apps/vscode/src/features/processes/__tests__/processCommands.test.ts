import * as vscode from 'vscode';
import { registerProcessCommands } from '../processCommands';
import { runSpecifyExtensionAdd } from '../../../speckit/processExtensions';

jest.mock('../../../speckit/processExtensions', () => ({
    ...jest.requireActual('../../../speckit/processExtensions'),
    runSpecifyExtensionAdd: jest.fn(() => Promise.resolve('terminal')),
}));

const bugs = { refresh: jest.fn() };
const ideas = { refresh: jest.fn() };

function handlerFor(command: string): (...args: unknown[]) => unknown {
    const call = (vscode.commands.registerCommand as jest.Mock).mock.calls.find(c => c[0] === command);
    return call![1];
}

beforeEach(() => {
    jest.clearAllMocks();
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = [{ uri: { fsPath: '/ws' }, name: 'ws' }];
    registerProcessCommands({ subscriptions: [] } as unknown as vscode.ExtensionContext, { bugs, ideas });
});

afterEach(() => {
    (vscode.workspace as { workspaceFolders: unknown }).workspaceFolders = undefined;
});

describe('the pane refresh commands', () => {
    it('refresh their own pane only', () => {
        handlerFor('speckit.bugs.refresh')();
        expect(bugs.refresh).toHaveBeenCalledTimes(1);
        expect(ideas.refresh).not.toHaveBeenCalled();

        handlerFor('speckit.ideas.refresh')();
        expect(ideas.refresh).toHaveBeenCalledTimes(1);
    });
});

describe('the install command', () => {
    it.each(['bug', 'assess'])('installs the %s extension in the project folder', async id => {
        await handlerFor('speckit.processes.installExtension')(id);
        expect(runSpecifyExtensionAdd).toHaveBeenCalledWith(id, '/ws');
    });

    it.each(['companion', 'bug; rm -rf ~', 'constructor', undefined, 42, { id: 'bug' }])(
        'does nothing for the unknown extension %p',
        async requested => {
            await handlerFor('speckit.processes.installExtension')(requested);
            expect(runSpecifyExtensionAdd).not.toHaveBeenCalled();
        },
    );

    it('hands back what the install returns, so the command can be awaited', async () => {
        await expect(handlerFor('speckit.processes.installExtension')('bug')).resolves.toBe('terminal');
    });
});
