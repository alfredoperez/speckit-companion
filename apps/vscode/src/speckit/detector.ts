import * as vscode from 'vscode';
import { getProjectRoot, getProjectRootUri, hasSpecKitMarker } from '../core/projectRoot';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CONTEXT_KEYS, setContextKey } from '../core/utils/contextKeys';
import { getConfiguredSpecKitAgent, specKitInitAgentArgs, SpecKitAgentFlag } from './specKitAgent';
import { runInTerminal } from '../core/utils/terminalUtils';

const execAsync = promisify(exec);

function initCommand(base: string, flag: SpecKitAgentFlag): string {
    const agentArgs = specKitInitAgentArgs(getConfiguredSpecKitAgent(), flag);
    return agentArgs ? `${base} ${agentArgs}` : base;
}

/**
 * Service for detecting SpecKit CLI installation and workspace initialization
 */
export class SpecKitDetector {
    private static instance: SpecKitDetector;
    private _isInstalled = false;
    private _isInitialized = false;
    private _constitutionNeedsSetup = false;
    private outputChannel: vscode.OutputChannel | null = null;

    private constructor() {}

    static getInstance(): SpecKitDetector {
        if (!SpecKitDetector.instance) {
            SpecKitDetector.instance = new SpecKitDetector();
        }
        return SpecKitDetector.instance;
    }

    /**
     * Set the output channel for logging
     */
    setOutputChannel(channel: vscode.OutputChannel): void {
        this.outputChannel = channel;
    }

    private log(message: string): void {
        if (this.outputChannel) {
            this.outputChannel.appendLine(`[SpecKitDetector] ${message}`);
        }
    }

    /**
     * Check if SpecKit CLI is installed globally
     * Note: specify CLI doesn't support --version, so we use 'which' or 'specify --help'
     */
    async checkCliInstalled(): Promise<boolean> {
        try {
            // Try to find the specify command in PATH
            const whichCmd = process.platform === 'win32' ? 'where specify' : 'which specify';
            const { stdout } = await execAsync(whichCmd);
            this._isInstalled = true;
            this.log(`SpecKit CLI found at: ${stdout.trim()}`);
            await setContextKey(CONTEXT_KEYS.cliInstalled, true);
            return true;
        } catch {
            // Fallback: try running specify with --help (exits with 0)
            try {
                await execAsync('specify --help');
                this._isInstalled = true;
                this.log('SpecKit CLI found (via --help)');
                await setContextKey(CONTEXT_KEYS.cliInstalled, true);
                return true;
            } catch {
                this._isInstalled = false;
                this.log('SpecKit CLI not found');
                await setContextKey(CONTEXT_KEYS.cliInstalled, false);
                return false;
            }
        }
    }

    /**
     * Check if SpecKit is initialized in the current workspace
     * (looks for .specify/ folder or .github/agents/speckit.*.md files)
     */
    async checkWorkspaceInitialized(): Promise<boolean> {
        const root = getProjectRoot();
        if (!root) {
            this._isInitialized = false;
            await setContextKey(CONTEXT_KEYS.detected, false);
            return false;
        }

        this._isInitialized = hasSpecKitMarker(root);

        // Update context for welcome view
        await setContextKey(CONTEXT_KEYS.detected, this._isInitialized);
        this.log(`Workspace initialized: ${this._isInitialized}`);

        return this._isInitialized;
    }

    /**
     * Check if constitution needs setup (has placeholder tokens)
     */
    async checkConstitutionSetup(): Promise<boolean> {
        const root = getProjectRoot();
        if (!root) {
            this._constitutionNeedsSetup = false;
            return false;
        }

        const constitutionPath = path.join(root, '.specify/memory/constitution.md');

        if (!fs.existsSync(constitutionPath)) {
            this._constitutionNeedsSetup = false;
            this.log('Constitution file not found');
            return false;
        }

        try {
            const content = fs.readFileSync(constitutionPath, 'utf-8');
            // The Sync Impact Report `/speckit.constitution` writes at the top is an
            // HTML comment listing every placeholder it replaced, so a finished
            // constitution still contains the words. Read the body only.
            const body = content.replace(/<!--[\s\S]*?-->/g, '');
            const hasPlaceholders = /\[PROJECT_NAME\]|\[PRINCIPLE_\d+_NAME\]|\[PLACEHOLDER\]/.test(body);
            this._constitutionNeedsSetup = hasPlaceholders;
            this.log(`Constitution needs setup: ${hasPlaceholders}`);
            await setContextKey(CONTEXT_KEYS.constitutionNeedsSetup, hasPlaceholders);
            return hasPlaceholders;
        } catch (error) {
            this.log(`Error reading constitution: ${error}`);
            this._constitutionNeedsSetup = false;
            return false;
        }
    }

