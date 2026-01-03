import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * File system utilities for consistent file operations
 */
export class FileSystemUtils {
    /**
     * Check if a file exists
     */
    static async exists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if a file exists (synchronous)
     */
    static existsSync(filePath: string): boolean {
        return fs.existsSync(filePath);
    }

    /**
     * Read a file as text
     */
    static async readFile(filePath: string): Promise<string> {
        return fs.promises.readFile(filePath, 'utf8');
    }

    /**
     * Read a file as text (synchronous)
     */
    static readFileSync(filePath: string): string {
        return fs.readFileSync(filePath, 'utf8');
    }

    /**
     * Write content to a file
     */
    static async writeFile(filePath: string, content: string): Promise<void> {
        await fs.promises.writeFile(filePath, content, 'utf8');
    }

    /**
     * Ensure a directory exists, creating it if necessary
     */
    static async ensureDirectory(dirPath: string): Promise<void> {
        await fs.promises.mkdir(dirPath, { recursive: true });
    }

    /**
     * Get the workspace root path
     */
    static getWorkspaceRoot(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        return folders?.[0]?.uri.fsPath;
    }

    /**
     * Join paths relative to workspace root
     */
    static workspacePath(...segments: string[]): string | undefined {
        const root = FileSystemUtils.getWorkspaceRoot();
        if (!root) return undefined;
        return path.join(root, ...segments);
    }

    /**
     * Read directory contents
     */
    static async readDirectory(dirPath: string): Promise<string[]> {
        return fs.promises.readdir(dirPath);
    }

    /**
     * Check if path is a directory
     */
    static async isDirectory(filePath: string): Promise<boolean> {
        try {
            const stats = await fs.promises.stat(filePath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }
}
