import * as vscode from 'vscode';
import * as path from 'path';
import { DefaultPaths, DefaultViewVisibility, Timing } from '../constants';

const CONFIG_FILE_NAME = 'speckit-settings.json';

export interface SpecKitSettings {
    paths: {
        specs: string;
        steering: string;
        settings: string;
    };
    views: {
        specs: { visible: boolean };
        steering: { visible: boolean };
        mcp: { visible: boolean };
        hooks: { visible: boolean };
        settings: { visible: boolean };
    };
}

export class ConfigManager {
    private static instance: ConfigManager;
    private settings: SpecKitSettings | null = null;
    private workspaceFolder: vscode.WorkspaceFolder | undefined;

    private constructor() {
        this.workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    async loadSettings(): Promise<SpecKitSettings> {
        if (!this.workspaceFolder) {
            return this.getDefaultSettings();
        }

        const settingsPath = path.join(
            this.workspaceFolder.uri.fsPath,
            DefaultPaths.settings,
            CONFIG_FILE_NAME
        );

        try {
            const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(settingsPath));
            const settings = JSON.parse(Buffer.from(fileContent).toString());
            const mergedSettings = { ...this.getDefaultSettings(), ...settings };
            this.settings = mergedSettings;
            return this.settings!;
        } catch (error) {
            // Return default settings if file doesn't exist
            this.settings = this.getDefaultSettings();
            return this.settings!;
        }
    }

    getSettings(): SpecKitSettings {
        if (!this.settings) {
            this.settings = this.getDefaultSettings();
        }
        return this.settings;
    }

    getPath(type: keyof SpecKitSettings['paths']): string {
        const settings = this.getSettings();
        const rawPath = settings.paths[type] || DefaultPaths[type];
        const normalized = this.normalizePath(rawPath);
        return normalized || this.normalizePath(DefaultPaths[type]);
    }

    /**
     * Normalizes a path for consistent matching:
     * - Removes leading ./ or .\
     * - Converts backslashes to forward slashes
     * - Collapses duplicate separators and trims trailing slashes
     */
    private normalizePath(inputPath: string): string {
        if (!inputPath) {
            return inputPath;
        }

        // Start by trimming whitespace and removing repeated leading ./ or .\
        let normalized = inputPath.trim().replace(/^(\.\/|\.\\)+/, '');

        // Normalize path separators to forward slashes for glob compatibility
        normalized = normalized.replace(/\\/g, '/');

        // Collapse any duplicate separators that may result from user input
        normalized = normalized.replace(/\/{2,}/g, '/');

        // Remove trailing slashes for consistent matching
        normalized = normalized.replace(/\/+$/, '');

        return normalized;
    }

    getAbsolutePath(type: keyof SpecKitSettings['paths']): string {
        if (!this.workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        return path.join(this.workspaceFolder.uri.fsPath, this.getPath(type));
    }

    getTerminalDelay(): number {
        return Timing.terminalVenvActivationDelay;
    }

    private getDefaultSettings(): SpecKitSettings {
        return {
            paths: { ...DefaultPaths },
            views: {
                specs: { visible: DefaultViewVisibility.specs },
                steering: { visible: DefaultViewVisibility.steering },
                mcp: { visible: DefaultViewVisibility.mcp },
                hooks: { visible: DefaultViewVisibility.hooks },
                settings: { visible: DefaultViewVisibility.settings }
            }
        };
    }

    async saveSettings(settings: SpecKitSettings): Promise<void> {
        if (!this.workspaceFolder) {
            throw new Error('No workspace folder found');
        }

        const settingsDir = path.join(
            this.workspaceFolder.uri.fsPath,
            DefaultPaths.settings
        );
        const settingsPath = path.join(settingsDir, CONFIG_FILE_NAME);

        // Ensure directory exists
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(settingsDir));

        // Save settings
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(settingsPath),
            Buffer.from(JSON.stringify(settings, null, 2))
        );

        this.settings = settings;
    }
}
