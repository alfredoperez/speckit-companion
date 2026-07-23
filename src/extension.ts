import * as vscode from 'vscode';
import { CONTEXT_KEYS, setContextKey } from './core/utils/contextKeys';

// AI Providers
import { IAIProvider, AIProviderFactory, isProviderConfigured, promptForProviderSelection, validatePermissionMode } from './ai-providers';

// Features
import { SteeringManager, SteeringExplorerProvider, registerSteeringCommands } from './features/steering';
import { SpecExplorerProvider, LivingSpecsExplorerProvider, registerSpecKitCommands, registerLivingSpecsCommands, updateSelectionContextKeys, createSpecsSidebarState } from './features/specs';
import { register as registerTerminalStepTracker } from './features/specs/terminalStepTracker';
import { setLifecycleOutputChannel } from './features/specs/stepLifecycle';
import { OverviewProvider } from './features/settings';
import { ensureStandardFamily } from './features/settings/companionPresetReconciler';
import { AgentManager } from './features/agents';
import { SkillManager } from './features/skills';
import { registerWorkflowEditorCommands } from './features/workflow-editor';
import { registerSpecEditorCommands } from './features/spec-editor';
import { registerSpecViewerCommands, isSpecDocument } from './features/spec-viewer';
import { validateWorkflowsOnActivation, registerWorkflowConfigChangeListener } from './features/workflows';

// SpecKit CLI integration
import { SpecKitDetector, UpdateChecker, registerCliCommands, registerUtilityCommands, registerSpecKitExtensionInstallCommands } from './speckit';
import { isCompanionInstalled } from './features/settings/companionPresetReconciler';

