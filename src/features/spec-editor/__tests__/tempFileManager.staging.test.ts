import * as vscode from 'vscode';
import { TempFileManager } from '../tempFileManager';
import type { AttachedImage } from '../types';
import { CLEANUP_THRESHOLDS } from '../types';

/**
 * #208 — OpenCode attached-image staging.
 *
 * Verifies images are copied into a self-gitignored workspace cache dir, the
 * `.gitignore` (`*`) is written on first use, the staged set is registered in
 * the manifest for the existing expiry sweep (NOT immediately deleted), and the
 * inlined image references are rewritten to the in-workspace paths.
 */

const GLOBAL_STORAGE = '/gs/alfredoperez.speckit-companion';
const WORKSPACE_ROOT = '/Users/x/project';

function makeContext(): vscode.ExtensionContext {
    return {
        globalStorageUri: vscode.Uri.file(GLOBAL_STORAGE),
    } as unknown as vscode.ExtensionContext;
}

function makeImage(id: string): AttachedImage {
    return {
        id,
        sessionId: 's1',
        originalName: `${id}.png`,
        format: 'png',
        size: 10,
        thumbnailDataUri: 'data:image/png;base64,AAAA',
        filePath: `${GLOBAL_STORAGE}/spec-editor/s1/images/${id}.png`,
        addedAt: Date.now(),
    };
}

function setWorkspace(root: string | undefined): void {
    (vscode.workspace as any).workspaceFolders = root
        ? [{ uri: vscode.Uri.file(root), name: 'project', index: 0 }]
        : undefined;
}

/** A tiny in-memory manifest store so reads see prior writes. */
function withManifestStore(): { restore: () => void } {
    let manifestJson: string | null = null;
    const manifestPath = `${GLOBAL_STORAGE}/spec-editor/manifest.json`;

    const origRead = (vscode.workspace.fs.readFile as jest.Mock).getMockImplementation();
    const origWrite = (vscode.workspace.fs.writeFile as jest.Mock).getMockImplementation();

    (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === manifestPath) {
            if (manifestJson === null) {
                throw new Error('not found');
            }
            return Buffer.from(manifestJson, 'utf-8');
        }
        return Buffer.from('', 'utf-8');
    });
    (vscode.workspace.fs.writeFile as jest.Mock).mockImplementation(async (uri: vscode.Uri, data: Buffer) => {
        if (uri.fsPath === manifestPath) {
            manifestJson = Buffer.from(data).toString('utf-8');
        }
    });

    return {
        restore: () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockImplementation(origRead);
            (vscode.workspace.fs.writeFile as jest.Mock).mockImplementation(origWrite);
        },
    };
}

