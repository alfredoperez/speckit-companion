"use strict";
/**
 * runtime-homes.cts — canonical runtime → global config/skills directory mapping.
 *
 * Single source of truth for resolving the global config base directory and
 * the correct global skills directory for every GSD-supported runtime.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/runtime-homes.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved
 * byte-for-behaviour from the prior hand-written .cjs; only types are added.
 *
 * Runtime-specific notes:
 *   hermes  — GSD skills nest under skills/gsd/<skillName>/ (not the flat
 *             skills/<skillName>/ layout used by all other runtimes).
 *   cline   — Skills-capable since v3.48.0 (#782). SKILL.md files live at
 *             ~/.cline/skills/<skillName>/SKILL.md (same flat layout as cursor/codex).
 *             .clinerules is also emitted (rules-based compatibility layer).
 *   kimi    — Agent Skills are discovered from Kimi's generic user roots:
 *             ~/.config/agents/skills (recommended) then ~/.agents/skills,
 *             with Kimi selecting the first existing generic skills directory.
 *             ~/.kimi-code/skills is brand-specific and can be selected as a
 *             GSD write target with --config-dir or KIMI_CONFIG_DIR.
 *   trae    — Targets Trae IDE (trae.ai), the Electron-based IDE — NOT
 *             trae-agent (github.com/bytedance/trae-agent), a Python CLI that
 *             uses trae_config.yaml, has no ~/.trae directory, and has no
 *             skills system. Both are ByteDance "Trae" products; they are
 *             entirely distinct. The global ~/.trae/skills/ path is
 *             community-soft-confirmed: docs.trae.ai/ide/skills documents the
 *             SKILL.md format and project-level .trae/skills/, but does NOT
 *             publish the global on-disk path; ~/.trae/skills/ rests on
 *             community evidence incl. Trae-AI/TRAE#2253. Best-effort only.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConfigHomeFromDescriptor = resolveConfigHomeFromDescriptor;
exports.resolveAntigravityGlobalDir = resolveAntigravityGlobalDir;
exports.detectAntigravityDirAmbiguity = detectAntigravityDirAmbiguity;
exports.resolveKimiGlobalDir = resolveKimiGlobalDir;
exports.getGlobalConfigDir = getGlobalConfigDir;
exports.resolveSkillsBaseFromDescriptor = resolveSkillsBaseFromDescriptor;
exports.getGlobalSkillsBase = getGlobalSkillsBase;
exports.getGlobalSkillDir = getGlobalSkillDir;
exports.getGlobalSkillDisplayPath = getGlobalSkillDisplayPath;
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
/**
 * Expand a leading ~ to os.homedir().
 */
function expandTilde(p) {
    if (!p)
        return p;
    if (p.startsWith('~/') || p === '~')
        return node_path_1.default.join(node_os_1.default.homedir(), p.slice(1));
    return p;
}
function resolveDescriptorWithOptions(configHome) {
    return resolveConfigHomeFromDescriptor(configHome, {
        env: process.env,
        home: node_os_1.default.homedir(),
        existsSync: node_fs_1.default.existsSync,
    });
}
function getRegistry() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./capability-registry.cjs');
}
/**
 * Resolve a configHome descriptor to an absolute directory path.
 *
 * Implements the four descriptor kinds:
 *   - dot-home:           env-override → path.join(home, name)
 *   - dot-home-nested:    env-override → probed subdir of path.join(home, parent)
 *   - xdg:                env[0] → env[1](dirname) → env[2](XDG subdir) → ~/.config/<name>
 *   - generic-agents-root:env[0] → first probe where probeExists exists → probe[0]
 */
