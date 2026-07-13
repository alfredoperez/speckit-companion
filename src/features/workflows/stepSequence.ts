import type { WorkflowStepConfig } from './types';

/** Index of a step in the full ordered workflow, or -1 when absent. */
export function workflowStepIndex(
  steps: WorkflowStepConfig[] | undefined,
  name: string | undefined,
): number {
  if (!steps || !name) return -1;
  return steps.findIndex((s) => s.name === name);
}

/**
 * The immediate next step after `currentStep` in the full ordered workflow —
 * action-only or document-producing alike. The footer label and the Approve
 * dispatch both derive from this so they can never diverge.
 */
export function nextWorkflowStep(
  steps: WorkflowStepConfig[] | undefined,
  currentStep: string | undefined,
): WorkflowStepConfig | undefined {
  const idx = workflowStepIndex(steps, currentStep);
  if (idx < 0 || !steps) return undefined;
  return steps[idx + 1];
}