    /**
     * Full detection - checks CLI, workspace, and constitution
     */
    async detect(): Promise<{ cliInstalled: boolean; workspaceInitialized: boolean; constitutionNeedsSetup: boolean }> {
        const cliInstalled = await this.checkCliInstalled();
        const workspaceInitialized = await this.checkWorkspaceInitialized();
        const constitutionNeedsSetup = workspaceInitialized ? await this.checkConstitutionSetup() : false;
        return { cliInstalled, workspaceInitialized, constitutionNeedsSetup };
    }

    /**
     * Install SpecKit CLI using uv
     */
    async installCli(): Promise<void> {
        const terminal = vscode.window.createTerminal('Install SpecKit CLI');
        terminal.show();
        await runInTerminal(terminal, 'uv tool install specify-cli --from git+https://github.com/github/spec-kit.git');

        const selection = await vscode.window.showInformationMessage(
            'Installing SpecKit CLI... Once complete, reload the window to detect it.',
            'Learn More',
            'Reload Window'
        );

        if (selection === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/github/spec-kit#-get-started'));
        } else if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }

    /**
     * Initialize SpecKit in the current workspace
     */
    async initializeWorkspace(): Promise<void> {
        const workspaceFolder = getProjectRootUri();
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const agentFlag = await this.detectAgentFlag();
        const terminal = vscode.window.createTerminal({ name: 'Initialize SpecKit', cwd: workspaceFolder });
        terminal.show();
        await runInTerminal(terminal, initCommand('specify init .', agentFlag));

        const selection = await vscode.window.showInformationMessage(
            'Initializing SpecKit... Reload window once complete.',
            'Reload Window',
            'Learn More'
        );

        if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else if (selection === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/github/spec-kit#-get-started'));
        }
    }

    /**
     * Upgrade SpecKit CLI to latest version
     */
    async upgradeCli(): Promise<void> {
        const terminal = vscode.window.createTerminal('Upgrade SpecKit CLI');
        terminal.show();
        await runInTerminal(terminal, 'uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git');

        const selection = await vscode.window.showInformationMessage(
            'Upgrading SpecKit CLI... Reload window after upgrade completes.',
            'Reload Window'
        );

        if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }

    /**
     * The flag this CLI uses to pick the agent: `--integration` on current spec-kit,
     * `--ai` on older CLIs that do not list it. An unreadable help falls back to the current flag.
     */
    private async detectAgentFlag(): Promise<SpecKitAgentFlag> {
        try {
            const { stdout } = await execAsync('specify init --help', { timeout: 5000 });
            return /--integration(?![\w-])/.test(stdout) || !/--ai(?![\w-])/.test(stdout) ? '--integration' : '--ai';
        } catch {
            this.log('Could not read `specify init --help`; using --integration');
            return '--integration';
        }
    }

    /**
     * Upgrade project files to latest SpecKit version
     */
    async upgradeProject(): Promise<void> {
        const workspaceFolder = getProjectRootUri();
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const agentFlag = await this.detectAgentFlag();
        const terminal = vscode.window.createTerminal({ name: 'Upgrade SpecKit Project', cwd: workspaceFolder });
        terminal.show();
        await runInTerminal(terminal, initCommand('specify init --here --force', agentFlag));

        const selection = await vscode.window.showInformationMessage(
            'Upgrading project files... Reload window after upgrade completes.',
            'Reload Window'
        );

        if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }

    /**
     * Upgrade both CLI and project files
     */
    async upgradeAll(): Promise<void> {
        const workspaceFolder = getProjectRootUri();
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const terminal = vscode.window.createTerminal({ name: 'Upgrade SpecKit (All)', cwd: workspaceFolder });
        terminal.show();
        await runInTerminal(terminal, 'uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git && ' +
            initCommand('specify init --here --force', '--integration'));

        const selection = await vscode.window.showInformationMessage(
            'Upgrading SpecKit CLI and project files... Reload window after upgrade completes.',
            'Reload Window'
        );

        if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    }

    /**
     * Create a new spec using SpecKit
     */
    async createSpec(): Promise<void> {
        const description = await vscode.window.showInputBox({
            title: 'Create New Spec',
            prompt: 'What feature do you want to build?',
            placeHolder: 'Add user authentication with OAuth support...',
            ignoreFocusOut: true
        });

        if (!description) {
            return;
        }

        // Return the description so the caller can use it with the AI provider
        return;
    }

    get cliInstalled(): boolean {
        return this._isInstalled;
    }

    get workspaceInitialized(): boolean {
        return this._isInitialized;
    }

    get constitutionNeedsSetup(): boolean {
        return this._constitutionNeedsSetup;
    }
}
