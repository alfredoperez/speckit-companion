import * as vscode from 'vscode';
import * as fs from 'fs';

// 定义回调接口
interface PermissionWebviewCallbacks {
    onAccept: () => Promise<boolean>;
    onCancel: () => void;
    onDispose: () => void;
}

export class PermissionWebview {
    public static currentPanel: vscode.WebviewPanel | undefined;
    private static messageDisposable: vscode.Disposable | undefined;
    private static disposeDisposable: vscode.Disposable | undefined;
    private static callbacks: PermissionWebviewCallbacks | undefined;
    private static outputChannel: vscode.OutputChannel;

    public static createOrShow(
        context: vscode.ExtensionContext, 
        callbacks: PermissionWebviewCallbacks,
        outputChannel?: vscode.OutputChannel
    ): void {
        // Use provided output channel or create a default one
        if (outputChannel) {
            this.outputChannel = outputChannel;
        } else if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('SpecKit Companion - Debug');
        }
        this.outputChannel.appendLine(
            `[PermissionWebview] createOrShow called, current state: ` +
            `hasPanel: ${!!PermissionWebview.currentPanel}, ` +
            `hasCallbacks: ${!!PermissionWebview.callbacks}, ` +
            `hasMessageDisposable: ${!!PermissionWebview.messageDisposable}, ` +
            `hasDisposeDisposable: ${!!PermissionWebview.disposeDisposable}`
        );
        
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Clean up previous event listeners
        if (PermissionWebview.messageDisposable) {
            PermissionWebview.messageDisposable.dispose();
            PermissionWebview.messageDisposable = undefined;
        }
        if (PermissionWebview.disposeDisposable) {
            PermissionWebview.disposeDisposable.dispose();
            PermissionWebview.disposeDisposable = undefined;
        }

        // If we already have a panel, show it
        if (PermissionWebview.currentPanel) {
            this.outputChannel.appendLine('[PermissionWebview] Revealing existing panel');
            PermissionWebview.currentPanel.reveal(column);
        } else {
            // Otherwise, create a new panel
            this.outputChannel.appendLine('[PermissionWebview] Creating new panel');
            try {
                const panel = vscode.window.createWebviewPanel(
                    'claudePermission',
                    'Claude Code Permission',
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
                    }
                );

                PermissionWebview.currentPanel = panel;
                this.outputChannel.appendLine('[PermissionWebview] Panel created successfully');
                
                // Get path to media
                const mediaPath = vscode.Uri.joinPath(context.extensionUri, 'media');
                
                // Read HTML template from file
                const htmlPath = vscode.Uri.joinPath(mediaPath, 'permission.html').fsPath;
                let htmlContent = fs.readFileSync(htmlPath, 'utf8');
                
                // Replace placeholders with actual values
                // Since we're not using image anymore, we can remove IMAGE_PATH placeholder
                // The HTML is already updated to use text instead of image
                
                // Set the webview's initial html content
                panel.webview.html = htmlContent;
            } catch (error) {
                this.outputChannel.appendLine(`[PermissionWebview] Failed to create panel: ${error}`);
                callbacks.onCancel();
                return;
            }
        }

        // Store callbacks
        PermissionWebview.callbacks = callbacks;
        
        const panel = PermissionWebview.currentPanel;
        if (!panel) {
            this.outputChannel.appendLine('[PermissionWebview] ERROR: No panel available after creation!');
            callbacks.onCancel();
            return;
        }
        this.outputChannel.appendLine('[PermissionWebview] Setting up message handlers');

            // Handle messages from the webview
            PermissionWebview.messageDisposable = panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'accept':
                            if (PermissionWebview.callbacks) {
                                const success = await PermissionWebview.callbacks.onAccept();
                                if (!success) {
                                    // 更新 UI 状态显示失败
                                    panel.webview.postMessage({
                                        command: 'updateStatus',
                                        status: 'failed',
                                        message: '无法设置权限，请重试'
                                    });
                                }
                                // 注意：不在这里关闭 webview，由 Manager 控制
                            }
                            return;
                        case 'cancel':
                            this.outputChannel.appendLine('[PermissionWebview] Cancel clicked');
                            if (PermissionWebview.callbacks) {
                                PermissionWebview.callbacks.onCancel();
                            }
                            // 注意：不在这里关闭 webview，由 Manager 控制
                            return;
                        case 'openIssue':
                            await vscode.env.openExternal(vscode.Uri.parse('https://github.com/alfredoperez/speckit-companion/issues'));
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );

            // Reset when the current panel is closed
            PermissionWebview.disposeDisposable = panel.onDidDispose(
                () => {
                    this.outputChannel.appendLine('[PermissionWebview] Panel disposed via window close');
                    if (PermissionWebview.callbacks) {
                        PermissionWebview.callbacks.onDispose();
                    }
                    // 注意：清理工作由 Manager 控制
                },
                null,
                context.subscriptions
            );
    }

    /**
     * Forcefully close the current webview panel
     * This is called when permission is granted through the terminal
     */
    public static close(): void {
        if (this.outputChannel) {
            this.outputChannel.appendLine(
                `[PermissionWebview] close called, current state: ` +
                `hasPanel: ${!!PermissionWebview.currentPanel}`
            );
        }
        
        if (PermissionWebview.currentPanel) {
            // Clean up event listeners
            if (PermissionWebview.messageDisposable) {
                PermissionWebview.messageDisposable.dispose();
                PermissionWebview.messageDisposable = undefined;
            }
            if (PermissionWebview.disposeDisposable) {
                PermissionWebview.disposeDisposable.dispose();
                PermissionWebview.disposeDisposable = undefined;
            }

            // Dispose the panel
            PermissionWebview.currentPanel.dispose();
            PermissionWebview.currentPanel = undefined;
            PermissionWebview.callbacks = undefined;
            
            if (this.outputChannel) {
                this.outputChannel.appendLine('[PermissionWebview] close cleanup complete');
            }
        }
    }

    // Removed since we're reading from external file
}