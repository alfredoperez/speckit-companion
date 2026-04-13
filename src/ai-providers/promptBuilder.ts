import * as vscode from 'vscode';
import { CANONICAL_SUBSTEPS } from '../core/types/specContext';

export type PromptStep = keyof typeof CANONICAL_SUBSTEPS;

export interface BuildPromptOptions {
    command: string;
    step?: string | null;
    specDir?: string | null;
}

const MARKER_OPEN = '<!-- speckit-companion:context-update -->';
const MARKER_CLOSE = '<!-- /speckit-companion:context-update -->';

function isKnownStep(step: string | null | undefined): step is PromptStep {
    return !!step && Object.prototype.hasOwnProperty.call(CANONICAL_SUBSTEPS, step);
}

function isContextInstructionsEnabled(): boolean {
    try {
        return vscode.workspace
            .getConfiguration('speckit')
            .get<boolean>('aiContextInstructions', true);
    } catch {
        return true;
    }
}

function renderPreamble(step: PromptStep, specDir: string): string {
    const substeps = CANONICAL_SUBSTEPS[step].join(', ');
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    return [
        MARKER_OPEN,
        `Before and after this step runs, update ${target}:`,
        '',
        `1. Pre-step: set stepHistory.${step}.startedAt = now, currentStep = "${step}", status = "${step}-in-progress", and append a transition { step: "${step}", substep: null, from, by: "ai", at: now }.`,
        `2. Post-step: set stepHistory.${step}.completedAt = now, append a closing transition, and advance currentStep or set a terminal status.`,
        '',
        `Canonical substeps for ${step}: ${substeps}. Record each with its own startedAt/completedAt inside stepHistory.${step}.substeps[] and emit a transition with non-null substep.`,
        '',
        'Invariants: preserve unknown fields; transitions is append-only.',
        MARKER_CLOSE,
    ].join('\n');
}

export function buildPrompt(options: BuildPromptOptions): string {
    const { command, step, specDir } = options;
    if (!isContextInstructionsEnabled()) return command;
    if (!isKnownStep(step)) return command;
    const preamble = renderPreamble(step, specDir ?? '');
    return `${preamble}\n\n${command}`;
}
