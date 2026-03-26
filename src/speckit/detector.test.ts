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
});
