import * as vscode from 'vscode';
import { NotificationUtils } from '../core/utils/notificationUtils';

export class UpdateChecker {
    private static readonly SKIP_VERSION_KEY = 'speckit.skipVersion';
    private static readonly LAST_CHECK_KEY = 'speckit.lastUpdateCheck';
    private static readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    
    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
    ) {}
    
    /**
     * Check for updates
     * @param force Force check even if already checked today
     */
    async checkForUpdates(force = false): Promise<void> {
        // Skip if already checked today (unless forced)
        if (!force && this.hasCheckedRecently()) {
            return;
        }
        
        try {
            const currentVersion = this.getCurrentVersion();
            if (!currentVersion) {
                this.outputChannel.appendLine('[UpdateChecker] ERROR: Could not get current extension version');
                return;
            }
            
            this.outputChannel.appendLine(`[UpdateChecker] Checking for updates... (current: ${currentVersion})`)
            
            // Fetch latest release from GitHub
            const latestRelease = await this.fetchLatestRelease();
            if (!latestRelease) {
                return;
            }
            
            const latestVersion = latestRelease.tag_name.replace(/^v/, '');
            const skipVersion = this.context.globalState.get<string>(UpdateChecker.SKIP_VERSION_KEY);
            
            // Check if there's a new version that hasn't been skipped
            if (this.isNewerVersion(currentVersion, latestVersion) && latestVersion !== skipVersion) {
                this.showUpdateNotification(currentVersion, latestVersion);
            }
            
            // Update last check timestamp
            await this.context.globalState.update(UpdateChecker.LAST_CHECK_KEY, Date.now());
            this.outputChannel.appendLine('[UpdateChecker] Update check completed');
            
        } catch (error) {
            this.outputChannel.appendLine(`[UpdateChecker] ERROR: Failed to check for updates: ${error}`);
        }
    }
    
    /**
     * Get current extension version
     */
    private getCurrentVersion(): string | undefined {
        const extension = vscode.extensions.getExtension('alfredo-dev.speckit-companion');
        return extension?.packageJSON.version;
    }

    /**
     * Fetch latest release from GitHub API
     */
    private async fetchLatestRelease(): Promise<any> {
        try {
            this.outputChannel.appendLine('[UpdateChecker] Fetching latest release from GitHub...');
            const response = await fetch('https://api.github.com/repos/alfredoperez/speckit-companion/releases/latest');
            
            if (!response.ok) {
                this.outputChannel.appendLine(`[UpdateChecker] GitHub API returned ${response.status}: ${response.statusText}`);
                return null;
            }
            
            const release: any = await response.json();
            this.outputChannel.appendLine(`[UpdateChecker] Latest release: ${release?.tag_name || 'unknown'}`);
            return release;
        } catch (error) {
            this.outputChannel.appendLine(`[UpdateChecker] ERROR: Failed to fetch latest release: ${error}`);
            return null;
        }
    }
    
    /**
     * Show update notification
     */
    private showUpdateNotification(currentVersion: string, latestVersion: string): void {
        const message = `🎉 SpecKit Companion ${latestVersion} is available! (current: ${currentVersion})`;
        this.outputChannel.appendLine(`[UpdateChecker] Showing update notification: ${message}`);

        vscode.window.showInformationMessage(
            message,
            'View Changelog',
            'Skip'
        ).then(async (selection) => {
            if (selection === 'View Changelog') {
                // Open GitHub releases page
                const releaseUrl = 'https://github.com/alfredoperez/speckit-companion/releases/latest';
                await vscode.env.openExternal(vscode.Uri.parse(releaseUrl));
            } else if (selection === 'Skip') {
                // Remember skipped version
                await this.context.globalState.update(UpdateChecker.SKIP_VERSION_KEY, latestVersion);
                // Show confirmation that auto-dismisses after 5 seconds
                await NotificationUtils.showAutoDismissNotification(
                    `Version ${latestVersion} will be skipped in future checks.`,
                    5000
                );
            }
        });
    }
    
    /**
     * Compare version strings
     */
    private isNewerVersion(current: string, latest: string): boolean {
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            const currentPart = currentParts[i] || 0;
            const latestPart = latestParts[i] || 0;
            
            if (latestPart > currentPart) {
                return true;
            }
            if (latestPart < currentPart) {
                return false;
            }
        }
        
        return false;
    }
    
    /**
     * Check if we've already checked for updates recently
     */
    private hasCheckedRecently(): boolean {
        const lastCheck = this.context.globalState.get<number>(UpdateChecker.LAST_CHECK_KEY, 0);
        const now = Date.now();
        return (now - lastCheck) < UpdateChecker.CHECK_INTERVAL;
    }
    
    /**
     * Clear skip version (useful for testing or resetting)
     */
    async clearSkipVersion(): Promise<void> {
        await this.context.globalState.update(UpdateChecker.SKIP_VERSION_KEY, undefined);
    }
}