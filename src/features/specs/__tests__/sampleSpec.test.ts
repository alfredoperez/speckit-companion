import * as vscode from 'vscode';
import { openSampleSpec, SAMPLE_SPEC_DIR_NAME } from '../sampleSpec';

jest.mock('../../../core/telemetry', () => ({
    reportSampleOpened: jest.fn(),
}));

import { reportSampleOpened } from '../../../core/telemetry';

const mockFs = vscode.workspace.fs as jest.Mocked<typeof vscode.workspace.fs>;
const mockWindow = vscode.window as jest.Mocked<typeof vscode.window>;
const mockCommands = vscode.commands as jest.Mocked<typeof vscode.commands>;

const WS_ROOT = '/ws';
const EXT_ROOT = '/ext';
const TARGET_PATH = `${WS_ROOT}/specs/${SAMPLE_SPEC_DIR_NAME}`;
const BUNDLED_PATH = `${EXT_ROOT}/assets/sample-spec`;

function makeContext(): vscode.ExtensionContext {
    return { extensionUri: vscode.Uri.file(EXT_ROOT) } as unknown as vscode.ExtensionContext;
}

function setWorkspaceOpen(open: boolean): void {
    (vscode.workspace as { workspaceFolders?: unknown }).workspaceFolders = open
        ? [{ uri: vscode.Uri.file(WS_ROOT), name: 'ws', index: 0 }]
        : undefined;
}

describe('openSampleSpec (speckit.openSampleSpec)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setWorkspaceOpen(true);
        mockFs.stat.mockRejectedValue(new Error('not found'));
        mockFs.copy.mockResolvedValue(undefined);
    });

    describe('no workspace folder', () => {
        it('explains instead of failing silently, and writes nothing', async () => {
            setWorkspaceOpen(false);

            await openSampleSpec(makeContext());

            expect(mockWindow.showErrorMessage).toHaveBeenCalledTimes(1);
            expect(mockFs.copy).not.toHaveBeenCalled();
            expect(mockCommands.executeCommand).not.toHaveBeenCalled();
            expect(reportSampleOpened).not.toHaveBeenCalled();
        });
    });

    describe('target absent', () => {
        it('seeds a copy of the bundled sample and opens it in the viewer', async () => {
            await openSampleSpec(makeContext());

            expect(mockFs.copy).toHaveBeenCalledTimes(1);
            const [src, dst, opts] = mockFs.copy.mock.calls[0];
            expect(src.fsPath).toBe(BUNDLED_PATH);
            expect(dst.fsPath).toBe(TARGET_PATH);
            expect(opts).toEqual({ overwrite: false });
            expect(mockCommands.executeCommand).toHaveBeenCalledWith('speckit.openSpec', TARGET_PATH);
            expect(reportSampleOpened).toHaveBeenCalledTimes(1);
        });

        it('never overwrites: every seed copy passes overwrite: false', async () => {
            await openSampleSpec(makeContext());

            for (const call of mockFs.copy.mock.calls) {
                expect(call[2]).toEqual({ overwrite: false });
            }
        });
    });

    describe('target already present', () => {
        it('reopens the existing sample with zero writes', async () => {
            mockFs.stat.mockResolvedValue({} as vscode.FileStat);

            await openSampleSpec(makeContext());

            expect(mockFs.copy).not.toHaveBeenCalled();
            expect(mockCommands.executeCommand).toHaveBeenCalledWith('speckit.openSpec', TARGET_PATH);
            expect(reportSampleOpened).toHaveBeenCalledTimes(1);
        });
    });
});
