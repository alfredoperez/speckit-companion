import * as vscode from 'vscode';
import { ConfigReader } from './configReader';
import { PermissionCache, IPermissionCache } from './permissionCache';
import { PermissionWebview } from './permissionWebview';
import { ClaudeCodeProvider } from '../../ai-providers/claudeCodeProvider';
import { NotificationUtils } from '../../core/utils/notificationUtils';

export class PermissionManager {
    private cache: IPermissionCache;
    private configReader: ConfigReader;
    private permissionWebview?: vscode.WebviewPanel;
    private currentTerminal?: vscode.Terminal;
    private disposables: vscode.Disposable[] = [];

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
     * Grant permission (called from WebView)
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
     * Show permission setup flow
     */
    async showPermissionSetup(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                this.outputChannel.appendLine('[PermissionManager] Starting permission setup flow...');
                this.outputChannel.appendLine('[PermissionManager] showPermissionSetup called');

                // Call ClaudeCodeProvider.createPermissionTerminal() to create terminal
                this.currentTerminal = ClaudeCodeProvider.createPermissionTerminal();

                // Create WebView using callback pattern
                PermissionWebview.createOrShow(
                    this.context,
                    {
                        onAccept: async () => {
                            this.outputChannel.appendLine('[PermissionManager] User accepted, granting permission');
                            const success = await this.grantPermission();
                            if (success) {
                                // Close UI elements
                                this.closeUIElements();
                                resolve(true);
                            }
                            return success;
                        },
                        onCancel: () => {
                            this.outputChannel.appendLine('[PermissionManager] User cancelled');
                            // Close UI elements
                            this.closeUIElements();
                            resolve(false);
                        },
                        onDispose: () => {
                            this.outputChannel.appendLine('[PermissionManager] WebView disposed');
                            // Close other UI elements
                            if (this.currentTerminal) {
                                this.currentTerminal.dispose();
                                this.currentTerminal = undefined;
                            }
                            resolve(false);
                        }
                    },
                    this.outputChannel
                );

                // Save WebView reference
                this.permissionWebview = PermissionWebview.currentPanel;
                this.outputChannel.appendLine(
                    `[PermissionManager] WebView reference saved: ${this.permissionWebview ? 'Yes' : 'No'}`
                );
            } catch (error) {
                this.outputChannel.appendLine(
                    `[PermissionManager] Error in showPermissionSetup: ${error}`
                );
                resolve(false);
            }
        });
    }

    /**
     * Close all UI elements
     */
    private closeUIElements(): void {
        this.outputChannel.appendLine('[PermissionManager] Closing UI elements');

        // Close WebView
        if (this.permissionWebview) {
            PermissionWebview.close();
            this.permissionWebview = undefined;
        }

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

        // Clean up WebView and terminal
        if (this.permissionWebview) {
            this.permissionWebview.dispose();
        }
        if (this.currentTerminal) {
            this.currentTerminal.dispose();
        }

        this.outputChannel.appendLine('[PermissionManager] Disposed');
    }
}