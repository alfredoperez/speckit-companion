import * as path from 'path';
import * as vscode from 'vscode';
import { SpecExplorerProvider } from '../features/specs/specExplorerProvider';
import { SteeringExplorerProvider } from '../features/steering/steeringExplorerProvider';
import { SpecViewerProvider } from '../features/spec-viewer/specViewerProvider';
import {
    parseTasksFile,
    detectNewlyCompletedPhases,
    extractSpecNameFromPath,
    initializeCache,
} from '../speckit/taskProgressService';
import { NotificationUtils } from './utils/notificationUtils';
import { getFileWatcherPatterns } from './specDirectoryResolver';
import { readSpecContextSync } from '../features/specs/specContextReader';
import { completeStep } from '../features/specs/stepLifecycle';
import { shouldCloseImplement } from '../features/specs/implementCloseGuard';
import { detectExternalTransition, transitionCache } from '../features/specs/transitionLogger';
import { FEATURE_CONTEXT_FILE } from '../features/workflows/types';
import type { TransitionEntry } from '../features/workflows/types';

/**
 * Check if phase completion notifications are enabled
 */
function isPhaseCompletionNotificationEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('speckit');
    return config.get<boolean>('notifications.phaseCompletion', true);
}

/**
 * Set up file watchers for the extension
 */
export function setupFileWatchers(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    steeringExplorer: SteeringExplorerProvider,
    specViewer: SpecViewerProvider,
    outputChannel: vscode.OutputChannel
): void {
    // Watch for changes in .claude directory with debouncing
    setupClaudeDirectoryWatcher(context, specExplorer, steeringExplorer, specViewer, outputChannel);

    // Watch `.spec-context.json` under every configured spec directory so the
    // open viewer refreshes (and the sidebar re-scans) when a step settles —
    // the `.claude` watcher above misses the default `specs/` (and
    // `.specify/specs/`) layout. (#277 Child 3 / #270)
    setupSpecContextWatchers(context, specExplorer, specViewer, outputChannel);

    // Watch for changes in Claude settings
    setupClaudeSettingsWatcher(context, steeringExplorer);

    // Watch for changes in CLAUDE.md files
    setupClaudeMdWatchers(context, steeringExplorer);

    // Watch for changes in .specify directory (US3 - 005-speckit-views-enhancement)
    setupSpecifyDirectoryWatcher(context, steeringExplorer, outputChannel);
}

/**
 * Watch .claude directory with debouncing
 */
function setupClaudeDirectoryWatcher(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    steeringExplorer: SteeringExplorerProvider,
    specViewer: SpecViewerProvider,
    outputChannel: vscode.OutputChannel
): void {
    const claudeWatcher = vscode.workspace.createFileSystemWatcher('**/.claude/**/*');

    let refreshTimeout: NodeJS.Timeout | undefined;
    const debouncedRefresh = (event: string, uri: vscode.Uri) => {
        outputChannel.appendLine(`[FileWatcher] ${event}: ${uri.fsPath}`);

        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
            specExplorer.refresh();
            steeringExplorer.refresh();
        }, 1000);
    };

    claudeWatcher.onDidCreate((uri) => debouncedRefresh('Create', uri));
    claudeWatcher.onDidDelete((uri) => {
        handleSpecContextDelete(uri);
        debouncedRefresh('Delete', uri);
    });
    claudeWatcher.onDidChange((uri) => {
        handleSpecContextChange(uri, specViewer, outputChannel);
        debouncedRefresh('Change', uri);
    });

    context.subscriptions.push(claudeWatcher);
}

/**
 * Re-derive viewer state on a `.spec-context.json` write so the open viewer's
 * timeline picks up the new transition without a reload (R008, NFR004). Shared
 * by the `.claude` watcher and the per-spec-directory context watcher.
 */
async function handleSpecContextChange(
    uri: vscode.Uri,
    specViewer: SpecViewerProvider,
    outputChannel: vscode.OutputChannel,
): Promise<void> {
    if (!uri.fsPath.endsWith(FEATURE_CONTEXT_FILE)) {
        return;
    }
    try {
        const content = await vscode.workspace.fs.readFile(uri);
        const data = JSON.parse(Buffer.from(content).toString('utf-8'));
        const specDir = uri.fsPath.replace(/[/\\].spec-context\.json$/, '');

        // Canonical writer emits `history[]`; legacy files may still
        // carry `transitions[]`. Prefer history; fall back to transitions
        // so external-transition logs survive both schema generations.
        const logMessage = detectExternalTransition(
            specDir,
            data.currentStep,
            data.substep ?? null,
            (data.history ?? data.transitions) as TransitionEntry[] | undefined,
        );

        if (logMessage) {
            outputChannel.appendLine(logMessage);
        }

        void specViewer.refreshContextIfDisplaying(uri.fsPath);
    } catch {
        // Ignore parse errors
    }
}

function handleSpecContextDelete(uri: vscode.Uri): void {
    if (!uri.fsPath.endsWith(FEATURE_CONTEXT_FILE)) {
        return;
    }
    const specDir = uri.fsPath.replace(/[/\\].spec-context\.json$/, '');
    transitionCache.delete(specDir);
}

