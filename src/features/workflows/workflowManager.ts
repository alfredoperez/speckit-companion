/**
 * Workflow Manager
 *
 * Handles workflow loading, validation, and persistence.
 * Manages the mapping between features and their selected workflows.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    WorkflowConfig,
    WorkflowStepConfig,
    WorkflowCommandConfig,
    WorkflowStep,
    ValidationResult,
    FeatureWorkflowContext,
    WORKFLOW_NAME_PATTERN,
    FEATURE_CONTEXT_FILE,
} from './types';
import { ConfigKeys, WorkflowSteps, AIProviders, COMPANION_WORKFLOW_NAME } from '../../core/constants';
import { getConfiguredProviderType, AIProviderType } from '../../ai-providers/aiProvider';
import { isCompanionInstalled } from '../settings/companionPresetReconciler';

/**
 * Legacy alias — existing .spec-context.json files may use "default".
 */
const LEGACY_DEFAULT_NAME = 'default';

/** Canonical provider ids — used to validate workflow `supportedAiProviders` entries. */
const KNOWN_PROVIDERS = Object.values(AIProviders) as string[];

/**
 * Default workflow configuration (always available)
 */
export const DEFAULT_WORKFLOW: WorkflowConfig = {
    name: 'speckit',
    displayName: 'SpecKit',
    description: 'Standard SpecKit workflow',
    steps: [
        { name: WorkflowSteps.SPECIFY, label: 'Specification', command: 'speckit.specify', file: 'spec.md', subDir: 'checklists' },
        { name: WorkflowSteps.PLAN, label: 'Plan', command: 'speckit.plan', file: 'plan.md', subFiles: ['research.md', 'data-model.md', 'quickstart.md'], subDir: 'contracts', includeRelatedDocs: true },
        { name: WorkflowSteps.TASKS, label: 'Tasks', command: 'speckit.tasks', file: 'tasks.md' },
        { name: WorkflowSteps.IMPLEMENT, label: 'Implement', command: 'speckit.implement', actionOnly: true },
    ],
    [WorkflowSteps.CONFIG_SPECIFY]: 'speckit.specify',
    [WorkflowSteps.CONFIG_PLAN]: 'speckit.plan',
    [WorkflowSteps.CONFIG_TASKS]: 'speckit.tasks',
    [WorkflowSteps.CONFIG_IMPLEMENT]: 'speckit.implement',
    checkpoints: [],
};

/**
 * Built-in SpecKit Companion workflow. Mirrors {@link DEFAULT_WORKFLOW} but every
 * step dispatches the `/speckit.companion.*` command family, with a terminal
 * `mark-complete` step. Selecting it records `workflow: companion` on the spec;
 * the missing-extension fallback (profileDispatch) downgrades each companion
 * command to its stock twin when the spec-kit extension isn't installed.
 */
export const COMPANION_WORKFLOW: WorkflowConfig = {
    name: COMPANION_WORKFLOW_NAME,
    displayName: 'SpecKit Companion',
    description: 'SpecKit Companion pipeline — leaner output with built-in right-sizing, through to mark-complete',
    steps: [
        { name: WorkflowSteps.SPECIFY, label: 'Specification', command: 'speckit.companion.specify', file: 'spec.md', subDir: 'checklists' },
        { name: WorkflowSteps.PLAN, label: 'Plan', command: 'speckit.companion.plan', file: 'plan.md', subFiles: ['research.md', 'data-model.md', 'quickstart.md'], subDir: 'contracts', includeRelatedDocs: true },
        { name: WorkflowSteps.TASKS, label: 'Tasks', command: 'speckit.companion.tasks', file: 'tasks.md' },
        { name: WorkflowSteps.IMPLEMENT, label: 'Implement', command: 'speckit.companion.implement', actionOnly: true },
        { name: 'mark-complete', label: 'Mark Complete', command: 'speckit.companion.mark-complete', actionOnly: true, untimed: true },
    ],
    [WorkflowSteps.CONFIG_SPECIFY]: 'speckit.companion.specify',
    [WorkflowSteps.CONFIG_PLAN]: 'speckit.companion.plan',
    [WorkflowSteps.CONFIG_TASKS]: 'speckit.companion.tasks',
    [WorkflowSteps.CONFIG_IMPLEMENT]: 'speckit.companion.implement',
    checkpoints: [],
};

