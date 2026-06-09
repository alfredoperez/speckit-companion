import * as fs from 'fs';
import * as path from 'path';
import { readSpecContextSync } from './specContextReader';
import { readTemplateProfile } from '../settings/companionPresetReconciler';

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
    let profile: string | undefined;
    try {
        profile = readSpecContextSync(specDirectory)?.profile;
    } catch {
        // A corrupt/unreadable .spec-context.json must not break dispatch —
        // fall back to the stock command rather than throwing on every path.
        return command;
    }
    if (profile === 'lean' && LEAN_COMMAND_BY_STOCK[command]) {
        return LEAN_COMMAND_BY_STOCK[command];
    }
    return command;
}

/**
 * Project-default routing for a brand-new spec, which has no `.spec-context.json`
 * yet (so `resolveProfileCommand` can't read a pinned profile). Maps the stock
 * pipeline command to its lean twin when the project default
 * (`speckit.companion.templateProfile`) is `lean`; otherwise returns it unchanged.
 * This keeps the *first* step (specify) on the same shape as the rest of the spec
 * a lean default would seed — without it, a new lean-default spec's specify ran
 * stock and produced a standard-shaped spec.md.
 */
export function resolveNewSpecProfileCommand(stockCommand: string, workspaceRoot: string | undefined): string {
    const projectDefault = workspaceRoot ? readTemplateProfile(workspaceRoot) : undefined;
    if (projectDefault === 'lean' && LEAN_COMMAND_BY_STOCK[stockCommand]) {
        return LEAN_COMMAND_BY_STOCK[stockCommand];
    }
    return stockCommand;
}

/**
 * Walk up from a spec directory to the workspace root — the nearest ancestor
 * holding a `.specify` directory. Undefined when none is found.
 */
function findWorkspaceRoot(specDirectory: string): string | undefined {
    let dir = path.resolve(specDirectory);
    for (let i = 0; i < 12; i++) {
        if (fs.existsSync(path.join(dir, '.specify'))) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return undefined;
}

/**
 * Resolve the pinned `profile` for a brand-new spec from the project default
 * (`speckit.companion.templateProfile`, mirrored to `.specify/companion.yml`).
 * Only an explicit `lean` default pins `lean`; `standard`, `off`, an absent
 * setting, or an undiscoverable root all pin `standard`. Pinning at creation
 * keeps a later default change from reshaping an in-flight spec.
 */
export function seedProfileForNewSpec(specDirectory: string): 'standard' | 'lean' {
    const root = findWorkspaceRoot(specDirectory);
    const projectDefault = root ? readTemplateProfile(root) : undefined;
    return projectDefault === 'lean' ? 'lean' : 'standard';
}
