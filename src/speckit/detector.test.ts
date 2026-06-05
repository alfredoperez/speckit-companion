import * as vscode from 'vscode';
import { SpecKitDetector } from './detector';

// Mock child_process and fs since detector uses them
jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn(),
}));

const mockWindow = vscode.window as jest.Mocked<typeof vscode.window>;

beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton for isolation
    (SpecKitDetector as any).instance = undefined;
});

describe('SpecKitDetector', () => {
    describe('createSpec', () => {
        it('shows input box directly without checking initialization state', async () => {
            const detector = SpecKitDetector.getInstance();

            // Ensure _isInitialized is false to prove the guard is gone
            (detector as any)._isInitialized = false;

            mockWindow.showInputBox.mockResolvedValue('Add OAuth support');

            await detector.createSpec();

            expect(mockWindow.showInputBox).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Create New Spec',
                    prompt: 'What feature do you want to build?',
                })
            );
        });

        it('shows input box when workspace is initialized too', async () => {
            const detector = SpecKitDetector.getInstance();
            (detector as any)._isInitialized = true;

            mockWindow.showInputBox.mockResolvedValue('some feature');

            await detector.createSpec();

            expect(mockWindow.showInputBox).toHaveBeenCalled();
        });

        it('returns early when user cancels the input box', async () => {
            const detector = SpecKitDetector.getInstance();
            mockWindow.showInputBox.mockResolvedValue(undefined);

            await detector.createSpec();

            expect(mockWindow.showInputBox).toHaveBeenCalled();
        });

        it('does not show error message or init prompt regardless of initialization state', async () => {
            const detector = SpecKitDetector.getInstance();
            (detector as any)._isInitialized = false;

            mockWindow.showInputBox.mockResolvedValue('Build a dashboard');

            await detector.createSpec();

            expect(mockWindow.showErrorMessage).not.toHaveBeenCalled();
            expect(mockWindow.showWarningMessage).not.toHaveBeenCalled();
        });
    });

    describe('singleton', () => {
        it('returns the same instance', () => {
            const a = SpecKitDetector.getInstance();
            const b = SpecKitDetector.getInstance();
            expect(a).toBe(b);
        });
    });

    describe('upgrade dispatch (--ai agent resolution)', () => {
        const getConfig = vscode.workspace.getConfiguration as jest.Mock;

        function mockProvider(value: string | undefined): void {
            getConfig.mockReturnValue({ get: jest.fn().mockReturnValue(value) });
        }

        function lastSentText(): string {
            const results = mockWindow.createTerminal.mock.results;
            const terminal = results[results.length - 1].value;
            const calls = terminal.sendText.mock.calls;
            return calls[calls.length - 1][0];
        }

        beforeEach(() => {
            (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/tmp/ws' } }];
        });

        afterEach(() => {
            (vscode.workspace as any).workspaceFolders = undefined;
        });

        describe('upgradeProject', () => {
            it('dispatches the configured non-Claude agent, never claude-code (US1)', async () => {
                mockProvider('codex');
                await SpecKitDetector.getInstance().upgradeProject();
                const sent = lastSentText();
                expect(sent).toContain('--ai codex');
                expect(sent).not.toContain('claude-code');
            });

            it('dispatches --ai claude for the default provider (US2)', async () => {
                mockProvider('claude');
                await SpecKitDetector.getInstance().upgradeProject();
                const sent = lastSentText();
                expect(sent).toContain('--ai claude');
                expect(sent).not.toContain('claude-code');
            });
        });

        describe('upgradeAll', () => {
            it('dispatches --ai claude for the default provider, never claude-code (US2)', async () => {
                mockProvider('claude');
                await SpecKitDetector.getInstance().upgradeAll();
                const sent = lastSentText();
                expect(sent).toContain('--ai claude');
                expect(sent).not.toContain('claude-code');
            });
        });

        it('both upgrade paths emit the same --ai value for the same provider (FR-006)', async () => {
            mockProvider('claude');
            await SpecKitDetector.getInstance().upgradeProject();
            const projectAgent = lastSentText().match(/--ai (\S+)/)?.[1];
            await SpecKitDetector.getInstance().upgradeAll();
            const allAgent = lastSentText().match(/--ai (\S+)/)?.[1];
            expect(projectAgent).toBe('claude');
            expect(allAgent).toBe('claude');
        });
    });
});