/**
 * Get the resolved file for a workflow step.
 * Returns the explicit `file` property or defaults to `{name}.md`.
 */
export function getStepFile(step: WorkflowStepConfig): string {
    return step.file ?? `${step.name}.md`;
}

/**
 * Convert legacy `step-*` keys into a `steps` array.
 * If `steps` is already present, returns the config as-is.
 */
export function normalizeWorkflowConfig(config: WorkflowConfig): WorkflowConfig {
    if (config.steps && config.steps.length > 0) {
        return config;
    }

    const legacyMap: { key: keyof WorkflowConfig; name: string; label: string; file?: string; actionOnly?: boolean }[] = [
        { key: WorkflowSteps.CONFIG_SPECIFY, name: WorkflowSteps.SPECIFY, label: 'Specs', file: 'spec.md' },
        { key: WorkflowSteps.CONFIG_PLAN, name: WorkflowSteps.PLAN, label: 'Plan', file: 'plan.md' },
        { key: WorkflowSteps.CONFIG_TASKS, name: WorkflowSteps.TASKS, label: 'Tasks', file: 'tasks.md' },
        { key: WorkflowSteps.CONFIG_IMPLEMENT, name: WorkflowSteps.IMPLEMENT, label: 'Implement', actionOnly: true },
    ];

    const steps: WorkflowStepConfig[] = [];
    for (const entry of legacyMap) {
        const command = config[entry.key] as string | undefined;
        if (command && typeof command === 'string' && command.trim()) {
            steps.push({
                name: entry.name,
                label: entry.label,
                command: command.trim(),
                ...(entry.file ? { file: entry.file } : {}),
                ...(entry.actionOnly ? { actionOnly: true } : {}),
            });
        }
    }

    return { ...config, steps };
}

/**
 * Whether a workflow should be surfaced for the given AI provider.
 *
 * A workflow with no `supportedAiProviders` (undefined or empty array) is
 * supported everywhere. Otherwise it is supported only when `providerType`
 * appears in the list — comparison is case-sensitive against the canonical
 * provider ids in `AIProviders`.
 */
export function isWorkflowSupportedForProvider(
    config: WorkflowConfig,
    providerType: AIProviderType
): boolean {
    const supported = config.supportedAiProviders;
    if (!supported || supported.length === 0) {
        return true;
    }
    return supported.includes(providerType);
}

