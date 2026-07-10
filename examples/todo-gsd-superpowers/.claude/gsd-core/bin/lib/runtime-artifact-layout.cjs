'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
/**
 * Runtime artifact layout module — resolves the artifact directory shapes
 * (commands, agents, skills) for each supported runtime.
 *
 * grok is intentionally absent: it is in runtime-homes.cjs but has no runtime
 * capability descriptor. The TypeError on unknown runtime is the loud-fail
 * signal that a runtime was added without an artifact layout descriptor.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/runtime-artifact-layout.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only types are added.
 */
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const installProfiles = require("./install-profiles.cjs");
const { stageSkillsForProfile, stageAgentsForProfile, stageAgentsForRuntimeWithConverter, stageSkillsForRuntimeAsSkills, stageCommandsForRuntimeFlat, } = installProfiles;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runtimeArtifactConversion = require("./runtime-artifact-conversion.cjs");
const conversionExports = runtimeArtifactConversion;
// In .cts (CommonJS output) files, `require` is available as a global.
const _require = require;
// ---------------------------------------------------------------------------
// Source root finders
// ---------------------------------------------------------------------------
/**
 * Locate the GSD commands/gsd source directory.
 *
 * Resolution order:
 * 1. If runtimeConfigDir provided, check <runtimeConfigDir>/.gsd-source marker.
 * 2. Walk up from __dirname using path.dirname (no literal .. segments).
 * 3. Throw a descriptive error if neither succeeds.
 */
