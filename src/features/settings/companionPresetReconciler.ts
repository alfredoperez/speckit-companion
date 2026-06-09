import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type TemplateProfile = 'standard' | 'lean' | 'off';

export const PRESET_BY_PROFILE: Record<Exclude<TemplateProfile, 'off'>, string> = {
    standard: 'companion-standard',
    lean: 'companion-lean',
};
export const ALL_PRESET_IDS = ['companion-standard', 'companion-lean'] as const;
/** A preset left over from the pre-rename branch; cleaned up on first reconcile. */
const LEGACY_PRESET_ID = 'sdd-lean';

const CONFIG_REL = path.join('.specify', 'companion.yml');
const PRESETS_REL = path.join('.specify', 'presets');

export interface PresetOp {
    id: string;
    action: 'add' | 'enable' | 'remove';
}

/**
 * Pure decision: desired profile + which presets are installed on disk → an ordered
 * list of `specify preset` ops that converges to "only the target preset installed".
 * Mutual exclusivity is the invariant — any non-target preset that is installed is
 * removed, and removes are emitted BEFORE the add so a switch never has both
 * presets registered at once. "off" removes both.
 */
export function decidePresetOps(
    profile: TemplateProfile,
    installed: Record<string, boolean>
): PresetOp[] {
    const target = profile === 'off' ? null : PRESET_BY_PROFILE[profile];
    const removes: PresetOp[] = [];
    let add: PresetOp | null = null;

    for (const id of ALL_PRESET_IDS) {
        if (id === target) {
            add = installed[id] ? { id, action: 'enable' } : { id, action: 'add' };
        } else if (installed[id]) {
            removes.push({ id, action: 'remove' });
        }
    }
    // Clean up a stale pre-rename install if present.
    if (installed[LEGACY_PRESET_ID]) {
        removes.push({ id: LEGACY_PRESET_ID, action: 'remove' });
    }
    return add ? [...removes, add] : removes;
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

export interface ReconcileDeps {
    /** Runs a shell command in the workspace; injected so tests don't touch the real CLI. */
    run?: (cmd: string, cwd: string) => Promise<void>;
    log?: (msg: string) => void;
}

/**
 * Persist the profile (the source of truth) and run the decided `specify preset`
 * ops in order. Idempotent: re-applying the current state yields no ops. CLI
 * failures are logged, not thrown, so toggling the setting never breaks activation.
 */
export async function reconcileCompanionPreset(
    workspaceRoot: string,
    profile: TemplateProfile,
    deps: ReconcileDeps = {}
): Promise<PresetOp[]> {
    const run = deps.run ?? (async (cmd: string, cwd: string): Promise<void> => {
        await execAsync(cmd, { cwd });
    });
    const log = deps.log ?? ((): void => undefined);

    writeTemplateProfile(workspaceRoot, profile);
    const ops = decidePresetOps(profile, installedMap(workspaceRoot));
    if (ops.length === 0) {
        log(`[companion] profile "${profile}" already reconciled — no preset action`);
        return ops;
    }
    // Removes run before the target op. If a remove fails, skip the target's
    // activation (whether that's `add` or `enable`) rather than half-applying the
    // switch — activating the target while the other preset survives is the exact
    // both-active state mutual exclusivity exists to prevent. The next reconcile retries.
    let removeFailed = false;
    for (const op of ops) {
        const cmd = presetCommandFor(op);
        if ((op.action === 'add' || op.action === 'enable') && removeFailed) {
            log(`[companion] skipping "${cmd}" — a preceding remove failed; not activating both presets`);
            continue;
        }
        log(`[companion] profile "${profile}" → ${cmd}`);
        try {
            await run(cmd, workspaceRoot);
        } catch (e) {
            if (op.action === 'remove') {
                removeFailed = true;
            }
            log(`[companion] preset command failed: ${cmd} — ${(e as Error).message}`);
        }
    }
    return ops;
}