/**
 * Validate a workflow configuration
 * @param config Workflow configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateWorkflow(config: WorkflowConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required name field
    if (!config.name) {
        errors.push('Workflow name is required');
        return { valid: false, errors, warnings };
    }

    // Check reserved names
    if (config.name === 'speckit' || config.name === LEGACY_DEFAULT_NAME || config.name === COMPANION_WORKFLOW_NAME) {
        errors.push(`Workflow name "${config.name}" is reserved`);
        return { valid: false, errors, warnings };
    }

    // Validate name pattern
    if (!WORKFLOW_NAME_PATTERN.test(config.name)) {
        errors.push(
            `Invalid workflow name "${config.name}". Must start with lowercase letter, followed by lowercase letters, numbers, or hyphens.`
        );
    }

    // Validate step commands if provided
    const steps = [WorkflowSteps.CONFIG_SPECIFY, WorkflowSteps.CONFIG_PLAN, WorkflowSteps.CONFIG_TASKS, WorkflowSteps.CONFIG_IMPLEMENT] as const;
    for (const step of steps) {
        const value = config[step];
        if (value !== undefined && typeof value !== 'string') {
            errors.push(`Invalid ${step} value: must be a string`);
        } else if (value !== undefined && value.trim() === '') {
            warnings.push(`Empty ${step} value will use default command`);
        }
    }

    // Validate checkpoints
    if (config.checkpoints) {
        if (!Array.isArray(config.checkpoints)) {
            errors.push('Checkpoints must be an array');
        } else {
            for (let i = 0; i < config.checkpoints.length; i++) {
                const cp = config.checkpoints[i];
                if (!cp.id || !['commit', 'pr'].includes(cp.id)) {
                    errors.push(`Checkpoint ${i + 1}: Invalid id. Must be "commit" or "pr"`);
                }
                if (!cp.trigger || !['after-implement', 'after-commit'].includes(cp.trigger)) {
                    errors.push(`Checkpoint ${i + 1}: Invalid trigger. Must be "after-implement" or "after-commit"`);
                }
                // Validate trigger/id combinations
                if (cp.trigger === 'after-commit' && cp.id !== 'pr') {
                    warnings.push(`Checkpoint ${i + 1}: trigger "after-commit" is typically used with id "pr"`);
                }
            }
        }
    }

    // Validate supportedAiProviders
    if (config.supportedAiProviders !== undefined) {
        if (!Array.isArray(config.supportedAiProviders)) {
            errors.push('supportedAiProviders must be an array of provider ids');
        } else {
            for (const provider of config.supportedAiProviders) {
                if (typeof provider !== 'string') {
                    errors.push('supportedAiProviders entries must be strings');
                } else if (!KNOWN_PROVIDERS.includes(provider)) {
                    warnings.push(
                        `Unknown AI provider "${provider}" in supportedAiProviders — this id will never match any provider and is ignored`
                    );
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Get all configured workflows including the default
 * @returns Array of workflow configurations
 */
/**
 * Build the validated, de-duplicated workflow list (default + custom workflows).
 * When `filterByProvider` is true, workflows the active provider can't run are
 * hidden — for SELECTION surfaces (picker, spec-editor). Resolution of an
 * already-chosen workflow (`getWorkflow`) must NOT filter, otherwise an existing
 * spec would lose its real steps when viewed under a different provider.
 */
/**
 * Whether the Companion workflow may be offered for SELECTION: the companion
 * spec-kit extension is present on disk. Drives the Create-Spec picker so it never
 * lists an option that silently falls back to stock.
 */
export function isCompanionSelectable(): boolean {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return !!root && isCompanionInstalled(root);
}

function buildWorkflows(filterByProvider: boolean, outputChannel?: vscode.OutputChannel): WorkflowConfig[] {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const customWorkflows = config.get<WorkflowConfig[]>('customWorkflows', []);
    const activeProvider = getConfiguredProviderType();

    // SpecKit is always available. Companion is seeded into the SELECTION list
    // (filterByProvider) whenever the companion spec-kit extension is installed — so
    // the picker never offers a hollow option that does nothing. The RESOLUTION path
    // (getAllWorkflows) always includes it so an existing companion spec keeps its
    // real steps regardless.
    const includeCompanion = !filterByProvider || isCompanionSelectable();
    const validWorkflows: WorkflowConfig[] = [DEFAULT_WORKFLOW];
    if (includeCompanion) {
        validWorkflows.push(COMPANION_WORKFLOW);
    }
    // The companion name stays reserved at every scope so a custom workflow can
    // never shadow the built-in id, even when it isn't seeded into selection.
    const seenNames = new Set<string>(['speckit', LEGACY_DEFAULT_NAME, COMPANION_WORKFLOW_NAME]);

    for (const workflow of customWorkflows) {
        const result = validateWorkflow(workflow);
        if (!result.valid) {
            outputChannel?.appendLine(
                `[Workflows] Invalid workflow "${workflow.name || 'unnamed'}": ${result.errors.join('; ')}`
            );
            continue;
        }
        if (seenNames.has(workflow.name)) {
            outputChannel?.appendLine(
                `[Workflows] Duplicate workflow name "${workflow.name}" - skipping duplicate`
            );
            continue;
        }
        if (filterByProvider && !isWorkflowSupportedForProvider(workflow, activeProvider)) {
            outputChannel?.appendLine(
                `[Workflows] Workflow "${workflow.name}" not supported by provider "${activeProvider}" - hiding`
            );
            continue;
        }
        seenNames.add(workflow.name);
        validWorkflows.push(normalizeWorkflowConfig(workflow));
    }

    return validWorkflows;
}

