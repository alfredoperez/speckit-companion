import * as vscode from 'vscode';
import * as path from 'path';
import { getAIProvider } from '../../extension';
import { ConfigManager } from '../../core/utils/configManager';
import { NotificationUtils } from '../../core/utils/notificationUtils';

export class SteeringManager {
    private configManager: ConfigManager;

    constructor(
        private outputChannel: vscode.OutputChannel
    ) {
        this.configManager = ConfigManager.getInstance();
        this.configManager.loadSettings();
    }

    public getSteeringBasePath(): string {
        return this.configManager.getPath('steering');
    }

    async createCustom() {
        const description = await vscode.window.showInputBox({
            title: 'Create Steering Document',
            prompt: 'Describe what guidance you need for your project',
            placeHolder: 'e.g., API design patterns for REST endpoints, testing strategy for React components',
            ignoreFocusOut: false
        });

        if (!description) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const steeringPath = path.join(workspaceFolder.uri.fsPath, this.getSteeringBasePath());

        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(steeringPath));

            const prompt = `Create a steering document for: ${description}

Save it to: ${this.getSteeringBasePath()}/

The document should:
1. Be a markdown file with a descriptive name based on the topic
2. Provide clear guidelines and best practices
3. Include code examples where appropriate
4. Be referenced in CLAUDE.md with a @-mention`;

            await getAIProvider().executeInTerminal(prompt, 'SpecKit - Create Steering');

            await NotificationUtils.showAutoDismissNotification('Claude is creating a steering document. Check the terminal for progress.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create steering document: ${error}`);
        }
    }

    async delete(documentName: string, documentPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(documentPath));

            const prompt = `The steering document "${documentName}" has been deleted from ${this.getSteeringBasePath()}.

Please update CLAUDE.md to remove any references to this deleted document.`;

            await NotificationUtils.showAutoDismissNotification(`Deleting "${documentName}" and updating CLAUDE.md...`);

            const result = await getAIProvider().executeHeadless(prompt);

            if (result.exitCode === 0) {
                await NotificationUtils.showAutoDismissNotification(`Steering document "${documentName}" deleted and CLAUDE.md updated.`);
                return { success: true };
            } else if (result.exitCode !== undefined) {
                const error = `Failed to update CLAUDE.md. Exit code: ${result.exitCode}`;
                this.outputChannel.appendLine(`[Steering] ${error}`);
                return { success: false, error };
            } else {
                return { success: true };
            }
        } catch (error) {
            const errorMsg = `Failed to delete steering document: ${error}`;
            this.outputChannel.appendLine(`[Steering] ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    async init() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const existingDocs = await this.getSteeringDocuments();
        if (existingDocs.length > 0) {
            const existingNames = existingDocs.map(doc => doc.name).join(', ');
            const confirm = await vscode.window.showWarningMessage(
                `Steering documents already exist (${existingNames}). Init steering will analyze the project again but won't overwrite existing files.`,
                'Continue',
                'Cancel'
            );
            if (confirm !== 'Continue') {
                return;
            }
        }

        const steeringPath = path.join(workspaceFolder.uri.fsPath, this.getSteeringBasePath());
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(steeringPath));

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing project and generating steering documents...',
            cancellable: false
        }, async () => {
            const prompt = `Analyze this project and create initial steering documents in ${this.getSteeringBasePath()}.

Based on the project structure and code, create steering documents for:
1. Code style and conventions
2. Architecture patterns
3. Testing guidelines
4. Any domain-specific guidance

Update CLAUDE.md to reference these new steering documents.`;

            await getAIProvider().executeInTerminal(prompt, 'SpecKit - Init Steering');

            await NotificationUtils.showAutoDismissNotification('Steering documents generation started. Check the terminal for progress.');
        });
    }

    async refine(uri: vscode.Uri) {
        const prompt = `Refine and improve this steering document: ${uri.fsPath}

Analyze the document and:
1. Improve clarity and organization
2. Add more specific examples
3. Fill in any gaps in coverage
4. Update based on current best practices`;

        await getAIProvider().executeInTerminal(prompt, 'SpecKit - Refine Steering');

        await NotificationUtils.showAutoDismissNotification('Claude is refining the steering document. Check the terminal for progress.');
    }

    async getSteeringDocuments(): Promise<Array<{ name: string, path: string }>> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const steeringPath = path.join(workspaceFolder.uri.fsPath, this.getSteeringBasePath());

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(steeringPath));
            return entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.md'))
                .map(([name]) => ({
                    name: name.replace('.md', ''),
                    path: path.join(steeringPath, name)
                }));
        } catch (error) {
            return [];
        }
    }

    async createProjectClaudeMd() {
        const terminal = vscode.window.createTerminal({
            name: 'Claude Code - Init',
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            location: {
                viewColumn: vscode.ViewColumn.Two
            }
        });
        terminal.show();

        const delay = this.configManager.getTerminalDelay();
        const config = vscode.workspace.getConfiguration('speckit');
        const mode = config.get<string>('claudePermissionMode', 'bypassPermissions');
        const permissionFlag = mode === 'bypassPermissions' ? '--permission-mode bypassPermissions ' : '';
        setTimeout(() => {
            terminal.sendText(`claude ${permissionFlag}"/init"`);
        }, delay);
    }

    async createUserClaudeMd() {
        const claudeDir = path.join(process.env.HOME || '', '.claude');
        const filePath = path.join(claudeDir, 'CLAUDE.md');

        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(claudeDir));
        } catch (error) {
            // Directory might already exist
        }

        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            const overwrite = await vscode.window.showWarningMessage(
                'Global CLAUDE.md already exists. Overwrite?',
                'Overwrite',
                'Cancel'
            );
            if (overwrite !== 'Overwrite') {
                return;
            }
        } catch {
            // File doesn't exist, continue
        }

        const initialContent = '';
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(initialContent)
        );

        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);

        await NotificationUtils.showAutoDismissNotification('Created global CLAUDE.md file');
    }
}
