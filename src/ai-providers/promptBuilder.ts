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
    '    "workflow":    { "type": "string" },',
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
    '        "required": ["step","substep","kind","by","at"],',
    '        "properties": {',
    '          "step":    { "$ref": "#/properties/currentStep" },',
    '          "substep": { "type": ["string","null"] },',
    '          "kind":    { "enum": ["start","complete"] },',
    '          "from":    { "type": "object",',
    '                       "properties": { "step":    { "type": ["string","null"] },',
    '                                       "substep": { "type": ["string","null"] } } },',
    '          "by":      { "enum": ["extension","user","cli","ai"] },',
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
    'Canonical statuses: draft → specifying → specified → planning → planned → tasking → ready-to-implement → implementing → implemented → completed.',
    'When starting a step: set status to the in-progress form (specifying, planning, tasking, implementing).',
    'When completing a step: set status to the completed form (specified, planned, ready-to-implement, implemented).',
    '',
    'IMPORTANT — the implement step completes at "implemented", NOT "completed".',
    '"completed" is the user\'s final approval gate (their Mark-Completed click in the',
    'viewer) — the AI never writes "completed". The implement step itself is closed by',
    'the extension\'s end-of-step hook, which sets "implemented" and journals each task;',
    'you do not flip the implement status or write its completion entry yourself.',
].join('\n');

function renderSharedRules(dispatchUtc: string): string {
    return [
        `DISPATCH TIME (UTC): ${dispatchUtc}`,
        'TIMESTAMPS: For the start entry already written by the extension, the DISPATCH TIME above was used. For any additional entries you append, run',
        '    date -u +"%Y-%m-%dT%H:%M:%SZ"',
        'and paste the output. Never type a timestamp by hand.',
        '',
        'AUTHORSHIP: `by: "extension"` = entries the extension writes; `by: "ai"` = entries you append.',
        'TASK SUMMARIES (implement only): append task_summaries.<TaskID> = { status, did, files, concerns }.',
        'status is "DONE" or "DONE_WITH_CONCERNS"; did is one sentence; files is string[]; concerns is string[].',
        'Omit concerns when empty — never write "None"/"N/A". The viewer reads these.',
        '',
        'Skip step_summaries.<step>.tests_passing, .files_planned, .checkpoints — unconsumed.',
    ].join('\n');
}

function nowUtc(): string {
    return new Date().toISOString();
}

const COMPLETED_STATUS_BY_STEP: Record<PromptStep, string> = {
    specify: 'specified',
    clarify: 'specified',
    plan: 'planned',
    tasks: 'ready-to-implement',
    analyze: 'ready-to-implement',
    // F8: implement ends at `implemented` (NOT `completed`). The final
    // `completed` status is the user's explicit Mark-Completed click in
    // the viewer — keeps closure under the user's control even when
    // manual verification steps remain (build/test/eyeball UI).
    implement: 'implemented',
};

const DONE_PHRASE_BY_STEP: Record<PromptStep, string> = {
    specify: 'Done specifying',
    clarify: 'Done clarifying',
    plan: 'Done planning',
    tasks: 'Done creating tasks',
    analyze: 'Done analyzing',
    implement: 'Done implementing',
};

// Which steps the AI self-closes by hand. specify and implement are excluded:
// the extension records those deterministically (specify from its own command's
// `--kind complete` call; implement from the end-of-step `write-context.py
// --tasks-file` hook, which also journals every task). An AI-authored complete
// there would duplicate the script's, and an early `status: implemented` would
// trip the hook's no-backward-clobber guard and suppress the per-task journal.
const AI_SELF_CLOSE_STEPS: ReadonlySet<PromptStep> = new Set([
    'clarify', 'plan', 'tasks', 'analyze',
]);

