import * as fs from 'fs';
import * as path from 'path';
import { isCompanionInstalled } from '../settings/companionPresetReconciler';

/**
 * The stock command each `/speckit.companion.*` command downgrades to when the
 * spec-kit companion extension is not installed. Only the four pipeline commands
 * have stock twins; `mark-complete` has none (it's the terminal companion action).
 */
const STOCK_COMMAND_BY_COMPANION: Record<string, string> = {
    'speckit.companion.specify': 'speckit.specify',
    'speckit.companion.plan': 'speckit.plan',
    'speckit.companion.tasks': 'speckit.tasks',
    'speckit.companion.implement': 'speckit.implement',
};

/**
 * Whether a command needs the spec-kit companion extension to resolve — i.e. it's
 * one of the `/speckit.companion.*` pipeline commands. A stock `speckit.*` command
 * never needs it.
 */
function isCompanionNamespacedCommand(command: string): boolean {
    return command in STOCK_COMMAND_BY_COMPANION;
}

export interface DispatchResolution {
    /** The command to actually dispatch. */
    command: string;
    /**
     * True when a `/speckit.companion.*` command was downgraded to its stock twin
     * because the spec-kit extension is missing. The caller should warn
     * (non-blocking) and run the stock flow — NEVER dispatch the unresolvable
     * namespaced command.
     */
    fellBack: boolean;
}

/**
 * Apply the missing-extension fallback to an already-resolved workflow command,
 * given a workspace root. A `/speckit.companion.*` command resolves as-is when the
 * companion spec-kit extension is installed; otherwise it downgrades to its stock
 * twin with `fellBack: true`. Stock commands pass through unchanged. This is the
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
    return { command: STOCK_COMMAND_BY_COMPANION[command], fellBack: true };
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
