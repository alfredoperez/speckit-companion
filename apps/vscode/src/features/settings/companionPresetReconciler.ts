import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Carrier preset for the always-present standard `/speckit.*` command family. */
const STANDARD_PRESET_ID = 'companion-standard';
/** Leftover from an old install; removed once if left installed by an old swap. */
const TURBO_PRESET_ID = 'companion-turbo';
/** Presets left over from pre-rename branches; cleaned up on first ensure. */
const LEGACY_PRESET_IDS = ['companion-lean', 'sdd-lean'] as const;

const PRESETS_REL = path.join('.specify', 'presets');

export interface PresetOp {
    id: string;
    action: 'add' | 'enable' | 'remove';
}

/**
 * Pure decision: which `specify preset` ops bring a project to "the standard
 * command family is present". Add-only for `companion-standard` — added (from
 * the bundled path) when absent, never removed regardless of input state. A
 * leftover `companion-turbo` / legacy `companion-lean` / `sdd-lean` install is
 * removed once (all are leftovers from old installs); after such a removal,
 * `companion-standard` is re-enabled so its bodies aren't left reverted.
 * Already-present-and-clean is a no-op (idempotent). A `stale` install, one
 * whose version differs from the bundled preset, is removed and re-added,
 * because the CLI composes command bodies only when a preset is added.
 */
export function decideEnsureStandardOps(installed: Record<string, boolean>, stale = false): PresetOp[] {
    const ops: PresetOp[] = [];
    if (installed[TURBO_PRESET_ID]) {
        ops.push({ id: TURBO_PRESET_ID, action: 'remove' });
    }
    for (const legacyId of LEGACY_PRESET_IDS) {
        if (installed[legacyId]) {
            ops.push({ id: legacyId, action: 'remove' });
        }
    }
    if (!installed[STANDARD_PRESET_ID]) {
        ops.push({ id: STANDARD_PRESET_ID, action: 'add' });
    } else if (stale) {
        ops.push({ id: STANDARD_PRESET_ID, action: 'remove' }, { id: STANDARD_PRESET_ID, action: 'add' });
    } else if (ops.length > 0) {
        ops.push({ id: STANDARD_PRESET_ID, action: 'enable' });
    }
    return ops;
}

/**
 * Bundled preset location in a consumer project (installed by the companion
 * spec-kit extension), mirroring the `.specify/extensions/companion/scripts/`
 * convention. Forward-slash literal so the CLI string is identical on every OS.
 */
const BUNDLED_PRESETS_REL = '.specify/extensions/companion/presets';

export function presetCommandFor(op: PresetOp): string {
    // The presets are bundled locally, never published to a catalog, so catalog-form
    // `add <id>` silently no-ops. Install the `add` from the bundled path with --dev;
    // once registered, `enable`/`remove` act on it by id.
    if (op.action === 'add') {
        return `specify preset add --dev ${BUNDLED_PRESETS_REL}/${op.id}`;
    }
    return `specify preset ${op.action} ${op.id}`;
}

/** A preset is "installed" when its install directory exists under .specify/presets/. */
export function isPresetInstalled(workspaceRoot: string, id: string): boolean {
    return fs.existsSync(path.join(workspaceRoot, PRESETS_REL, id));
}

/**
 * The Companion spec-kit extension's on-disk install root in a consumer project
 * (`.specify/extensions/companion/`), holding the bundled scripts and presets the
 * Companion command family relies on. Forward-slash literal kept consistent with
 * `BUNDLED_PRESETS_REL`.
 */
const COMPANION_EXTENSION_REL = '.specify/extensions/companion';

/**
 * True when the Companion spec-kit extension is installed *in the project* — the
 * same on-disk signal the reconciler already keys off, not a VS Code marketplace
 * lookup.
 *
 * Requires the bundled extension dir (`.specify/extensions/companion/`) and ONLY
 * that. The presets are intentionally NOT accepted here: a preset only replaces
 * the stock `/speckit.*` command bodies, it does not register the namespaced
 * `/speckit.companion.*` family. The Companion workflow dispatches
 * `speckit.companion.specify`, which is provided exclusively by the Companion
 * *extension*. A project that has the preset(s) but no extension dir would
 * therefore surface the workflow and then fail with an unknown command — so the gate is
 * aligned with "the `/speckit.companion.*` commands actually exist", which is the
 * extension dir's presence, not a preset's. Used to gate install-only UI (e.g.
 * the Create-New-Spec Companion workflow option).
 */
