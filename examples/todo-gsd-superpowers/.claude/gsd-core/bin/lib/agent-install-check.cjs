"use strict";
/**
 * Agent Install Check — moved from core.cts (ADR-857 T0 #1268 phase rehome-core-squatters).
 *
 * Owns:
 *   - getAgentsDir(runtime?): string
 *   - checkAgentsInstalled(runtime?): AgentsInstalledResult
 *
 * The core.cjs re-export spine was retired in epic #1267; callers import
 * these symbols from agent-install-check.cjs directly.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelProfiles = require("./model-profiles.cjs");
const { MODEL_PROFILES } = modelProfiles;
const runtime_homes_cjs_1 = require("./runtime-homes.cjs");
/**
 * Resolve the agents directory for the given runtime.
 *
 * Priority:
 *   1. GSD_AGENTS_DIR env var (explicit override, any runtime)
 *   2. For claude runtime: __dirname-relative path (agents/ sibling of gsd-core/)
 *      This is correct for both repo runs and real installs (the runtime config dir's
 *      agents/ folder) because gsd-tools.cjs lives inside gsd-core/bin/ in both cases.
 *   3. For non-claude runtimes: getGlobalConfigDir(runtime)/agents
 *
 * @param runtime - the active runtime name; defaults to GSD_RUNTIME env, then 'claude'
 */
function getAgentsDir(runtime) {
    if (process.env['GSD_AGENTS_DIR']) {
        return process.env['GSD_AGENTS_DIR'];
    }
    const resolved = runtime ?? (process.env['GSD_RUNTIME'] || 'claude');
    if (resolved === 'claude') {
        return node_path_1.default.join(__dirname, '..', '..', '..', 'agents');
    }
    return node_path_1.default.join((0, runtime_homes_cjs_1.getGlobalConfigDir)(resolved), 'agents');
}
/**
 * Check which GSD agents are installed on disk.
 *
 * @param runtime - the active runtime name; defaults to GSD_RUNTIME env, then 'claude'
 */
function checkAgentsInstalled(runtime) {
    const resolvedRuntime = runtime ?? (process.env['GSD_RUNTIME'] || 'claude');
    const agentsDir = getAgentsDir(resolvedRuntime);
    const expectedAgents = Object.keys(MODEL_PROFILES);
    const installed = [];
    const missing = [];
    if (!node_fs_1.default.existsSync(agentsDir)) {
        return {
            agents_installed: false,
            missing_agents: expectedAgents,
            installed_agents: [],
            incomplete_agents: [],
            agents_dir: agentsDir,
            agent_runtime: resolvedRuntime,
        };
    }
    for (const agent of expectedAgents) {
        const agentFile = node_path_1.default.join(agentsDir, `${agent}.md`);
        const agentFileCopilot = node_path_1.default.join(agentsDir, `${agent}.agent.md`);
        const agentFileCodex = node_path_1.default.join(agentsDir, `${agent}.toml`);
        const agentFileKimiYaml = node_path_1.default.join(agentsDir, 'subagents', `${agent}.yaml`);
        const agentFileKimiPrompt = node_path_1.default.join(agentsDir, 'subagents', `${agent}.md`);
        const kimiAgentInstalled = resolvedRuntime === 'kimi' &&
            node_fs_1.default.existsSync(agentFileKimiYaml) &&
            node_fs_1.default.existsSync(agentFileKimiPrompt);
        if (node_fs_1.default.existsSync(agentFile) ||
            node_fs_1.default.existsSync(agentFileCopilot) ||
            node_fs_1.default.existsSync(agentFileCodex) ||
            kimiAgentInstalled) {
            installed.push(agent);
        }
        else {
            missing.push(agent);
        }
    }
    // ── Manifest-backed completeness check ──────────────────────────────────────
    // If a gsd-file-manifest.json exists alongside the agents dir (parent dir),
    // verify that every manifest-tracked file for each expected agent is present
    // on disk. Missing manifest-tracked files indicate an incomplete install even
    // when the plain presence check above passed (e.g. .md present, .toml absent).
    // If no manifest is found the check is a no-op (graceful for claude/bundled).
    const incomplete = [];
    const manifestPath = node_path_1.default.join(node_path_1.default.dirname(agentsDir), 'gsd-file-manifest.json');
    let manifestFiles = {};
    try {
        const raw = node_fs_1.default.readFileSync(manifestPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed !== null &&
            typeof parsed === 'object' &&
            'files' in parsed &&
            typeof parsed['files'] === 'object' &&
            parsed['files'] !== null) {
            manifestFiles = parsed['files'];
        }
    }
    catch {
        // No manifest or unreadable — completeness check is skipped
    }
    if (Object.keys(manifestFiles).length > 0) {
        for (const agent of expectedAgents) {
            // Find all manifest keys that belong to this agent:
            // key must be "agents/<agentName>.<ext>" with no further path segments.
            const agentPrefix = `agents/${agent}.`;
            const agentManifestKeys = Object.keys(manifestFiles).filter(key => {
                if (!key.startsWith(agentPrefix))
                    return false;
                const rest = key.slice(agentPrefix.length);
                // rest must be a bare extension (no slashes, non-empty)
                return rest.length > 0 && !rest.includes('/');
            });
            if (agentManifestKeys.length === 0) {
                // Agent not tracked in manifest — skip completeness check for this agent
                continue;
            }
            const allPresent = agentManifestKeys.every(key => {
                const basename = key.slice('agents/'.length);
                return node_fs_1.default.existsSync(node_path_1.default.join(agentsDir, basename));
            });
            if (!allPresent) {
                incomplete.push(agent);
            }
        }
    }
    return {
        agents_installed: installed.length > 0 && missing.length === 0 && incomplete.length === 0,
        missing_agents: missing,
        installed_agents: installed,
        incomplete_agents: incomplete,
        agents_dir: agentsDir,
        agent_runtime: resolvedRuntime,
    };
}
module.exports = {
    getAgentsDir,
    checkAgentsInstalled,
};