/**
 * Workflows for SELECTION surfaces — filtered to those the active provider can run.
 */
export function getWorkflows(outputChannel?: vscode.OutputChannel): WorkflowConfig[] {
    return buildWorkflows(true, outputChannel);
}

/**
 * All configured workflows regardless of the active provider. Used to RESOLVE an
 * already-selected workflow (e.g. an existing spec's stored workflow) so it keeps
 * its real steps even when the active provider couldn't newly select it.
 */
export function getAllWorkflows(): WorkflowConfig[] {
    return buildWorkflows(false);
}

/**
 * Get a specific workflow by name
 * @param name Workflow name
 * @returns Workflow configuration or undefined if not found
 */
export function getWorkflow(name: string): WorkflowConfig | undefined {
    // Treat legacy "default" as "speckit"
    const resolvedName = name === LEGACY_DEFAULT_NAME ? 'speckit' : name;
    // Resolve against the unfiltered set: a spec that already selected this
    // workflow must keep its steps even if the active provider can't select it.
    const workflows = getAllWorkflows();
    return workflows.find(w => w.name === resolvedName);
}

/**
 * Get the commands array for a workflow by name.
 * Returns an empty array if the workflow is not found or has no commands.
 */
export function getWorkflowCommands(workflowName: string): WorkflowCommandConfig[] {
    const workflow = getWorkflow(workflowName);
    return workflow?.commands ?? [];
}

/**
 * Get the selected workflow for a feature from .spec-context.json.
 * Checks both featureDir and optional changeRoot for the context file.
 * @param featureDir Path to feature directory
 * @param changeRoot Optional change root directory to also check
 * @returns Workflow context or undefined if not selected
 */
export async function getFeatureWorkflow(
    featureDir: string,
    changeRoot?: string | null
): Promise<FeatureWorkflowContext | undefined> {
    // Try featureDir first, then changeRoot
    const dirsToCheck = [featureDir];
    if (changeRoot && changeRoot !== featureDir) {
        dirsToCheck.push(changeRoot);
    }

    for (const dir of dirsToCheck) {
        const contextPath = path.join(dir, FEATURE_CONTEXT_FILE);
        let content: string;
        try {
            content = await fs.promises.readFile(contextPath, 'utf-8');
        } catch (err) {
            if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
            throw err;
        }
        try {
            // Return context even if workflow name is unrecognized —
            // callers can fall back to the default workflow for display
            // without overwriting the user's context data.
            return JSON.parse(content) as FeatureWorkflowContext;
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            throw new Error(`spec-context.json exists but is invalid JSON (${contextPath}): ${reason}`);
        }
    }

    return undefined;
}

/**
 * Save workflow selection for a feature to .spec-context.json
 * @param featureDir Path to feature directory
 * @param workflowName Name of selected workflow
 */
export async function saveFeatureWorkflow(
    featureDir: string,
    workflowName: string
): Promise<void> {
    const contextPath = path.join(featureDir, FEATURE_CONTEXT_FILE);

    // Read-modify-write that distinguishes ENOENT (legitimate first write —
    // emit minimal context) from any other failure (refuse to write so a
    // transient read error can't wipe lifecycle history).
    let content: string | null = null;
    try {
        content = await fs.promises.readFile(contextPath, 'utf-8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
            throw new Error(
                `refusing to save workflow selection: existing ${FEATURE_CONTEXT_FILE} at ${contextPath} is unreadable (${(err as Error)?.message ?? err}).`,
            );
        }
    }

    let context: FeatureWorkflowContext;
    if (content === null) {
        context = {
            workflow: workflowName,
            selectedAt: new Date().toISOString(),
        };
    } else {
        let existing: Record<string, unknown>;
        try {
            existing = JSON.parse(content);
        } catch (err) {
            throw new Error(
                `refusing to save workflow selection: existing ${FEATURE_CONTEXT_FILE} at ${contextPath} is not valid JSON (${(err as Error)?.message ?? err}).`,
            );
        }
        context = {
            ...(existing as unknown as FeatureWorkflowContext),
            workflow: workflowName,
            selectedAt: new Date().toISOString(),
        };
    }

    await fs.promises.writeFile(contextPath, JSON.stringify(context, null, 2), 'utf-8');
}