function findInstallSourceRoot(runtimeConfigDir) {
    // Step 1: marker check
    if (runtimeConfigDir) {
        const markerPath = node_path_1.default.join(runtimeConfigDir, '.gsd-source');
        if (node_fs_1.default.existsSync(markerPath)) {
            try {
                const src = node_fs_1.default.readFileSync(markerPath, 'utf8').trim();
                if (src && node_fs_1.default.existsSync(src))
                    return src;
            }
            catch { /* fall through */ }
        }
    }
    // Step 2: walk up from __dirname
    let dir = __dirname;
    for (let i = 0; i < 6; i++) {
        const candidate = node_path_1.default.join(dir, 'commands', 'gsd');
        if (node_fs_1.default.existsSync(candidate))
            return candidate;
        const parent = node_path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    throw new Error(`findInstallSourceRoot: could not locate commands/gsd from ${__dirname}`);
}
/**
 * Locate the GSD agents source directory.
 *
 * Resolution order:
 * 1. If runtimeConfigDir provided, check <runtimeConfigDir>/.gsd-source marker.
 * 2. Walk up from __dirname using path.dirname (no literal .. segments).
 * 3. Throw a descriptive error if neither succeeds.
 */
function findAgentsSourceRoot(runtimeConfigDir) {
    // Step 1: marker check
    if (runtimeConfigDir) {
        const markerPath = node_path_1.default.join(runtimeConfigDir, '.gsd-source');
        if (node_fs_1.default.existsSync(markerPath)) {
            try {
                const src = node_fs_1.default.readFileSync(markerPath, 'utf8').trim();
                if (src && node_fs_1.default.existsSync(src)) {
                    // Marker points to commands/gsd; agents/ is a sibling of commands/
                    const agentsCandidate = node_path_1.default.resolve(node_path_1.default.dirname(src), '..', 'agents');
                    if (node_fs_1.default.existsSync(agentsCandidate))
                        return agentsCandidate;
                }
            }
            catch { /* fall through */ }
        }
    }
    // Step 2: walk up from __dirname
    let dir = __dirname;
    for (let i = 0; i < 6; i++) {
        const candidate = node_path_1.default.join(dir, 'agents');
        if (node_fs_1.default.existsSync(candidate))
            return candidate;
        const parent = node_path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    throw new Error(`findAgentsSourceRoot: could not locate agents/ from ${__dirname}`);
}
// ---------------------------------------------------------------------------
// Layout table builders
// ---------------------------------------------------------------------------
function commandsKind(destSubpath, prefix, configDir) {
    return {
        kind: 'commands',
        destSubpath,
        prefix,
        stage: (resolved) => stageSkillsForProfile(findInstallSourceRoot(configDir), resolved),
    };
}
function agentsKind(destSubpath, prefix, configDir) {
    return {
        kind: 'agents',
        destSubpath,
        prefix,
        stage: (resolved) => stageAgentsForProfile(findAgentsSourceRoot(configDir), resolved),
    };
}
/**
 * Build a converted-agents kind descriptor for runtimes whose agent `.md` files
 * need runtime-specific frontmatter/body conversion (e.g. Copilot, Cursor, Codex).
 *
 * Unlike `agentsKind` (which raw-copies source files), this kind applies
 * `converterName` from Runtime Artifact Conversion exports to each agent file
 * during staging, writing flat `${name}.md` files to the staged directory.
 *
 * Agent filenames are preserved verbatim (the prefix is already embedded in the
 * agent stem — e.g. `gsd-planner.md`).
 *
 * #1173 SCOPE — plumbing only (declarations deferred): this provides the
 * converter dispatch + `isGlobal` scope threading for the descriptor's `agents`
 * kind, but NO runtime currently declares a converted `agents` kind in its
 * `capability.json`. The descriptor declarations for the 8 non-Claude runtimes
 * (copilot/antigravity/cursor/windsurf/augment/trae/codebuddy/cline) are
 * DEFERRED to a follow-up that first ships the ADR-1235 §0 byte-for-byte parity
 * harness, because the second `layout.kinds` consumer — `applySurface` /
 * `/gsd:surface` / `--materialize` (`src/surface.cts`) — does not yet mirror the
 * legacy agent pipeline (Copilot's `.agent.md` filename rename, the cross-cutting
 * path-prefix rewrite + attribution, stale-file cleanup, config-reading steps),
 * so declaring the kind now would regress the surface path. Until then the legacy
 * `bin/install.js` agent loop remains authoritative for the real install, and
 * this `convertedAgentsKind` is exercised only by synthetic-descriptor seam tests.
 *
 * Mirrors the `convertedCommandsKind` pattern (#785).
 *
 * @param destSubpath   destination subpath within configDir (e.g. 'agents')
 * @param prefix        filename prefix (informational; not applied here)
 * @param converterName name of converter function in Runtime Artifact Conversion exports
 * @param configDir     runtime config dir (for .gsd-source marker resolution)
 */
function convertedAgentsKind(destSubpath, prefix, converterName, configDir, scope = 'global') {
    return {
        kind: 'agents',
        destSubpath,
        prefix,
        stage: (resolved) => {
            // isGlobal is threaded so scope-aware agent converters (copilot, antigravity)
            // choose global-home vs workspace-relative paths; converters that only take
            // (content) ignore the extra positional arg. Mirrors skillsKind's scope
            // threading (#1173).
            const converter = conversionExports[converterName];
            return stageAgentsForRuntimeWithConverter(findAgentsSourceRoot(configDir), resolved, converter, scope === 'global');
        },
    };
}
function kimiAgentsKind(destSubpath, prefix, configDir) {
    return {
        kind: 'kimi-agents',
        destSubpath,
        prefix,
        stage: (resolved) => {
            const buildKimiAgentArtifacts = conversionExports['buildKimiAgentArtifacts'];
            const stagedAgents = stageAgentsForProfile(findAgentsSourceRoot(configDir), resolved);
            const subagents = [];
            if (node_fs_1.default.existsSync(stagedAgents)) {
                for (const entry of node_fs_1.default.readdirSync(stagedAgents, { withFileTypes: true })) {
                    if (!entry.isFile() || !entry.name.endsWith('.md'))
                        continue;
                    const agentPath = node_path_1.default.join(stagedAgents, entry.name);
                    subagents.push({
                        path: node_path_1.default.join('agents', entry.name).replace(/\\/g, '/'),
                        content: node_fs_1.default.readFileSync(agentPath, 'utf8'),
                    });
                }
            }
            const rootAgent = `---\nname: gsd\ndescription: Run GSD workflows in Kimi CLI.\ntools: Agent\n---\n\n# GSD for Kimi CLI\n\nCoordinate installed /skill:gsd-* workflows and route work to generated GSD subagents when a workflow requires an agent handoff.\n`;
            const artifacts = buildKimiAgentArtifacts({ rootAgent, subagents });
            const stageDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), 'gsd-kimi-agents-'));
            installProfiles.STAGED_DIRS.add(stageDir);
            node_fs_1.default.writeFileSync(node_path_1.default.join(stageDir, 'gsd.yaml'), artifacts.root.yaml);
            node_fs_1.default.writeFileSync(node_path_1.default.join(stageDir, 'gsd.md'), artifacts.root.prompt);
            const subagentsDir = node_path_1.default.join(stageDir, 'subagents');
            node_fs_1.default.mkdirSync(subagentsDir, { recursive: true });
            for (const artifact of artifacts.subagents) {
                node_fs_1.default.writeFileSync(node_path_1.default.join(subagentsDir, `${artifact.name}.yaml`), artifact.yaml);
                node_fs_1.default.writeFileSync(node_path_1.default.join(subagentsDir, `${artifact.name}.md`), artifact.prompt);
            }
            return stageDir;
        },
    };
}
/**
 * Build a skills kind descriptor.
 *
 * @param destSubpath
 * @param prefix
 * @param converterName  name of converter function in Runtime Artifact Conversion exports
 * @param runtime        canonical runtime ID (gates Hermes/Qwen branding in converter)
 * @param configDir      runtime config dir (for .gsd-source marker resolution)
 * @param nested         if true, nest concrete skills under their ns-* routers (#69)
 * @param scope          install scope; converted to isGlobal and passed as 5th positional
 *                       arg so scope-aware converters (antigravity, copilot) can choose
 *                       between global home paths and workspace-relative paths without
 *                       colliding with the `runtime` string at position 3.
 */
