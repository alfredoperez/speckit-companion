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
    WorkflowStep,
    ValidationResult,
    FeatureWorkflowContext,
    WORKFLOW_NAME_PATTERN,
    FEATURE_CONTEXT_FILE,
} from './types';
import { ConfigKeys } from '../../core/constants';

/**
 * Default workflow configuration (always available)
 */
export const DEFAULT_WORKFLOW: WorkflowConfig = {
    name: 'default',
    displayName: 'Default',
    description: 'Standard SpecKit workflow',
    steps: [
        { name: 'specify', label: 'Specs', command: 'speckit.specify', file: 'spec.md' },
        { name: 'plan', label: 'Plan', command: 'speckit.plan', file: 'plan.md' },
        { name: 'tasks', label: 'Tasks', command: 'speckit.tasks', file: 'tasks.md' },
        { name: 'implement', label: 'Implement', command: 'speckit.implement', actionOnly: true },
    ],
    'step-specify': 'speckit.specify',
    'step-plan': 'speckit.plan',
    'step-tasks': 'speckit.tasks',
    'step-implement': 'speckit.implement',
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
        { key: 'step-specify', name: 'specify', label: 'Specs', file: 'spec.md' },
        { key: 'step-plan', name: 'plan', label: 'Plan', file: 'plan.md' },
        { key: 'step-tasks', name: 'tasks', label: 'Tasks', file: 'tasks.md' },
        { key: 'step-implement', name: 'implement', label: 'Implement', actionOnly: true },
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

    // Check reserved name
    if (config.name === 'default') {
        errors.push('Workflow name "default" is reserved');
        return { valid: false, errors, warnings };
    }

    // Validate name pattern
    if (!WORKFLOW_NAME_PATTERN.test(config.name)) {
        errors.push(
            `Invalid workflow name "${config.name}". Must start with lowercase letter, followed by lowercase letters, numbers, or hyphens.`
        );
    }

    // Validate step commands if provided
    const steps = ['step-specify', 'step-plan', 'step-tasks', 'step-implement'] as const;
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
export function getWorkflows(outputChannel?: vscode.OutputChannel): WorkflowConfig[] {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const customWorkflows = config.get<WorkflowConfig[]>('customWorkflows', []);

    const validWorkflows: WorkflowConfig[] = [DEFAULT_WORKFLOW];
    const seenNames = new Set<string>(['default']);

    for (const workflow of customWorkflows) {
        const result = validateWorkflow(workflow);
        if (result.valid) {
            // Check for duplicates
            if (seenNames.has(workflow.name)) {
                outputChannel?.appendLine(
                    `[Workflows] Duplicate workflow name "${workflow.name}" - skipping duplicate`
                );
                continue;
            }
            seenNames.add(workflow.name);
            validWorkflows.push(normalizeWorkflowConfig(workflow));
        } else {
            // Log validation errors
            const errorMsg = result.errors.join('; ');
            outputChannel?.appendLine(
                `[Workflows] Invalid workflow "${workflow.name || 'unnamed'}": ${errorMsg}`
            );
        }
    }

    return validWorkflows;
}

/**
 * Get a specific workflow by name
 * @param name Workflow name
 * @returns Workflow configuration or undefined if not found
 */
export function getWorkflow(name: string): WorkflowConfig | undefined {
    const workflows = getWorkflows();
    return workflows.find(w => w.name === name);
}

/**
 * Get the selected workflow for a feature from .speckit.json
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
        try {
            const content = await fs.promises.readFile(contextPath, 'utf-8');
            const context = JSON.parse(content) as FeatureWorkflowContext;

            // Validate the workflow still exists
            const workflow = getWorkflow(context.workflow);
            if (!workflow) {
                continue;
            }

            return context;
        } catch {
            // File doesn't exist or is invalid, try next
        }
    }

    return undefined;
}

/**
 * Save workflow selection for a feature to .speckit.json
 * @param featureDir Path to feature directory
 * @param workflowName Name of selected workflow
 */
export async function saveFeatureWorkflow(
    featureDir: string,
    workflowName: string
): Promise<void> {
    const contextPath = path.join(featureDir, FEATURE_CONTEXT_FILE);

    // Read existing context or create new
    let context: FeatureWorkflowContext;
    try {
        const content = await fs.promises.readFile(contextPath, 'utf-8');
        const existing = JSON.parse(content);
        context = {
            ...existing,
            workflow: workflowName,
            selectedAt: new Date().toISOString(),
        };
    } catch {
        context = {
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
            return found.command;
        }
    }

    // Legacy fallback
    const stepKey = `step-${step}` as keyof WorkflowConfig;
    const customCommand = workflow[stepKey] as string | undefined;

    if (customCommand && customCommand.trim()) {
        return customCommand;
    }

    // Fall back to default workflow commands
    const defaultStep = DEFAULT_WORKFLOW.steps?.find(s => s.name === step);
    return defaultStep?.command ?? `speckit.${step}`;
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
    const defaultWorkflowName = config.get<string>('defaultWorkflow', 'default');
    const allWorkflowNames = ['default', ...seenNames];
    if (!allWorkflowNames.includes(defaultWorkflowName)) {
        outputChannel?.appendLine(
            `[Workflows] Default workflow "${defaultWorkflowName}" is not configured. Check your speckit.defaultWorkflow setting.`
        );
    }
}
