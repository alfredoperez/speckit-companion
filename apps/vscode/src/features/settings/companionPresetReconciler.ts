import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const STANDARD_PRESET_ID = 'companion-standard';
/** Presets earlier versions installed; each is removed once when its folder is still there. */
const LEFTOVER_PRESET_IDS = [STANDARD_PRESET_ID, 'companion-turbo', 'companion-lean', 'sdd-lean'] as const;

const PRESETS_REL = path.join('.specify', 'presets');

export interface PresetOp {
    id: string;
    action: 'remove';
}

/** One removal per leftover preset that is installed; nothing is ever added or enabled. */
export function decideLeftoverRemovals(installed: Record<string, boolean>): PresetOp[] {
    return LEFTOVER_PRESET_IDS.filter(id => installed[id]).map(id => ({ id, action: 'remove' }));
}

export function presetCommandFor(op: PresetOp): string {
    return `specify preset ${op.action} ${op.id}`;
}

/** A preset is "installed" when its install directory exists under .specify/presets/. */
export function isPresetInstalled(workspaceRoot: string, id: string): boolean {
    return fs.existsSync(path.join(workspaceRoot, PRESETS_REL, id));
}

/** The Companion spec-kit extension's on-disk install root in a consumer project. */
const COMPANION_EXTENSION_REL = '.specify/extensions/companion';

/** True when the extension's own folder is in the project: the only thing that provides `/speckit.companion.*`. */
export function isCompanionInstalled(workspaceRoot: string): boolean {
    return fs.existsSync(path.join(workspaceRoot, COMPANION_EXTENSION_REL));
}

/** The installed extension records a stock step's start through a hook, so the old wrapper is no longer needed. */
function recordsStartsThroughHooks(workspaceRoot: string): boolean {
    return fs.existsSync(path.join(workspaceRoot, COMPANION_EXTENSION_REL, 'commands', 'speckit.companion.before-step.md'));
}

function installedMap(workspaceRoot: string): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const id of LEFTOVER_PRESET_IDS) {
        map[id] = isPresetInstalled(workspaceRoot, id);
    }
    map[STANDARD_PRESET_ID] &&= recordsStartsThroughHooks(workspaceRoot);
    return map;
}

const inFlight = new Map<string, Promise<PresetOp[]>>();

export interface ReconcileDeps {
    /** Runs a shell command in the workspace; injected so tests don't touch the real CLI. */
    run?: (cmd: string, cwd: string) => Promise<void>;
    log?: (msg: string) => void;
}

/** Removes each leftover preset still installed; a CLI failure is logged, never thrown, so activation survives a missing `specify`. */
export function removeLeftoverPresets(workspaceRoot: string, deps: ReconcileDeps = {}): Promise<PresetOp[]> {
    const running = inFlight.get(workspaceRoot);
    if (running) {
        return running;
    }
    const pass = removeOnce(workspaceRoot, deps).finally(() => inFlight.delete(workspaceRoot));
    inFlight.set(workspaceRoot, pass);
    return pass;
}

async function removeOnce(workspaceRoot: string, deps: ReconcileDeps): Promise<PresetOp[]> {
    const run = deps.run ?? (async (cmd: string, cwd: string): Promise<void> => {
        await execAsync(cmd, { cwd });
    });
    const log = deps.log ?? ((): void => undefined);

    const ops = decideLeftoverRemovals(installedMap(workspaceRoot));
    if (ops.length === 0) {
        log('[companion] no leftover preset installed, nothing to remove');
        return ops;
    }
    for (const op of ops) {
        const cmd = presetCommandFor(op);
        log(`[companion] removing leftover preset: ${cmd}`);
        try {
            await run(cmd, workspaceRoot);
        } catch (e) {
            log(`[companion] leftover preset removal failed: ${cmd} (${(e as Error).message})`);
        }
    }
    return ops;
}
