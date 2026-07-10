"use strict";
/**
 * Configuration Module — legacy-key normalization, defaults merge, and explicit
 * on-disk migration. Pure normalization primitives consumed by config-loader.cjs
 * and config-schema.cjs. `loadConfig` was extracted to config-loader.cjs per
 * ADR-857 phase 2e (#885) and removed from this module per #893.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/configuration.cjs collapsed
 * to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only types are added.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DYNAMIC_KEY_PATTERNS = exports.RUNTIME_STATE_KEYS = exports.VALID_CONFIG_KEYS = exports.CONFIG_DEFAULTS = void 0;
exports.normalizeLegacyKeys = normalizeLegacyKeys;
exports.mergeDefaults = mergeDefaults;
exports.migrateOnDisk = migrateOnDisk;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
// In .cts (CommonJS output) files, `require` is available as a global.
const _require = require;
// ─── Manifest requires ───────────────────────────────────────────────────────
function loadConfigurationManifest(fileName) {
    const candidates = [
        // Installed runtime layout: gsd-core/bin/shared/*.manifest.json
        (0, node_path_1.join)(__dirname, '..', 'shared', fileName),
    ];
    let lastErr = null;
    for (const candidate of candidates) {
        try {
            return _require(candidate);
        }
        catch (err) {
            const e = err;
            const isMissingCandidate = e && e.code === 'MODULE_NOT_FOUND' && String(e.message || '').includes(candidate);
            if (!isMissingCandidate)
                throw err;
            lastErr = e;
        }
    }
    throw new Error(`${fileName} not found. Tried:\n${candidates.map((p) => `  ${p}`).join('\n')}\nLast error: ${lastErr?.message}`);
}
const CONFIG_DEFAULTS = loadConfigurationManifest('config-defaults.manifest.json');
exports.CONFIG_DEFAULTS = CONFIG_DEFAULTS;
const SCHEMA_MANIFEST = loadConfigurationManifest('config-schema.manifest.json');
const VALID_CONFIG_KEYS = new Set(SCHEMA_MANIFEST.validKeys);
exports.VALID_CONFIG_KEYS = VALID_CONFIG_KEYS;
const RUNTIME_STATE_KEYS = new Set(SCHEMA_MANIFEST.runtimeStateKeys);
exports.RUNTIME_STATE_KEYS = RUNTIME_STATE_KEYS;
const DYNAMIC_KEY_PATTERNS = SCHEMA_MANIFEST.dynamicKeyPatterns.map((p) => {
    const pattern = new RegExp(p.source);
    return {
        ...p,
        test: (key) => {
            pattern.lastIndex = 0;
            return pattern.test(key);
        },
    };
});
exports.DYNAMIC_KEY_PATTERNS = DYNAMIC_KEY_PATTERNS;
// ─── Depth → Granularity mapping ─────────────────────────────────────────────
const DEPTH_TO_GRANULARITY = {
    quick: 'coarse',
    standard: 'standard',
    comprehensive: 'fine',
};
// ─── Internal helpers ─────────────────────────────────────────────────────────
function planningDir(cwd, workstream) {
    if (!workstream)
        return (0, node_path_1.join)(cwd, '.planning');
    return (0, node_path_1.join)(cwd, '.planning', 'workstreams', workstream);
}
function detectSubRepos(cwd) {
    const results = [];
    try {
        const entries = (0, node_fs_1.readdirSync)(cwd, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (entry.name.startsWith('.') || entry.name === 'node_modules')
                continue;
            const gitPath = (0, node_path_1.join)(cwd, entry.name, '.git');
            try {
                if ((0, node_fs_1.existsSync)(gitPath)) {
                    results.push(entry.name);
                }
            }
            catch { /* ignore */ }
        }
    }
    catch { /* ignore */ }
    return results.sort();
}
function deepMergeConfig(base, overlay) {
    const result = { ...base };
    for (const key of Object.keys(overlay)) {
        const ov = overlay[key];
        if (ov !== null && ov !== undefined && typeof ov === 'object' && !Array.isArray(ov)) {
            const bv = base[key];
            if (bv !== null && bv !== undefined && typeof bv === 'object' && !Array.isArray(bv)) {
                result[key] = deepMergeConfig(bv, ov);
            }
            else {
                result[key] = deepMergeConfig({}, ov);
            }
        }
        else {
            result[key] = ov;
        }
    }
    return result;
}
// ─── Exported functions ───────────────────────────────────────────────────────
function normalizeLegacyKeys(parsed) {
    const result = { ...parsed };
    const normalizations = [];
    // 1. branching_strategy → git.branching_strategy
    if (Object.prototype.hasOwnProperty.call(result, 'branching_strategy')) {
        const value = result['branching_strategy'];
        const git = (result['git'] ?? {});
        if (git['branching_strategy'] === undefined) {
            result['git'] = { ...git, branching_strategy: value };
        }
        else {
            // canonical nested wins — just delete the stale top-level
            result['git'] = { ...git };
        }
        delete result['branching_strategy'];
        normalizations.push({ from: 'branching_strategy', to: 'git.branching_strategy', value });
    }
    // 2. top-level sub_repos → planning.sub_repos
    if (Object.prototype.hasOwnProperty.call(result, 'sub_repos')) {
        const value = result['sub_repos'];
        const planning = (result['planning'] ?? {});
        if (planning['sub_repos'] === undefined) {
            result['planning'] = { ...planning, sub_repos: value };
        }
        else {
            // canonical nested wins — just drop the stale top-level
            result['planning'] = { ...planning };
        }
        delete result['sub_repos'];
        normalizations.push({ from: 'sub_repos', to: 'planning.sub_repos', value });
    }
    // 3. multiRepo: true → marker (filesystem detection deferred to migrateOnDisk / caller)
    if (result['multiRepo'] === true) {
        delete result['multiRepo'];
        normalizations.push({ from: 'multiRepo', to: 'planning.sub_repos', value: true, requiresFilesystem: true });
    }
    // 4. top-level depth → granularity
    if (Object.prototype.hasOwnProperty.call(result, 'depth') && !Object.prototype.hasOwnProperty.call(result, 'granularity')) {
        const rawDepth = result['depth'];
        const mapped = DEPTH_TO_GRANULARITY[rawDepth] ?? rawDepth;
        result['granularity'] = mapped;
        delete result['depth'];
        normalizations.push({ from: 'depth', to: 'granularity', value: mapped });
    }
    return { parsed: result, normalizations };
}
function mergeDefaults(parsed) {
    // Start with a deep clone of defaults, then overlay parsed
    const defaults = structuredClone(CONFIG_DEFAULTS);
    return deepMergeConfig(defaults, parsed);
}
function migrateOnDisk(cwd, workstream) {
    const configPath = (0, node_path_1.join)(planningDir(cwd, workstream), 'config.json');
    let raw;
    try {
        raw = (0, node_fs_1.readFileSync)(configPath, 'utf-8');
    }
    catch {
        // File missing — nothing to migrate
        return { migrated: false, normalizations: [], wrote: null };
    }
    const trimmed = raw.trim();
    if (trimmed === '') {
        return { migrated: false, normalizations: [], wrote: null };
    }
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch {
        // Malformed — can't migrate
        return { migrated: false, normalizations: [], wrote: null };
    }
    const { parsed: normalized, normalizations } = normalizeLegacyKeys(parsed);
    if (normalizations.length === 0) {
        return { migrated: false, normalizations: [], wrote: null };
    }
    // Resolve multiRepo filesystem detection
    const result = { ...normalized };
    for (const norm of normalizations) {
        if (norm.requiresFilesystem) {
            const detected = detectSubRepos(cwd);
            if (detected.length > 0) {
                const planning = (result['planning'] ?? {});
                result['planning'] = { ...planning, sub_repos: detected, commit_docs: false };
            }
        }
    }
    try {
        (0, node_fs_1.writeFileSync)(configPath, JSON.stringify(result, null, 2));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to write migrated config at ${configPath}: ${msg}`);
    }
    return { migrated: true, normalizations, wrote: configPath };
}
