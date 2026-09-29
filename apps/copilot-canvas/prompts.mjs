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

/** The chat line a run button sends: the same `/speckit.companion.<cmd> <spec dir>` the VS Code sidebar dispatches. */
export function buildPrompt(command, specId, commandSet = 'companion') {
    if (!availableCommands(commandSet).includes(command)) {
        throw new Error(`Unknown command for the ${commandSet} command set: ${command}`);
    }
    const prefix = commandSet === 'companion' ? 'speckit.companion' : 'speckit';
    return `/${prefix}.${command} ${specId}`;
}

/** A new spec starts from a description, not a folder: specify mints the folder itself. */
export function buildSpecifyPrompt(description, commandSet = 'companion') {
    const text = String(description ?? '').replace(/\s+/g, ' ').trim();
    if (!text) throw new Error('Describe the feature to specify.');
    const prefix = commandSet === 'companion' ? 'speckit.companion' : 'speckit';
    return `/${prefix}.specify ${text}`;
}

/** A read-only question about one spec, for the "Ask Copilot" button. */
export function buildAskPrompt(spec) {
    return [
        `Look at the spec in \`${spec.id}\` (titled ${JSON.stringify(spec.title)}).`,
        `Its run record says status "${spec.statusLabel}", current step "${spec.currentStep ?? 'none'}".`,
        'Tell me in a few lines where it stands, what is left, and the single next step. Read only: do not change any files.',
    ].join(' ');
}
