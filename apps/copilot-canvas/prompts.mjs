import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SPEC_DIRS } from './spec-rules.mjs';
import { isKnownStep, renderPreamble, renderSpecifyCreationLifecyclePreamble } from './vendor/preamble.mjs';

export const STEP_COMMANDS = ['plan', 'tasks', 'implement'];
export const SPEC_COMMANDS = [...STEP_COMMANDS, 'status', 'resume', 'doctor', 'mark-complete'];
const COMPANION_ONLY = new Set(['status', 'resume', 'doctor', 'mark-complete']);

/** Companion is installed when its extension folder is: the same check VS Code makes (`isCompanionInstalled`). */
export function isCompanionInstalled(root) {
    return existsSync(join(root, '.specify', 'extensions', 'companion'));
}

/** `companion` when the Companion commands are installed in the workspace, else stock `speckit`. */
export function detectCommandSet(root) {
    return isCompanionInstalled(root) ? 'companion' : 'speckit';
}

/** A stock-workflow spec keeps the stock commands even when Companion is installed; every other spec follows the workspace. */
export function commandSetFor(root, workflow) {
    return workflow === 'speckit' ? 'speckit' : detectCommandSet(root);
}

const WORKSPACE_WRITER = '.specify/extensions/companion/scripts/write-context.py';
const CHECKOUT_WRITER = fileURLToPath(new URL('../speckit-extension/scripts/write-context.py', import.meta.url));

/** The context writer a stock run's preamble tells the agent to call: the workspace's copy, else this checkout's. */
export function writerPath(root) {
    if (existsSync(join(root, WORKSPACE_WRITER))) return WORKSPACE_WRITER;
    return existsSync(CHECKOUT_WRITER) ? CHECKOUT_WRITER : WORKSPACE_WRITER;
}

/** The model reads only title, status and url from a canvas's `open` result, so the instruction to stop rides in `status`. */
export const OPEN_NOTE = 'The board is open: wait for the user\'s next instruction and do not start any work.';

/** The rule appended to the session's system message: the strongest place to say what opening the board means. */
export const SYSTEM_RULE = 'If the user only asks to open the SpecKit Companion canvas, open it and stop: do not read, test or implement any spec until they ask. A message that starts with a /speckit command is a request to run that command, so run it.';

/** What the catalog shows the model for the canvas, in the same words as the rule. */
export const CANVAS_DESCRIPTION = 'A live board of every spec: its specify → plan → tasks → implement pipeline, task progress and run history, with a button that runs the next step. When the user only asks to open it, show it and stop: do not read, test or implement any spec until they ask.';

export function openStatus(active, total) {
    return `${active} active · ${total} specs. ${OPEN_NOTE}`;
}

/** Which commands the board can offer for this workspace's command set. */
export function availableCommands(commandSet) {
    return SPEC_COMMANDS.filter(command => commandSet === 'companion' || !COMPANION_ONLY.has(command));
}

/** Where the command's body lives on disk, for hosts that don't resolve the slash command themselves. */
export function commandInstructions(root, command, commandSet = 'companion') {
    const dotted = commandSet === 'companion' ? `speckit.companion.${command}` : `speckit.${command}`;
    const dashed = dotted.replace(/\./g, '-');
    const candidates = [
        `.github/agents/${dotted}.agent.md`,
        `.github/prompts/${dotted}.prompt.md`,
        `.github/skills/${dashed}/SKILL.md`,
        `.agents/skills/${dashed}/SKILL.md`,
        `.claude/skills/${dashed}/SKILL.md`,
        commandSet === 'companion' ? `.specify/extensions/companion/commands/${dotted}.md` : `.specify/templates/commands/${command}.md`,
    ];
    return candidates.find(candidate => existsSync(join(root, candidate))) ?? null;
}

/**
 * The chat message a run button sends: the same `/speckit.companion.<cmd> <spec dir>` line the VS Code sidebar dispatches,
 * a pointer to the command's instructions so an agent without the slash command can still run it, and the step preamble
 * VS Code appends so the run records itself.
 */
export function buildPrompt(command, specId, commandSet = 'companion', instructions = null, preamble = null) {
    if (!availableCommands(commandSet).includes(command)) {
        throw new Error(`Unknown command for the ${commandSet} command set: ${command}`);
    }
    const prefix = commandSet === 'companion' ? 'speckit.companion' : 'speckit';
    let text = `/${prefix}.${command} ${specId}`;
    if (instructions) text += `\n\nIf /${prefix}.${command} is not a command here, read \`${instructions}\` and follow it for the spec in \`${specId}\`.`;
    return preamble ? `${text}\n\n${preamble}` : text;
}

/** The step preamble for a run button (plan, tasks, implement), or null for commands VS Code sends none for. */
export function buildStepPreamble(command, specId, root, commandSet, now = new Date()) {
    if (!STEP_COMMANDS.includes(command) || !isKnownStep(command)) return null;
    return renderPreamble(command, specId, now.toISOString(), commandSet === 'companion', writerPath(root));
}