export function isCompanionInstalled(workspaceRoot: string): boolean {
    return fs.existsSync(path.join(workspaceRoot, COMPANION_EXTENSION_REL));
}

function presetVersion(manifestPath: string): string | undefined {
    try {
        return /^\s+version:\s*["']?([^"'\s]+)/m.exec(fs.readFileSync(manifestPath, 'utf8'))?.[1];
    } catch {
        return undefined;
    }
}

/** True when the installed standard preset is a different version than the bundled one. */
export function isStandardPresetStale(workspaceRoot: string): boolean {
    const installed = presetVersion(path.join(workspaceRoot, PRESETS_REL, STANDARD_PRESET_ID, 'preset.yml'));
    const bundled = presetVersion(path.join(workspaceRoot, BUNDLED_PRESETS_REL, STANDARD_PRESET_ID, 'preset.yml'));
    return installed !== undefined && bundled !== undefined && installed !== bundled;
}

function installedMap(workspaceRoot: string): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const id of [STANDARD_PRESET_ID, TURBO_PRESET_ID, ...LEGACY_PRESET_IDS]) {
        map[id] = isPresetInstalled(workspaceRoot, id);
    }
    return map;
}

export interface ReconcileDeps {
    /** Runs a shell command in the workspace; injected so tests don't touch the real CLI. */
    run?: (cmd: string, cwd: string) => Promise<void>;
    log?: (msg: string) => void;
    /** Reads the installed spec-kit version; injected so tests don't touch the real CLI. */
    specKitVersion?: (cwd: string) => Promise<string | undefined>;
    /** Remembers the spec-kit version the standard family was last composed against. */
    state?: {
        get(key: string): string | undefined;
        update(key: string, value: string): PromiseLike<void>;
    };
}

const COMPOSED_SPECKIT_VERSION_KEY = 'speckit.companion.standardPresetSpecKitVersion';

async function readSpecKitVersion(cwd: string): Promise<string | undefined> {
    try {
        const { stdout } = await execAsync('specify --version', { cwd });
        return /\d+\.\d+\.\d+[\w.+-]*/.exec(stdout)?.[0];
    } catch {
        return undefined;
    }
}

/**
 * Idempotently ensure the standard `/speckit.*` command family is present:
 * add `companion-standard` from the bundled path when absent (recovering a
 * project a prior swap stranded), and migrate away a leftover `companion-turbo`
 * / legacy `companion-lean` / `sdd-lean` install. The standard family is removed
 * only to be re-added in the same pass, when the bundled preset or the installed
 * spec-kit changed version since it was composed. CLI failures are logged, not
 * thrown, so activation is never broken by a missing `specify` binary.
 */
export async function ensureStandardFamily(
    workspaceRoot: string,
    deps: ReconcileDeps = {}
): Promise<PresetOp[]> {
    const run = deps.run ?? (async (cmd: string, cwd: string): Promise<void> => {
        await execAsync(cmd, { cwd });
    });
    const log = deps.log ?? ((): void => undefined);

    const specKit = deps.state ? await (deps.specKitVersion ?? readSpecKitVersion)(workspaceRoot) : undefined;
    const composedWith = deps.state?.get(COMPOSED_SPECKIT_VERSION_KEY);
    const specKitUpgraded = specKit !== undefined && composedWith !== undefined && composedWith !== specKit;

    const ops = decideEnsureStandardOps(
        installedMap(workspaceRoot),
        isStandardPresetStale(workspaceRoot) || specKitUpgraded
    );
    if (ops.length === 0) {
        log('[companion] standard command family already present — no preset action');
    }
    let failed = false;
    for (const op of ops) {
        const cmd = presetCommandFor(op);
        log(`[companion] ensure standard → ${cmd}`);
        try {
            await run(cmd, workspaceRoot);
        } catch (e) {
            failed = true;
            log(`[companion] preset command failed: ${cmd} — ${(e as Error).message}`);
        }
    }
    if (specKit !== undefined && !failed && composedWith !== specKit) {
        await deps.state?.update(COMPOSED_SPECKIT_VERSION_KEY, specKit);
    }
    return ops;
}
