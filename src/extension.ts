import * as vscode from 'vscode';
import { CONTEXT_KEYS, setContextKey } from './core/utils/contextKeys';

// AI Providers
import { IAIProvider, AIProviderFactory, isProviderConfigured, promptForProviderSelection, validatePermissionMode } from './ai-providers';

// Features
import { SteeringManager, SteeringExplorerProvider, registerSteeringCommands } from './features/steering';
import { SpecExplorerProvider, registerSpecKitCommands, updateSelectionContextKeys, createSpecsSidebarState } from './features/specs';
import { register as registerTerminalStepTracker } from './features/specs/terminalStepTracker';
import { setLifecycleOutputChannel } from './features/specs/stepLifecycle';
import { OverviewProvider } from './features/settings';
import { ensureStandardFamily, shouldEnsureStandard, writeTemplateProfile, resolveComplexityFastPath, writeComplexityFastPath, TemplateProfile } from './features/settings/companionPresetReconciler';
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
let extensionContext: vscode.ExtensionContext;
export let outputChannel: vscode.OutputChannel;

/**
 * Resolve the AI provider for the *current* `speckit.aiProvider` setting.
 * Goes through the factory (which caches by type) rather than returning a
 * singleton frozen at activation, so changing the provider takes effect without
 * a window reload and every call site resolves the same provider (the spec
 * editor already resolved fresh; the viewer used the stale singleton, which is
 * why a switched provider only applied to some actions).
 */
export function getAIProvider(): IAIProvider {
    if (extensionContext) {
        return AIProviderFactory.getProvider(extensionContext, outputChannel);
    }
    return aiProvider;
}

export async function activate(context: vscode.ExtensionContext) {
    // Create output channel for debugging
    outputChannel = vscode.window.createOutputChannel('SpecKit Companion');
    context.subscriptions.push(outputChannel);
    extensionContext = context;
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
    const sidebarState = createSpecsSidebarState(context, () => specExplorer.refresh());
    specExplorer = new SpecExplorerProvider(context, outputChannel, sidebarState.filter, sidebarState.sort);
    const steeringExplorer = new SteeringExplorerProvider(context);

    // Restore filter/sort from workspace state and sync the matching context
    // keys so title-bar menu visibility matches reality on activation.
    sidebarState.initialize().then(undefined, () => { /* no-op */ });

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
    void setContextKey(CONTEXT_KEYS.specsAllCollapsed, false);

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
    registerSpecKitCommands(context, specExplorer, outputChannel, specsTreeView, sidebarState.filter, sidebarState.sort);
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
            if (e.affectsConfiguration(ConfigKeys.templateProfile)) {
                const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (root) {
                    const profile = vscode.workspace
                        .getConfiguration(ConfigKeys.namespace)
                        .get<TemplateProfile>('companion.templateProfile', 'off');
                    // Mode selection is non-destructive: mirror the choice to
                    // .specify/companion.yml so new specs seed their pinned
                    // profile from it. No preset swap — both command families
                    // stay present; only which one a spec dispatches changes.
                    writeTemplateProfile(root, profile);
                    // Switching away from `off` at runtime re-materializes the
                    // standard family without waiting for a reload (no-op when present).
                    if (shouldEnsureStandard(profile)) {
                        void ensureStandardFamily(root, {
                            log: msg => outputChannel.appendLine(msg),
                        });
                    }
                }
            }
            if (e.affectsConfiguration(ConfigKeys.complexityFastPath)) {
                const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (root) {
                    const enabled = vscode.workspace
                        .getConfiguration(ConfigKeys.namespace)
                        .get<boolean>('companion.complexityFastPath', false);
                    // Mirror the editor choice to .specify/companion.yml so the
                    // turbo specify body reads a single boolean (it never reads VS
                    // Code settings directly).
                    writeComplexityFastPath(root, enabled);
                }
            }
            if (e.affectsConfiguration(ConfigKeys.resumeBeta)) {
                // Pure VS Code menu gate — refresh the context key the resume
                // `when` clause reads; no reload, no companion.yml mirror.
                const enabled = vscode.workspace
                    .getConfiguration(ConfigKeys.namespace)
                    .get<boolean>('companion.resumeBeta', false);
                void setContextKey(CONTEXT_KEYS.resumeBeta, enabled);
            }
        })
    );

    // Validate provider/permission combination after activation completes (non-blocking)
    setTimeout(() => { void validatePermissionMode(context); }, 0);

    // On activation, mirror the project default to .specify/companion.yml and
    // idempotently ensure the standard /speckit.* command family is present.
    // The ensure is add-only — it re-materializes the standard family on a
    // fresh checkout and recovers a project a prior swap left stranded, and it
    // never removes a command set. No-ops when already present.
    {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root) {
            const profile = vscode.workspace
                .getConfiguration(ConfigKeys.namespace)
                .get<TemplateProfile>('companion.templateProfile', 'off');
            writeTemplateProfile(root, profile);
            // Mirror the fast-path setting into companion.yml so the turbo body
            // reads one boolean (the setting is the source of truth).
            const fastPathSetting = vscode.workspace
                .getConfiguration(ConfigKeys.namespace)
                .get<boolean>('companion.complexityFastPath', false);
            resolveComplexityFastPath(root, fastPathSetting);
            // Gate the sidebar resume (▶) button on the opt-in beta setting.
            const resumeBetaEnabled = vscode.workspace
                .getConfiguration(ConfigKeys.namespace)
                .get<boolean>('companion.resumeBeta', false);
            void setContextKey(CONTEXT_KEYS.resumeBeta, resumeBetaEnabled);
            // `off` opts out of the ensure (plain upstream spec-kit); every other
            // profile keeps the standard family materialized.
            if (shouldEnsureStandard(profile)) {
                void ensureStandardFamily(root, {
                    log: msg => outputChannel.appendLine(msg),
                });
            }
        }
    }
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
