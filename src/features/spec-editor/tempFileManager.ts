import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import type {
    AttachedImage,
    TempSpecFile,
    TempFileManifest,
    TempFileStatus,
    ImageFormat
} from './types';
import { SIZE_LIMITS, CLEANUP_THRESHOLDS } from './types';
import { rewriteImageRefsToStaged } from '../../ai-providers/promptBuilder';

/**
 * Manages temporary markdown files and images for spec editor submissions.
 * Files are stored in globalStorageUri/spec-editor/ with manifest-based tracking.
 * Falls back to OS temp directory if globalStorageUri is not writable.
 */
export class TempFileManager {
    private baseDir: vscode.Uri;
    private manifestPath: vscode.Uri;
    private usingFallback = false;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.baseDir = vscode.Uri.joinPath(context.globalStorageUri, 'spec-editor');
        this.manifestPath = vscode.Uri.joinPath(this.baseDir, 'manifest.json');
    }

    /**
     * Get the fallback temp directory
     */
    private getFallbackDir(): vscode.Uri {
        return vscode.Uri.file(path.join(os.tmpdir(), 'speckit-companion', 'spec-editor'));
    }

    /**
     * Generate a unique ID for sessions and temp files
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Ensure the base directory exists, with fallback to OS temp directory
     */
    private async ensureBaseDir(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.baseDir);
            // Test write access by creating a test file
            const testPath = vscode.Uri.joinPath(this.baseDir, '.write-test');
            await vscode.workspace.fs.writeFile(testPath, Buffer.from('test'));
            await vscode.workspace.fs.delete(testPath);
        } catch (primaryError) {
            // Fall back to OS temp directory
            if (!this.usingFallback) {
                console.warn(`[TempFileManager] Primary directory not writable, falling back to OS temp: ${primaryError}`);
                this.baseDir = this.getFallbackDir();
                this.manifestPath = vscode.Uri.joinPath(this.baseDir, 'manifest.json');
                this.usingFallback = true;

                try {
                    await vscode.workspace.fs.createDirectory(this.baseDir);
                } catch {
                    // Fallback directory may already exist
                }
            }
        }
    }

    /**
     * Read the manifest file, creating if not exists
     */
    private async readManifest(): Promise<TempFileManifest> {
        try {
            const data = await vscode.workspace.fs.readFile(this.manifestPath);
            return JSON.parse(Buffer.from(data).toString('utf-8'));
        } catch {
            // Return default manifest if file doesn't exist
            return {
                version: '1.0',
                files: {},
                lastCleanup: 0
            };
        }
    }

    /**
     * Write the manifest file
     */
    private async writeManifest(manifest: TempFileManifest): Promise<void> {
        await this.ensureBaseDir();
        const content = JSON.stringify(manifest, null, 2);
        await vscode.workspace.fs.writeFile(
            this.manifestPath,
            Buffer.from(content, 'utf-8')
        );
    }

    /**
     * Get the session directory path
     */
    private getSessionDir(sessionId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.baseDir, sessionId);
    }

    /**
     * Get the images directory for a session
     */
    private getImagesDir(sessionId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.getSessionDir(sessionId), 'images');
    }

    /**
     * Extract image format from filename
     */
    private getImageFormat(filename: string): ImageFormat {
        const ext = path.extname(filename).toLowerCase();
        switch (ext) {
            case '.jpg':
            case '.jpeg':
                return 'jpg';
            case '.gif':
                return 'gif';
            case '.webp':
                return 'webp';
            case '.png':
            default:
                return 'png';
        }
    }

    /**
     * Save an image from data URI to disk
     */
    async saveImage(
        sessionId: string,
        name: string,
        dataUri: string
    ): Promise<AttachedImage> {
        await this.ensureBaseDir();

        // Create images directory
        const imagesDir = this.getImagesDir(sessionId);
        await vscode.workspace.fs.createDirectory(imagesDir);

        // Parse data URI
        const matches = dataUri.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            throw new Error('Invalid image data URI');
        }

        const [, , base64Data] = matches;
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Validate size
        if (imageBuffer.length > SIZE_LIMITS.SINGLE_IMAGE_BYTES) {
            throw new Error(`Image exceeds ${SIZE_LIMITS.SINGLE_IMAGE_BYTES / (1024 * 1024)}MB limit`);
        }

        // Generate unique ID and file path
        const imageId = this.generateId();
        const format = this.getImageFormat(name);
        const fileName = `${imageId}.${format}`;
        const filePath = vscode.Uri.joinPath(imagesDir, fileName);

        // Write file
        await vscode.workspace.fs.writeFile(filePath, imageBuffer);

        // Generate thumbnail (just use original for now, could resize later)
        const thumbnailDataUri = dataUri;

        const image: AttachedImage = {
            id: imageId,
            sessionId,
            originalName: name,
            format,
            size: imageBuffer.length,
            thumbnailDataUri,
            filePath: filePath.fsPath,
            addedAt: Date.now()
        };

        return image;
    }

    /**
     * Stage attached images into a self-gitignored cache dir INSIDE the workspace
     * so a sandboxed CLI (OpenCode) — which auto-rejects reads outside the project
     * root — can read them. globalStorage is outside that sandbox; this copies the
     * images into `<workspace-root>/.speckit-companion/spec-editor/<stageId>/images/`
     * and writes a `.gitignore` containing `*` at the cache root on first use so the
     * tree never shows in `git status`.
     *
     * The staged set is registered in the manifest (images-only, `expiresAt` on the
     * existing orphaned schedule) so it's reaped by `cleanupOrphanedFiles` — NOT by
     * an immediate post-dispatch delete, which would race the agent's async read
     * (see #207). Returns a map of the source globalStorage fsPath → staged fsPath
     * for rewriting the inlined image references; returns an empty map (no-op) when
     * no workspace folder is open or a copy fails — callers fall back to the
     * original references.
     */
    async stageImagesInWorkspace(
        stageId: string,
        images: AttachedImage[],
        sourcePaths: Record<string, string>
    ): Promise<Record<string, string>> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot || images.length === 0) {
            return {};
        }

        const cacheRoot = vscode.Uri.joinPath(workspaceRoot, '.speckit-companion');
        const stagedImagesDir = vscode.Uri.joinPath(cacheRoot, 'spec-editor', stageId, 'images');

        const rewriteMap: Record<string, string> = {};
        try {
            await vscode.workspace.fs.createDirectory(stagedImagesDir);
            await this.ensureCacheGitignore(cacheRoot);

            const stagedPaths: Record<string, string> = {};
            for (const image of images) {
                const source = sourcePaths[image.id];
                if (!source) {
                    continue;
                }
                const destPath = vscode.Uri.joinPath(
                    stagedImagesDir,
                    `${image.id}.${image.format}`
                );
                await vscode.workspace.fs.copy(
                    vscode.Uri.file(source),
                    destPath,
                    { overwrite: true }
                );
                stagedPaths[image.id] = destPath.fsPath;
                rewriteMap[source] = destPath.fsPath;
            }

            if (Object.keys(stagedPaths).length === 0) {
                return {};
            }

            // Register a SEPARATE images-only entry so the existing expiry sweep
            // reaps the workspace dir. The key must NOT collide with the temp-set's
            // own manifest entry (keyed by `stageId` in createTempFileSet) — reusing
            // `stageId` here would clobber that entry, losing its markdownFilePath
            // and, because the overwritten entry would carry `workspaceStageDir`,
            // making cleanup skip the original `baseDir/<stageId>` dir (a leak). Use
            // a derived key; markdownFilePath is empty (no markdown staged here) and
            // workspaceStageDir records the in-workspace dir for the sweep to delete.
            const manifestKey = `${stageId}-staged-images`;
            const manifest = await this.readManifest();
            manifest.files[manifestKey] = {
                id: manifestKey,
                sessionId: stageId,
                markdownFilePath: '',
                imageFilePaths: stagedPaths,
                workspaceStageDir: vscode.Uri.joinPath(cacheRoot, 'spec-editor', stageId).fsPath,
                createdAt: Date.now(),
                expiresAt: Date.now() + CLEANUP_THRESHOLDS.ORPHANED_FILES_MS,
                status: 'submitted'
            };
            await this.writeManifest(manifest);

            return rewriteMap;
        } catch (e) {
            console.error(`[TempFileManager] Failed to stage images in workspace: ${e}`);
            return {};
        }
    }

    /**
     * Rewrite the markdown image references in a temp markdown file from their
     * source (globalStorage) paths to staged in-workspace paths, in place. Used
     * after `stageImagesInWorkspace` so the inlined OpenCode prompt carries
     * readable in-project image paths.
     */
    async rewriteImageRefsInFile(
        filePath: string,
        rewriteMap: Record<string, string>
    ): Promise<void> {
        if (Object.keys(rewriteMap).length === 0) {
            return;
        }
        const uri = vscode.Uri.file(filePath);
        const existing = await vscode.workspace.fs.readFile(uri);
        const rewritten = rewriteImageRefsToStaged(
            Buffer.from(existing).toString('utf-8'),
            rewriteMap
        );
        await vscode.workspace.fs.writeFile(uri, Buffer.from(rewritten, 'utf-8'));
    }

    /**
     * Write a `.gitignore` containing `*` at the cache root on first use so the
     * whole ephemeral cache tree is invisible to git. Idempotent — skips when the
     * file already exists.
     */
    private async ensureCacheGitignore(cacheRoot: vscode.Uri): Promise<void> {
        const gitignorePath = vscode.Uri.joinPath(cacheRoot, '.gitignore');
        try {
            await vscode.workspace.fs.stat(gitignorePath);
            return; // already exists
        } catch {
            // not present — create it
        }
        await vscode.workspace.fs.writeFile(gitignorePath, Buffer.from('*\n', 'utf-8'));
    }

    /**
     * Delete an image file
     */
    async deleteImage(filePath: string): Promise<void> {
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(filePath));
        } catch {
            // File may already be deleted
        }
    }

    /**
     * Create a temp file set for submission
     */
    async createTempFileSet(
        sessionId: string,
        content: string,
        images: AttachedImage[]
    ): Promise<TempSpecFile> {
        await this.ensureBaseDir();

        const tempId = this.generateId();
        const tempDir = vscode.Uri.joinPath(this.baseDir, tempId);
        await vscode.workspace.fs.createDirectory(tempDir);

        // Copy images to temp directory
        const tempImagesDir = vscode.Uri.joinPath(tempDir, 'images');
        const imageFilePaths: Record<string, string> = {};

        if (images.length > 0) {
            await vscode.workspace.fs.createDirectory(tempImagesDir);

            for (const image of images) {
                const destPath = vscode.Uri.joinPath(
                    tempImagesDir,
                    `${image.id}.${image.format}`
                );
                try {
                    await vscode.workspace.fs.copy(
                        vscode.Uri.file(image.filePath),
                        destPath
                    );
                    imageFilePaths[image.id] = destPath.fsPath;
                } catch (e) {
                    // Image may have been deleted, skip
                    console.error(`Failed to copy image ${image.id}: ${e}`);
                }
            }
        }

        // Create markdown file
        const markdownPath = vscode.Uri.joinPath(tempDir, 'spec.md');
        const markdownContent = this.generateMarkdownContent(content, images, imageFilePaths);
        await vscode.workspace.fs.writeFile(
            markdownPath,
            Buffer.from(markdownContent, 'utf-8')
        );

        const tempFile: TempSpecFile = {
            id: tempId,
            sessionId,
            markdownFilePath: markdownPath.fsPath,
            imageFilePaths,
            createdAt: Date.now(),
            expiresAt: Date.now() + CLEANUP_THRESHOLDS.ORPHANED_FILES_MS,
            status: 'active'
        };

        // Update manifest
        const manifest = await this.readManifest();
        manifest.files[tempId] = tempFile;
        await this.writeManifest(manifest);

        return tempFile;
    }

    /**
     * Generate markdown content with image references
     */
    private generateMarkdownContent(
        content: string,
        images: AttachedImage[],
        imageFilePaths: Record<string, string>
    ): string {
        let markdown = content;

        if (images.length > 0) {
            markdown += '\n\n## Attached Images\n\n';
            for (const image of images) {
                const imagePath = imageFilePaths[image.id];
                if (imagePath) {
                    markdown += `![${image.originalName}](${imagePath})\n\n`;
                }
            }
        }

        return markdown;
    }

    /**
     * Generate markdown for use with AI CLI (returns content, doesn't write file)
     */
    async generateMarkdown(
        _tempFileId: string,
        content: string,
        images: AttachedImage[]
    ): Promise<string> {
        const manifest = await this.readManifest();
        const tempFile = manifest.files[_tempFileId];

        if (!tempFile) {
            // No temp file, just return content with inline image paths
            return this.generateMarkdownContent(content, images, {});
        }

        return this.generateMarkdownContent(content, images, tempFile.imageFilePaths);
    }

    /**
     * Mark a temp file set as submitted
     */
    async markSubmitted(tempFileId: string): Promise<void> {
        await this.updateStatus(tempFileId, 'submitted');
    }

    /**
     * Mark a temp file set as completed (schedules cleanup after grace period)
     */
    async markCompleted(tempFileId: string): Promise<void> {
        const manifest = await this.readManifest();
        const tempFile = manifest.files[tempFileId];

        if (tempFile) {
            tempFile.status = 'completed';
            tempFile.expiresAt = Date.now() + CLEANUP_THRESHOLDS.COMPLETED_FILES_MS;
            await this.writeManifest(manifest);
        }
    }

    /**
     * Update the status of a temp file
     */
    private async updateStatus(tempFileId: string, status: TempFileStatus): Promise<void> {
        const manifest = await this.readManifest();
        const tempFile = manifest.files[tempFileId];

        if (tempFile) {
            tempFile.status = status;
            await this.writeManifest(manifest);
        }
    }

    /**
     * Clean up orphaned and expired files
     * Should be called on extension activation
     */
    async cleanupOrphanedFiles(): Promise<string[]> {
        const cleanedIds: string[] = [];
        const now = Date.now();

        try {
            const manifest = await this.readManifest();

            for (const [id, tempFile] of Object.entries(manifest.files)) {
                const isExpired = now > tempFile.expiresAt;
                const isOrphaned = tempFile.status === 'orphaned' &&
                    (now - tempFile.createdAt) > CLEANUP_THRESHOLDS.ORPHANED_FILES_MS;
                const isCompleted = tempFile.status === 'completed' &&
                    (now - tempFile.createdAt) > CLEANUP_THRESHOLDS.COMPLETED_FILES_MS;

                if (isExpired || isOrphaned || isCompleted) {
                    // Delete the directory. Workspace-staged sets (OpenCode image
                    // staging) live under the workspace, not baseDir — delete the
                    // recorded staged dir for those; otherwise the baseDir/<id> dir.
                    try {
                        const dir = tempFile.workspaceStageDir
                            ? vscode.Uri.file(tempFile.workspaceStageDir)
                            : vscode.Uri.joinPath(this.baseDir, id);
                        await vscode.workspace.fs.delete(dir, { recursive: true });
                    } catch {
                        // Directory may already be deleted
                    }

                    delete manifest.files[id];
                    cleanedIds.push(id);
                }
            }

            if (cleanedIds.length > 0) {
                manifest.lastCleanup = now;
                await this.writeManifest(manifest);
            }

            return cleanedIds;
        } catch (e) {
            console.error('Failed to cleanup orphaned files:', e);
            return [];
        }
    }

    /**
     * Delete a session's images directory
     */
    async cleanupSession(sessionId: string): Promise<void> {
        try {
            const sessionDir = this.getSessionDir(sessionId);
            await vscode.workspace.fs.delete(sessionDir, { recursive: true });
        } catch {
            // Directory may not exist
        }
    }

    /**
     * Get the markdown file path for a temp file set
     */
    async getTempFilePath(tempFileId: string): Promise<string | undefined> {
        const manifest = await this.readManifest();
        return manifest.files[tempFileId]?.markdownFilePath;
    }

    /**
     * Append additional content to an existing markdown file (used for
     * trailing instruction blocks the AI should read but the terminal
     * shouldn't display).
     */
    async appendToMarkdownFile(filePath: string, content: string): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        const existing = await vscode.workspace.fs.readFile(uri);
        const merged = Buffer.concat([
            Buffer.from(existing),
            Buffer.from('\n\n' + content, 'utf-8'),
        ]);
        await vscode.workspace.fs.writeFile(uri, merged);
    }
}
