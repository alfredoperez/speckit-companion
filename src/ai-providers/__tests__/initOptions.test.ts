import * as fs from 'fs';
import * as vscode from 'vscode';
import { readInitOptions, resetInitOptionsCache } from '../initOptions';

jest.mock('fs');

describe('readInitOptions', () => {
    const fakeWorkspacePath = '/fake/workspace';
    let outputChannel: { appendLine: jest.Mock; show: jest.Mock; dispose: jest.Mock };

    beforeEach(() => {
        resetInitOptionsCache();
        (fs.readFileSync as jest.Mock).mockReset();
        (vscode.workspace as any).workspaceFolders = [
            { uri: vscode.Uri.file(fakeWorkspacePath) },
        ];
        outputChannel = {
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn(),
        };
    });

    describe('when init-options.json is missing (ENOENT)', () => {
        beforeEach(() => {
            const err = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
            err.code = 'ENOENT';
            (fs.readFileSync as jest.Mock).mockImplementation(() => {
                throw err;
            });
        });

        it('returns the default sh script without throwing', () => {
            expect(() => readInitOptions(outputChannel as any)).not.toThrow();
            expect(readInitOptions(outputChannel as any)).toEqual({ script: 'sh' });
        });

        it('does not log anything (missing file is normal)', () => {
            readInitOptions(outputChannel as any);
            expect(outputChannel.appendLine).not.toHaveBeenCalled();
        });
    });

    describe('when init-options.json contains valid {"script":"ps"}', () => {
        beforeEach(() => {
            (fs.readFileSync as jest.Mock).mockReturnValue('{"script":"ps"}');
        });

        it('returns { script: "ps" }', () => {
            expect(readInitOptions(outputChannel as any)).toEqual({ script: 'ps' });
        });
    });

    describe('when init-options.json is invalid JSON', () => {
        beforeEach(() => {
            (fs.readFileSync as jest.Mock).mockReturnValue('not json {');
        });

        it('returns the default sh script', () => {
            expect(readInitOptions(outputChannel as any)).toEqual({ script: 'sh' });
        });

        it('logs exactly one warning line to the output channel', () => {
            readInitOptions(outputChannel as any);
            expect(outputChannel.appendLine).toHaveBeenCalledTimes(1);
            const message = outputChannel.appendLine.mock.calls[0][0] as string;
            expect(message).toContain(fakeWorkspacePath);
        });
    });

    describe('when init-options.json declares an unknown script value', () => {
        beforeEach(() => {
            (fs.readFileSync as jest.Mock).mockReturnValue('{"script":"bash"}');
        });

        it('normalizes to { script: "sh" }', () => {
            expect(readInitOptions(outputChannel as any)).toEqual({ script: 'sh' });
        });

        it('does not log a warning for a successful parse', () => {
            readInitOptions(outputChannel as any);
            expect(outputChannel.appendLine).not.toHaveBeenCalled();
        });
    });

    describe('caching', () => {
        beforeEach(() => {
            (fs.readFileSync as jest.Mock).mockReturnValue('{"script":"ps"}');
        });

        it('only reads the file once across multiple calls for the same workspace', () => {
            const first = readInitOptions(outputChannel as any);
            const second = readInitOptions(outputChannel as any);

            expect(first).toEqual({ script: 'ps' });
            expect(second).toEqual({ script: 'ps' });
            expect(fs.readFileSync as jest.Mock).toHaveBeenCalledTimes(1);
        });
    });

    describe('when readFileSync fails with a non-ENOENT error (e.g., EACCES)', () => {
        beforeEach(() => {
            const err = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
            err.code = 'EACCES';
            (fs.readFileSync as jest.Mock).mockImplementation(() => {
                throw err;
            });
        });

        it('returns the default sh script', () => {
            expect(readInitOptions(outputChannel as any)).toEqual({ script: 'sh' });
        });

        it('logs a warning line to the output channel', () => {
            readInitOptions(outputChannel as any);
            expect(outputChannel.appendLine).toHaveBeenCalledTimes(1);
            const message = outputChannel.appendLine.mock.calls[0][0] as string;
            expect(message).toContain(fakeWorkspacePath);
            expect(message).toContain('EACCES');
        });
    });
});
