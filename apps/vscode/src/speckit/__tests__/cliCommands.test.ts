import * as vscode from 'vscode';
import { registerCliCommands } from '../cliCommands';
import { SpecKitDetector } from '../detector';
import { _resetSpecifyVersionForTests } from '../specKitUpgrade';

jest.mock('child_process', () => {
    const exec: any = jest.fn();
    exec[require('util').promisify.custom] = jest.fn().mockResolvedValue({
        stdout: JSON.stringify({ cli_version: '1.2.7', features: { integration_upgrade_command: true } }),
        stderr: '',
    });
    return { exec };
});
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
        _resetSpecifyVersionForTests();
        context = { subscriptions: [], extensionPath: '/ext' } as unknown as vscode.ExtensionContext;
        registerCliCommands(context, SpecKitDetector.getInstance());
    });

    const pick = (text: string) => mockWindow.showQuickPick.mockImplementation(async (items: unknown) =>
        (items as Array<{ label: string }>).find(i => i.label.includes(text)));

    it('offers Upgrade All, then the three documented steps in order', async () => {
        mockWindow.showQuickPick.mockResolvedValue(undefined as never);
        await getRegisteredHandler('speckit.upgrade')();

        const [items] = mockWindow.showQuickPick.mock.calls[0];
        const labels = (items as Array<{ label: string }>).map(i => i.label);
        expect(labels[0]).toMatch(/Upgrade All/);
        expect(labels[1]).toMatch(/1 · Spec Kit CLI/);
        expect(labels[2]).toMatch(/2 · This project's agents/);
        expect(labels[3]).toMatch(/3 · Companion's spec-kit extension/);
    });

    it('shows the CLI version spec-kit reports', async () => {
        mockWindow.showQuickPick.mockResolvedValue(undefined as never);
        await getRegisteredHandler('speckit.upgrade')();
        const [items] = mockWindow.showQuickPick.mock.calls[0];
        expect((items as unknown as Array<{ description?: string }>)[1].description).toBe('1.2.7');
    });

    it.each([
        ['Upgrade All', 'speckit.upgradeAll'],
        ['Spec Kit CLI', 'speckit.upgradeCli'],
        ["This project's agents", 'speckit.upgradeProject'],
        ["Companion's spec-kit extension", 'speckit.companion.installSpecKitExtension'],
    ])('dispatches the command behind "%s"', async (label, commandId) => {
        pick(label);
        await getRegisteredHandler('speckit.upgrade')();
        expect(mockCommands.executeCommand).toHaveBeenCalledWith(commandId);
    });

    it('does nothing when the picker is cancelled', async () => {
        mockWindow.showQuickPick.mockResolvedValue(undefined as never);
        await getRegisteredHandler('speckit.upgrade')();
        expect(mockCommands.executeCommand).not.toHaveBeenCalled();
    });
});
