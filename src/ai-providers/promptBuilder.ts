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

/**
 * Compact JSON Schema for `.spec-context.json`. Embedded at the top of every
 * preamble so the AI has a precise contract — not prose — for the canonical
 * shape. Kept terse to control token cost; the invariants beyond JSON Schema
 * (atomic writes, `history` ↔ `currentStep` consistency) live below it.
 */
const SPEC_CONTEXT_SCHEMA = [
    '```jsonschema',
    '{',
    '  "type": "object",',
    '  "required": ["workflow", "specName", "currentStep", "status", "history"],',
    '  "additionalProperties": true,',
    '  "properties": {',
    '    "workflow":    { "enum": ["speckit", "sdd"] },',
    '    "specName":    { "type": "string" },',
    '    "branch":      { "type": "string" },',
    '    "selectedAt":  { "type": "string", "format": "date-time" },',
    '    "currentStep": { "enum": ["specify","clarify","plan","tasks","analyze","implement"] },',
    '    "status":      { "enum": ["draft","specifying","specified","planning","planned",',
    '                              "tasking","ready-to-implement","implementing","implemented",',
    '                              "completed","archived"] },',
    '    "history": {',
    '      "type": "array",',
    '      "items": {',
    '        "type": "object",',
    '        "required": ["step","substep","from","by","at"],',
    '        "properties": {',
    '          "step":    { "$ref": "#/properties/currentStep" },',
    '          "substep": { "type": ["string","null"] },',
    '          "from":    { "type": "object",',
    '                       "properties": { "step":    { "type": ["string","null"] },',
    '                                       "substep": { "type": ["string","null"] } } },',
    '          "by":      { "enum": ["extension","sdd-skill","user","ai"] },',
    '          "at":      { "type": "string", "format": "date-time" }',
    '        }',
    '      }',
    '    }',
    '  }',
    '}',
    '```',
    '',
    'Invariants beyond JSON Schema:',
    '- `history` is APPEND-ONLY. Never reorder, never delete, never edit prior entries.',
    '- The last `history[]` entry\'s `step` MUST equal `currentStep`. If you change',
    '  `currentStep`, append a matching history entry in the SAME write. `currentStep`',
    '  ahead of `history` is an invalid state — the viewer reads it as a fake',
    '  "Generating <step>…" indefinitely.',
    '- `status` MUST match the lifecycle stage of `currentStep` (see the status table',
    '  below).',
    '- Do NOT write `stepHistory` or `transitions` — both are deprecated. `stepHistory`',
    '  is derived in-memory by the viewer; `transitions` was renamed to `history`.',
].join('\n');

const STATUS_LIFECYCLE = [
    'Canonical statuses: draft → specifying → specified → planning → planned → tasking → ready-to-implement → implementing → completed.',
    'When starting a step: set status to the in-progress form (specifying, planning, tasking, implementing).',
    'When completing a step: set status to the completed form (specified, planned, ready-to-implement, completed).',
].join('\n');