/** What the New spec form offers, mirroring VS Code's create-spec dialog: Companion, Spec Kit, and Auto (Companion only). */
export const SPECIFY_WORKFLOWS = ['companion', 'speckit', 'auto'];

export function specifyChoices(root) {
    const installed = isCompanionInstalled(root);
    const needs = 'Needs the SpecKit Companion extension, which is not installed in this workspace.';
    return {
        installed,
        default: installed ? 'companion' : 'speckit',
        choices: [
            { id: 'companion', label: 'Companion', available: installed, reason: installed ? null : needs },
            { id: 'speckit', label: 'Spec Kit', available: true, reason: null },
            { id: 'auto', label: 'Auto', available: installed, reason: installed ? null : needs },
        ],
    };
}

/** The command a workflow choice sends and the workflow name the run record carries. Throws when the choice cannot run here. */
export function resolveSpecify(workflow, installed) {
    if (!SPECIFY_WORKFLOWS.includes(workflow)) throw new Error(`Unknown workflow: ${String(workflow)}`);
    if (workflow === 'auto' && !installed) throw new Error('Auto needs the companion spec-kit extension, which is not installed.');
    if (workflow === 'companion' && !installed) throw new Error('SpecKit Companion is not installed in this workspace. Choose Spec Kit, or install the companion spec-kit extension.');
    if (workflow === 'speckit') return { command: 'speckit.specify', effective: 'speckit' };
    return { command: workflow === 'auto' ? 'speckit.companion.auto' : 'speckit.companion.specify', effective: 'companion' };
}

function usesTimestampNumbering(root) {
    try {
        return JSON.parse(readFileSync(join(root, '.specify', 'init-options.json'), 'utf8')).branch_numbering === 'timestamp';
    } catch {
        return false;
    }
}

/**
 * The number the next spec folder takes, counted the way Spec Kit's `create-new-feature` script counts: the highest `NNN-` folder
 * plus one, skipping timestamp folders. A `_NN_` fixture folder never matches. Null when the workspace numbers by timestamp.
 */
export function nextSpecNumber(root, specDirs = DEFAULT_SPEC_DIRS) {
    if (usesTimestampNumbering(root)) return null;
    let highest = 0;
    for (const specDir of specDirs) {
        let entries;
        try {
            entries = readdirSync(join(root, specDir), { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || /^\d{8}-\d{6}-/.test(entry.name)) continue;
            const number = Number(entry.name.match(/^(\d{3,})-/)?.[1] ?? 0);
            if (number > highest) highest = number;
        }
    }
    return String(highest + 1).padStart(3, '0');
}

/** The numbering rule New spec carries, so the agent neither reuses a number nor counts on from the `_NN_` fixture folders. */
export function numberingRule(root, specDirs = DEFAULT_SPEC_DIRS) {
    const next = nextSpecNumber(root, specDirs);
    if (!next) return null;
    return `Name the new spec folder \`${next}-<short-name>\`: ${next} is one more than the highest numbered spec folder. Folders that start with \`_\` are fixtures, so do not count them or copy their naming. If a branch script in this run reports a higher feature number, use that number instead.`;
}

/**
 * A new spec starts from a description, not a folder: specify mints the folder itself. The message is what VS Code writes to
 * its temp file, kept inline: the command line with the description, the folder number, then the lifecycle preamble that seeds `.spec-context.json`.
 */
export function buildSpecifyPrompt({ description, workflow, root, specDirs = DEFAULT_SPEC_DIRS, now = new Date() }) {
    const text = String(description ?? '').replace(/\r\n?/g, '\n').trim();
    if (!text) throw new Error('Describe the feature to specify.');
    const installed = isCompanionInstalled(root);
    const { command, effective } = resolveSpecify(workflow, installed);
    const instructions = commandInstructions(root, command.replace(/^speckit\.(companion\.)?/, ''), command.startsWith('speckit.companion') ? 'companion' : 'speckit');
    let message = `/${command} ${text}`;
    if (instructions) message += `\n\nIf /${command} is not a command here, read \`${instructions}\` and follow it with the feature description above.`;
    const numbering = numberingRule(root, specDirs);
    if (numbering) message += `\n\n${numbering}`;
    const preamble = renderSpecifyCreationLifecyclePreamble(effective, null, now.toISOString(), effective === 'companion' && installed, writerPath(root), null);
    return { prompt: `${message}\n\n${preamble}`, command, workflow: effective };
}

/** A read-only question about one spec, for the "Ask Copilot" button. */
export function buildAskPrompt(spec) {
    return [
        `Look at the spec in \`${spec.id}\` (titled ${JSON.stringify(spec.title)}).`,
        `Its run record says status "${spec.statusLabel}", current step "${spec.currentStep ?? 'none'}".`,
        'Tell me in a few lines where it stands, what is left, and the single next step. Read only: do not change any files.',
    ].join(' ');
}
