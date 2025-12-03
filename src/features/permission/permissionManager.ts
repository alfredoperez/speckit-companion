import * as vscode from 'vscode';
import { ConfigReader } from './configReader';
import { PermissionCache, IPermissionCache } from './permissionCache';
import { ClaudeCodeProvider } from '../../ai-providers/claudeCodeProvider';
import { NotificationUtils } from '../../core/utils/notificationUtils';

export class PermissionManager {
    private cache: IPermissionCache;
    private configReader: ConfigReader;
    private currentTerminal?: vscode.Terminal;
    private disposables: vscode.Disposable[] = [];
    private permissionCheckInterval?: ReturnType<typeof setInterval>;

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {
        // Initialize ConfigReader and PermissionCache
        this.configReader = new ConfigReader(outputChannel);
        this.cache = new PermissionCache(this.configReader, outputChannel);

        // Listen to cache permission change events
        const eventDisposable = this.cache.event(async (hasPermission) => {
            this.outputChannel.appendLine(
                `[PermissionManager] Event received with hasPermission: ${hasPermission}`
            );
            if (hasPermission) {
                // Permission was granted
                this.outputChannel.appendLine(
                    '[PermissionManager] Permission granted detected, closing UI elements'
                );

                // Close all UI elements
                this.outputChannel.appendLine('[PermissionManager] Permission granted, closing UI elements');
                this.closeUIElements();

                // Show success notification
                NotificationUtils.showAutoDismissNotification(
                    '✅ Claude Code permissions detected and verified!'
                );
            } else {
                // Permission was revoked
                this.outputChannel.appendLine(
                    '[PermissionManager] Permission revoked detected, showing setup'
                );

                // Show warning
                vscode.window.showWarningMessage(
                    'Claude Code permissions have been revoked. Please grant permissions again.'
                );

                // Show permission setup UI
                await this.showPermissionSetup();
            }
        });

        this.disposables.push(eventDisposable);
    }

    /**
     * Initialize permission system (called on extension startup)
     */
    async initializePermissions(): Promise<boolean> {
        this.outputChannel.appendLine('[PermissionManager] Initializing permissions...');

        // Always start file monitoring to detect permission changes
        this.startMonitoring();

        // Call cache.refreshAndGet() to check permissions
        let hasPermission = await this.cache.refreshAndGet();

        if (hasPermission) {
            this.outputChannel.appendLine('[PermissionManager] Permissions already granted');
            return true;
        }

        // If no permissions, try showing setup UI
        this.outputChannel.appendLine('[PermissionManager] No permissions found, showing setup');

        // First time, directly show permission setup
        hasPermission = await this.showPermissionSetup();

        // If user cancelled in webview, enter retry loop
        while (!hasPermission) {
            // Show warning with retry options
            const retry = await vscode.window.showWarningMessage(
                'Claude Code permissions not granted. The extension will not work. Please approve or uninstall.',
                'Try Again',
                'Uninstall'
            );

            if (retry === 'Try Again') {
                // Call permission setup flow again
                const granted = await this.showPermissionSetup();
                if (granted) {
                    hasPermission = true;
                }
            } else if (retry === 'Uninstall') {
                // User clicked Uninstall
                this.outputChannel.appendLine('[PermissionManager] User chose to uninstall');

                // Show confirmation dialog first
                const confirm = await vscode.window.showWarningMessage(
                    'Are you sure you want to uninstall SpecKit Companion?',
                    'Keep It',
                    'Uninstall'
                );

                if (confirm === 'Uninstall') {
                    try {
                        // Execute uninstall command
                        await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', 'alfredo-dev.speckit-companion');
                        this.outputChannel.appendLine('[PermissionManager] Uninstall command executed');
                    } catch (error) {
                        this.outputChannel.appendLine(`[PermissionManager] Failed to uninstall: ${error}`);
                    }
                    await vscode.commands.executeCommand('extension.open', 'alfredo-dev.speckit-companion');
                    break;
                }

            }
        }

        return hasPermission;
    }

    /**
     * Check permission (uses cache)
     */
    async checkPermission(): Promise<boolean> {
        return this.cache.get();
    }

