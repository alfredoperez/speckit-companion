import * as vscode from 'vscode';
import { ensureCliInstalled } from '../installUtils';

jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

jest.mock('util', () => ({
    promisify: jest.fn(() => jest.fn()),
}));

describe('ensureCliInstalled', () => {
    let mockOutputChannel: vscode.OutputChannel;

    beforeEach(() => {
        jest.clearAllMocks();
        mockOutputChannel = {
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn(),
        } as unknown as vscode.OutputChannel;

        (vscode.env as any).clipboard = {
            writeText: jest.fn().mockResolvedValue(undefined),
        };
    });

    it('does not throw when CLI is installed', async () => {
        // Mock child_process.exec to succeed
        const { exec } = require('child_process');
        const { promisify } = require('util');
        (promisify as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue({ stdout: '1.0.0' }));

        await expect(
            ensureCliInstalled('Test CLI', 'npm install -g test-cli', 'test --version', mockOutputChannel)
        ).resolves.toBeUndefined();
    });

    it('throws and shows error when CLI is not installed', async () => {
        const { promisify } = require('util');
        (promisify as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue(new Error('not found')));

        (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue(undefined);

        await expect(
            ensureCliInstalled('Test CLI', 'npm install -g test-cli', 'test --version', mockOutputChannel)
        ).rejects.toThrow('Test CLI is not installed');

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Test CLI is not installed. Install it with: npm install -g test-cli',
            'Copy Install Command'
        );
    });

    it('copies install command to clipboard when user clicks Copy', async () => {
        const { promisify } = require('util');
        (promisify as jest.Mock).mockReturnValue(jest.fn().mockRejectedValue(new Error('not found')));

        (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue('Copy Install Command');

        await expect(
            ensureCliInstalled('Test CLI', 'npm install -g test-cli', 'test --version', mockOutputChannel)
        ).rejects.toThrow();

        expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith('npm install -g test-cli');
    });
});
