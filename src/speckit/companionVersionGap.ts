import * as path from 'path';
import * as yaml from 'js-yaml';
import { isCompanionInstalled } from '../features/settings/companionPresetReconciler';
import { readCompanionManifest } from '../features/steering/companionSteering';
import { readText } from '../features/workflows/projectSteps';
import { isNewerVersion } from './updateChecker';

/** Is the companion spec-kit extension missing, behind the version this build ships, or current? */
export type CompanionGap =
    | { state: 'missing' }
    | { state: 'current' }
    | { state: 'outdated'; installed: string; expected: string };

const REGISTRY_REL = '.specify/extensions/.registry';
const BUNDLED_MANIFEST_REL = path.join('speckit-extension', 'extension.yml');
const SEMVER = /^\d+\.\d+\.\d+$/;

function asSemver(value: unknown): string | undefined {
    return typeof value === 'string' && SEMVER.test(value) ? value : undefined;
}

function manifestVersion(parsed: unknown): string | undefined {
    return asSemver((parsed as { extension?: { version?: unknown } } | undefined)?.extension?.version);
}

/** `extension.version` from an `extension.yml` body; `undefined` when absent, malformed, or not `major.minor.patch`. */
export function parseManifestVersion(text: string): string | undefined {
    try {
        return manifestVersion(yaml.load(text));
    } catch {
        return undefined;
    }
}

/** `extensions.companion.version` from a `.registry` body; `undefined` when absent or malformed. */
export function parseRegistryVersion(text: string): string | undefined {
    try {
        const parsed = JSON.parse(text) as { extensions?: { companion?: { version?: unknown } } } | undefined;
        return asSemver(parsed?.extensions?.companion?.version);
    } catch {
        return undefined;
    }
}

let bundled: { extensionPath: string; version: string } | undefined;

/** The version this build of the VS Code extension ships, read once per process from its own bundled manifest. */
export function readBundledCompanionVersion(extensionPath: string): string | undefined {
    if (bundled?.extensionPath !== extensionPath) {
        const text = readText(path.join(extensionPath, BUNDLED_MANIFEST_REL));
        const version = text === undefined ? undefined : parseManifestVersion(text);
        bundled = version ? { extensionPath, version } : undefined;
    }
    return bundled?.version;
}

/** The version installed in the workspace: the installed manifest first (a `--dev` link keeps it current), the spec-kit registry as fallback. */
export function readInstalledCompanionVersion(workspaceRoot: string): string | undefined {
    const fromManifest = manifestVersion(readCompanionManifest(workspaceRoot));
    if (fromManifest) {
        return fromManifest;
    }
    const registry = readText(path.join(workspaceRoot, REGISTRY_REL));
    return registry === undefined ? undefined : parseRegistryVersion(registry);
}

/** Pure three-state decision. An unreadable version on either side reads as `current`, never as out of date. */
export function computeCompanionGap(
    installed: boolean,
    installedVersion: string | undefined,
    expectedVersion: string | undefined
): CompanionGap {
    if (!installed) {
        return { state: 'missing' };
    }
    if (installedVersion && expectedVersion && isNewerVersion(installedVersion, expectedVersion)) {
        return { state: 'outdated', installed: installedVersion, expected: expectedVersion };
    }
    return { state: 'current' };
}

/** Compare the workspace's installed spec-kit extension against the version bundled in this build. Local files only, no network. */
export function resolveCompanionGap(workspaceRoot: string, extensionPath: string): CompanionGap {
    return computeCompanionGap(
        isCompanionInstalled(workspaceRoot),
        readInstalledCompanionVersion(workspaceRoot),
        readBundledCompanionVersion(extensionPath)
    );
}

let installDeadline = 0;

/** Called when an install is dispatched: for the next minute an empty extension dir is a `--force` reinstall mid-copy, not an uninstall. */
export function markInstallInFlight(): void {
    installDeadline = Date.now() + 60_000;
}

/** True while a dispatched install is plausibly still copying files. */
export function isInstallInFlight(): boolean {
    return Date.now() < installDeadline;
}

/** Called once a refresh sees the extension present again. */
export function clearInstallInFlight(): void {
    installDeadline = 0;
}

let lastGap: { key: string; gap: CompanionGap } | undefined;

const gapKey = (workspaceRoot: string, extensionPath: string): string => `${workspaceRoot}\u0000${extensionPath}`;

/** Resolve from disk and remember the answer; activation, the watchers and a workspace-folder change call this once per tick. */
export function refreshCompanionGap(workspaceRoot: string, extensionPath: string): CompanionGap {
    const key = gapKey(workspaceRoot, extensionPath);
    const gap = resolveCompanionGap(workspaceRoot, extensionPath);
    // `--force` deletes the extension dir before it copies the new one. Caching that gap would show every
    // banner the install pitch mid-update, so the last known answer stands until the copy lands.
    if (gap.state === 'missing' && isInstallInFlight() && lastGap?.key === key) {
        return lastGap.gap;
    }
    lastGap = { key, gap };
    return gap;
}

/** The gap the last refresh saw for this workspace, resolving from disk when it was for another one (or none yet). */
export function cachedCompanionGap(workspaceRoot: string, extensionPath: string): CompanionGap {
    return lastGap?.key === gapKey(workspaceRoot, extensionPath)
        ? lastGap.gap
        : refreshCompanionGap(workspaceRoot, extensionPath);
}