/**
 * Watch `.spec-context.json` under every configured spec directory.
 *
 * The `.claude` watcher only sees `**​/.claude/**​/*`, but specs default to
 * `specDirectories: ['specs', '.specify/specs']`, so a context write under
 * `specs/<name>/` or `.specify/specs/<name>/` was unobserved — the open viewer
 * never refreshed on step completion (#277 Child 3) and a freshly-created spec
 * never cleared the welcome screen (#270). This watcher targets the context
 * file directly under each configured pattern, refreshing the viewer on every
 * write and re-scanning the sidebar when a new context file appears.
 */
function setupSpecContextWatchers(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    specViewer: SpecViewerProvider,
    outputChannel: vscode.OutputChannel,
): void {
    const patterns = getFileWatcherPatterns().specContext;
    for (const pattern of patterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidChange((uri) => handleSpecContextChange(uri, specViewer, outputChannel));
        watcher.onDidCreate((uri) => {
            // A new context file = a newly-created (or newly-tracked) spec.
            // Refresh the sidebar so it appears and the welcome screen clears,
            // and refresh the viewer in case it is already open on that path.
            specExplorer.refresh();
            void handleSpecContextChange(uri, specViewer, outputChannel);
        });
        watcher.onDidDelete(handleSpecContextDelete);
        context.subscriptions.push(watcher);
    }
    outputChannel.appendLine(`[FileWatcher] spec-context watchers registered for ${patterns.length} spec patterns`);
}

/**
 * Watch Claude settings file
 */
function setupClaudeSettingsWatcher(
    context: vscode.ExtensionContext,
    steeringExplorer: SteeringExplorerProvider
): void {
    const claudeSettingsWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(process.env.HOME || '', '.claude/settings.json')
    );

    claudeSettingsWatcher.onDidChange(() => {
        steeringExplorer.refresh();
    });

    context.subscriptions.push(claudeSettingsWatcher);
}

/**
 * Watch CLAUDE.md files (global and project)
 */
function setupClaudeMdWatchers(
    context: vscode.ExtensionContext,
    steeringExplorer: SteeringExplorerProvider
): void {
    const globalClaudeMdWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(process.env.HOME || '', '.claude/CLAUDE.md')
    );
    const projectClaudeMdWatcher = vscode.workspace.createFileSystemWatcher('**/CLAUDE.md');

    globalClaudeMdWatcher.onDidCreate(() => steeringExplorer.refresh());
    globalClaudeMdWatcher.onDidDelete(() => steeringExplorer.refresh());
    projectClaudeMdWatcher.onDidCreate(() => steeringExplorer.refresh());
    projectClaudeMdWatcher.onDidDelete(() => steeringExplorer.refresh());

    context.subscriptions.push(globalClaudeMdWatcher, projectClaudeMdWatcher);
}

/**
 * Watch .specify directory for SpecKit file changes
 * (US3 - 005-speckit-views-enhancement)
 */
function setupSpecifyDirectoryWatcher(
    context: vscode.ExtensionContext,
    steeringExplorer: SteeringExplorerProvider,
    outputChannel: vscode.OutputChannel
): void {
    const specifyWatcher = vscode.workspace.createFileSystemWatcher('**/.specify/**/*');

    let refreshTimeout: NodeJS.Timeout | undefined;
    const debouncedRefresh = (event: string, uri: vscode.Uri) => {
        outputChannel.appendLine(`[FileWatcher] .specify ${event}: ${uri.fsPath}`);

        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
            steeringExplorer.refresh();
        }, 1000);
    };

    specifyWatcher.onDidCreate((uri) => debouncedRefresh('Create', uri));
    specifyWatcher.onDidDelete((uri) => debouncedRefresh('Delete', uri));
    specifyWatcher.onDidChange((uri) => debouncedRefresh('Change', uri));

    context.subscriptions.push(specifyWatcher);
}

/**
 * Watch tasks.md files for phase completion notifications
 */
