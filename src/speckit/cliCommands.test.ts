import * as vscode from 'vscode';
import { registerCliCommands } from './cliCommands';
import { SpecKitDetector } from './detector';

jest.mock('child_process', () => ({ exec: jest.fn() }));
jest.mock('fs', () => ({ existsSync: jest.fn().mockReturnValue(false), readFileSync: jest.fn() }));

const mockCommands = vscode.commands as jest.Mocked<typeof vscode.commands>;
const mockWindow = vscode.window as jest.Mocked<typeof vscode.window>;

type Handler = (...args: unknown[]) => unknown;

function getRegisteredHandler(commandId: string): Handler {
    const call = mockCommands.registerCommand.mock.calls.find(c => c[0] === commandId);
    if (!call) {
        throw new Error(`${commandId} was not registered`);
    }
    return call[1] as Handler;
}

describe('speckit.upgrade QuickPick', () => {
    let context: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        registerCliCommands(context, SpecKitDetector.getInstance());
    });

    it('offers three options in order: All → Project → CLI', async () => {
        mockWindow.showQuickPick.mockResolvedValue(undefined as never);
        await getRegisteredHandler('speckit.upgrade')();

        const [items] = mockWindow.showQuickPick.mock.calls[0];
        const labels = (items as Array<{ label: string }>).map(i => i.label);
        expect(labels[0]).toMatch(/Upgrade All/);
        expect(labels[1]).toMatch(/Upgrade Project/);
        expect(labels[2]).toMatch(/Upgrade CLI/);
    });

    it('dispatches speckit.upgradeAll when "Upgrade All" is picked', async () => {
        mockWindow.showQuickPick.mockImplementation(async (items: unknown) => {
            return (items as Array<{ label: string }>).find(i => i.label.includes('Upgrade All'));
        });
        await getRegisteredHandler('speckit.upgrade')();
        expect(mockCommands.executeCommand).toHaveBeenCalledWith('speckit.upgradeAll');
    });

    it('dispatches speckit.upgradeProject when "Upgrade Project" is picked', async () => {
        mockWindow.showQuickPick.mockImplementation(async (items: unknown) => {
            return (items as Array<{ label: string }>).find(i => i.label.includes('Upgrade Project'));
        });
        await getRegisteredHandler('speckit.upgrade')();
        expect(mockCommands.executeCommand).toHaveBeenCalledWith('speckit.upgradeProject');
    });

    it('dispatches speckit.upgradeCli when "Upgrade CLI" is picked', async () => {
        mockWindow.showQuickPick.mockImplementation(async (items: unknown) => {
            return (items as Array<{ label: string }>).find(i => i.label.includes('Upgrade CLI'));
        });
        await getRegisteredHandler('speckit.upgrade')();
        expect(mockCommands.executeCommand).toHaveBeenCalledWith('speckit.upgradeCli');
    });

    it('does nothing when the picker is cancelled', async () => {
        mockWindow.showQuickPick.mockResolvedValue(undefined as never);
        await getRegisteredHandler('speckit.upgrade')();
        expect(mockCommands.executeCommand).not.toHaveBeenCalled();
    });
});