const SHARED_RULES = [
    'TIMESTAMPS: never type one. For each history `at`, run',
    '    date -u +"%Y-%m-%dT%H:%M:%SZ"',
    'and paste the output. Hand-typed times round to :00 and the viewer treats them as unreliable.',
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

const NEXT_STEP_BY_STEP: Record<PromptStep, PromptStep | null> = {
    specify: 'plan',
    plan: 'tasks',
    tasks: 'implement',
    implement: null,
};

function renderPreamble(step: PromptStep, specDir: string): string {
    const substeps = CANONICAL_SUBSTEPS[step].join(', ');
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    const completedStatus = COMPLETED_STATUS_BY_STEP[step];
    const donePhrase = DONE_PHRASE_BY_STEP[step];
    const nextStep = NEXT_STEP_BY_STEP[step];
    const advanceClause = nextStep
        ? [
            `  (d) ATOMICALLY (in the same write as (a) and (b)) set currentStep to "${nextStep}"`,
            `      AND append a start history entry { step: "${nextStep}", substep: null,`,
            `      from: { step: "${step}", substep: null }, by: "extension", at: <real timestamp> }.`,
            `      The entry is what makes the advance visible — currentStep ahead of history`,
            `      is the exact failure mode that makes the viewer show "Generating ${nextStep}…"`,
            `      forever with no real progress.`,
        ].join('\n')
        : `  (d) Leave currentStep on "${step}" — this is the terminal step; do not advance further.`;
    const advanceFailureNote = nextStep
        ? `; skipping (d), or doing (d) but forgetting the start-entry, leaves currentStep ahead of history and the PhasesCard shows a phantom "Generating ${nextStep}…"`
        : '';
    return [
        MARKER_OPEN,
        `Before and after this step runs, update ${target}. Schema:`,
        '',
        SPEC_CONTEXT_SCHEMA,
        '',
        STATUS_LIFECYCLE,
        '',
        `1. Pre-step: set currentStep = "${step}" and the matching in-progress status. Append a history entry { step: "${step}", substep: null, from, by: "extension", at: <real timestamp> }.`,
        `1.5. When advancing from a previous step: flip the previous step's status to its completed form before writing the new step.`,
        '',
        `Canonical substeps for ${step}: ${substeps}. For each substep boundary append a history entry with that substep name (and a real timestamp).`,
        '',
        `MUST DO BEFORE ENDING — all four required:`,
        `  (a) Flip status to "${completedStatus}".`,
        `  (b) Append a completion history entry { step: "${step}", substep: null, from: { step: "${step}", substep: null }, by: "extension", at: <real timestamp> }. This is what clears the "in-flight" ring on the ${step} tab.`,
        `  (c) Print "${donePhrase}" as the final terminal line.`,
        advanceClause,
        `Skipping (a) leaves the badge stuck on the in-progress form; skipping (b) leaves the step timer running indefinitely; skipping (c) hides the completion from the activity log${advanceFailureNote}.`,
        '',
        SHARED_RULES,
        '',
        'Invariants: preserve unknown fields; history is append-only.',
        MARKER_CLOSE,
    ].join('\n');
}

function renderLifecycleBody(target: string): string {
    return [
        `Throughout this run, keep ${target} up to date as you move through steps. Schema:`,
        '',
        SPEC_CONTEXT_SCHEMA,
        '',
        STATUS_LIFECYCLE,
        '',
        'For EACH step you work on (specify, plan, tasks, implement):',
        '1. Before starting: set currentStep = "<step>" and status = in-progress form. Append a history entry { step: "<step>", substep: null, from, by: "extension", at: <real timestamp> }.',
        '2. After completing: flip status = completed form. Append a completion history entry { step: "<step>", substep: null, from: { step: "<step>", substep: null }, by: "extension", at: <real timestamp> } — this is what clears the in-flight ring on the tab.',
        '3. Append a history entry for each substep boundary too, using a real timestamp.',
        '4. After completing a step, ATOMICALLY (same write as the completion entry) advance to the next step: set currentStep to the next step in the canonical sequence specify → plan → tasks → implement AND append a start history entry { step: "<next>", substep: null, from: { step: "<this>", substep: null }, by: "extension", at: <real timestamp> }. After implement, leave currentStep on "implement" — it is terminal. currentStep ahead of history is an invalid state.',
        '',
        SHARED_RULES,
        '',
        'Invariants: preserve unknown fields; history is append-only.',
    ].join('\n');
}

function renderLifecyclePreamble(specDir: string): string {
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    return [
        MARKER_OPEN,
        renderLifecycleBody(target),
        MARKER_CLOSE,
    ].join('\n');
}

function renderSpecifyCreationLifecyclePreamble(
    workflowName: string,
    specDir: string | null
): string {
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    return [
        MARKER_OPEN,
        `On first creation, write ${target} with these top-level fields (the file does not yet exist):`,
        '',
        '```json',
        '{',
        `  "workflow": "${workflowName}",`,
        '  "specName": "<human-readable name derived from the spec directory slug, e.g. 108-my-feature → My Feature>",',
        '  "branch": "<output of: git rev-parse --abbrev-ref HEAD>",',
        '  "selectedAt": "<real ISO timestamp, see TIMESTAMPS rule below>",',
        '  "currentStep": "specify",',
        '  "status": "specifying",',
        '  "history": [',
        '    {',
        '      "step": "specify",',
        '      "substep": null,',
        '      "from": { "step": null, "substep": null },',
        '      "by": "extension",',
        '      "at": "<real ISO timestamp>"',
        '    }',
        '  ]',
        '}',
        '```',
        '',
        'Notes on the initial write:',
        '- Do NOT write `stepHistory` or `transitions` — both are deprecated. The viewer derives per-step timing in-memory from `history[]`.',
        '- The seed history entry is attributed to `"extension"` because this lifecycle was initiated by the SpecKit Companion extension dispatching the command, even though you are the one transcribing.',
        '- Only update the `.spec-context.json` for the spec being created. Do NOT touch other spec dirs.',
        '',
        renderLifecycleBody(target),
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
 * Build the preamble for the spec editor's "Create" dispatch. The spec dir
 * does not yet exist, so the preamble includes both the initial-creation
 * fields and the lifecycle "throughout this run, for EACH step…" body —
 * the latter survives in CLI chat history when the user keeps typing
 * follow-up commands in the same terminal session.
 *
 * Returns just the preamble (no command wrapper) because the spec editor
 * appends it to a temp markdown file separately from the dispatched command.
 */
export function buildSpecifyCreationPreamble(
    workflowName: string,
    specDir?: string | null
): string {
    if (!isContextInstructionsEnabled()) return '';
    return renderSpecifyCreationLifecyclePreamble(workflowName, specDir ?? null);
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