export function setupTasksWatcher(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    // Debounce to avoid multiple notifications for rapid saves
    let debounceTimeout: NodeJS.Timeout | undefined;

    const handleTasksChange = async (uri: vscode.Uri) => {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }

        debounceTimeout = setTimeout(async () => {
            try {
                const content = await vscode.workspace.fs.readFile(uri);
                const specName = extractSpecNameFromPath(uri.fsPath);
                const progress = parseTasksFile(content.toString(), specName, uri.fsPath);
                const completedPhases = detectNewlyCompletedPhases(uri.fsPath, progress);

                for (const phaseName of completedPhases) {
                    outputChannel.appendLine(`[TasksWatcher] Phase completed: "${phaseName}" in ${specName}`);
                    if (isPhaseCompletionNotificationEnabled()) {
                        await NotificationUtils.showPhaseCompleteNotification(specName, phaseName, uri.fsPath);
                    }
                }

                // Issue #244 — close the implement step when every task is checked.
                // The tasks watcher is the only surface that fires for every driving
                // mode (stock speckit has no companion hook; IDE-chat dispatch returns
                // no terminal so the terminal-close tracker no-ops; implement has no
                // next step so complete-on-advance never fires for it). When implement
                // is underway and all tasks are now done, write the terminal close via
                // the same `completeStep` lifecycle helper the tracker + Python hook use
                // — idempotent and no-backward-clobber by the guard below. Best-effort:
                // a failure here is logged-and-swallowed by the enclosing try/catch and
                // never blocks the watcher.
                const specDir = path.dirname(uri.fsPath);
                const ctx = readSpecContextSync(specDir);
                if (shouldCloseImplement(ctx, progress)) {
                    // `completeStep` is best-effort: it logs-and-swallows write
                    // failures internally and returns void, so we can't confirm the
                    // terminal close was actually persisted here. Describe the action
                    // taken (all tasks checked → closing implement) rather than
                    // claiming a confirmed `implemented` outcome.
                    outputChannel.appendLine(`[TasksWatcher] All implement tasks checked → closing implement for ${specName}`);
                    await completeStep(specDir, 'implement', 'extension');
                }
            } catch (error) {
                outputChannel.appendLine(`[TasksWatcher] Error processing ${uri.fsPath}: ${error}`);
            }
        }, 500);
    };

    // Initialize cache when file is created (avoid false notifications on first open)
    const handleTasksCreate = async (uri: vscode.Uri) => {
        try {
            const content = await vscode.workspace.fs.readFile(uri);
            const specName = extractSpecNameFromPath(uri.fsPath);
            const progress = parseTasksFile(content.toString(), specName, uri.fsPath);
            initializeCache(uri.fsPath, progress);
            outputChannel.appendLine(`[TasksWatcher] Initialized cache for ${specName}`);
        } catch (error) {
            outputChannel.appendLine(`[TasksWatcher] Error initializing ${uri.fsPath}: ${error}`);
        }
    };

    // Watch for tasks.md files in configured spec directories
    const watcherPatterns = getFileWatcherPatterns();
    const taskPatterns = watcherPatterns.tasks;
    for (const pattern of taskPatterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidChange(handleTasksChange);
        watcher.onDidCreate(handleTasksCreate);
        context.subscriptions.push(watcher);
    }

    // Initialize cache for existing tasks.md files on startup
    initializeExistingTasksCache(outputChannel);
}

/**
 * Scan workspace for existing tasks.md files and initialize their cache
 * This prevents false "phase completed" notifications on first file change
 */
async function initializeExistingTasksCache(outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        const watcherPatterns = getFileWatcherPatterns();
        const allTasksFiles: vscode.Uri[] = [];
        for (const pattern of watcherPatterns.tasks) {
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
            allTasksFiles.push(...files);
        }
        const tasksFiles = allTasksFiles;
        outputChannel.appendLine(`[TasksWatcher] Found ${tasksFiles.length} existing tasks.md files`);

        for (const uri of tasksFiles) {
            try {
                const content = await vscode.workspace.fs.readFile(uri);
                const specName = extractSpecNameFromPath(uri.fsPath);
                const progress = parseTasksFile(content.toString(), specName, uri.fsPath);
                initializeCache(uri.fsPath, progress);
                outputChannel.appendLine(`[TasksWatcher] Cached: ${specName} (${progress.completedTasks}/${progress.totalTasks} tasks)`);
            } catch (error) {
                outputChannel.appendLine(`[TasksWatcher] Error caching ${uri.fsPath}: ${error}`);
            }
        }
    } catch (error) {
        outputChannel.appendLine(`[TasksWatcher] Error scanning for tasks.md files: ${error}`);
    }
}

/**
 * Watch spec markdown files for live content updates in the spec viewer
 * (US5 - 007-spec-viewer-webview)
 */
export function setupSpecViewerWatcher(
    context: vscode.ExtensionContext,
    specViewer: SpecViewerProvider,
    outputChannel: vscode.OutputChannel
): void {
    const watcherPatterns = getFileWatcherPatterns();
    const mdPatterns = watcherPatterns.markdown;
    // Create watchers for all configured markdown patterns
    const mdWatchers = mdPatterns.map(p => vscode.workspace.createFileSystemWatcher(p));
    const specMarkdownWatcher = mdWatchers[0] || vscode.workspace.createFileSystemWatcher('**/specs/**/*.md');

    let debounceTimer: NodeJS.Timeout | undefined;

    const handleChange = (uri: vscode.Uri) => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            outputChannel.appendLine(`[SpecViewerWatcher] File changed: ${uri.fsPath}`);
            specViewer.refreshIfDisplaying(uri.fsPath);
        }, 500);
    };

    const handleDelete = (uri: vscode.Uri) => {
        outputChannel.appendLine(`[SpecViewerWatcher] File deleted: ${uri.fsPath}`);
        specViewer.handleFileDeleted(uri.fsPath);
    };

    for (const watcher of mdWatchers) {
        watcher.onDidChange(handleChange);
        watcher.onDidCreate(handleChange);
        watcher.onDidDelete(handleDelete);
        context.subscriptions.push(watcher);
    }
    outputChannel.appendLine(`[SpecViewerWatcher] Watchers registered for ${mdPatterns.length} spec patterns`);
}
