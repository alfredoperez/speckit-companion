import * as fs from 'fs';
import * as path from 'path';
import { readSpecContextSync } from './specContextReader';
import { readTemplateProfile, isCompanionInstalled } from '../settings/companionPresetReconciler';

/**
 * When a spec's per-spec profile is `turbo`, the stock pipeline command is swapped
 * for its `/speckit.companion.*` turbo twin so that one spec gets the turbo shape
 * regardless of the project-default preset. Only the four pipeline commands have
 * turbo twins; everything else (custom commands, clarify/analyze/constitution)
 * passes through unchanged.
 */
const TURBO_COMMAND_BY_STOCK: Record<string, string> = {
    'speckit.specify': 'speckit.companion.specify',
    'speckit.plan': 'speckit.companion.plan',
    'speckit.tasks': 'speckit.companion.tasks',
    'speckit.implement': 'speckit.companion.implement',
};

/**
 * Map a pipeline command to its turbo twin when the spec should run turbo — i.e. its
 * recorded `profile` is `turbo`, or (when the spec has no pin yet) the project default
 * is `turbo`. Only the four pipeline commands (specify/plan/tasks/implement) have turbo
 * twins; everything else passes through. Shared by every dispatch path (viewer footer,
 * command palette, sidebar) so the override is honored uniformly. An explicit non-turbo
 * pin, a standard default, or an unreadable context returns the command unchanged.
 */
export function resolveProfileCommand(command: string, specDirectory: string): string {
    let profile: string | undefined;
    try {
        profile = readSpecContextSync(specDirectory)?.profile;
    } catch {
        // A corrupt/unreadable .spec-context.json must not break dispatch —
        // fall back to the stock command rather than throwing on every path.
        return command;
    }
    // No pinned profile — e.g. the spec-kit command's capture script created the
    // context without one. Fall back to the project default so the rest of the
    // pipeline keeps the shape the spec was created under. An explicit pin
    // (including `standard`) or an invalid value is respected as-is.
    const effective = profile ?? seedProfileForNewSpec(specDirectory);
    if (effective === 'turbo' && TURBO_COMMAND_BY_STOCK[command]) {
        return TURBO_COMMAND_BY_STOCK[command];
    }
    return command;
}

/**
 * Project-default routing for a brand-new spec, which has no `.spec-context.json`
 * yet (so `resolveProfileCommand` can't read a pinned profile). Maps the stock
 * pipeline command to its turbo twin when the project default
 * (`speckit.companion.templateProfile`) is `turbo`; otherwise returns it unchanged.
 * This keeps the *first* step (specify) on the same shape as the rest of the spec
 * a turbo default would seed — without it, a new turbo-default spec's specify ran
 * stock and produced a standard-shaped spec.md.
 */
export function resolveNewSpecProfileCommand(stockCommand: string, workspaceRoot: string | undefined): string {
    const projectDefault = workspaceRoot ? readTemplateProfile(workspaceRoot) : undefined;
    if (projectDefault === 'turbo' && TURBO_COMMAND_BY_STOCK[stockCommand]) {
        return TURBO_COMMAND_BY_STOCK[stockCommand];
    }
    return stockCommand;
}

/** Reverse map: the stock command a `/speckit.companion.*` twin falls back to. */
const STOCK_COMMAND_BY_TURBO: Record<string, string> = Object.fromEntries(
    Object.entries(TURBO_COMMAND_BY_STOCK).map(([stock, turbo]) => [turbo, stock])
);

/**
 * The discriminator for "this command needs the spec-kit extension to exist": a
 * resolved `/speckit.companion.*` twin only works when the companion extension dir
 * is installed (it registers that namespaced command family). A stock `speckit.*`
 * command never needs it.
 */
function isCompanionNamespacedCommand(command: string): boolean {
    return command in STOCK_COMMAND_BY_TURBO;
}

export interface DispatchResolution {
    /** The command to actually dispatch. */
    command: string;
    /**
     * True when a `/speckit.companion.*` twin was downgraded to its stock command
     * because the spec-kit extension is missing. The caller should warn (non-blocking)
     * and run the stock flow — NEVER dispatch the unresolvable namespaced command.
     */
    fellBack: boolean;
}

/**
 * Resolve the dispatch command for an existing spec AND guard the missing-extension
 * case: if `resolveProfileCommand` picks a `/speckit.companion.*` twin but the
 * companion spec-kit extension is not installed (no `.specify/extensions/companion/`),
 * downgrade to the stock command and flag `fellBack` so the caller can warn. This is
 * the FR-003 safety net — turning on turbo without the extension must never dispatch a
 * command the AI CLI can't resolve.
 */
export function resolveProfileCommandWithFallback(
    command: string,
    specDirectory: string
): DispatchResolution {
    const resolved = resolveProfileCommand(command, specDirectory);
    if (!isCompanionNamespacedCommand(resolved)) {
        return { command: resolved, fellBack: false };
    }
    const root = findWorkspaceRoot(specDirectory);
    if (root && isCompanionInstalled(root)) {
        return { command: resolved, fellBack: false };
    }
    // Extension missing — fall back to the stock command rather than dispatch an
    // unresolvable `/speckit.companion.*`.
    return { command: STOCK_COMMAND_BY_TURBO[resolved], fellBack: true };
}

/**
 * New-spec variant of {@link resolveProfileCommandWithFallback}: resolves the
 * project-default turbo routing for a brand-new spec, then applies the same
 * missing-extension guard. Used by the Create-Spec editor's specify dispatch.
 */
export function resolveNewSpecProfileCommandWithFallback(
    stockCommand: string,
    workspaceRoot: string | undefined
): DispatchResolution {
    const resolved = resolveNewSpecProfileCommand(stockCommand, workspaceRoot);
    if (!isCompanionNamespacedCommand(resolved)) {
        return { command: resolved, fellBack: false };
    }
    if (workspaceRoot && isCompanionInstalled(workspaceRoot)) {
        return { command: resolved, fellBack: false };
    }
    return { command: STOCK_COMMAND_BY_TURBO[resolved], fellBack: true };
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

/**
 * Resolve the pinned `profile` for a brand-new spec from the project default
 * (`speckit.companion.templateProfile`, mirrored to `.specify/companion.yml`).
 * Only an explicit `turbo` default pins `turbo`; `standard`, `off`, an absent
 * setting, or an undiscoverable root all pin `standard`. Pinning at creation
 * keeps a later default change from reshaping an in-flight spec.
 */
export function seedProfileForNewSpec(specDirectory: string): 'standard' | 'turbo' {
    const root = findWorkspaceRoot(specDirectory);
    const projectDefault = root ? readTemplateProfile(root) : undefined;
    return projectDefault === 'turbo' ? 'turbo' : 'standard';
}
