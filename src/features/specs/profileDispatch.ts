import * as fs from 'fs';
import * as path from 'path';
import { isCompanionInstalled } from '../settings/companionPresetReconciler';

/** Prefix every Companion-namespaced command shares. */
const COMPANION_COMMAND_PREFIX = 'speckit.companion.';

/**
 * The stock command each `/speckit.companion.*` command downgrades to when the
 * spec-kit companion extension is not installed. Only the four pipeline commands
 * have stock twins; companion-only commands with no twin (e.g. `mark-complete`,
 * `classify`) have no entry and are suppressed rather than dispatched (see
 * {@link resolveDispatchForRoot}).
 */
const STOCK_COMMAND_BY_COMPANION: Record<string, string> = {
    'speckit.companion.specify': 'speckit.specify',
    'speckit.companion.plan': 'speckit.plan',
    'speckit.companion.tasks': 'speckit.tasks',
    'speckit.companion.implement': 'speckit.implement',
};

/**
 * Whether a command needs the spec-kit companion extension to resolve — ANY
 * `/speckit.companion.*` command, not just the four with stock twins. Detection is
 * prefix-based so a companion-only command (`mark-complete`, `classify`) can never
 * slip past the missing-extension guard and dispatch unresolvably. A stock
 * `speckit.*` command never needs it.
 */
function isCompanionNamespacedCommand(command: string): boolean {
    return command.startsWith(COMPANION_COMMAND_PREFIX);
}

export interface DispatchResolution {
    /**
     * The command to actually dispatch, or `null` when a companion command with no
     * stock twin (e.g. `mark-complete`) was suppressed because the extension is
     * missing — the caller must NOT dispatch anything in that case.
     */
    command: string | null;
    /**
     * True when a `/speckit.companion.*` command could not run as-is because the
     * spec-kit extension is missing — either downgraded to its stock twin (`command`
     * is the stock command) or suppressed when it has no twin (`command` is null).
     * The caller should warn (non-blocking) and NEVER dispatch the unresolvable
     * namespaced command.
     */
    fellBack: boolean;
}

/**
 * Apply the missing-extension fallback to an already-resolved workflow command,
 * given a workspace root. A `/speckit.companion.*` command resolves as-is when the
 * companion spec-kit extension is installed; otherwise it downgrades to its stock
 * twin (`fellBack: true`), or — for a companion-only command with no twin like
 * `mark-complete` — is suppressed (`command: null, fellBack: true`) so nothing
 * unresolvable is dispatched. Stock commands pass through unchanged. This is the
 * FR-006/FR-007 safety net so a Companion workflow never dispatches a command the
 * AI CLI can't resolve.
 */
export function resolveDispatchForRoot(
    command: string,
    workspaceRoot: string | undefined
): DispatchResolution {
    if (!isCompanionNamespacedCommand(command)) {
        return { command, fellBack: false };
    }
    if (workspaceRoot && isCompanionInstalled(workspaceRoot)) {
        return { command, fellBack: false };
    }
    // Extension missing: downgrade to the stock twin, or suppress (null) when the
    // companion command has no stock equivalent (mark-complete / classify).
    return { command: STOCK_COMMAND_BY_COMPANION[command] ?? null, fellBack: true };
}

/**
 * Spec-directory variant of {@link resolveDispatchForRoot}: walks up to the
 * workspace root from a spec directory, then applies the missing-extension
 * fallback. Used by every existing-spec dispatch path (viewer footer, sidebar
 * resume, command palette).
 */
export function resolveDispatchWithFallback(
    command: string,
    specDirectory: string
): DispatchResolution {
    return resolveDispatchForRoot(command, findWorkspaceRoot(specDirectory));
}

/**
 * Walk up from a spec directory to the workspace root — the nearest ancestor
 * holding a `.specify` directory. Undefined when none is found.
 */
function findWorkspaceRoot(specDirectory: string): string | undefined {
    let dir = path.resolve(specDirectory);
    for (;;) {
        if (fs.existsSync(path.join(dir, '.specify'))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            return undefined;
        }
        dir = parent;
    }
}