function resolveConfigHomeFromDescriptor(configHome, opts = {}) {
    const env = opts.env ?? process.env;
    const home = opts.home ?? node_os_1.default.homedir();
    const existsSyncFn = opts.existsSync ?? node_fs_1.default.existsSync;
    switch (configHome.kind) {
        case 'dot-home': {
            // First env var that is set wins
            for (const varName of configHome.env) {
                const val = env[varName];
                if (val)
                    return expandTilde(val);
            }
            return node_path_1.default.join(home, configHome.name);
        }
        case 'dot-home-nested': {
            // env override
            const nestedEnv0Val = env[configHome.env[0]];
            if (configHome.env[0] && nestedEnv0Val) {
                return expandTilde(nestedEnv0Val);
            }
            const base = node_path_1.default.join(home, configHome.parent);
            if (configHome.probe && configHome.probe.length > 0) {
                // Pass 1 (marker-priority): when probeExists is declared, prefer the
                // candidate GSD actually owns (its `<candidate>/<probeExists>` exists).
                // This disambiguates an active-but-shadowing sibling dir (e.g. the
                // Antigravity-IDE `~/.gemini/antigravity` dir) from the dir GSD was
                // installed into, instead of blindly taking the first dir that exists.
                if (configHome.probeExists) {
                    for (const candidate of configHome.probe) {
                        const resolved = node_path_1.default.join(base, candidate);
                        if (existsSyncFn(node_path_1.default.join(resolved, configHome.probeExists))) {
                            return resolved;
                        }
                    }
                }
                // Pass 2 (legacy bare-existence): first candidate dir that exists.
                for (const candidate of configHome.probe) {
                    const resolved = node_path_1.default.join(base, candidate);
                    if (existsSyncFn(resolved))
                        return resolved;
                }
                // fallback: first probe candidate
                return node_path_1.default.join(base, configHome.probe[0]);
            }
            // no probe (e.g. windsurf): always name under parent
            return node_path_1.default.join(base, configHome.name);
        }
        case 'xdg': {
            // env[0]: direct override dir
            const xdgEnv0Val = env[configHome.env[0]];
            if (configHome.env[0] && xdgEnv0Val) {
                return expandTilde(xdgEnv0Val);
            }
            // env[1]: FILE path → dirname
            const xdgEnv1Val = env[configHome.env[1]];
            if (configHome.env[1] && xdgEnv1Val) {
                return node_path_1.default.dirname(expandTilde(xdgEnv1Val));
            }
            // env[2]: XDG_CONFIG_HOME → subdir
            const xdgEnv2Val = env[configHome.env[2]];
            if (configHome.env[2] && xdgEnv2Val) {
                return node_path_1.default.join(expandTilde(xdgEnv2Val), configHome.name);
            }
            return node_path_1.default.join(home, '.config', configHome.name);
        }
        case 'generic-agents-root': {
            // env override
            const garEnv0Val = env[configHome.env[0]];
            if (configHome.env[0] && garEnv0Val) {
                return expandTilde(garEnv0Val);
            }
            // probe each candidate; return first where probeExists subpath exists
            for (const candidate of configHome.probe) {
                const resolved = expandTildeWithHome(candidate, home);
                if (existsSyncFn(node_path_1.default.join(resolved, configHome.probeExists))) {
                    return resolved;
                }
            }
            // fallback: first probe candidate
            return expandTildeWithHome(configHome.probe[0], home);
        }
    }
}
/**
 * Expand ~ using an explicit home directory (for hermetic testing).
 */
function expandTildeWithHome(p, home) {
    if (!p)
        return p;
    if (p.startsWith('~/') || p === '~')
        return node_path_1.default.join(home, p.slice(1));
    return p;
}
/**
 * Resolve Antigravity global config dir across 1.x and 2.x layouts.
 *
 * Thin wrapper delegating to resolveConfigHomeFromDescriptor with the
 * antigravity descriptor shape. Preserved for external callers and tests.
 */
function resolveAntigravityGlobalDir(opts = {}) {
    const env = opts.env ?? process.env;
    const home = opts.home ?? node_os_1.default.homedir();
    const existsSyncFn = opts.existsSync ?? node_fs_1.default.existsSync;
    return resolveConfigHomeFromDescriptor({
        kind: 'dot-home-nested',
        name: 'antigravity',
        parent: '.gemini',
        env: ['ANTIGRAVITY_CONFIG_DIR'],
        probe: ['antigravity', 'antigravity-ide', 'antigravity-cli'],
        // Prefer the candidate GSD installed into (carries gsd-core/VERSION) over
        // a bare-existing sibling. Without this, a CLI user (antigravity-cli) who
        // also has the IDE's ~/.gemini/antigravity dir is shadowed to the legacy
        // dir because it is probed first. See #213/#217. The posix-slash literal
        // matches capabilities/antigravity/capability.json; both normalize via
        // path.join at the check site, so Windows backslash handling is covered.
        probeExists: 'gsd-core/VERSION',
    }, { env, home, existsSync: existsSyncFn });
}
/**
 * Detect whether the Antigravity config-dir resolution is ambiguous — i.e. more
 * than one of ~/.gemini/{antigravity,antigravity-ide,antigravity-cli} exists, so
 * a user upgrading from a pre-#217 install may have had GSD written into the
 * wrong sibling dir (the legacy/IDE dir shadowing an active CLI dir).
 *
 * This is a pure, side-effect-free probe intended for the installer and
 * /gsd-update to surface operator guidance (set ANTIGRAVITY_CONFIG_DIR or move
 * gsd-core/ into the intended dir). The migration framework cannot relocate an
 * install across sibling config dirs (it is bounded to a single configDir and
 * has no cross-dir move primitive — see installer-migrations 004), so existing
 * misinstalls are corrected by re-detection + operator guidance, not an
 * automatic move.
 */
