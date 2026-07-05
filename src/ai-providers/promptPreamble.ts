import { CANONICAL_SUBSTEPS } from '../core/types/specContext';

export type PromptStep = keyof typeof CANONICAL_SUBSTEPS;

export const MARKER_OPEN = '<!-- speckit-companion:context-update -->';
export const MARKER_CLOSE = '<!-- /speckit-companion:context-update -->';

export function isKnownStep(step: string | null | undefined): step is PromptStep {
    return !!step && Object.prototype.hasOwnProperty.call(CANONICAL_SUBSTEPS, step);
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

/** The feature dir from a `<dir>/.spec-context.json` target path. */
function featureDirFromTarget(target: string): string {
    return target.replace(/\/?\.spec-context\.json$/, '');
}

/**
 * Fallback writer location when the caller can't resolve the extension's own
 * install path — the copy the companion spec-kit extension installs into the
 * workspace. The builder normally passes the bundled path instead.
 */
export const WORKSPACE_WRITER_PATH = '.specify/extensions/companion/scripts/write-context.py';

// Always quoted: extension install paths (and workspace spec dirs) can contain spaces.
function writerInvocation(writerPath: string, featureDir: string): string {
    const dir = featureDir && featureDir !== '<specDir>' ? ` --feature-dir "${featureDir}"` : '';
    return `python3 "${writerPath}"${dir}`;
}

/**
 * The finish-only per-task journaling command the AI runs as it finishes each
 * implement task — a script call (reliable, ms precision) instead of hand-authored
 * JSON. Passes `--feature-dir` when known; otherwise the script self-resolves.
 */
function perTaskFinishCmd(featureDir: string, writerPath: string): string {
    return `${writerInvocation(writerPath, featureDir)} --task <TaskID> --kind complete --by ai`;
}

/**
 * The stock-path self-close command: `--advance` (finish + forward-only status
 * flip in one call) for an advancing step, `--finish` (timing-only) for a step
 * with no canonical advance (clarify/analyze). `ADVANCING_STEPS` is meant to mirror
 * write-context.py's `STEP_COMPLETED_STATUS` — keep the two in sync if that map changes.
 */
function selfCloseCmd(step: PromptStep, featureDir: string, writerPath: string): string {
    const verb = ADVANCING_STEPS.has(step) ? '--advance' : '--finish';
    return `${writerInvocation(writerPath, featureDir)} --step ${step} ${verb} --by ai`;
}

/**
 * The per-step reasoning-capture block for stock mode — the same writer flags the
 * companion command bodies teach, so the Activity panel (intent, out-of-scope,
 * context, decisions, checks, coverage) fills on stock runs too. Empty for steps
 * with nothing step-specific to capture (clarify).
 */
function captureBlock(step: PromptStep, featureDir: string, writerPath: string): string[] {
    const base = writerInvocation(writerPath, featureDir);
    const lines: Record<PromptStep, string[]> = {
        specify: [
            `- As you draft each requirement: \`${base} --coverage-req FR-NNN --title "<the requirement's one-line text>"\` (one call per requirement).`,
            `- Before closing: \`${base} --set intent="<one-line goal>"\`, one \`--expectation "<out-of-scope item>"\` per explicit non-goal (never invent them), and one \`--context "<area or constraint worked from>"\` per entry.`,
        ],
        clarify: [],
        plan: [
            `- \`${base} --set approach="<2-3 sentence how-summary>"\`.`,
            `- One \`${base} --decision '{"decision": "…", "why": "…", "rejected": "…"}'\` per genuine design choice — skip trivia.`,
            `- \`${base} --step plan --step-summary '{"summary": "<one-line rollup>"}'\`.`,
        ],
        tasks: [
            `- \`${base} --coverage-req FR-NNN --tasks "T001,T004"\` per requirement (which tasks cover it).`,
            `- \`${base} --step tasks --step-summary '{"summary": "<task count + shape>"}'\`.`,
        ],
        analyze: [
            `- One \`${base} --concern '{"note": "<finding>", "step": "analyze"}'\` per genuine issue found — none on a clean pass.`,
        ],
        implement: [
            `- One \`${base} --verified '{"what": "<check>", "command": "<cmd>", "result": "<outcome>"}'\` per real check (tests, build, manual pass).`,
            `- \`${base} --coverage-req FR-NNN --tests "<test file or evidence>"\` per requirement a check covers.`,
            `- \`${base} --step implement --step-summary '{"summary": "<what shipped in one line>"}'\`.`,
        ],
    };
    const body = lines[step];
    if (body.length === 0) return [];
    return [
        'CAPTURE THE REASONING (best-effort: if python3 is unavailable, skip silently — never block the step; the writer de-dupes, so re-runs are safe):',
        ...body,
    ];
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

// Steps whose self-close advances status via `--advance`; mirrors `STEP_COMPLETED_STATUS` in write-context.py (clarify/analyze absent → finish-only).
const ADVANCING_STEPS: ReadonlySet<PromptStep> = new Set([
    'specify', 'plan', 'tasks',
]);

// Which steps the AI self-closes by hand. `clarify/plan/tasks/analyze` always do.
// `specify` is conditional (see `aiSelfClosesStep`): the companion specify command
// records its own `--kind complete`, so when companion is installed the AI defers
// — but in STOCK mode the upstream `/speckit.specify` makes no such call, so the
// AI MUST close specify itself or it sticks at `specifying` forever (#332).
// `implement` always defers: the always-on `tasks.md` watcher closes it, and an
// early `ai` complete would trip the hook's no-backward-clobber guard.
const AI_SELF_CLOSE_STEPS: ReadonlySet<PromptStep> = new Set([
    'clarify', 'plan', 'tasks', 'analyze',
]);

/**
 * True when the AI must write `<step>`'s completion itself. The four steps above
 * always do; `specify` joins them only when companion is NOT installed (no
 * companion command to record it). `implement` never does — its watcher closes it.
 */
function aiSelfClosesStep(step: PromptStep, companionInstalled: boolean): boolean {
    if (AI_SELF_CLOSE_STEPS.has(step)) return true;
    return step === 'specify' && !companionInstalled;
}

function renderClosingInstruction(
    step: PromptStep, completedStatus: string, donePhrase: string, specDir: string,
    companionInstalled: boolean, writerPath: string
): string[] {
    if (aiSelfClosesStep(step, companionInstalled)) {
        const advances = ADVANCING_STEPS.has(step);
        const effect = advances
            ? `appends the step's "complete" entry AND flips status to "${completedStatus}" in one atomic, forward-only write`
            : `appends the step's "complete" entry (no status change — ${step} has no canonical advance)`;
        return [
            '╔══════════════════════════════════════════════════════════════════╗',
            '║  MANDATORY FINAL WRITE — DO THIS BEFORE YOUR TURN ENDS          ║',
            '╚══════════════════════════════════════════════════════════════════╝',
            `Run this script to close ${step} — it ${effect}:`,
            `    ${selfCloseCmd(step, specDir, writerPath)}`,
            'Never hand-author the JSON or hand-flip the status — the script stamps the real clock and writes atomically.',
            `Then print "${donePhrase}" as the final terminal line.`,
            '',
            'Skipping the script leaves the badge stuck on the in-progress form and the step timer running; skipping the final line hides the completion from the activity log.',
        ];
    }
    // specify + implement: the extension/hook closes the STEP deterministically.
    const recorder = step === 'implement'
        ? 'the end-of-step hook closes the implement step (and backfills any task you miss)'
        : 'the specify command records its own completion';
    return [
        `DONE: do NOT flip the status yourself and do NOT append a step-level "complete" entry for ${step} — ${recorder} with a real script timestamp; a hand-written "ai" complete would duplicate it.`,
        ...(step === 'implement'
            ? [`Per-task timing is finish-only via a script: as you finish each task, mark it \`- [x] **<TaskID>**\` in tasks.md, append task_summaries.<TaskID>, then run \`${perTaskFinishCmd(specDir, writerPath)}\` — that stamps ONE finish event from the real clock (no per-task start, no hand-authored JSON). Run it the moment each task completes, not in one end-of-step batch: clustering every finish into a tiny window FAILS the cadence check. The hook backfills any task you don't journal.`]
            : []),
        `Print "${donePhrase}" as the final terminal line.`,
    ];
}

const NEXT_STEP_GUARD = (step: PromptStep) =>
    `Leave currentStep on "${step}". This command is single-step — the user clicks the next-phase button (or the extension dispatches a fresh /speckit.<next> command) to advance; that path appends the next start-entry. Writing a start-entry for the next step here is a lie that makes the viewer render a phantom "Generating <next>…" indefinitely.`;

/**
 * Slim preamble for a `/speckit.companion.*` dispatch: the command body carries
 * the full protocol, so emit only the dynamic dispatch context it can't
 * self-source — the dispatch timestamp (seed start), feature dir, next-step guard.
 */
function renderSlimCompanionPreamble(step: PromptStep, target: string, dispatchUtc: string): string {
    return [
        MARKER_OPEN,
        `This command's body carries the full \`.spec-context.json\` capture & timing protocol — schema, status lifecycle, self-close, and per-task journaling. Follow it. This preamble adds only the dispatch context the body can't know:`,
        '',
        `1. Pre-step seed: in ${target}, set currentStep = "${step}" and the matching in-progress status, and append { step: "${step}", substep: null, kind: "start", by: "extension", at: "${dispatchUtc}" } — use this DISPATCH TIME for the start entry (the extension sent it; do NOT run \`date -u\` for this one).`,
        '',
        NEXT_STEP_GUARD(step),
        MARKER_CLOSE,
    ].join('\n');
}

export function renderPreamble(step: PromptStep, specDir: string, dispatchUtc: string, companionInstalled = false, writerPath: string = WORKSPACE_WRITER_PATH): string {
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    if (companionInstalled) {
        return renderSlimCompanionPreamble(step, target, dispatchUtc);
    }
    const substepsList = CANONICAL_SUBSTEPS[step];
    const substepsLine = substepsList.length === 0
        ? `Canonical substeps for ${step}: none — single-pass step.`
        : `Canonical substeps for ${step}: ${substepsList.join(', ')}. For each substep boundary append a SINGLE finish entry { step, substep: "<name>", kind: "complete", by: "ai", at } the moment it ends (fresh \`date -u\`) — one per substep, never two sharing a timestamp, never a separate start. The delta between finishes is each substep's duration.`;
    const completedStatus = COMPLETED_STATUS_BY_STEP[step];
    const donePhrase = DONE_PHRASE_BY_STEP[step];
    const capture = captureBlock(step, specDir, writerPath);
    return [
        MARKER_OPEN,
        `Before and after this step runs, update ${target}. Schema:`,
        '',
        SPEC_CONTEXT_SCHEMA,
        '',
        STATUS_LIFECYCLE,
        '',
        `1. Pre-step: set currentStep = "${step}" and the matching in-progress status. Append a history entry { step: "${step}", substep: null, kind: "start", by: "extension", at: "${dispatchUtc}" }. Use the DISPATCH TIME for this start entry — it was sent by the extension.`,
        `1.5. When advancing from a previous step: flip the previous step's status to its completed form before writing the new step.`,
        '',
        substepsLine,
        '',
        ...(capture.length > 0 ? [...capture, ''] : []),
        ...renderClosingInstruction(step, completedStatus, donePhrase, specDir, companionInstalled, writerPath),
        '',
        NEXT_STEP_GUARD(step),
        '',
        renderSharedRules(dispatchUtc),
        '',
        'Invariants: preserve unknown fields; history is append-only.',
        MARKER_CLOSE,
    ].join('\n');
}

/**
 * Slim lifecycle body for a companion run: each `/speckit.companion.*` command
 * carries the full protocol (incl. self-close) in its own body, so this adds only
 * the cross-step rules the body can't own.
 */
function renderSlimLifecycleBody(_featureDir: string): string {
    return [
        `Each /speckit.companion.* command in this run carries the full \`.spec-context.json\` capture & timing protocol in its body — schema, status lifecycle, self-close, per-task journaling. Follow each command's body for how to close each step (the companion bodies record a finish-only complete and let the lifecycle hooks flip status). This preamble adds only the cross-step rules:`,
        '',
        '- Never write a start-entry for the next step when you finish one — that produces a phantom "Generating <next>…". Only the next command seeds its own start.',
        'Invariants: preserve unknown fields; history is append-only.',
    ].join('\n');
}

export function renderLifecycleBody(target: string, dispatchUtc: string, companionInstalled = false, writerPath: string = WORKSPACE_WRITER_PATH): string {
    const featureDir = featureDirFromTarget(target);
    // The companion command bodies carry the full protocol, so a companion run
    // only needs the slim cross-step rules. Stock has no such body → full body.
    if (companionInstalled) {
        return renderSlimLifecycleBody(featureDir);
    }
    const writerBase = writerInvocation(writerPath, featureDir);
    // Stock: specify has no companion command to record it, so it self-closes too.
    const selfCloseLine = `2. When you FINISH a **specify, plan, tasks, clarify, or analyze** step, close it with the context writer (it ships with the SpecKit Companion editor extension — the quoted path below always exists) — run \`${writerBase} --step <step> --advance --by ai\` for **specify/plan/tasks** (it appends the complete AND flips status forward-only in one atomic write), or the same command with \`--finish\` in place of \`--advance\` for **clarify/analyze** (which have no canonical advance). Never hand-author the JSON or hand-flip the status. The stock pipeline has no command that records specify's completion, so closing specify is YOUR job — skip it and the spec sticks on \`specifying\` with the next-step button hidden. Do NOT self-close **implement**: the end-of-step watcher closes it when every task is checked.`;
    const captureLines = [
        'CAPTURE THE REASONING as each step produces it (best-effort: if python3 is unavailable, skip silently — never block a step; the writer de-dupes, so re-runs are safe):',
        `- specify: \`${writerBase} --coverage-req FR-NNN --title "<one-line requirement text>"\` per requirement as you draft it; then \`--set intent="<one-line goal>"\`, one \`--expectation "<out-of-scope item>"\` per explicit non-goal, one \`--context "<area or constraint worked from>"\` per entry.`,
        `- plan: \`${writerBase} --set approach="<2-3 sentence how>"\`; one \`--decision '{"decision": "…", "why": "…", "rejected": "…"}'\` per genuine choice; \`--step plan --step-summary '{"summary": "<one line>"}'\`.`,
        `- tasks: \`${writerBase} --coverage-req FR-NNN --tasks "T001,T004"\` per requirement; \`--step tasks --step-summary '{"summary": "<count + shape>"}'\`.`,
        `- implement: one \`${writerBase} --verified '{"what": "…", "command": "…", "result": "…"}'\` per real check; \`--coverage-req FR-NNN --tests "<evidence>"\` per covered requirement; \`--step implement --step-summary '{"summary": "<what shipped>"}'\`.`,
    ];
    return [
        `Throughout this run, keep ${target} up to date as you move through steps. Schema:`,
        '',
        SPEC_CONTEXT_SCHEMA,
        '',
        STATUS_LIFECYCLE,
        '',
        'For EACH step you work on (specify, clarify, plan, tasks, analyze, implement):',
        '1. When you START a step on your own initiative (mid-run, not the initial seed): set currentStep = "<step>" and status = in-progress form. Append a history entry { step: "<step>", substep: null, kind: "start", by: "ai", at: <real timestamp from `date -u`> }.',
        selfCloseLine,
        '3. For each substep boundary append a SINGLE finish entry { step, substep: "<name>", kind: "complete", by: "ai", at: <date -u> } the moment it ends — one per substep, never two sharing a timestamp, never a separate start.',
        '',
        ...captureLines,
        '',
        `Implement (finish-only per task): as you finish each task, mark it \`- [x] **<TaskID>**\` in tasks.md, append task_summaries.<TaskID>, then run \`${perTaskFinishCmd(featureDir, writerPath)}\` — ONE finish event from the real clock, no per-task start, no hand-authored JSON. Run it the moment each task completes, not in one end-of-step batch: clustering every finish into a tiny window FAILS the cadence check. The end-of-step hook backfills any task you miss and closes the step.`,
        '',
        'Do NOT preemptively write a start-entry for the next step at completion time. The start-entry must coincide with you actually beginning that step (item 1 above), not with you finishing the previous one. Writing a { step: "<next>", kind: "start" } entry as part of the completion write produces a phantom "Generating <next>…" state in the viewer when in fact no one is generating anything.',
        '',
        'If this run is single-step (you finish after one /speckit.<step> command), stop after item 2 and leave currentStep on "<step>". The user clicks the next-phase button (or a fresh /speckit.<next> command runs) to actually advance — that path appends the next start-entry.',
        '',
        renderSharedRules(dispatchUtc),
        '',
        'Invariants: preserve unknown fields; history is append-only.',
    ].join('\n');
}

export function renderLifecyclePreamble(specDir: string, dispatchUtc: string, companionInstalled = false, writerPath: string = WORKSPACE_WRITER_PATH): string {
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
    return [
        MARKER_OPEN,
        renderLifecycleBody(target, dispatchUtc, companionInstalled, writerPath),
        MARKER_CLOSE,
    ].join('\n');
}

export function renderSpecifyCreationLifecyclePreamble(
    workflowName: string,
    specDir: string | null,
    dispatchUtc: string,
    companionInstalled = false,
    writerPath: string = WORKSPACE_WRITER_PATH
): string {
    const target = specDir ? `${specDir}/.spec-context.json` : '<specDir>/.spec-context.json';
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
        renderLifecycleBody(target, dispatchUtc, companionInstalled, writerPath),
        MARKER_CLOSE,
    ].join('\n');
}
