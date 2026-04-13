/**
 * Minimal context creation for specs that have no `.spec-context.json`.
 *
 * Per FR-011 / Decision 3: never infer step completion from file presence.
 * Backfill records only facts we can verify.
 */

import { SpecContext } from '../../core/types/specContext';

export interface BackfillInput {
    workflow: string;
    specName: string;
    branch: string;
    selectedAt?: string;
}

export function backfillMinimalContext(input: BackfillInput): SpecContext {
    return {
        workflow: input.workflow,
        specName: input.specName,
        branch: input.branch,
        selectedAt: input.selectedAt ?? new Date().toISOString(),
        currentStep: 'specify',
        status: 'draft',
        stepHistory: {},
        transitions: [],
    };
}
