import * as vscode from 'vscode';
import { NotificationUtils } from '../../core/utils/notificationUtils';
import { getConfiguredProviderType } from '../../ai-providers/aiProvider';

const GLOBAL_STATE_KEY = 'speckit.permissionSetupComplete';

export class PermissionManager {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Initialize permission system (called on extension startup)
     * Only runs for Claude Code provider in bypassPermissions mode
     */
    async initializePermissions(): Promise<boolean> {
        this.outputChannel.appendLine('[PermissionManager] Initializing permissions...');

        // Check if we're using Claude Code provider
        const providerType = getConfiguredProviderType();
        if (providerType !== 'claude') {
            this.outputChannel.appendLine(`[PermissionManager] Skipping permission check for provider: ${providerType}`);
            return true;
        }

        // Skip if permission mode is "default" (bypass not needed)
        const config = vscode.workspace.getConfiguration('speckit');
        const mode = config.get<string>('claudePermissionMode', 'bypassPermissions');
        if (mode === 'default') {
            this.outputChannel.appendLine('[PermissionManager] Permission mode is "default", skipping bypass setup');
            return true;
        }

        // Check globalState for previous setup completion
        const setupComplete = this.context.globalState.get<boolean>(GLOBAL_STATE_KEY, false);
        if (setupComplete) {
            this.outputChannel.appendLine('[PermissionManager] Permission setup already completed (globalState)');
            return true;
        }

        // First time: show permission setup
        this.outputChannel.appendLine('[PermissionManager] No previous setup found, showing setup');
        const hasPermission = await this.showPermissionSetup();

        if (!hasPermission) {
            // Show warning with retry option
            const retry = await vscode.window.showWarningMessage(
                'Claude Code permissions not granted. Some features may not work.',
                'Try Again',
                'Dismiss'
            );

            if (retry === 'Try Again') {
                return this.showPermissionSetup();
            }
        }

        return hasPermission;
    }

    /**
     * Check permission (reads from globalState)
     */
    async checkPermission(): Promise<boolean> {
        // Skip check if permission mode is "default"
        const config = vscode.workspace.getConfiguration('speckit');
        const mode = config.get<string>('claudePermissionMode', 'bypassPermissions');
        if (mode === 'default') {
            return true;
        }

        return this.context.globalState.get<boolean>(GLOBAL_STATE_KEY, false);
    }

    /**
     * Show permission setup flow (simple confirmation dialog)
     */
    async showPermissionSetup(): Promise<boolean> {
        this.outputChannel.appendLine('[PermissionManager] Starting permission setup flow...');

        const selection = await vscode.window.showInformationMessage(
            'SpecKit Companion requires Claude Code to run with --permission-mode bypassPermissions. ' +
            'Have you already enabled this?',
            'Yes, Enable',
            'Not Yet'
        );

        if (selection === 'Yes, Enable') {
            await this.context.globalState.update(GLOBAL_STATE_KEY, true);
            this.outputChannel.appendLine('[PermissionManager] Permission setup marked complete by user');
            NotificationUtils.showAutoDismissNotification(
                'Claude Code permissions confirmed!'
            );
            return true;
        }

        this.outputChannel.appendLine('[PermissionManager] Permission setup deferred by user');
        return false;
    }

    /**
     * Reset permission state (clears globalState and re-triggers setup)
     */
    async resetPermission(): Promise<boolean> {
        try {
            this.outputChannel.appendLine('[PermissionManager] Resetting permission...');
            await this.context.globalState.update(GLOBAL_STATE_KEY, undefined);
            this.outputChannel.appendLine('[PermissionManager] Permission reset completed');
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
        this.disposables.forEach(d => d.dispose());
        this.outputChannel.appendLine('[PermissionManager] Disposed');
    }
}