function skillsKind(destSubpath, prefix, converterName, runtime, configDir, nested = false, scope = 'global') {
    return {
        kind: 'skills',
        destSubpath,
        prefix,
        stage: (resolved) => {
            const realConverter = conversionExports[converterName];
            // Compute cmdNames once per stage call for performance (#3583).
            // Extra trailing args are ignored by converters that don't need them. The
            // isGlobal flag is the 5th positional (NOT the 3rd): the 3rd positional is
            // `runtime` for the claude/kimi/cline converters, so the scope-aware
            // converters (antigravity, copilot) read isGlobal from position 5 to avoid
            // colliding with `runtime` and always taking the global branch.
            const cmdNames = conversionExports.readGsdCommandNames
                ? conversionExports.readGsdCommandNames()
                : [];
            const isGlobal = scope === 'global';
            const wrappedConverter = (content, skillName) => realConverter(content, skillName, runtime, cmdNames, isGlobal);
            return stageSkillsForRuntimeAsSkills(findInstallSourceRoot(configDir), resolved, wrappedConverter, prefix, nested);
        },
    };
}
/**
 * Build a converted-commands kind descriptor for runtimes that use a flat
 * commands directory with per-file conversion (e.g. Cursor 1.6 slash commands).
 *
 * Unlike `commandsKind` (which passes raw source files through), this kind
 * applies `converterName` from Runtime Artifact Conversion exports to each file during
 * staging, writing flat `${prefix}${stem}.md` files to the staged directory.
 *
 * The staged files are then written by `_copyStaged` (commands branch) which
 * handles prefix logic via the existing layout machinery.
 *
 * @param destSubpath   destination subpath within configDir (e.g. 'commands')
 * @param prefix        filename prefix, e.g. 'gsd-'
 * @param converterName name of converter function in Runtime Artifact Conversion exports
 * @param configDir     runtime config dir (for .gsd-source marker resolution)
 */
function convertedCommandsKind(destSubpath, prefix, converterName, configDir) {
    return {
        kind: 'commands',
        destSubpath,
        prefix,
        stage: (resolved) => {
            const converter = conversionExports[converterName];
            return stageCommandsForRuntimeFlat(findInstallSourceRoot(configDir), resolved, converter, prefix);
        },
    };
}
function getRegistry() {
    return _require('./capability-registry.cjs');
}
/**
 * Map a single ArtifactKindDescriptor entry to an ArtifactKind using the
 * matching builder function. Mirrors the hand-built calls in the old switch.
 */
function dispatchKindEntry(entry, runtime, configDir, scope) {
    const { kind, destSubpath, prefix, nesting, converter } = entry;
    const nested = nesting === 'nested';
    switch (kind) {
        case 'commands':
            if (converter == null) {
                return commandsKind(destSubpath, prefix, configDir);
            }
            return convertedCommandsKind(destSubpath, prefix, converter, configDir);
        case 'agents':
            if (converter == null) {
                return agentsKind(destSubpath, prefix, configDir);
            }
            return convertedAgentsKind(destSubpath, prefix, converter, configDir, scope);
        case 'skills':
            if (converter == null) {
                throw new TypeError(`resolveRuntimeArtifactLayout: skills entry for '${runtime}' has converter=null (converter is required for skills)`);
            }
            return skillsKind(destSubpath, prefix, converter, runtime, configDir, nested, scope);
        case 'kimi-agents':
            return kimiAgentsKind(destSubpath, prefix, configDir);
        default:
            throw new TypeError(`resolveRuntimeArtifactLayout: unknown kind '${kind}' in descriptor for runtime '${runtime}'`);
    }
}
/**
 * Resolve the artifact layout for a given runtime and config directory.
 *
 * ADR-857 phase 5d: driven by the capability-registry artifactLayout descriptor
 * instead of a hardcoded switch statement.
 */
function resolveRuntimeArtifactLayout(runtime, configDir, scope = 'global') {
    return resolveRuntimeArtifactLayoutFromRegistry(getRegistry(), runtime, configDir, scope);
}
function resolveRuntimeArtifactLayoutFromRegistry(registry, runtime, configDir, scope = 'global') {
    if (typeof configDir !== 'string' || configDir === '') {
        throw new TypeError('configDir must be a non-empty string');
    }
    if (scope !== 'local' && scope !== 'global') {
        throw new TypeError('scope must be "local" or "global"');
    }
    const desc = registry.runtimes[runtime]?.runtime?.artifactLayout;
    if (!desc) {
        throw new TypeError(`Unknown runtime: '${runtime}' — add to runtime-artifact-layout.cjs table`);
    }
    const entries = desc[scope] ?? [];
    const kinds = entries.map((entry) => dispatchKindEntry(entry, runtime, configDir, scope));
    return { runtime, configDir, scope, kinds };
}
module.exports = { resolveRuntimeArtifactLayout, resolveRuntimeArtifactLayoutFromRegistry, findInstallSourceRoot };
