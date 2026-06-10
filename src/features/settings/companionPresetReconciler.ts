import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type TemplateProfile = 'standard' | 'turbo' | 'off';

/** Carrier preset for the always-present standard `/speckit.*` command family. */
const STANDARD_PRESET_ID = 'companion-standard';
/** Retired from the selection path; removed once if left installed by an old swap. */
const TURBO_PRESET_ID = 'companion-turbo';
/** Presets left over from pre-rename branches; cleaned up on first ensure. */
const LEGACY_PRESET_IDS = ['companion-lean', 'sdd-lean'] as const;

export const ALL_PRESET_IDS = ['companion-standard', 'companion-turbo'] as const;

const CONFIG_REL = path.join('.specify', 'companion.yml');
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
 * removed once (all are retired from the selection path); after such a removal,
 * `companion-standard` is re-enabled so its bodies aren't left reverted.
 * Already-present-and-clean is a no-op (idempotent).
 */
export function decideEnsureStandardOps(installed: Record<string, boolean>): PresetOp[] {
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
 * turbo command family relies on. Forward-slash literal kept consistent with
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
 * `/speckit.companion.*` family. The turbo picker dispatches
 * `speckit.companion.specify`, which is provided exclusively by the Companion
 * *extension*. A project that has the preset(s) but no extension dir would
 * therefore surface turbo and then fail with an unknown command — so the gate is
 * aligned with "the `/speckit.companion.*` commands actually exist", which is the
 * extension dir's presence, not a preset's. Used to gate install-only UI (e.g.
 * the Create-New-Spec turbo workflow option).
 */
export function isCompanionInstalled(workspaceRoot: string): boolean {
    return fs.existsSync(path.join(workspaceRoot, COMPANION_EXTENSION_REL));
}

function installedMap(workspaceRoot: string): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const id of [...ALL_PRESET_IDS, ...LEGACY_PRESET_IDS]) {
        map[id] = isPresetInstalled(workspaceRoot, id);
    }
    return map;
}

const VALID_PROFILES: readonly TemplateProfile[] = ['standard', 'turbo', 'off'];

function isTemplateProfile(v: unknown): v is TemplateProfile {
    return typeof v === 'string' && (VALID_PROFILES as readonly string[]).includes(v);
}

/**
 * Read templateProfile from .specify/companion.yml; undefined when absent, unreadable,
 * or set to a value that isn't a known profile (a hand-edited `templateProfile: foo`
 * must not flow downstream as a TemplateProfile).
 */
export function readTemplateProfile(workspaceRoot: string): TemplateProfile | undefined {
    const p = path.join(workspaceRoot, CONFIG_REL);
    if (!fs.existsSync(p)) {
        return undefined;
    }
    try {
        const doc = yaml.load(fs.readFileSync(p, 'utf8')) as { templateProfile?: unknown } | null;
        const value = doc?.templateProfile;
        return isTemplateProfile(value) ? value : undefined;
    } catch {
        return undefined;
    }
}

/** Read-merge-write templateProfile, preserving every other key already in the file. */
export function writeTemplateProfile(workspaceRoot: string, profile: TemplateProfile): void {
    const p = path.join(workspaceRoot, CONFIG_REL);
    let doc: Record<string, unknown> = {};
    if (fs.existsSync(p)) {
        try {
            const loaded = yaml.load(fs.readFileSync(p, 'utf8'));
            if (loaded && typeof loaded === 'object') {
                doc = loaded as Record<string, unknown>;
            }
        } catch {
            doc = {};
        }
    }
    doc.templateProfile = profile;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, yaml.dump(doc), 'utf8');
}

/** Read-merge-write complexityFastPath, preserving every other key already in the file. */
export function writeComplexityFastPath(workspaceRoot: string, value: boolean): void {
    const p = path.join(workspaceRoot, CONFIG_REL);
    let doc: Record<string, unknown> = {};
    if (fs.existsSync(p)) {
        try {
            const loaded = yaml.load(fs.readFileSync(p, 'utf8'));
            if (loaded && typeof loaded === 'object') {
                doc = loaded as Record<string, unknown>;
            }
        } catch {
            doc = {};
        }
    }
    doc.complexityFastPath = value;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, yaml.dump(doc), 'utf8');
}

/**
 * Mirror the VS Code `complexityFastPath` setting into .specify/companion.yml so
 * the turbo command body reads a single boolean (it never reads VS Code settings).
 * The setting is the source of truth and companion.yml is a derived, machine-local
 * cache (gitignored) — there is no project-level override. Defaults to `false`
 * (opt-in beta) when the setting is unset.
 */
export function resolveComplexityFastPath(
    workspaceRoot: string,
    settingValue: boolean | undefined
): boolean {
    const resolved = settingValue ?? false;
    writeComplexityFastPath(workspaceRoot, resolved);
    return resolved;
}

/**
 * The `off` profile is the explicit "plain upstream spec-kit" escape hatch — it
 * routes to stock commands and must NOT pull in the `companion-standard` family
 * (which carries the timing-augmented bodies). Every other profile (and an absent
 * one) keeps the standard family ensured so the pipeline is always present.
 */
export function shouldEnsureStandard(profile: TemplateProfile | undefined): boolean {
    return profile !== 'off';
}

export interface ReconcileDeps {
    /** Runs a shell command in the workspace; injected so tests don't touch the real CLI. */
    run?: (cmd: string, cwd: string) => Promise<void>;
    log?: (msg: string) => void;
}

/**
 * Idempotently ensure the standard `/speckit.*` command family is present:
 * add `companion-standard` from the bundled path when absent (recovering a
 * project a prior swap stranded), and migrate away a leftover `companion-turbo`
 * / legacy `companion-lean` / `sdd-lean` install. Add-only — never removes the standard family,
 * so it cannot strand the project. CLI failures are logged, not thrown, so
 * activation is never broken by a missing `specify` binary.
 */
export async function ensureStandardFamily(
    workspaceRoot: string,
    deps: ReconcileDeps = {}
): Promise<PresetOp[]> {
    const run = deps.run ?? (async (cmd: string, cwd: string): Promise<void> => {
        await execAsync(cmd, { cwd });
    });
    const log = deps.log ?? ((): void => undefined);

    const ops = decideEnsureStandardOps(installedMap(workspaceRoot));
    if (ops.length === 0) {
        log('[companion] standard command family already present — no preset action');
        return ops;
    }
    for (const op of ops) {
        const cmd = presetCommandFor(op);
        log(`[companion] ensure standard → ${cmd}`);
        try {
            await run(cmd, workspaceRoot);
        } catch (e) {
            log(`[companion] preset command failed: ${cmd} — ${(e as Error).message}`);
        }
    }
    return ops;
}