function detectAntigravityDirAmbiguity(opts = {}) {
    const env = opts.env ?? process.env;
    const home = opts.home ?? node_os_1.default.homedir();
    const existsSyncFn = opts.existsSync ?? node_fs_1.default.existsSync;
    const marker = node_path_1.default.join('gsd-core', 'VERSION');
    const base = node_path_1.default.join(home, '.gemini');
    const candidates = ['antigravity', 'antigravity-ide', 'antigravity-cli'].map((c) => node_path_1.default.join(base, c));
    const presentDirs = candidates.filter((dir) => existsSyncFn(dir));
    const gsdMarkedDirs = candidates.filter((dir) => existsSyncFn(node_path_1.default.join(dir, marker)));
    return {
        ambiguous: presentDirs.length > 1,
        resolved: resolveAntigravityGlobalDir({ env, home, existsSync: existsSyncFn }),
        presentDirs,
        gsdMarkedDirs,
        envOverridden: Boolean(env['ANTIGRAVITY_CONFIG_DIR']),
    };
}
/**
 * Resolve Kimi's generic user root using Kimi CLI's documented first-existing
 * generic skills directory policy:
 *
 *   1. ~/.config/agents/skills  (recommended)
 *   2. ~/.agents/skills
 *
 * If neither generic skills directory exists yet, install to the recommended
 * ~/.config/agents root so the generated skills become the first generic
 * candidate Kimi discovers.
 *
 * KIMI_CONFIG_DIR is a GSD installer write-location override. It is not Kimi's
 * upstream data-root variable, and arbitrary roots are discoverable by Kimi only
 * when the user also configures Kimi --skills-dir or extra_skill_dirs.
 *
 * Thin wrapper delegating to resolveConfigHomeFromDescriptor with the
 * kimi descriptor shape. Preserved for external callers and tests.
 */
function resolveKimiGlobalDir(opts = {}) {
    const env = opts.env ?? process.env;
    const home = opts.home ?? node_os_1.default.homedir();
    const existsSyncFn = opts.existsSync ?? node_fs_1.default.existsSync;
    return resolveConfigHomeFromDescriptor({
        kind: 'generic-agents-root',
        name: 'agents',
        env: ['KIMI_CONFIG_DIR'],
        probe: ['~/.config/agents', '~/.agents'],
        probeExists: 'skills',
    }, { env, home, existsSync: existsSyncFn });
}
/**
 * Return the global config base directory for the given runtime.
 * Respects the same env-var overrides as bin/install.js getGlobalDir().
 *
 * @param runtime   - The runtime identifier (e.g. 'claude', 'opencode').
 * @param explicitDir - If provided and non-empty, returned immediately after
 *   tilde-expansion, overriding all env-var and default logic. This matches
 *   the behaviour of bin/install.js getGlobalDir(runtime, explicitDir).
 */
function getGlobalConfigDir(runtime, explicitDir) {
    if (explicitDir)
        return expandTilde(explicitDir);
    // ── Grok: not in the registry — hardcoded branch ─────────────────────────
    if (runtime === 'grok') {
        const env = process.env;
        return env['GROK_AGENTS_HOME'] ? expandTilde(env['GROK_AGENTS_HOME']) : node_path_1.default.join(node_os_1.default.homedir(), '.agents');
    }
    // ── Descriptor-driven: look up in capability-registry ────────────────────
    const { runtimes } = getRegistry();
    const runtimeEntry = runtimes[runtime];
    if (runtimeEntry?.runtime?.configHome) {
        return resolveDescriptorWithOptions(runtimeEntry.runtime.configHome);
    }
    // ── Default (unknown runtime → Claude fallback) ───────────────────────────
    const env = process.env;
    return env['CLAUDE_CONFIG_DIR'] ? expandTilde(env['CLAUDE_CONFIG_DIR']) : node_path_1.default.join(node_os_1.default.homedir(), '.claude');
}
/**
 * Return the global skills base directory for the given runtime.
 * Descriptor-backed runtimes derive the base home from configHome.skillsHome
 * when present, then append the first global skills artifact destSubpath.
 */
function resolveSkillsBaseFromDescriptor(configHome, opts = {}, skillsDestSubpath = 'skills') {
    const baseDescriptor = configHome.skillsHome ?? configHome;
    const base = resolveConfigHomeFromDescriptor(baseDescriptor, opts);
    return node_path_1.default.join(base, skillsDestSubpath);
}
function getGlobalSkillsBase(runtime) {
    const runtimeEntry = getRegistry().runtimes[runtime];
    const descriptor = runtimeEntry?.runtime;
    const globalSkillsKind = descriptor?.artifactLayout?.global?.find((entry) => entry.kind === 'skills');
    if (descriptor?.configHome && globalSkillsKind?.destSubpath) {
        return resolveSkillsBaseFromDescriptor(descriptor.configHome, { env: process.env, home: node_os_1.default.homedir(), existsSync: node_fs_1.default.existsSync }, globalSkillsKind.destSubpath);
    }
    const configDir = getGlobalConfigDir(runtime);
    return node_path_1.default.join(configDir, 'skills');
}
/**
 * Return the full path to a specific skill's directory for the given runtime.
 */
function getGlobalSkillDir(runtime, skillName) {
    const base = getGlobalSkillsBase(runtime);
    if (base === null)
        return null;
    return node_path_1.default.join(base, skillName);
}
/**
 * Return a human-readable display path for a global skill (for log messages).
 */
function getGlobalSkillDisplayPath(runtime, skillName) {
    const dir = getGlobalSkillDir(runtime, skillName);
    if (!dir)
        return `(${runtime} does not use a skills directory)`;
    // Replace homedir prefix with ~ for readability
    const home = node_os_1.default.homedir();
    return dir.startsWith(home) ? '~' + dir.slice(home.length) : dir;
}