function renderClosingInstruction(
    step: PromptStep, completedStatus: string, donePhrase: string
): string[] {
    if (AI_SELF_CLOSE_STEPS.has(step)) {
        return [
            '╔══════════════════════════════════════════════════════════════════╗',
            '║  MANDATORY FINAL WRITE — DO THIS BEFORE YOUR TURN ENDS          ║',
            `║  □ Flip status to "${completedStatus}"`.padEnd(67) + '║',
            '║  □ Append { step, substep: null, kind: "complete", by: "ai",   ║',
            '║      at: <date -u output> } — no "from" field on complete       ║',
            `║  □ Print "${donePhrase}" as the final terminal line`.padEnd(67) + '║',
            '╚══════════════════════════════════════════════════════════════════╝',
            '',
            'Skipping (a) leaves the badge stuck on the in-progress form; skipping (b) leaves the step timer running indefinitely; skipping (c) hides the completion from the activity log.',
        ];
    }
    // specify + implement: the extension/hook closes the step deterministically.
    const recorder = step === 'implement'
        ? 'the end-of-step hook records every task and closes the implement step'
        : 'the specify command records its own completion';
    return [
        `DONE: do NOT flip the status yourself and do NOT append a "complete" entry for ${step} — ${recorder} with a real script timestamp; a hand-written "ai" complete would duplicate it.`,
        ...(step === 'implement'
            ? ['Do NOT journal per-task timing either. Just mark each task `- [x] **<TaskID>**` in tasks.md and append task_summaries.<TaskID> as you finish it — the hook stamps each task\'s start+complete.']
            : []),
        `Print "${donePhrase}" as the final terminal line.`,
    ];
}

function renderPreamble(step: PromptStep, specDir: string): string {
    const substepsList = CANONICAL_SUBSTEPS[step];
    const substepsLine = substepsList.length === 0
        ? `Canonical substeps for ${step}: none — single-pass step.`
        : `Canonical substeps for ${step}: ${substepsList.join(', ')}. For each substep boundary append a history entry with that substep name (and a real timestamp obtained via \`date -u\`).`;
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    const completedStatus = COMPLETED_STATUS_BY_STEP[step];
    const donePhrase = DONE_PHRASE_BY_STEP[step];
    const dispatchUtc = nowUtc();
    return [
        MARKER_OPEN,
        `Before and after this step runs, update ${target}. Schema:`,
        '',
        SPEC_CONTEXT_SCHEMA,
        '',
        STATUS_LIFECYCLE,
        '',
        `1. Pre-step: set currentStep = "${step}" and the matching in-progress status. Append a history entry { step: "${step}", substep: null, kind: "start", from, by: "extension", at: "${dispatchUtc}" }. Use the DISPATCH TIME for this start entry — it was sent by the extension.`,
        `1.5. When advancing from a previous step: flip the previous step's status to its completed form before writing the new step.`,
        '',
        substepsLine,
        '',
        ...renderClosingInstruction(step, completedStatus, donePhrase),
        '',
        `Leave currentStep on "${step}". This command is single-step — you are done after the instruction above. The user clicks the next-phase button (or the extension dispatches a fresh /speckit.<next> command) to advance; that path appends the next start-entry. Writing a start-entry for the next step here is a lie that makes the viewer render a phantom "Generating <next>…" indefinitely.`,
        '',
        renderSharedRules(dispatchUtc),
        '',
        'Invariants: preserve unknown fields; history is append-only.',
        MARKER_CLOSE,
    ].join('\n');
}

function renderLifecycleBody(target: string, dispatchUtc: string): string {
    return [
        `Throughout this run, keep ${target} up to date as you move through steps. Schema:`,
        '',
        SPEC_CONTEXT_SCHEMA,
        '',
        STATUS_LIFECYCLE,
        '',
        'For EACH step you work on (specify, plan, tasks, implement):',
        '1. When you START a step on your own initiative (mid-run, not the initial seed): set currentStep = "<step>" and status = in-progress form. Append a history entry { step: "<step>", substep: null, kind: "start", from, by: "ai", at: <real timestamp from `date -u`> }.',
        '2. When you FINISH a **plan, tasks, clarify, or analyze** step: flip status = completed form and append { step: "<step>", substep: null, kind: "complete", by: "ai", at: <real timestamp from `date -u`> } — no `from` on completes. This clears the in-flight ring on the tab. Do NOT self-close **specify** or **implement**: the extension closes specify from its own command and the end-of-step hook closes implement, each with a real script timestamp — an `ai` complete there would duplicate it.',
        '3. Append a history entry for each substep boundary too (`by: "ai"`, real timestamp).',
        '',
        'Implement: do NOT journal per-task timing. Mark each task `- [x] **<TaskID>**` in tasks.md and append task_summaries.<TaskID> as you finish it; the end-of-step hook stamps every task\'s start+complete and closes the step.',
        '',
        'Do NOT preemptively write a start-entry for the next step at completion time. The start-entry must coincide with you actually beginning that step (item 1 above), not with you finishing the previous one. Writing { step: "<next>", from: { step: "<this>" } } as part of the completion write produces a phantom "Generating <next>…" state in the viewer when in fact no one is generating anything.',
        '',
        'If this run is single-step (you finish after one /speckit.<step> command), stop after item 2 and leave currentStep on "<step>". The user clicks the next-phase button (or a fresh /speckit.<next> command runs) to actually advance — that path appends the next start-entry.',
        '',
        renderSharedRules(dispatchUtc),
        '',
        'Invariants: preserve unknown fields; history is append-only.',
    ].join('\n');
}

