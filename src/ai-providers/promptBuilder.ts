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
        `1. Pre-step: set currentStep = "${step}" and the matching in-progress status. Append a transition { step: "${step}", substep: null, from, by: "extension", at: <real timestamp> }.`,
        `1.5. When advancing from a previous step: flip the previous step\'s status to its completed form before writing the new step.`,
        '',
        `Canonical substeps for ${step}: ${substeps}. For each substep boundary append a transition with that substep name (and a real timestamp) — do NOT write substep entries inside stepHistory.`,
        '',
        `MUST DO BEFORE ENDING — all three required:`,
        `  (a) Flip status to "${completedStatus}".`,
        `  (b) Append a completion transition { step: "${step}", substep: null, from: { step: "${step}", substep: null }, by: "extension", at: <real timestamp> }. This is what clears the "in-flight" ring on the ${step} tab.`,
        `  (c) Print "${donePhrase}" as the final terminal line.`,
        `Skipping (a) leaves the badge stuck on the in-progress form; skipping (b) leaves the step timer running indefinitely; skipping (c) hides the completion from the activity log.`,
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
        '1. Before starting: set currentStep = "<step>" and status = in-progress form. Append a transition { step: "<step>", substep: null, from, by: "extension", at: <real timestamp> }.',
        '2. After completing: flip status = completed form. Append a completion transition { step: "<step>", substep: null, from: { step: "<step>", substep: null }, by: "extension", at: <real timestamp> } — this is what clears the in-flight ring on the tab.',
        '3. Append a transition entry for each substep boundary too, using a real timestamp.',
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

/**
 * Split a built prompt into its context-update preamble and the clean command
 * (typically just a slash command). When no preamble marker is present, the
 * whole prompt is returned as `command`. Used by providers that must route the
 * bookkeeping preamble separately from the user-facing command (Claude via
 * `--append-system-prompt`) or drop it entirely (IDE Chat, whose host editor
 * can't act on it).
 */
export function splitContextPreamble(prompt: string): { preamble: string | null; command: string } {
    const idx = prompt.indexOf(MARKER_CLOSE);
    if (idx === -1) {
        return { preamble: null, command: prompt };
    }
    const end = idx + MARKER_CLOSE.length;
    return {
        preamble: prompt.slice(0, end).trim(),
        command: prompt.slice(end).trim(),
    };
}

/**
 * Read a specify temp markdown file and return the feature description, dropping
 * the bookkeeping the extension appends below it (`## Post-Specification`).
 * Returns null when the file can't be read or is empty. Shared by providers that
 * inline the description into a prefilled command instead of passing the temp
 * path a human-facing surface can't open (IDE chat, Claude panel).
 */
export async function readSpecDescription(filePath: string): Promise<string | null> {
    try {
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        const text = Buffer.from(data).toString('utf-8');
        const marker = text.indexOf('## Post-Specification');
        const body = (marker === -1 ? text : text.slice(0, marker)).trim();
        return body || null;
    } catch {
        return null;
    }
}

/** The spec name from a path: the last segment, or its parent when it's a doc file. */
export function specNameFromPath(p: string): string {
    const segments = p.split(/[/\\]/).filter(Boolean);
    let name = segments.pop() ?? p;
    if (/\.md$/i.test(name) && segments.length > 0) {
        name = segments.pop()!;
    }
    return name;
}

/**
 * Clean the argument of an already-verb-formatted `/speckit.* <arg>` command for
 * dispatch to a surface that prefills text a human reads (IDE chat, Claude panel):
 * - free-text / multi-token / non-path args are kept as-is;
 * - `specify <temp.md>` (create-new-spec writes the description into a temp md the
 *   surface can't open) is inlined to `specify <description>`;
 * - any other spec-dir path arg is shortened to just the spec name.
 *
 * The command verb is left untouched — callers apply dot/dash formatting first.
 */
export async function cleanCommandArg(command: string): Promise<string> {
    const trimmed = command.trim();
    const sp = trimmed.indexOf(' ');
    if (sp === -1) return trimmed;
    const cmd = trimmed.slice(0, sp);
    const arg = trimmed.slice(sp + 1).trim();
    if (!arg) return cmd;

    if (/\s/.test(arg)) return `${cmd} ${arg}`;     // free-text / multi-token argument
    if (!/[/\\]/.test(arg)) return `${cmd} ${arg}`; // not a path

    if (/[.-]specify$/.test(cmd) && /\.md$/i.test(arg)) {
        const description = await readSpecDescription(arg);
        if (description) return `${cmd} ${description}`;
    }
    return `${cmd} ${specNameFromPath(arg)}`;
}
