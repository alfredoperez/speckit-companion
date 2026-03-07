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
        { name: 'specify', label: 'Specify', command: 'speckit.specify', file: 'spec.md' },
        { name: 'plan', label: 'Plan', command: 'speckit.plan', file: 'plan.md', includeRelatedDocs: true },
        { name: 'tasks', label: 'Tasks', command: 'speckit.tasks', file: 'tasks.md' },
        { name: 'implement', label: 'Implement', command: 'speckit.implement' },
    ],
    checkpoints: [],
};

/**
 * Legacy step key to default file mapping
 */
const LEGACY_STEP_DEFAULTS: Record<string, { name: string; label: string; file: string }> = {
    'step-specify': { name: 'specify', label: 'Specify', file: 'spec.md' },
    'step-plan': { name: 'plan', label: 'Plan', file: 'plan.md' },
    'step-tasks': { name: 'tasks', label: 'Tasks', file: 'tasks.md' },
    'step-implement': { name: 'implement', label: 'Implement', file: 'implement.md' },
};

/**
 * Normalize a workflow config: convert legacy `step-*` keys to `steps` array
 */
export function normalizeWorkflowConfig(config: WorkflowConfig): WorkflowConfig {
    // Already has steps array — use as-is
    if (config.steps && config.steps.length > 0) {
        return config;
    }

    // Convert legacy step-* keys to steps array
    const steps: WorkflowStepConfig[] = [];
    const legacyKeys = ['step-specify', 'step-plan', 'step-tasks', 'step-implement'] as const;

    for (const key of legacyKeys) {
        const command = config[key];
        if (command && typeof command === 'string' && command.trim()) {
            const defaults = LEGACY_STEP_DEFAULTS[key];
            steps.push({
                name: defaults.name,
                label: defaults.label,
                command: command.trim(),
                file: defaults.file,
                ...(key === 'step-plan' && { includeRelatedDocs: true }),
            });
        }
    }

    // If no legacy keys were set either, return the default steps
    if (steps.length === 0) {
        return { ...config, steps: DEFAULT_WORKFLOW.steps };
    }

    return { ...config, steps };
}

/**
 * Resolve the output file for a workflow step
 * Uses step.file if set, otherwise defaults to `{step.name}.md`
 */
export function getStepFile(step: WorkflowStepConfig): string {
    return step.file ?? `${step.name}.md`;
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

    // Validate steps array if provided (new format)
    if (config.steps) {
        if (!Array.isArray(config.steps)) {
            errors.push('Steps must be an array');
        } else {
            for (let i = 0; i < config.steps.length; i++) {
                const step = config.steps[i];
                if (!step.name || typeof step.name !== 'string') {
                    errors.push(`Step ${i + 1}: name is required and must be a string`);
                }
                if (!step.command || typeof step.command !== 'string') {
                    errors.push(`Step ${i + 1}: command is required and must be a string`);
                }
            }
        }
    }

    // Validate legacy step commands if provided
    const legacySteps = ['step-specify', 'step-plan', 'step-tasks', 'step-implement'] as const;
    for (const step of legacySteps) {
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
 * @param featureDir Path to feature directory
 * @returns Workflow context or undefined if not selected
 */
export async function getFeatureWorkflow(
    featureDir: string
): Promise<FeatureWorkflowContext | undefined> {
    const contextPath = path.join(featureDir, FEATURE_CONTEXT_FILE);

    try {
        const content = await fs.promises.readFile(contextPath, 'utf-8');
        const context = JSON.parse(content) as FeatureWorkflowContext;

        // Validate the workflow still exists
        const workflow = getWorkflow(context.workflow);
        if (!workflow) {
            return undefined;
        }

        return context;
    } catch {
        // File doesn't exist or is invalid
        return undefined;
    }
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
    // Look up in steps array first (normalized configs always have this)
    const normalized = normalizeWorkflowConfig(workflow);
    const stepConfig = normalized.steps?.find(s => s.name === step);
    if (stepConfig) {
        return stepConfig.command;
    }

    // Fall back to default workflow
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
