import * as vscode from 'vscode';
import { ConfigReader } from './configReader';

export interface IPermissionCache extends vscode.EventEmitter<boolean> {
    get(): Promise<boolean>;
    refresh(): Promise<void>;
    refreshAndGet(): Promise<boolean>;
}

export class PermissionCache extends vscode.EventEmitter<boolean> implements IPermissionCache {
    private cache?: boolean;

    constructor(
        private configReader: ConfigReader,
        private outputChannel: vscode.OutputChannel
    ) {
        super();
    }

    /**
     * Get permission status (uses cache)
     */
    async get(): Promise<boolean> {
        // Return cached value if available
        if (this.cache !== undefined) {
            return this.cache;
        }

        // Otherwise call refreshAndGet
        return this.refreshAndGet();
    }

    /**
     * Refresh cache (no return value)
     */
    async refresh(): Promise<void> {
        await this.refreshAndGet();
    }

    /**
     * Refresh cache and return latest value
     */
    async refreshAndGet(): Promise<boolean> {
        // Save old value
        const oldValue = this.cache;

        // Read latest status from ConfigReader
        this.cache = await this.configReader.getBypassPermissionStatus();

        // Only log when permission status changes
        if (oldValue !== this.cache) {
            this.outputChannel.appendLine(
                `[PermissionCache] Permission changed: ${oldValue} -> ${this.cache}`
            );

            // If permission changed from false to true, fire event
            if (oldValue === false && this.cache === true) {
                this.outputChannel.appendLine(
                    '[PermissionCache] Permission granted! Firing event.'
                );
                this.fire(true);
            }

            // If permission changed from true to false, also fire event
            if (oldValue === true && this.cache === false) {
                this.outputChannel.appendLine(
                    '[PermissionCache] Permission revoked! Firing event.'
                );
                this.fire(false);
            }
        }

        return this.cache;
    }

}
