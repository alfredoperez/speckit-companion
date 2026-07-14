import type { CustomCommandConfig } from '../../core/types/config';

/** A user `customCommands` entry, normalised into what the viewer dispatches. */
export interface EnhancementCommand {
    command: string;
    step?: string;
    title?: string;
    name?: string;
}

/** Drop entries that carry no runnable command; a bare `name` implies `/speckit.<name>`. */
export function normalizeCustomCommand(
    entry: CustomCommandConfig | string,
): EnhancementCommand | undefined {
    if (typeof entry === 'string') return undefined;
    const command = entry.command || (entry.name ? `/speckit.${entry.name}` : undefined);
    if (!command) return undefined;
    return { command, step: entry.step, title: entry.title, name: entry.name };
}

/**
 * Whether a command belongs to what the viewer is showing.
 *
 * `currentStep` is what makes an action-only step reachable: it produces no
 * document, so a command scoped to it can never match `docType`. Both the
 * render path (which buttons to show) and the dispatch path (which command an
 * implicit request runs) go through here — when they disagreed, the viewer
 * offered a button that dispatch could not resolve.
 */
export function commandMatchesStep(
    step: string | undefined,
    docType: string,
    currentStep?: string,
): boolean {
    const scope = step || 'all';
    return scope === 'all' || scope === docType || scope === currentStep;
}
