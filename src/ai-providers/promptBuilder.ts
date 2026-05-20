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
].join('\n');

const SHARED_RULES = [
    'TIMESTAMPS: never type one. For each transition `at`, run',
    '    date -u +"%Y-%m-%dT%H:%M:%SZ"',
    'and paste the output. Hand-typed times round to :00 and the viewer treats them as unreliable.',
    '',
    'stepHistory is READ-ONLY. The extension derives it from transitions[] and overwrites whatever',
    'is on disk. Do not write substep startedAt/completedAt entries.',
    '',
    'TASK SUMMARIES (implement only): append task_summaries.<TaskID> = { status, did, files, concerns }.',
    'status is "DONE" or "DONE_WITH_CONCERNS"; did is one sentence; files is string[]; concerns is string[].',
    'Omit concerns when empty — never write "None"/"N/A". The viewer reads these.',
    '',
    'Skip step_summaries.<step>.tests_passing, .files_planned, .checkpoints — unconsumed.',
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
        `1. Pre-step: set currentStep = "${step}" and the matching in-progress status. Append a transition { step: "${step}", substep: null, from, by: "ai", at: <real timestamp> }.`,
        `1.5. When advancing from a previous step: flip the previous step\'s status to its completed form before writing the new step.`,
        '',
        `Canonical substeps for ${step}: ${substeps}. For each substep boundary append a transition with that substep name (and a real timestamp) — do NOT write substep entries inside stepHistory.`,
        '',
        `MUST DO BEFORE ENDING — both required:`,
        `  (a) Flip status to "${completedStatus}".`,
        `  (b) Print "${donePhrase}" as the final terminal line.`,
        `Skipping either leaves the viewer badge stuck on the in-progress form.`,
        '',
        SHARED_RULES,
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
        'For EACH step you work on (specify, plan, tasks, implement):',
        '1. Before starting: set currentStep = "<step>" and status = in-progress form.',
        '2. After completing: flip status = completed form.',
        '3. Append a transition entry for each step change AND each substep boundary, using a real timestamp.',
        '',
        SHARED_RULES,
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
