import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { SteeringManager } from '../steeringManager';

jest.mock('../../../extension', () => ({
    getAIProvider: jest.fn(),
}));

jest.mock('../../../core/utils/configManager', () => ({
    ConfigManager: {
        getInstance: jest.fn().mockReturnValue({
            loadSettings: jest.fn(),
            getPath: jest.fn().mockReturnValue('.claude/steering'),
        }),
    },
}));

jest.mock('../../../core/utils/notificationUtils', () => ({
    NotificationUtils: {
        showAutoDismissNotification: jest.fn().mockResolvedValue(undefined),
    },
}));

describe('SteeringManager.createUserSteeringFile', () => {
    const outputChannel = { appendLine: jest.fn() } as unknown as vscode.OutputChannel;
    let manager: SteeringManager;
    const originalHome = process.env.HOME;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('not found'));
        manager = new SteeringManager(outputChannel);
    });

    afterEach(() => {
        if (originalHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = originalHome;
        }
    });

    function writtenPath(): string {
        const call = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls[0];
        return call[0].fsPath;
    }

    function createdDirPath(): string {
        const call = (vscode.workspace.fs.createDirectory as jest.Mock).mock.calls[0];
        return call[0].fsPath;
    }

    it('writes the global steering file under the OS home directory when HOME is unset', async () => {
        delete process.env.HOME;

        await manager.createUserSteeringFile();

        expect(createdDirPath()).toBe(path.join(os.homedir(), '.claude'));
        expect(writtenPath()).toBe(path.join(os.homedir(), '.claude', 'CLAUDE.md'));
    });

    it('writes the global steering file under the OS home directory when HOME is empty', async () => {
        process.env.HOME = '';

        await manager.createUserSteeringFile();

        expect(writtenPath()).toBe(path.join(os.homedir(), '.claude', 'CLAUDE.md'));
    });

    it('never resolves the target to a path relative to the current working directory', async () => {
        delete process.env.HOME;

        await manager.createUserSteeringFile();

        const target = writtenPath();
        expect(path.isAbsolute(target)).toBe(true);
        expect(target.startsWith(os.homedir())).toBe(true);
    });

    it('writes to the same home directory when HOME is set normally', async () => {
        process.env.HOME = os.homedir();

        await manager.createUserSteeringFile();

        expect(writtenPath()).toBe(path.join(os.homedir(), '.claude', 'CLAUDE.md'));
    });

    it('leaves the existing file untouched when the user cancels the overwrite prompt', async () => {
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({});
        (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('Cancel');

        await manager.createUserSteeringFile();

        expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
});
