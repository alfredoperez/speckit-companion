import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type TemplateProfile = 'standard' | 'lean' | 'off';

/** Carrier preset for the always-present standard `/speckit.*` command family. */
const STANDARD_PRESET_ID = 'companion-standard';
/** Retired from the selection path; removed once if left installed by an old swap. */
const LEAN_PRESET_ID = 'companion-lean';
/** A preset left over from the pre-rename branch; cleaned up on first ensure. */
const LEGACY_PRESET_ID = 'sdd-lean';

export const ALL_PRESET_IDS = ['companion-standard', 'companion-lean'] as const;

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
 * leftover `companion-lean` / legacy `sdd-lean` install is removed once (both
 * are retired from the selection path); after such a removal, `companion-standard`
 * is re-enabled so its bodies aren't left reverted. Already-present-and-clean is
 * a no-op (idempotent).
 */
export function decideEnsureStandardOps(installed: Record<string, boolean>): PresetOp[] {
    const ops: PresetOp[] = [];
    if (installed[LEAN_PRESET_ID]) {
        ops.push({ id: LEAN_PRESET_ID, action: 'remove' });
    }
    if (installed[LEGACY_PRESET_ID]) {
        ops.push({ id: LEGACY_PRESET_ID, action: 'remove' });
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

function installedMap(workspaceRoot: string): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const id of [...ALL_PRESET_IDS, LEGACY_PRESET_ID]) {
        map[id] = isPresetInstalled(workspaceRoot, id);
    }
    return map;
}

const VALID_PROFILES: readonly TemplateProfile[] = ['standard', 'lean', 'off'];

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
 * project a prior swap stranded), and migrate away a leftover `companion-lean`
 * / legacy `sdd-lean` install. Add-only — never removes the standard family,
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
