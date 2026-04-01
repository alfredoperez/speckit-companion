import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createTempFile } from '../tempFileUtils';

jest.mock('fs', () => ({
    promises: {
        writeFile: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../pathUtils', () => ({
    convertPathIfWSL: jest.fn((p: string) => `/wsl${p}`),
}));

describe('createTempFile', () => {
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContext = {
            globalStorageUri: vscode.Uri.file('/tmp/ext-storage'),
        } as unknown as vscode.ExtensionContext;

        (vscode.workspace.fs as any).createDirectory = jest.fn().mockResolvedValue(undefined);
    });

    it('creates a temp file with the given content and prefix', async () => {
        const result = await createTempFile(mockContext, 'hello world', 'test-prefix', false);

        expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(mockContext.globalStorageUri);
        expect(fs.promises.writeFile).toHaveBeenCalledWith(
            expect.stringContaining('test-prefix-'),
            'hello world'
        );
        expect(result).toMatch(/test-prefix-\d+\.md$/);
    });

    it('returns unconverted path when convertWSL is false', async () => {
        const result = await createTempFile(mockContext, 'content', 'prompt', false);
        expect(result).not.toMatch(/^\/wsl/);
    });

    it('returns WSL-converted path when convertWSL is true', async () => {
        const result = await createTempFile(mockContext, 'content', 'prompt', true);
        expect(result).toMatch(/^\/wsl/);
    });

    it('uses default prefix when none provided', async () => {
        const result = await createTempFile(mockContext, 'content');
        expect(result).toMatch(/prompt-\d+\.md$/);
    });
});
