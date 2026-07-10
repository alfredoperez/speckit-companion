"use strict";
/**
 * Model catalog — typed access to model-catalog.json.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/model-catalog.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved
 * byte-for-behaviour from the prior hand-written .cjs; only types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIMES_WITH_FAST_MODE = exports.EFFORT_RENDERING = exports.KNOWN_PROVIDERS = exports.PROVIDER_PRESETS = exports.RUNTIMES_WITH_REASONING_EFFORT = exports.KNOWN_RUNTIMES = exports.RUNTIME_PROFILE_MAP = exports.MODEL_ALIAS_MAP = exports.AGENT_DEFAULT_TIERS = exports.AGENT_TO_PHASE_TYPE = exports.MODEL_PROFILES = exports.VALID_AGENT_TIERS = exports.VALID_PHASE_TYPES = exports.VALID_PROFILES = exports.catalog = void 0;
exports.nextTier = nextTier;
exports.formatAgentToModelMapAsTable = formatAgentToModelMapAsTable;
exports.getAgentToModelMapForProfile = getAgentToModelMapForProfile;
exports.renderEffortForRuntime = renderEffortForRuntime;
const node_path_1 = __importDefault(require("node:path"));
// In .cts (CommonJS output) files, `require` is available as a global;
// we use it directly to load JSON candidates.
const _require = require;
// Resolve model-catalog.json via a prioritised candidate list so the module
// works in every layout:
//
//   1. Co-located install path — gsd-core/bin/shared/model-catalog.json
//   2. Source-repo dev path — sdk/shared/model-catalog.json
//   3. GSD_MODEL_CATALOG env override
const _catalogCandidates = [
    node_path_1.default.resolve(__dirname, '..', 'shared', 'model-catalog.json'),
    node_path_1.default.resolve(__dirname, '..', '..', '..', 'sdk', 'shared', 'model-catalog.json'),
    ...(process.env['GSD_MODEL_CATALOG'] ? [node_path_1.default.resolve(process.env['GSD_MODEL_CATALOG'])] : []),
];
let catalog = null;
let _catalogLastErr = null;
for (const _p of _catalogCandidates) {
    try {
        catalog = _require(_p);
        break;
    }
    catch (e) {
        const isMissingCandidate = (e && e.code === 'MODULE_NOT_FOUND' && String(e.message || '').includes(_p)) ||
            (e && e.code === 'ENOENT');
        if (!isMissingCandidate)
            throw e;
        _catalogLastErr = e;
    }
}
if (!catalog) {
    throw new Error(`model-catalog.json not found. Tried:\n${_catalogCandidates.map((p) => `  ${p}`).join('\n')}\nLast error: ${_catalogLastErr?.message}`);
}
// After the throw guard above, catalog is guaranteed non-null.
const _catalog = catalog;
exports.catalog = _catalog;
exports.VALID_PROFILES = [..._catalog.profiles];
exports.VALID_PHASE_TYPES = new Set(_catalog.phaseTypes);
exports.VALID_AGENT_TIERS = new Set(Object.keys(_catalog.adaptiveTierMap));
exports.MODEL_PROFILES = Object.fromEntries(Object.entries(_catalog.agents).map(([agent, meta]) => [agent, {
        quality: meta.golden,
        balanced: meta.balanced,
        budget: meta.budget,
        adaptive: _catalog.adaptiveTierMap[meta.routingTier],
    }]));
exports.AGENT_TO_PHASE_TYPE = Object.fromEntries(Object.entries(_catalog.agents).map(([agent, meta]) => [agent, meta.phaseType]));
exports.AGENT_DEFAULT_TIERS = Object.fromEntries(Object.entries(_catalog.agents).map(([agent, meta]) => [agent, meta.routingTier]));
exports.MODEL_ALIAS_MAP = Object.fromEntries(Object.entries(_catalog.runtimeTierDefaults['claude'] ?? {}).map(([tier, entry]) => [tier, entry?.model]));
exports.RUNTIME_PROFILE_MAP = (() => {
    const result = {};
    for (const [runtime, tiers] of Object.entries(_catalog.runtimeTierDefaults)) {
        const filtered = {};
        for (const [tier, entry] of Object.entries(tiers)) {
            if (entry)
                filtered[tier] = entry;
        }
        if (Object.keys(filtered).length > 0)
            result[runtime] = filtered;
    }
    return result;
})();
exports.KNOWN_RUNTIMES = new Set(Object.keys(_catalog.runtimeTierDefaults));
exports.RUNTIMES_WITH_REASONING_EFFORT = new Set(Object.entries(_catalog.runtimeTierDefaults)
    .filter(([, tiers]) => Object.values(tiers).some((entry) => entry && entry.reasoning_effort))
    .map(([runtime]) => runtime));
exports.PROVIDER_PRESETS = _catalog.providerPresets ?? {};
// KNOWN_PROVIDERS excludes 'generic' — it is a sentinel (all null entries) that
// forces users to supply model IDs via model_profile_overrides. It is not a
// real catalog-backed provider (#49).
exports.KNOWN_PROVIDERS = new Set(Object.entries(exports.PROVIDER_PRESETS)
    .filter(([, tiers]) => Object.values(tiers).some((budgets) => budgets && Object.values(budgets).some((entry) => entry && entry.model)))
    .map(([name]) => name));
function nextTier(currentTier) {
    const order = ['light', 'standard', 'heavy'];
    const idx = order.indexOf(String(currentTier));
    if (idx === -1)
        return null;
    return order[Math.min(idx + 1, order.length - 1)];
}
function formatAgentToModelMapAsTable(agentToModelMap) {
    const agentWidth = Math.max('Agent'.length, ...Object.keys(agentToModelMap).map((a) => a.length));
    const modelWidth = Math.max('Model'.length, ...Object.values(agentToModelMap).map((m) => m.length));
    const sep = '─'.repeat(agentWidth + 2) + '┼' + '─'.repeat(modelWidth + 2);
    const header = ` ${'Agent'.padEnd(agentWidth)} │ ${'Model'.padEnd(modelWidth)}`;
    let out = `${header}\n${sep}\n`;
    for (const [agent, model] of Object.entries(agentToModelMap)) {
        out += ` ${agent.padEnd(agentWidth)} │ ${model.padEnd(modelWidth)}\n`;
    }
    return out;
}
function getAgentToModelMapForProfile(normalizedProfile) {
    const profile = exports.VALID_PROFILES.includes(normalizedProfile) ? normalizedProfile : 'balanced';
    const out = {};
    for (const [agent, profiles] of Object.entries(exports.MODEL_PROFILES)) {
        const profilesRec = profiles;
        out[agent] = profile === 'inherit' ? 'inherit' : (profilesRec[profile] ?? profiles.balanced);
    }
    return out;
}
exports.EFFORT_RENDERING = {
    claude: {
        param: 'output_config.effort',
        channel: 'frontmatter',
        supported: new Set(['low', 'medium', 'high', 'xhigh', 'max']),
        clamp(level) {
            if (level === 'minimal')
                return 'low';
            return level;
        },
    },
    codex: {
        param: 'model_reasoning_effort',
        channel: 'api',
        supported: new Set(['minimal', 'low', 'medium', 'high', 'xhigh']),
        clamp(level) {
            if (level === 'max')
                return 'xhigh';
            return level;
        },
    },
};
/**
 * Render a universal effort string for a specific runtime.
 */
function renderEffortForRuntime(runtime, universalEffort) {
    const spec = exports.EFFORT_RENDERING[runtime];
    if (!spec) {
        return { value: universalEffort, param: null, channel: null };
    }
    return {
        value: spec.clamp(universalEffort),
        param: spec.param,
        channel: spec.channel,
    };
}
// ─── Fast mode propagation ───────────────────────────────────────────────────
exports.RUNTIMES_WITH_FAST_MODE = new Set(['api']);
