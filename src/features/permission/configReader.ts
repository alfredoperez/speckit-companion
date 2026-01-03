import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { ClaudeConfig } from '../../core/types/config';
import { handleError } from '../../core/errors';

export class ConfigReader {
    private configPath: string;
    private watchCallback?: () => void;

    constructor(private outputChannel: vscode.OutputChannel) {
        this.configPath = path.join(os.homedir(), '.claude.json');
    }

    /**
     * Read the bypassPermissionsModeAccepted field value
     */
    async getBypassPermissionStatus(): Promise<boolean> {
        try {
            // Check if file exists
            if (!fs.existsSync(this.configPath)) {
                this.outputChannel.appendLine(`[ConfigReader] Config file not found: ${this.configPath}`);
                return false;
            }

            // Read file content
            const content = await fs.promises.readFile(this.configPath, 'utf8');

            // Parse JSON
            const config = JSON.parse(content);

            // Return permission field value, defaults to false
            const hasPermission = config.bypassPermissionsModeAccepted === true;

            return hasPermission;
        } catch (error) {
            handleError(error, { outputChannel: this.outputChannel, context: 'ConfigReader.getBypassPermissionStatus' });
            return false;
        }
    }

    /**
     * Set the bypassPermissionsModeAccepted field value
     */
    async setBypassPermission(value: boolean): Promise<void> {
        try {
            let config: ClaudeConfig = {};

            // If file exists, read existing config first
            if (fs.existsSync(this.configPath)) {
                const content = await fs.promises.readFile(this.configPath, 'utf8');
                let parseSuccess = false;

                try {
                    config = JSON.parse(content);
                    parseSuccess = true;
                } catch {
                    // If parse fails, retry twice
                    this.outputChannel.appendLine(`[ConfigReader] Failed to parse existing config, retrying...`);
                    for (let i = 0; i < 2; i++) {
                        try {
                            config = JSON.parse(content);
                            parseSuccess = true;
                            break;
                        } catch {
                            this.outputChannel.appendLine(`[ConfigReader] Retry ${i + 1} failed to parse config`);
                        }
                    }
                }

                // If still fails, use empty object
                if (!parseSuccess) {
                    this.outputChannel.appendLine(`[ConfigReader] All parse attempts failed, using empty config object`);
                    config = {};
                }
            }

            // Set permission field
            config.bypassPermissionsModeAccepted = value;

            // Ensure directory exists
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }

            // Write back to file (keep 2-space indent format)
            await fs.promises.writeFile(
                this.configPath,
                JSON.stringify(config, null, 2),
                'utf8'
            );

            this.outputChannel.appendLine(
                `[ConfigReader] Set bypassPermissionsModeAccepted to ${value}`
            );
        } catch (error) {
            handleError(error, { outputChannel: this.outputChannel, context: 'ConfigReader.setBypassPermission', rethrow: true });
        }
    }

    /**
     * Watch config file for changes
     */
    watchConfigFile(callback: () => void): void {
        // Save callback
        this.watchCallback = callback;

        // Use fs.watchFile to watch file changes
        // Testing shows this is the most reliable method
        fs.watchFile(this.configPath, { interval: 2000 }, (curr, prev) => {
            if (curr.mtime.getTime() !== prev.mtime.getTime()) {
                // Call callback when file changes, logging happens on permission change
                callback();
            }
        });

        this.outputChannel.appendLine(
            `[ConfigReader] Started watching config file: ${this.configPath}`
        );
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        // Stop watching file
        if (this.watchCallback) {
            fs.unwatchFile(this.configPath);
            this.outputChannel.appendLine('[ConfigReader] Stopped watching config file');
        }
    }
}