// Core
import { Views, setupFileWatchers, setupTasksWatcher, setupSpecViewerWatcher } from './core';
import { ConfigKeys } from './core/constants';
import { ConfigManager } from './core/utils/configManager';
import { migrateBetaTriStateSettings, removeRetiredSettings } from './core/settingsMigration';
import { openSpecFile } from './core/utils/fileOpener';
import { TelemetryService, initTelemetry, sendTelemetryEvent, buildActivatedProperties, reportInstallPromptShown } from './core/telemetry';
import { getConfiguredProviderType } from './ai-providers/aiProvider';
import { resolveSpecDirectories } from './core/specDirectoryResolver';

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

    // Anonymous, PII-free telemetry. Gated on both `speckit.telemetry` and VS
    // Code's global telemetry level; fires nothing when the connection string
    // is empty. Construct + register dispose now; the once-per-activation event
    // fires after the settings migration so the beta snapshot reads coerced
    // boolean values, not legacy tri-state strings.
    const telemetryService = new TelemetryService();
    initTelemetry(telemetryService);
    context.subscriptions.push({ dispose: () => telemetryService.dispose() });

    // Migrate the former tri-state beta settings (#259) to booleans before any
    // reader runs. Idempotent and scope-preserving: legacy `'beta'`/`'on'` → true,
    // `'off'` → false. Readers still coerce defensively, so an un-migrated scope or
    // an in-flight read is safe regardless.
    try {
        await migrateBetaTriStateSettings();
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[Extension] Beta-settings migration skipped: ${detail}`);
    }

    // Drop retired settings (the collapsed spec-driven toggles and the former
    // Companion-workflow beta gate + its legacy keys) from settings.json. Activation
    // tolerates them either way; this just keeps users' settings tidy. Wrapped so a
    // bad stored value can never fail activation (the provider-rename lesson).
    try {
        await removeRetiredSettings();
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[Extension] Retired-settings cleanup skipped: ${detail}`);
    }

    void fireActivatedEvent(context);

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
    const livingSpecsExplorer = new LivingSpecsExplorerProvider(context, outputChannel);

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

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(Views.settings, overviewProvider),
        specsTreeView,
        vscode.window.registerTreeDataProvider(Views.livingSpecs, livingSpecsExplorer),
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
    registerSpecKitExtensionInstallCommands(context);
    registerSteeringCommands(context, steeringManager, steeringExplorer, outputChannel);
    registerSpecKitCommands(context, specExplorer, outputChannel, specsTreeView, sidebarState.filter, sidebarState.sort);
    registerLivingSpecsCommands(context, livingSpecsExplorer, outputChannel);
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
                sendTelemetryEvent('provider.selected', { providerId: getConfiguredProviderType() });
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

    // On activation, idempotently ensure the standard /speckit.* command family is
    // present. The ensure is add-only — it re-materializes the standard family on a
    // fresh checkout and recovers a project a prior swap left stranded, and it
    // never removes a command set. No-ops when already present.
    {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root) {
            // Drive the sidebar install affordance: the install icon shows when
            // the spec-kit extension is NOT installed. Refreshed by the watcher
            // below when the extension dir appears/disappears (e.g. after the
            // one-click install terminal completes).
            void refreshCompanionInstalledContext(root);
            // Activity-bar install nudge: badge the Specs view (VS Code aggregates it
            // onto the seedling container icon) when the spec-kit extension is missing;
            // clear it once installed. Refreshed by the watcher below so it flips
            // without a reload. Also refreshes the Specs + Steering trees so the pinned
            // CTA row and the retired Steering node track install state.
            const syncInstallAffordances = (): void => {
                const installed = isCompanionInstalled(root);
                specsTreeView.badge = installed
                    ? undefined
                    : { value: 1, tooltip: 'Install SpecKit Companion' };
                if (!installed) {
                    reportInstallPromptShown('sidebarBadge');
                }
                specExplorer.refresh();
                steeringExplorer.refresh();
            };
            syncInstallAffordances();
            // Remember a prior dismissal of the intrusive empty-state install nudge.
            void setContextKey(
                CONTEXT_KEYS.companionInstallNudgeDismissed,
                context.globalState.get<boolean>(ConfigKeys.globalState.installNudgeDismissed, false),
            );
            // Keep the timing-augmented standard command family materialized — but
            // ONLY when the companion spec-kit extension is installed: the ensure's
            // bundled preset path lives inside `.specify/extensions/companion/`, so
            // running it without the extension just fails + logs on every activation.
            // The watcher below reruns it once the extension dir appears (one-click
            // install), so it doesn't wait for a reload.
            const ensureStandardWhenInstalled = (): void => {
                if (isCompanionInstalled(root)) {
                    void ensureStandardFamily(root, {
                        log: msg => outputChannel.appendLine(msg),
                    });
                }
            };
            ensureStandardWhenInstalled();
            // Refresh the install context key (and rerun the standard-family ensure)
            // whenever the companion extension dir is created or removed (the
            // one-click install lands it on disk), so both flip without a reload.
            const extWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(root, '.specify/extensions/companion/**')
            );
            const refresh = (): void => {
                void refreshCompanionInstalledContext(root);
                ensureStandardWhenInstalled();
                syncInstallAffordances();
                livingSpecsExplorer.refresh();
            };
            extWatcher.onDidCreate(refresh);
            extWatcher.onDidDelete(refresh);
            context.subscriptions.push(extWatcher);

            // Refresh the Living Specs view when the living-specs config or the
            // capabilities tree changes on disk (no reload needed).
            const livingSpecsWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(root, '{living-specs.yml,.specify/companion.yml,capabilities/**,**/*.spec.md}')
            );
            // Debounce: a rapid save sequence across the watched glob would
            // otherwise re-run the full `**/*.spec.md` scan per event.
            let refreshTimer: ReturnType<typeof setTimeout> | undefined;
            const refreshLivingSpecs = (): void => {
                if (refreshTimer) {
                    clearTimeout(refreshTimer);
                }
                refreshTimer = setTimeout(() => livingSpecsExplorer.refresh(), 150);
            };
            livingSpecsWatcher.onDidCreate(refreshLivingSpecs);
            livingSpecsWatcher.onDidChange(refreshLivingSpecs);
            livingSpecsWatcher.onDidDelete(refreshLivingSpecs);
            context.subscriptions.push(livingSpecsWatcher, {
                dispose: () => {
                    if (refreshTimer) {
                        clearTimeout(refreshTimer);
                    }
                },
            });
        }
    }
}

/**
 * Mirror "is the companion spec-kit extension installed?" into the
 * `speckit.companion.installed` context key. The sidebar install affordance's
 * `when` clause reads `!speckit.companion.installed`, so this gate must be kept
 * current as the extension dir appears/disappears on disk.
 */
async function refreshCompanionInstalledContext(root: string): Promise<void> {
    await setContextKey(CONTEXT_KEYS.companionInstalled, isCompanionInstalled(root));
}

/**
 * Fire the once-per-activation `extension.activated` event: version
 * distribution + spec count + the beta-flag snapshot. All anonymous.
 */
async function fireActivatedEvent(context: vscode.ExtensionContext): Promise<void> {
    let specCount = 0;
    let companionInstalled = false;
    try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root) {
            specCount = (await resolveSpecDirectories(root)).length;
            companionInstalled = isCompanionInstalled(root);
        }
    } catch {
        /* spec discovery failure is non-fatal — report 0 */
    }
    sendTelemetryEvent('extension.activated', buildActivatedProperties({
        extensionVersion: String(context.extension.packageJSON.version ?? 'unknown'),
        vscodeVersion: vscode.version,
        // No CLI version detector exists today — the detector only checks presence.
        speckitCliVersion: 'unknown',
        specCount,
        companionInstalled,
    }));
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
