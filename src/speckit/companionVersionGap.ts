import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { isCompanionInstalled } from '../features/settings/companionPresetReconciler';
import { isNewerVersion } from './updateChecker';

/** Is the companion spec-kit extension missing, behind the version this build ships, or current? */
export type CompanionGap =
    | { state: 'missing' }
    | { state: 'current' }
    | { state: 'outdated'; installed: string; expected: string };

const REGISTRY_REL = '.specify/extensions/.registry';
const INSTALLED_MANIFEST_REL = '.specify/extensions/companion/extension.yml';
const BUNDLED_MANIFEST_REL = path.join('speckit-extension', 'extension.yml');
const SEMVER = /^\d+\.\d+\.\d+$/;

function asSemver(value: unknown): string | undefined {
    return typeof value === 'string' && SEMVER.test(value) ? value : undefined;
}

/** `extension.version` from an `extension.yml` body; `undefined` when absent, malformed, or not `major.minor.patch`. */
export function parseManifestVersion(text: string): string | undefined {
    try {
        const parsed = yaml.load(text) as { extension?: { version?: unknown } } | undefined;
        return asSemver(parsed?.extension?.version);
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

function readText(file: string): string | undefined {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
}

/** The version this build of the VS Code extension ships, read from its own bundled manifest. */
export function readBundledCompanionVersion(extensionPath: string): string | undefined {
    const text = readText(path.join(extensionPath, BUNDLED_MANIFEST_REL));
    return text === undefined ? undefined : parseManifestVersion(text);
}

/** The version installed in the workspace: the spec-kit registry first, the installed manifest as fallback. */
export function readInstalledCompanionVersion(workspaceRoot: string): string | undefined {
    const registry = readText(path.join(workspaceRoot, REGISTRY_REL));
    const fromRegistry = registry === undefined ? undefined : parseRegistryVersion(registry);
    if (fromRegistry) {
        return fromRegistry;
    }
    const manifest = readText(path.join(workspaceRoot, INSTALLED_MANIFEST_REL));
    return manifest === undefined ? undefined : parseManifestVersion(manifest);
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
