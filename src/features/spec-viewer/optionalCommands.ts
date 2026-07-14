/**
 * Built-in optional SpecKit commands surfaced as step-scoped buttons in the
 * spec viewer. These reuse the already-registered VS Code commands
 * (`speckit.clarify` / `speckit.checklist` / `speckit.analyze`) so dispatch,
 * provider formatting, and step tracking stay identical to invoking them from
 * the Command Palette.
 */

import { Commands } from '../../core/constants';
import { CORE_DOCUMENTS, DocumentType, EnhancementButton } from './types';
import type { CustomCommandConfig } from '../../core/types/config';
import { commandMatchesStep, normalizeCustomCommand } from './customCommands';

interface OptionalCommand {
    /** Registered VS Code command id (e.g. "speckit.clarify") */
    command: string;
    /** Button label */
    label: string;
    /** Spec viewer tab this command belongs to */
    tab: DocumentType;
    /** Tooltip shown on hover */
    tooltip: string;
}

/**
 * The three optional SpecKit refinement commands, each scoped to the tab where
 * it is most useful in the spec lifecycle.
 */
export const OPTIONAL_SPECKIT_COMMANDS: readonly OptionalCommand[] = [
    {
        command: Commands.clarify,
        label: 'Clarify',
        tab: CORE_DOCUMENTS.SPEC,
        tooltip: 'Ask clarifying questions to refine the spec',
    },
    {
        command: Commands.checklist,
        label: 'Checklist',
        tab: CORE_DOCUMENTS.PLAN,
        tooltip: 'Generate a quality checklist for the plan',
    },
    {
        command: Commands.analyze,
        label: 'Analyze',
        tab: CORE_DOCUMENTS.TASKS,
        tooltip: 'Cross-check spec, plan, and tasks for consistency',
    },
];

/**
 * Build enhancement buttons for the built-in optional commands matching a tab.
 * Commands already present in `seen` are skipped (so user-defined commands and
 * workflow commands with the same id win); each emitted command is added to
 * `seen`.
 */
export function optionalCommandButtonsForTab(
    docType: string,
    seen: Set<string>
): EnhancementButton[] {
    const buttons: EnhancementButton[] = [];
    for (const cmd of OPTIONAL_SPECKIT_COMMANDS) {
        if (cmd.tab !== docType) continue;
        if (seen.has(cmd.command)) continue;
        seen.add(cmd.command);
        buttons.push({
            label: cmd.label,
            command: cmd.command,
            icon: '⚡',
            tooltip: cmd.tooltip,
        });
    }
    return buttons;
}

/**
 * Whether a command id is one of the built-in optional SpecKit commands.
 */
export function isOptionalCommand(command: string): boolean {
    return OPTIONAL_SPECKIT_COMMANDS.some(c => c.command === command);
}

/**
 * Build enhancement buttons from the user's `speckit.customCommands` setting.
 * A command surfaces when its `step` matches the displayed document, is `all`,
 * or matches the spec's current workflow step — the latter is how commands
 * scoped to an action-only step (which never has a document) stay reachable.
 * Emitted command ids are added to `seen` so built-ins dedupe against them.
 */
export function customCommandButtons(
    rawCommands: ReadonlyArray<CustomCommandConfig | string>,
    docType: string,
    seen: Set<string>,
    currentStep?: string,
): EnhancementButton[] {
    const buttons: EnhancementButton[] = [];
    for (const entry of rawCommands) {
        const cmd = normalizeCustomCommand(entry);
        if (!cmd) continue;
        if (!commandMatchesStep(cmd.step, docType, currentStep)) continue;

        const title = cmd.title || cmd.name;
        if (!title) continue;

        seen.add(cmd.command);
        buttons.push({
            label: title,
            command: cmd.command,
            icon: '⚡',
            tooltip: (typeof entry === 'string' ? undefined : entry.tooltip) || title,
        });
    }
    return buttons;
}
