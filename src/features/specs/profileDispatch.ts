import * as fs from 'fs';
import * as path from 'path';
import { readSpecContextSync } from './specContextReader';
import { readTemplateProfile } from '../settings/companionPresetReconciler';

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
