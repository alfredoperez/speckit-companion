import * as vscode from 'vscode';
import { SpecExplorerProvider } from '../features/specs/specExplorerProvider';
import { SteeringExplorerProvider } from '../features/steering/steeringExplorerProvider';
import { HooksExplorerProvider } from '../features/hooks/hooksExplorerProvider';
import { MCPExplorerProvider } from '../features/mcp/mcpExplorerProvider';
import { AgentsExplorerProvider } from '../features/agents/agentsExplorerProvider';
import {
    parseTasksFile,
    detectNewlyCompletedPhases,
    extractSpecNameFromPath,
    initializeCache,
} from '../speckit/taskProgressService';
import { NotificationUtils } from './utils/notificationUtils';

/**
 * Set up file watchers for the extension
 */
export function setupFileWatchers(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    steeringExplorer: SteeringExplorerProvider,
    hooksExplorer: HooksExplorerProvider,
    mcpExplorer: MCPExplorerProvider,
    agentsExplorer: AgentsExplorerProvider,
    outputChannel: vscode.OutputChannel
): void {
    // Watch for changes in .claude directory with debouncing
    setupClaudeDirectoryWatcher(context, specExplorer, steeringExplorer, hooksExplorer, mcpExplorer, agentsExplorer, outputChannel);

    // Watch for changes in Claude settings
    setupClaudeSettingsWatcher(context, hooksExplorer, mcpExplorer);

    // Watch for changes in CLAUDE.md files
    setupClaudeMdWatchers(context, steeringExplorer);

    // Watch for changes in .specify directory (US3 - 001-speckit-views-enhancement)
    setupSpecifyDirectoryWatcher(context, steeringExplorer, outputChannel);
}

/**
 * Watch .claude directory with debouncing
 */
function setupClaudeDirectoryWatcher(
    context: vscode.ExtensionContext,
    specExplorer: SpecExplorerProvider,
    steeringExplorer: SteeringExplorerProvider,
    hooksExplorer: HooksExplorerProvider,
    mcpExplorer: MCPExplorerProvider,
    agentsExplorer: AgentsExplorerProvider,
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
            hooksExplorer.refresh();
            mcpExplorer.refresh();
            agentsExplorer.refresh();
        }, 1000);
    };

    claudeWatcher.onDidCreate((uri) => debouncedRefresh('Create', uri));
    claudeWatcher.onDidDelete((uri) => debouncedRefresh('Delete', uri));
    claudeWatcher.onDidChange((uri) => debouncedRefresh('Change', uri));

    context.subscriptions.push(claudeWatcher);
}

/**
 * Watch Claude settings file
 */
function setupClaudeSettingsWatcher(
    context: vscode.ExtensionContext,
    hooksExplorer: HooksExplorerProvider,
    mcpExplorer: MCPExplorerProvider
): void {
    const claudeSettingsWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(process.env.HOME || '', '.claude/settings.json')
    );

    claudeSettingsWatcher.onDidChange(() => {
        hooksExplorer.refresh();
        mcpExplorer.refresh();
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
 * (US3 - 001-speckit-views-enhancement)
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
    // Watch for tasks.md files in specs directories
    const tasksWatcher = vscode.workspace.createFileSystemWatcher('**/specs/**/tasks.md');

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
                    await NotificationUtils.showPhaseCompleteNotification(specName, phaseName, uri.fsPath);
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

    tasksWatcher.onDidChange(handleTasksChange);
    tasksWatcher.onDidCreate(handleTasksCreate);

    context.subscriptions.push(tasksWatcher);

    // Initialize cache for existing tasks.md files on startup
    initializeExistingTasksCache(outputChannel);
}

/**
 * Scan workspace for existing tasks.md files and initialize their cache
 * This prevents false "phase completed" notifications on first file change
 */
async function initializeExistingTasksCache(outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        const tasksFiles = await vscode.workspace.findFiles('**/specs/**/tasks.md', '**/node_modules/**');
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
