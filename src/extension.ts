import * as vscode from 'vscode';

// AI Providers
import { IAIProvider, AIProviderFactory, isProviderConfigured, promptForProviderSelection } from './ai-providers';

// Features
import { SteeringManager, SteeringExplorerProvider, registerSteeringCommands } from './features/steering';
import { SpecExplorerProvider, registerSpecKitCommands } from './features/specs';
import { HooksExplorerProvider } from './features/hooks';
import { MCPExplorerProvider } from './features/mcp';
import { OverviewProvider } from './features/settings';
import { AgentsExplorerProvider, AgentManager } from './features/agents';
import { SkillsExplorerProvider, SkillManager } from './features/skills';
import { PermissionManager } from './features/permission';
import { WorkflowEditorProvider, registerWorkflowEditorCommands } from './features/workflow-editor';
import { registerSpecEditorCommands } from './features/spec-editor';
import { registerSpecViewerCommands, isSpecDocument } from './features/spec-viewer';
import { validateWorkflowsOnActivation, registerWorkflowConfigChangeListener } from './features/workflows';

// SpecKit CLI integration
import { SpecKitDetector, UpdateChecker, registerCliCommands, registerUtilityCommands } from './speckit';

// Core
import { Views, setupFileWatchers, setupTasksWatcher, setupSpecViewerWatcher } from './core';
import { openSpecFile } from './core/utils/fileOpener';

let aiProvider: IAIProvider;
let permissionManager: PermissionManager;
export let outputChannel: vscode.OutputChannel;

export function getPermissionManager(): PermissionManager {
    return permissionManager;
}

export function getAIProvider(): IAIProvider {
    return aiProvider;
}

