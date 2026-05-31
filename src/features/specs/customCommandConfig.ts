/**
 * Custom-command resolution for the SpecKit sidebar.
 *
 * Reads `speckit.customCommands` from the workspace settings and normalises
 * each entry — either a bare string (interpreted as a SpecKit command name)
 * or a `CustomCommandConfig` object — into a single `NormalizedCustomCommand`
 * shape that the registration code can iterate.
 *
 * Lived inline in `specCommands.ts` until Phase 10; extracted here so the
 * 834-LOC file becomes more navigable and the normalisation logic is
 * unit-testable without touching the command-registration plumbing.
 */

import * as vscode from 'vscode';
import { ConfigKeys } from '../../core/constants';
import type { CustomCommandConfig } from '../../core/types/config';

export interface NormalizedCustomCommand {
    label: string;
    description: string;
    command: string;
    requiresSpecDir: boolean;
    autoExecute: boolean;
}

export function loadCustomCommands(): NormalizedCustomCommand[] {
    const config = vscode.workspace.getConfiguration(ConfigKeys.namespace);
    const rawCommands = config.get<Array<CustomCommandConfig | string>>(
        'customCommands',
        [],
    );

    return rawCommands
        .map((entry) => normalizeCustomCommand(entry))
        .filter((entry): entry is NormalizedCustomCommand => entry !== null);
}

export function normalizeCustomCommand(
    entry: CustomCommandConfig | string,
): NormalizedCustomCommand | null {
    if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) return null;
        return buildCustomCommand({ name: trimmed });
    }

    const name = entry.name?.trim();
    const title = entry.title?.trim();
    const command = entry.command?.trim();

    if (!name && !command) return null;

    return buildCustomCommand({
        name,
        title,
        command,
        requiresSpecDir: entry.requiresSpecDir,
        autoExecute: entry.autoExecute,
    });
}

function buildCustomCommand(config: {
    name?: string;
    title?: string;
    command?: string;
    requiresSpecDir?: boolean;
    autoExecute?: boolean;
}): NormalizedCustomCommand | null {
    const rawCommand = config.command?.length ? config.command : config.name;
    if (!rawCommand) return null;

    let commandText = rawCommand.trim();
    if (!commandText.startsWith('/')) {
        if (commandText.startsWith('speckit.')) {
            commandText = `/${commandText}`;
        } else {
            commandText = `/speckit.${commandText}`;
        }
    }

    const label = config.title || config.name || commandText;
    const description = commandText;

    return {
        label,
        description,
        command: commandText,
        requiresSpecDir: config.requiresSpecDir ?? true,
        autoExecute: config.autoExecute ?? true,
    };
}