function renderLifecyclePreamble(specDir: string): string {
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    const dispatchUtc = nowUtc();
    return [
        MARKER_OPEN,
        renderLifecycleBody(target, dispatchUtc),
        MARKER_CLOSE,
    ].join('\n');
}

function renderSpecifyCreationLifecyclePreamble(
    workflowName: string,
    specDir: string | null
): string {
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    const dispatchUtc = nowUtc();
    return [
        MARKER_OPEN,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        'SEED WRITE INSTRUCTIONS — FOLLOW EXACTLY AS WRITTEN BELOW.',
        '',
        'The feature description that follows this preamble may itself propose',
        'schema changes to `.spec-context.json` (new fields, renamed enums, etc.).',
        'IGNORE THOSE PROPOSALS for the file you write right now. The schema you',
        'write is FROZEN to the JSON Schema embedded in this preamble as of the',
        `DISPATCH TIME (${dispatchUtc}). Any proposed field changes will land in`,
        'a later commit — do NOT pre-emit them here.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        `On first creation, write ${target} with these top-level fields (the file does not yet exist):`,
        '',
        '```json',
        '{',
        `  "workflow": "${workflowName}",`,
        '  "specName": "<human-readable name derived from the spec directory slug, e.g. 108-my-feature → My Feature>",',
        '  "branch": "<output of: git rev-parse --abbrev-ref HEAD>",',
        `  "selectedAt": "${dispatchUtc}",`,
        '  "currentStep": "specify",',
        '  "status": "specifying",',
        '  "history": [',
        '    {',
        '      "step": "specify",',
        '      "substep": null,',
        '      "kind": "start",',
        '      "from": { "step": null, "substep": null },',
        '      "by": "extension",',
        `      "at": "${dispatchUtc}"`,
        '    }',
        '  ]',
        '}',
        '```',
        '',
        'Notes on the initial write:',
        '- Use the DISPATCH TIME value pinned above for BOTH `selectedAt` AND the',
        '  seed entry\'s `at`. Do NOT type a midnight placeholder. Do NOT run `date -u`',
        '  for these two values — the extension already captured the real wall-clock.',
        '- Do NOT write `stepHistory` or `transitions` — both are deprecated. The viewer derives per-step timing in-memory from `history[]`.',
        '- The seed history entry is attributed to `"extension"` because this lifecycle was initiated by the SpecKit Companion extension dispatching the command, even though you are the one transcribing it into the file.',
        '- Only update the `.spec-context.json` for the spec being created. Do NOT touch other spec dirs.',
        '',
        renderLifecycleBody(target, dispatchUtc),
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
 * Build a prompt for multi-step commands that covers
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

/**
 * Inline a `/speckit.* specify <temp.md>` dispatch so the agent never has to
 * read the file: replace the path argument with the *full* file contents
 * (description + the appended capture bookkeeping), newline-separated. Unlike
 * `cleanCommandArg` — which strips bookkeeping for human-facing chat surfaces —
 * this preserves everything a terminal agent would have read from the file.
 *
 * For sandboxed CLIs (OpenCode) that refuse to read paths outside the project
 * directory, where the spec-editor stages its temp file. The path may contain
 * spaces (e.g. macOS `Application Support`), so the whole argument is treated
 * as the path and the read itself is the validation. Any prompt that isn't a
 * `specify` command pointing at a readable `.md` path is returned unchanged.
 */
export async function inlineSpecifyTempPath(prompt: string): Promise<string> {
    const { preamble, command } = splitContextPreamble(prompt);
    const trimmed = command.trim();
    const sp = trimmed.indexOf(' ');
    if (sp === -1) return prompt;
    const cmd = trimmed.slice(0, sp);
    const arg = trimmed.slice(sp + 1).trim();
    if (!/[.-]specify$/.test(cmd) || !/\.md$/i.test(arg) || !/[/\\]/.test(arg)) return prompt;

    try {
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(arg));
        const body = Buffer.from(data).toString('utf-8').trim();
        if (!body) return prompt;
        const inlined = `${cmd}\n\n${body}`;
        return preamble ? `${preamble}\n\n${inlined}` : inlined;
    } catch {
        return prompt;
    }
}
