import * as vscode from 'vscode';

// AI Providers
import { IAIProvider, AIProviderFactory } from './ai-providers';

// Features
import { SteeringManager, SteeringExplorerProvider, registerSteeringCommands } from './features/steering';
import { SpecExplorerProvider, registerSpecKitCommands } from './features/specs';
import { HooksExplorerProvider } from './features/hooks';
import { MCPExplorerProvider } from './features/mcp';
import { OverviewProvider } from './features/settings';
import { AgentsExplorerProvider, AgentManager } from './features/agents';
import { PermissionManager } from './features/permission';
import { WorkflowEditorProvider, registerWorkflowEditorCommands } from './features/workflow-editor';

// SpecKit CLI integration
import { SpecKitDetector, UpdateChecker, registerCliCommands, registerUtilityCommands } from './speckit';

// Core
import { Views, setupFileWatchers, setupTasksWatcher } from './core';

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
    if (cliInstalled && !workspaceInitialized) {
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

    // Initialize providers and managers
    aiProvider = AIProviderFactory.getProvider(context, outputChannel);
    outputChannel.appendLine(`[Extension] Using AI provider: ${aiProvider.name}`);

    permissionManager = new PermissionManager(context, outputChannel);
    await permissionManager.initializePermissions();

    const steeringManager = new SteeringManager(aiProvider, outputChannel);

    const agentManager = new AgentManager(context, outputChannel);
    await agentManager.initializeBuiltInAgents();

    // Register tree data providers
    const overviewProvider = new OverviewProvider(context);
    const specExplorer = new SpecExplorerProvider(context, outputChannel);
    const steeringExplorer = new SteeringExplorerProvider(context);
    const hooksExplorer = new HooksExplorerProvider(context);
    const mcpExplorer = new MCPExplorerProvider(context, outputChannel);
    const agentsExplorer = new AgentsExplorerProvider(context, agentManager, outputChannel);

    // Set managers
    steeringExplorer.setSteeringManager(steeringManager);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(Views.settings, overviewProvider),
        vscode.window.registerTreeDataProvider(Views.explorer, specExplorer),
        vscode.window.registerTreeDataProvider(Views.agents, agentsExplorer),
        vscode.window.registerTreeDataProvider(Views.steering, steeringExplorer),
        vscode.window.registerTreeDataProvider(Views.hooks, hooksExplorer),
        vscode.window.registerTreeDataProvider(Views.mcp, mcpExplorer)
    );

    // Initialize update checker
    const updateChecker = new UpdateChecker(context, outputChannel);

    // Register all commands
    registerCliCommands(context, specKitDetector);
    registerSteeringCommands(context, steeringManager, steeringExplorer, agentsExplorer, outputChannel);
    registerSpecKitCommands(context, aiProvider, specExplorer, specKitDetector, outputChannel);
    registerUtilityCommands(context, hooksExplorer, mcpExplorer, updateChecker, outputChannel);

    // Set up file watchers
    setupFileWatchers(context, specExplorer, steeringExplorer, hooksExplorer, mcpExplorer, agentsExplorer, outputChannel);

    // Set up tasks watcher for phase completion notifications
    setupTasksWatcher(context, outputChannel);

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
    registerWorkflowEditorCommands(context, aiProvider, outputChannel);

    // Listen for provider configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('speckit.aiProvider')) {
                // Clear cached provider and reinitialize
                AIProviderFactory.clearCache();
                aiProvider = AIProviderFactory.getProvider(context, outputChannel);
                outputChannel.appendLine(`[Extension] AI provider changed to: ${aiProvider.name}`);
                vscode.window.showInformationMessage(`SpecKit now using ${aiProvider.name}`);
            }
        })
    );
}

/**
 * Show initialization suggestion for SpecKit
 */
async function showInitSuggestion(context: vscode.ExtensionContext): Promise<void> {
    // Check if user dismissed this for current workspace
    const dismissed = context.workspaceState.get<boolean>('speckit.initSuggestionDismissed', false);
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
        await context.workspaceState.update('speckit.initSuggestionDismissed', true);
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
