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

const STATUS_LIFECYCLE = [
    'Canonical statuses: draft → specifying → specified → planning → planned → tasking → ready-to-implement → implementing → completed.',
    'When starting a step: set status to the in-progress form (specifying, planning, tasking, implementing).',
    'When completing a step: set status to the completed form (specified, planned, ready-to-implement, completed).',
    'Always set stepHistory.<step>.completedAt before advancing currentStep to the next step.',
].join('\n');

const COMPLETED_STATUS_BY_STEP: Record<PromptStep, string> = {
    specify: 'specified',
    plan: 'planned',
    tasks: 'ready-to-implement',
    implement: 'completed',
};

const DONE_PHRASE_BY_STEP: Record<PromptStep, string> = {
    specify: 'Done specifying',
    plan: 'Done planning',
    tasks: 'Done creating tasks',
    implement: 'Done implementing',
};

function renderPreamble(step: PromptStep, specDir: string): string {
    const substeps = CANONICAL_SUBSTEPS[step].join(', ');
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    const completedStatus = COMPLETED_STATUS_BY_STEP[step];
    const donePhrase = DONE_PHRASE_BY_STEP[step];
    return [
        MARKER_OPEN,
        `Before and after this step runs, update ${target}:`,
        '',
        STATUS_LIFECYCLE,
        '',
        `1. Pre-step: set stepHistory.${step}.startedAt = now, currentStep = "${step}", and set the matching in-progress status. Append a transition { step: "${step}", substep: null, from, by: "ai", at: now }.`,
        `1.5. When advancing from a previous step: set stepHistory.<previousStep>.completedAt = now (if not already set) and its completed status before writing the new step.`,
        '',
        `Canonical substeps for ${step}: ${substeps}. Record each with its own startedAt/completedAt inside stepHistory.${step}.substeps[] and emit a transition with non-null substep.`,
        '',
        `MUST DO BEFORE ENDING — all three required:`,
        `  (a) Set stepHistory.${step}.completedAt = now.`,
        `  (b) Flip status to "${completedStatus}".`,
        `  (c) Print "${donePhrase}" as the final terminal line.`,
        `Skipping any leaves the viewer badge stuck on the in-progress form.`,
        '',
        'Invariants: preserve unknown fields; transitions is append-only.',
        MARKER_CLOSE,
    ].join('\n');
}

function renderLifecyclePreamble(specDir: string): string {
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    return [
        MARKER_OPEN,
        `Throughout this run, keep ${target} up to date as you move through steps:`,
        '',
        STATUS_LIFECYCLE,
        '',
        'For EACH step you work on (specify, plan, tasks):',
        '1. Before starting: set stepHistory.<step>.startedAt = now, currentStep = "<step>", status = in-progress form.',
        '2. After completing: set stepHistory.<step>.completedAt = now, status = completed form.',
        '3. Always set the previous step\'s completedAt before advancing to the next step.',
        '4. Append a transition entry for each step change.',
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

/**
 * Build a prompt for multi-step commands (e.g., sdd-auto) that covers
 * the entire step lifecycle rather than a single step.
 */
export function buildLifecyclePrompt(command: string, specDir?: string | null): string {
    if (!isContextInstructionsEnabled()) return command;
    const preamble = renderLifecyclePreamble(specDir ?? '');
    return `${preamble}\n\n${command}`;
}
