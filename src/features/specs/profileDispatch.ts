import { readSpecContextSync } from './specContextReader';

/**
 * When a spec's per-spec profile is `lean`, the stock pipeline command is swapped
 * for its `/speckit.companion.*` lean twin so that one spec gets the lean shape
 * regardless of the project-default preset. Only the four pipeline commands have
 * lean twins; everything else (custom commands, clarify/analyze/constitution)
 * passes through unchanged.
 */
const LEAN_COMMAND_BY_STOCK: Record<string, string> = {
    'speckit.specify': 'speckit.companion.specify',
    'speckit.plan': 'speckit.companion.plan',
    'speckit.tasks': 'speckit.companion.tasks',
    'speckit.implement': 'speckit.companion.implement',
};

/**
 * Map a pipeline command to its lean twin when the spec's recorded profile is
 * `lean`. Shared by every dispatch path (viewer footer, command palette, sidebar)
 * so the per-spec override is honored uniformly. Returns the command unchanged
 * when the spec isn't lean or the command has no lean twin.
 */
export function resolveProfileCommand(command: string, specDirectory: string): string {
    const profile = readSpecContextSync(specDirectory)?.profile;
    if (profile === 'lean' && LEAN_COMMAND_BY_STOCK[command]) {
        return LEAN_COMMAND_BY_STOCK[command];
    }
    return command;
}