describe('TempFileManager.stageImagesInWorkspace (#208)', () => {
    let store: { restore: () => void };

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('not found'));
        store = withManifestStore();
        setWorkspace(WORKSPACE_ROOT);
    });

    afterEach(() => {
        store.restore();
        setWorkspace(undefined);
    });

    it('copies each image into the workspace cache dir and returns a source→staged map', async () => {
        const mgr = new TempFileManager(makeContext());
        const img = makeImage('img1');
        const sources = { img1: img.filePath };

        const map = await mgr.stageImagesInWorkspace('stage1', [img], sources);

        const stagedPath = `${WORKSPACE_ROOT}/.speckit-companion/spec-editor/stage1/images/img1.png`;
        expect(map).toEqual({ [img.filePath]: stagedPath });
        expect(vscode.workspace.fs.copy).toHaveBeenCalledWith(
            expect.objectContaining({ fsPath: img.filePath }),
            expect.objectContaining({ fsPath: stagedPath }),
            { overwrite: true }
        );
    });

    it('writes a `.gitignore` containing `*` at the cache root on first use', async () => {
        const mgr = new TempFileManager(makeContext());
        const img = makeImage('img1');

        await mgr.stageImagesInWorkspace('stage1', [img], { img1: img.filePath });

        const gitignoreWrite = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls.find(
            ([uri]) => (uri as vscode.Uri).fsPath ===
                `${WORKSPACE_ROOT}/.speckit-companion/.gitignore`
        );
        expect(gitignoreWrite).toBeDefined();
        expect(Buffer.from(gitignoreWrite![1]).toString('utf-8')).toBe('*\n');
    });

    it('does not rewrite the `.gitignore` when it already exists', async () => {
        (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({}); // gitignore present
        const mgr = new TempFileManager(makeContext());
        const img = makeImage('img1');

        await mgr.stageImagesInWorkspace('stage1', [img], { img1: img.filePath });

        const gitignoreWrite = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls.find(
            ([uri]) => (uri as vscode.Uri).fsPath ===
                `${WORKSPACE_ROOT}/.speckit-companion/.gitignore`
        );
        expect(gitignoreWrite).toBeUndefined();
    });

    it('registers the staged set in the manifest with an expiry — and does NOT delete on dispatch', async () => {
        const before = Date.now();
        const mgr = new TempFileManager(makeContext());
        const img = makeImage('img1');

        await mgr.stageImagesInWorkspace('stage1', [img], { img1: img.filePath });

        // No immediate delete of the staged content — cleanup goes through the
        // manifest sweep, never a post-dispatch delete that races the read (#207).
        // (ensureBaseDir's `.write-test` probe is the only delete and it's unrelated.)
        const deletedStaged = (vscode.workspace.fs.delete as jest.Mock).mock.calls.some(
            ([uri]) => (uri as vscode.Uri).fsPath.startsWith(`${WORKSPACE_ROOT}/.speckit-companion`)
        );
        expect(deletedStaged).toBe(false);

        // Manifest now carries the staged set with an ORPHANED-schedule expiry and
        // the in-workspace dir for the sweep to delete later.
        const manifest = JSON.parse(
            Buffer.from(
                await vscode.workspace.fs.readFile(
                    vscode.Uri.file(`${GLOBAL_STORAGE}/spec-editor/manifest.json`)
                )
            ).toString('utf-8')
        );
        const entry = manifest.files['stage1-staged-images'];
        expect(entry).toBeDefined();
        expect(entry.workspaceStageDir).toBe(
            `${WORKSPACE_ROOT}/.speckit-companion/spec-editor/stage1`
        );
        expect(entry.expiresAt).toBeGreaterThanOrEqual(before + CLEANUP_THRESHOLDS.ORPHANED_FILES_MS);
    });

    it('registers under a derived key — never clobbers the temp-set entry with the same id', async () => {
        const mgr = new TempFileManager(makeContext());
        const img = makeImage('img1');

        // Simulate the temp-set entry createTempFileSet wrote under the same id.
        const manifestPath = vscode.Uri.file(`${GLOBAL_STORAGE}/spec-editor/manifest.json`);
        await vscode.workspace.fs.writeFile(
            manifestPath,
            Buffer.from(
                JSON.stringify({
                    files: {
                        stage1: {
                            id: 'stage1',
                            sessionId: 's1',
                            markdownFilePath: `${GLOBAL_STORAGE}/spec-editor/stage1/spec.md`,
                            imageFilePaths: { img1: `${GLOBAL_STORAGE}/spec-editor/stage1/images/img1.png` },
                            createdAt: Date.now(),
                            expiresAt: Date.now() + CLEANUP_THRESHOLDS.ORPHANED_FILES_MS,
                            status: 'active',
                        },
                    },
                })
            )
        );

        await mgr.stageImagesInWorkspace('stage1', [img], { img1: img.filePath });

        const manifest = JSON.parse(
            Buffer.from(await vscode.workspace.fs.readFile(manifestPath)).toString('utf-8')
        );
        // Temp-set entry survives intact (markdownFilePath + no workspaceStageDir),
        // so its baseDir/<id> dir is still reaped by the sweep.
        expect(manifest.files.stage1.markdownFilePath).toBe(
            `${GLOBAL_STORAGE}/spec-editor/stage1/spec.md`
        );
        expect(manifest.files.stage1.workspaceStageDir).toBeUndefined();
        // Staged set lives under its own key.
        expect(manifest.files['stage1-staged-images']).toBeDefined();
    });

    it('cleanup deletes the workspace-staged dir via the manifest sweep when expired', async () => {
        const mgr = new TempFileManager(makeContext());
        const img = makeImage('img1');
        await mgr.stageImagesInWorkspace('stage1', [img], { img1: img.filePath });

        // Force expiry by rewriting the manifest entry's expiresAt into the past.
        const manifestPath = vscode.Uri.file(`${GLOBAL_STORAGE}/spec-editor/manifest.json`);
        const manifest = JSON.parse(
            Buffer.from(await vscode.workspace.fs.readFile(manifestPath)).toString('utf-8')
        );
        manifest.files['stage1-staged-images'].expiresAt = Date.now() - 1000;
        await vscode.workspace.fs.writeFile(manifestPath, Buffer.from(JSON.stringify(manifest)));

        (vscode.workspace.fs.delete as jest.Mock).mockClear();
        const cleaned = await mgr.cleanupOrphanedFiles();

        expect(cleaned).toContain('stage1-staged-images');
        expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(
            expect.objectContaining({
                fsPath: `${WORKSPACE_ROOT}/.speckit-companion/spec-editor/stage1`,
            }),
            { recursive: true }
        );
    });

    it('no-ops (empty map, no manifest entry) when no workspace folder is open', async () => {
        setWorkspace(undefined);
        const mgr = new TempFileManager(makeContext());
        const img = makeImage('img1');

        const map = await mgr.stageImagesInWorkspace('stage1', [img], { img1: img.filePath });

        expect(map).toEqual({});
        expect(vscode.workspace.fs.copy).not.toHaveBeenCalled();
    });

    it('rewriteImageRefsInFile swaps the temp markdown references to staged paths', async () => {
        const mgr = new TempFileManager(makeContext());
        const source = `${GLOBAL_STORAGE}/spec-editor/t1/images/img1.png`;
        const staged = `${WORKSPACE_ROOT}/.speckit-companion/spec-editor/stage1/images/img1.png`;
        const md = `Spec body\n\n## Attached Images\n\n![shot](${source})\n`;

        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from(md));
        let written = '';
        (vscode.workspace.fs.writeFile as jest.Mock).mockImplementationOnce(async (_uri, data) => {
            written = Buffer.from(data).toString('utf-8');
        });

        await mgr.rewriteImageRefsInFile('/gs/spec-editor/t1/spec.md', { [source]: staged });

        expect(written).toContain(`![shot](${staged})`);
        expect(written).not.toContain(source);
    });
});