    /**
     * Grant permission programmatically
     */
    async grantPermission(): Promise<boolean> {
        try {
            // Call ConfigReader to set permission
            await this.configReader.setBypassPermission(true);

            // Refresh cache
            await this.cache.refresh();

            // Log success
            this.outputChannel.appendLine(
                '[PermissionManager] Permission granted via WebView'
            );

            return true;
        } catch (error) {
            this.outputChannel.appendLine(
                `[PermissionManager] Failed to grant permission: ${error}`
            );
            return false;
        }
    }

    /**
     * Show permission setup flow (simplified - terminal only, no WebView popup)
     */
    async showPermissionSetup(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                this.outputChannel.appendLine('[PermissionManager] Starting permission setup flow...');

                // Create terminal for user to approve permissions
                this.currentTerminal = ClaudeCodeProvider.createPermissionTerminal();

                // Show notification with instructions
                vscode.window.showInformationMessage(
                    'Claude Code permissions required. Please approve in the terminal that just opened.',
                    'OK'
                );

                // Poll for permission changes (file monitoring will also catch this)
                let checkCount = 0;
                const maxChecks = 300; // 5 minutes at 1 second intervals

                this.permissionCheckInterval = setInterval(async () => {
                    checkCount++;

                    const hasPermission = await this.cache.refreshAndGet();
                    if (hasPermission) {
                        this.outputChannel.appendLine('[PermissionManager] Permission detected via polling');
                        this.clearPermissionCheckInterval();
                        this.closeUIElements();
                        resolve(true);
                        return;
                    }

                    // Check if terminal was closed by user
                    if (!this.currentTerminal || this.currentTerminal.exitStatus !== undefined) {
                        this.outputChannel.appendLine('[PermissionManager] Terminal closed by user');
                        this.clearPermissionCheckInterval();
                        resolve(false);
                        return;
                    }

                    // Timeout after 5 minutes
                    if (checkCount >= maxChecks) {
                        this.outputChannel.appendLine('[PermissionManager] Permission check timed out');
                        this.clearPermissionCheckInterval();
                        this.closeUIElements();
                        resolve(false);
                    }
                }, 1000);

            } catch (error) {
                this.outputChannel.appendLine(
                    `[PermissionManager] Error in showPermissionSetup: ${error}`
                );
                resolve(false);
            }
        });
    }

    /**
     * Clear the permission check interval
     */
    private clearPermissionCheckInterval(): void {
        if (this.permissionCheckInterval) {
            clearInterval(this.permissionCheckInterval);
            this.permissionCheckInterval = undefined;
        }
    }

    /**
     * Close all UI elements
     */
    private closeUIElements(): void {
        this.outputChannel.appendLine('[PermissionManager] Closing UI elements');

        // Clear any pending interval
        this.clearPermissionCheckInterval();

        // Close terminal
        if (this.currentTerminal) {
            this.currentTerminal.dispose();
            this.currentTerminal = undefined;
        }
    }

    /**
     * Start file monitoring
     */
    startMonitoring(): void {
        this.outputChannel.appendLine('[PermissionManager] Starting file monitoring...');

        // Call configReader.watchConfigFile()
        this.configReader.watchConfigFile(async () => {
            // Refresh cache when file changes
            await this.cache.refresh();
        });
    }

    /**
     * Reset permission state (set to false)
     */
    async resetPermission(): Promise<boolean> {
        try {
            this.outputChannel.appendLine('[PermissionManager] Resetting permission to false...');

            // Call ConfigReader to set permission to false
            await this.configReader.setBypassPermission(false);

            // Refresh cache
            await this.cache.refresh();

            this.outputChannel.appendLine('[PermissionManager] Permission reset completed');

            // After permission is reset, event will trigger and show setup UI automatically
            return true;
        } catch (error) {
            this.outputChannel.appendLine(
                `[PermissionManager] Failed to reset permission: ${error}`
            );
            return false;
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        // Clean up all disposables
        this.disposables.forEach(d => d.dispose());

        // Clean up ConfigReader
        this.configReader.dispose();

        // Clear any pending interval
        this.clearPermissionCheckInterval();

        // Clean up terminal
        if (this.currentTerminal) {
            this.currentTerminal.dispose();
        }

        this.outputChannel.appendLine('[PermissionManager] Disposed');
    }
}