/**
 * Resolve the command for a workflow step
 * @param workflow Workflow configuration
 * @param step Step name (e.g., "specify", "plan", "design")
 * @returns Resolved command name
 */
export function resolveStepCommand(workflow: WorkflowConfig, step: WorkflowStep): string {
    // Try new steps array first
    const normalized = normalizeWorkflowConfig(workflow);
    if (normalized.steps) {
        const found = normalized.steps.find(s => s.name === step);
        if (found) {
            return stripLeadingSlash(found.command);
        }
    }

    // Legacy fallback
    const stepKey = `step-${step}` as keyof WorkflowConfig;
    const customCommand = workflow[stepKey] as string | undefined;

    if (customCommand && customCommand.trim()) {
        return stripLeadingSlash(customCommand);
    }

    // Fall back to default workflow commands
    const defaultStep = DEFAULT_WORKFLOW.steps?.find(s => s.name === step);
    return defaultStep?.command ?? `speckit.${step}`;
}

/**
 * Normalize a workflow step command to a bare command id. Users may write a
 * step command either as `to-spec` or `/to-spec` (matching how they'd type a
 * slash command); the dispatch sites prepend the leading `/` themselves, so a
 * stored leading slash would produce `//to-spec`. Strip it here — the single
 * point every step command is resolved through. Mirrors the normalization in
 * `customCommandConfig.ts`. (Issue #419)
 */
function stripLeadingSlash(command: string): string {
    const trimmed = command.trim();
    return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
}

/**
 * Register configuration change listener for workflow validation
 * @param context Extension context for subscription management
 * @returns Disposable for the configuration listener
 */
export function registerWorkflowConfigChangeListener(
    context: vscode.ExtensionContext
): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(ConfigKeys.customWorkflows)) {
            validateWorkflowsOnActivation();
        }
    });
}

/**
 * Validate all workflows and display warnings for any issues
 * Called during extension activation
 */
export function validateWorkflowsOnActivation(outputChannel?: vscode.OutputChannel): void {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const customWorkflows = config.get<WorkflowConfig[]>('customWorkflows', []);

    if (customWorkflows.length === 0) {
        return;
    }

    let hasErrors = false;
    const seenNames = new Set<string>();

    for (const workflow of customWorkflows) {
        const result = validateWorkflow(workflow);

        // Check for duplicate names
        if (workflow.name && seenNames.has(workflow.name)) {
            outputChannel?.appendLine(
                `[Workflows] Duplicate workflow name "${workflow.name}" found in settings`
            );
            hasErrors = true;
        }
        if (workflow.name) {
            seenNames.add(workflow.name);
        }

        // Log validation warnings
        for (const warning of result.warnings) {
            outputChannel?.appendLine(`[Workflows] "${workflow.name}": ${warning}`);
        }

        // Log validation errors
        if (!result.valid) {
            hasErrors = true;
            for (const error of result.errors) {
                outputChannel?.appendLine(`[Workflows] "${workflow.name || 'unnamed'}": ${error}`);
            }
        }
    }

    if (hasErrors) {
        outputChannel?.appendLine(
            '[Workflows] Some workflows have configuration errors and will be skipped. Check the settings.'
        );
    }

    // Validate defaultWorkflow setting
    const defaultWorkflowName = config.get<string>('defaultWorkflow', 'speckit');
    const allWorkflowNames = ['speckit', LEGACY_DEFAULT_NAME, COMPANION_WORKFLOW_NAME, ...seenNames];
    if (!allWorkflowNames.includes(defaultWorkflowName)) {
        outputChannel?.appendLine(
            `[Workflows] Default workflow "${defaultWorkflowName}" is not configured. Check your speckit.defaultWorkflow setting.`
        );
    }
}