export async function activate(context: vscode.ExtensionContext) {
    // Create output channel for debugging
    outputChannel = vscode.window.createOutputChannel('SpecKit Companion');

    // Initialize SpecKit detector
    const specKitDetector = SpecKitDetector.getInstance();
    specKitDetector.setOutputChannel(outputChannel);

    // Detect SpecKit CLI and workspace initialization
    const { cliInstalled, workspaceInitialized, constitutionNeedsSetup } = await specKitDetector.detect();
    outputChannel.appendLine(`SpecKit CLI installed: ${cliInstalled}`);
    outputChannel.appendLine(`SpecKit workspace initialized: ${workspaceInitialized}`);
    outputChannel.appendLine(`Constitution needs setup: ${constitutionNeedsSetup}`);

    // Show init suggestion when CLI is installed but workspace is not initialized
    // ONLY if a workspace is actually open (US1 fix - 005-speckit-views-enhancement)
    const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
    if (cliInstalled && !workspaceInitialized && hasWorkspace) {
        await showInitSuggestion(context);
    }

    // Show constitution setup recommendation if needed
    if (workspaceInitialized && constitutionNeedsSetup) {
        await showConstitutionSetupSuggestion();
    }

    // Check workspace state
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        outputChannel.appendLine('WARNING: No workspace folder found!');
    }

    // Prompt for AI provider selection if not configured
    if (!isProviderConfigured()) {
        outputChannel.appendLine('[Extension] AI provider not configured, prompting user...');
        const selectedProvider = await promptForProviderSelection();
        if (!selectedProvider) {
            outputChannel.appendLine('[Extension] User cancelled provider selection, extension will not activate');
            vscode.window.showErrorMessage('SpecKit Companion requires an AI provider to be selected to function. Please configure an AI provider in the extension settings.');
            return;
        }
    }

    // Initialize providers and managers
    aiProvider = AIProviderFactory.getProvider(context, outputChannel);
    outputChannel.appendLine(`[Extension] Using AI provider: ${aiProvider.name}`);

    permissionManager = new PermissionManager(context, outputChannel);
    if (hasWorkspace) {
        await permissionManager.initializePermissions();
    } else {
        outputChannel.appendLine('[Extension] No workspace open, skipping permission initialization');
    }

    const steeringManager = new SteeringManager(outputChannel);

    const agentManager = new AgentManager(context, outputChannel);
    if (hasWorkspace) {
        await agentManager.initializeBuiltInAgents();
    } else {
        outputChannel.appendLine('[Extension] No workspace open, skipping agent initialization');
    }

    const skillManager = new SkillManager(context, outputChannel);

    // Register tree data providers
    const overviewProvider = new OverviewProvider(context);
    const specExplorer = new SpecExplorerProvider(context, outputChannel);
    const steeringExplorer = new SteeringExplorerProvider(context);
    const hooksExplorer = new HooksExplorerProvider(context);
    const mcpExplorer = new MCPExplorerProvider(context, outputChannel);
    const agentsExplorer = new AgentsExplorerProvider(context, agentManager, outputChannel);
    const skillsExplorer = new SkillsExplorerProvider(context, skillManager, outputChannel);

    // Set managers
    steeringExplorer.setSteeringManager(steeringManager);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(Views.settings, overviewProvider),
        vscode.window.registerTreeDataProvider(Views.explorer, specExplorer),
        vscode.window.registerTreeDataProvider(Views.agents, agentsExplorer),
        vscode.window.registerTreeDataProvider(Views.skills, skillsExplorer),
        vscode.window.registerTreeDataProvider(Views.steering, steeringExplorer),
        vscode.window.registerTreeDataProvider(Views.hooks, hooksExplorer),
        vscode.window.registerTreeDataProvider(Views.mcp, mcpExplorer)
    );

    // Register Skills refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.skills.refresh', () => {
            skillsExplorer.refresh();
        })
    );

    // Register file opener command for spec files (with retry logic)
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.openSpecFile', async (filePath: string) => {
            await openSpecFile(filePath, { outputChannel });
        })
    );

    // Initialize update checker
    const updateChecker = new UpdateChecker(context, outputChannel);

    // Register all commands
    registerCliCommands(context, specKitDetector);
    registerSteeringCommands(context, steeringManager, steeringExplorer, agentsExplorer, outputChannel);
    registerSpecKitCommands(context, specExplorer, specKitDetector, outputChannel);
    registerUtilityCommands(context, hooksExplorer, mcpExplorer, updateChecker, outputChannel);

    // Set up file watchers
    setupFileWatchers(context, specExplorer, steeringExplorer, hooksExplorer, mcpExplorer, agentsExplorer, outputChannel);

    // Set up tasks watcher for phase completion notifications
    setupTasksWatcher(context, outputChannel);

    // Validate custom workflows on activation and register change listener
    validateWorkflowsOnActivation(outputChannel);
    context.subscriptions.push(registerWorkflowConfigChangeListener(context));
    outputChannel.appendLine('Custom workflows validated');

    // Check for updates on startup
    updateChecker.checkForUpdates();
    outputChannel.appendLine('Update check initiated');

    // Register Workflow Editor provider if enabled
    const workflowConfig = vscode.workspace.getConfiguration('speckit');
    if (workflowConfig.get<boolean>('workflowEditor.enabled', true)) {
        context.subscriptions.push(
            WorkflowEditorProvider.register(context, outputChannel)
        );
        outputChannel.appendLine('Workflow Editor provider registered');
    }

    // Register workflow editor action commands
    registerWorkflowEditorCommands(context, outputChannel);

    // Register spec editor commands
    registerSpecEditorCommands(context, outputChannel);

    // Register spec viewer commands and get provider instance
    const specViewer = registerSpecViewerCommands(context, outputChannel);

    // Set up spec viewer file watcher
    setupSpecViewerWatcher(context, specViewer, outputChannel);

    // Listen for provider configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration('speckit.aiProvider')) {
                const action = await vscode.window.showInformationMessage(
                    'AI provider changed. Reload window to apply changes.',
                    'Reload Now'
                );
                if (action === 'Reload Now') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            }
        })
    );
}

/**
 * Show initialization suggestion for SpecKit
 */
async function showInitSuggestion(context: vscode.ExtensionContext): Promise<void> {
    // Check if user dismissed this globally (for all projects)
    const dismissed = context.globalState.get<boolean>('speckit.initSuggestionDismissed', false);
    if (dismissed) {
        return;
    }

    const selection = await vscode.window.showInformationMessage(
        'SpecKit CLI detected! Initialize this workspace to start building with specs.',
        'Initialize Now',
        'Learn More',
        "Don't Ask Again"
    );
    if (selection === 'Initialize Now') {
        vscode.commands.executeCommand('speckit.initWorkspace');
    } else if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/github/spec-kit#-get-started'));
    } else if (selection === "Don't Ask Again") {
        // Save globally so it won't show in any project
        await context.globalState.update('speckit.initSuggestionDismissed', true);
    }
}

/**
 * Show constitution setup suggestion
 */
async function showConstitutionSetupSuggestion(): Promise<void> {
    const selection = await vscode.window.showInformationMessage(
        'SpecKit detected! Configure your project principles by running /speckit.constitution',
        'Run Setup',
        'Dismiss'
    );
    if (selection === 'Run Setup') {
        vscode.commands.executeCommand('speckit.constitution');
    }
}

export function deactivate() {
    if (permissionManager) {
        permissionManager.dispose();
    }
}
