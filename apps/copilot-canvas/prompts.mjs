import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const STEP_COMMANDS = ['plan', 'tasks', 'implement'];
export const SPEC_COMMANDS = [...STEP_COMMANDS, 'status', 'resume', 'doctor', 'mark-complete'];
const COMPANION_ONLY = new Set(['status', 'resume', 'doctor', 'mark-complete']);

// Where `specify extension add` leaves the Companion commands, one entry per agent family.
const COMPANION_MARKERS = [
    '.specify/extensions/companion',
    '.github/agents/speckit.companion.plan.agent.md',
    '.agents/skills/speckit-companion-plan',
    '.claude/skills/speckit-companion-plan',
];

/** `companion` when the Companion commands are installed in the workspace, else stock `speckit`. */
export function detectCommandSet(root) {
    return COMPANION_MARKERS.some(marker => existsSync(join(root, marker))) ? 'companion' : 'speckit';
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
 * plus a pointer to the command's instructions so an agent without the slash command can still run it.
 */
export function buildPrompt(command, specId, commandSet = 'companion', instructions = null) {
    if (!availableCommands(commandSet).includes(command)) {
        throw new Error(`Unknown command for the ${commandSet} command set: ${command}`);
    }
    const prefix = commandSet === 'companion' ? 'speckit.companion' : 'speckit';
    const line = `/${prefix}.${command} ${specId}`;
    if (!instructions) return line;
    return `${line}\n\nIf /${prefix}.${command} is not a command here, read \`${instructions}\` and follow it for the spec in \`${specId}\`.`;
}

/** A new spec starts from a description, not a folder: specify mints the folder itself. */
export function buildSpecifyPrompt(description, commandSet = 'companion', instructions = null) {
    const text = String(description ?? '').replace(/\s+/g, ' ').trim();
    if (!text) throw new Error('Describe the feature to specify.');
    const prefix = commandSet === 'companion' ? 'speckit.companion' : 'speckit';
    const line = `/${prefix}.specify ${text}`;
    if (!instructions) return line;
    return `${line}\n\nIf /${prefix}.specify is not a command here, read \`${instructions}\` and follow it with that feature description.`;
}

/** A read-only question about one spec, for the "Ask Copilot" button. */
export function buildAskPrompt(spec) {
    return [
        `Look at the spec in \`${spec.id}\` (titled ${JSON.stringify(spec.title)}).`,
        `Its run record says status "${spec.statusLabel}", current step "${spec.currentStep ?? 'none'}".`,
        'Tell me in a few lines where it stands, what is left, and the single next step. Read only: do not change any files.',
    ].join(' ');
}
