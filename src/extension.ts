import * as vscode from 'vscode';

// AI Providers
import { IAIProvider, AIProviderFactory, isProviderConfigured, promptForProviderSelection, validatePermissionMode } from './ai-providers';

// Features
import { SteeringManager, SteeringExplorerProvider, registerSteeringCommands } from './features/steering';
import { SpecExplorerProvider, registerSpecKitCommands, updateSelectionContextKeys, SpecsFilterState, SpecsSortState } from './features/specs';
import { register as registerTerminalStepTracker } from './features/specs/terminalStepTracker';
import { setLifecycleOutputChannel } from './features/specs/stepLifecycle';
import { OverviewProvider } from './features/settings';
import { AgentManager } from './features/agents';
import { SkillManager } from './features/skills';
import { registerWorkflowEditorCommands } from './features/workflow-editor';
import { registerSpecEditorCommands } from './features/spec-editor';
import { registerSpecViewerCommands, isSpecDocument } from './features/spec-viewer';
import { validateWorkflowsOnActivation, registerWorkflowConfigChangeListener } from './features/workflows';

// SpecKit CLI integration
import { SpecKitDetector, UpdateChecker, registerCliCommands, registerUtilityCommands } from './speckit';

// Core
import { Views, setupFileWatchers, setupTasksWatcher, setupSpecViewerWatcher } from './core';
import { ConfigKeys } from './core/constants';
import { ConfigManager } from './core/utils/configManager';
import { openSpecFile } from './core/utils/fileOpener';

let aiProvider: IAIProvider;
export let outputChannel: vscode.OutputChannel;

export function getAIProvider(): IAIProvider {
    return aiProvider;
}

export async function activate(context: vscode.ExtensionContext) {
    // Create output channel for debugging
    outputChannel = vscode.window.createOutputChannel('SpecKit Companion');
    context.subscriptions.push(outputChannel);
    setLifecycleOutputChannel(outputChannel);
    context.subscriptions.push(registerTerminalStepTracker(context));

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
        showInitSuggestion(context);
    }

    // Show constitution setup recommendation if needed
    if (workspaceInitialized && constitutionNeedsSetup) {
        showConstitutionSetupSuggestion();
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

    // Reload ConfigManager settings on configuration changes (single listener for all consumers)
    const configManager = ConfigManager.getInstance();
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ConfigKeys.namespace)) {
                configManager.loadSettings();
            }
        })
    );

    const steeringManager = new SteeringManager(outputChannel);

    const agentManager = new AgentManager(context, outputChannel);
    if (hasWorkspace) {
        await agentManager.initializeBuiltInAgents();
    } else {
        outputChannel.appendLine('[Extension] No workspace open, skipping agent initialization');
    }

    const skillManager = new SkillManager(context, outputChannel);

    // Register tree data providers.
    // Filter state is constructed before the provider so the provider reads the
    // persisted query on first paint; the refresh callback closes over
    // `specExplorer` (declared next), resolved lazily at invocation time.
    const overviewProvider = new OverviewProvider(context);
    let specExplorer!: SpecExplorerProvider;
    const specsFilterState = new SpecsFilterState(context, () => specExplorer.refresh());
    const specsSortState = new SpecsSortState(context, () => specExplorer.refresh());
    specExplorer = new SpecExplorerProvider(context, outputChannel, specsFilterState, specsSortState);
    const steeringExplorer = new SteeringExplorerProvider(context);

    // Sync the filterActive / sortActive context keys to any persisted state
    // so title-bar menu visibility matches reality on activation.
    specsFilterState.initialize().then(undefined, () => { /* no-op */ });
    specsSortState.initialize().then(undefined, () => { /* no-op */ });

    // Set managers
    steeringExplorer.setSteeringManager(steeringManager);
    steeringExplorer.setAgentManager(agentManager);
    steeringExplorer.setSkillManager(skillManager);

    const specsTreeView = vscode.window.createTreeView(Views.explorer, {
        treeDataProvider: specExplorer,
        canSelectMany: true,
    });
    specsTreeView.onDidChangeSelection(e => updateSelectionContextKeys(e.selection as any));

    // Seed the collapse/expand toggle icon state to match the provider default
    // (expandAllSpecs=true → next click collapses → show collapse-all icon).
    vscode.commands.executeCommand('setContext', 'speckit.specs.allCollapsed', false);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(Views.settings, overviewProvider),
        specsTreeView,
        vscode.window.registerTreeDataProvider(Views.steering, steeringExplorer)
    );

    // Register Skills refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('speckit.skills.refresh', () => {
            steeringExplorer.refresh();
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
    registerSteeringCommands(context, steeringManager, steeringExplorer, outputChannel);
    registerSpecKitCommands(context, specExplorer, outputChannel, specsTreeView, specsFilterState, specsSortState);
    registerUtilityCommands(context, updateChecker, outputChannel);

    // Spec viewer needs to exist before setupFileWatchers so the .spec-context.json
    // watcher can refresh the open viewer when transitions are appended externally.
    const specViewer = registerSpecViewerCommands(context, outputChannel);

    // Set up file watchers
    setupFileWatchers(context, specExplorer, steeringExplorer, specViewer, outputChannel);

    // Set up tasks watcher for phase completion notifications
    setupTasksWatcher(context, outputChannel);

    // Validate custom workflows on activation and register change listener
    validateWorkflowsOnActivation(outputChannel);
    context.subscriptions.push(registerWorkflowConfigChangeListener(context));
    outputChannel.appendLine('Custom workflows validated');

    // Check for updates on startup
    updateChecker.checkForUpdates();
    outputChannel.appendLine('Update check initiated');

    // Register workflow editor action commands
    registerWorkflowEditorCommands(context, outputChannel);

    // Register spec editor commands
    registerSpecEditorCommands(context, outputChannel);

    // Set up spec viewer file watcher (specViewer was created above before setupFileWatchers)
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
            if (
                e.affectsConfiguration('speckit.permissionMode') ||
                e.affectsConfiguration('speckit.aiProvider')
            ) {
                void validatePermissionMode(context);
            }
        })
    );

    // Validate provider/permission combination after activation completes (non-blocking)
    setTimeout(() => { void validatePermissionMode(context); }, 0);
}

/**
 * Show initialization suggestion for SpecKit
 */
async function showInitSuggestion(context: vscode.ExtensionContext): Promise<void> {
    // Check if user dismissed this globally (for all projects)
    const dismissed = context.globalState.get<boolean>(ConfigKeys.globalState.initSuggestionDismissed, false);
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
        await context.globalState.update(ConfigKeys.globalState.initSuggestionDismissed, true);
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
    // All disposables are registered in context.subscriptions and disposed automatically by VS Code
}
