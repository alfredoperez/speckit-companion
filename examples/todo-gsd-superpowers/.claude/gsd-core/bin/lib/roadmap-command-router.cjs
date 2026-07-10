"use strict";
/**
 * Manifest-backed roadmap subcommand router.
 * Keeps gsd-tools.cjs thin while preserving existing command semantics.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/roadmap-command-router.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const command_aliases_cjs_1 = require("./command-aliases.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cjsCommandRouterAdapter = require("./cjs-command-router-adapter.cjs");
const { routeCjsCommandFamily } = cjsCommandRouterAdapter;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const roadmapUpgrade = require("./roadmap-upgrade.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planningWorkspace = require("./planning-workspace.cjs");
const { planningDir } = planningWorkspace;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const configLoaderMod = require("./config-loader.cjs");
const { loadConfig } = configLoaderMod;
// ─── W021 Implementation ──────────────────────────────────────────────────────
/**
 * Check each phase entry in a milestone-prefixed ROADMAP.md for W021 violations.
 *
 * W021: a phase whose ID integer prefix does not match its enclosing milestone's
 * major version number.
 *
 * Sentinel milestones (0 = pre-milestone, 999 = backlog) are exempt.
 *
 * @param content - ROADMAP.md content
 * @returns Array of W021 warnings
 */
function checkW021(content) {
    const warnings = [];
    // Sentinel milestone integers exempt from W021
    const SENTINELS = new Set([0, 999]);
    const MIGRATION_CMD = 'gsd-tools roadmap upgrade --convention milestone-prefixed';
    // Milestone section heading: ## [GSD] v2.0 — Label  OR  ## v2.0: Label  OR  ## Roadmap v2.0
    //   OR  ## ✅ v2.0  OR  ## 🚧 v2.0  (emoji-prefixed variants used by roadmap templates)
    // Capture the major integer.
    const MILESTONE_RE = /^#{1,3}\s+(?:\[[^\]]+\]\s+|Roadmap\s+|[✅🚧]\s*)?v(\d+)\.\d+(?:\s|:|\s*—)/iu;
    // Migrated phase heading: ### Phase M-NN: Name  (M-NN or unpadded M-N form)
    const PHASE_RE = /^#{2,4}\s*(?:\[[^\]]+\]\s*)?Phase\s+(\d+)-(\d+)(?:-\d+)*\s*:/i;
    // Unprefixed legacy phase heading: ### Phase N: Name  (no hyphen sub-index)
    const UNPREFIXED_PHASE_RE = /^#{2,4}\s*(?:\[[^\]]+\]\s*)?Phase\s+(\d+[A-Za-z]?(?:\.\d+)*)\s*:/i;
    let currentMilestoneMajor = null;
    const lines = content.split('\n');
    for (const line of lines) {
        const milestoneMatch = line.match(MILESTONE_RE);
        if (milestoneMatch) {
            currentMilestoneMajor = parseInt(milestoneMatch[1], 10);
            continue;
        }
        const phaseMatch = line.match(PHASE_RE);
        if (phaseMatch) {
            const phaseMajor = parseInt(phaseMatch[1], 10);
            if (SENTINELS.has(phaseMajor))
                continue; // exempt
            if (currentMilestoneMajor !== null && phaseMajor !== currentMilestoneMajor) {
                const phaseId = `${phaseMatch[1]}-${phaseMatch[2]}`;
                warnings.push({
                    code: 'W021',
                    message: `Phase ID prefix mismatch: phase "${phaseId}" is listed under v${currentMilestoneMajor}.x ` +
                        `but its prefix (${phaseMajor}) does not match. ` +
                        `Run \`${MIGRATION_CMD}\` to fix.`,
                });
            }
            continue;
        }
        // When the convention is active, an unprefixed heading (### Phase 1:) is itself a W021
        // violation — it is missing the required M-NN prefix entirely.
        const unprefixedMatch = line.match(UNPREFIXED_PHASE_RE);
        if (unprefixedMatch && currentMilestoneMajor !== null) {
            const rawId = unprefixedMatch[1];
            // Skip if it matched PHASE_RE already (it didn't reach here in that case)
            // Also skip if it looks like a bare integer whose prefix matches the section
            // — those pass; only non-matching or non-prefixed forms fire W021.
            const numericMajor = parseInt(rawId, 10);
            if (!SENTINELS.has(numericMajor)) {
                warnings.push({
                    code: 'W021',
                    message: `Phase ID "${rawId}" is not in M-NN form (milestone-prefixed convention is active). ` +
                        `Run \`${MIGRATION_CMD}\` to migrate.`,
                });
            }
        }
    }
    return warnings;
}
// ─── Router ───────────────────────────────────────────────────────────────────
function routeRoadmapCommand({ roadmap, args, cwd, raw, error }) {
    routeCjsCommandFamily({
        args,
        subcommands: command_aliases_cjs_1.ROADMAP_SUBCOMMANDS,
        unsupported: {},
        error,
        unknownMessage: (_subcommand, available) => `Unknown roadmap subcommand. Available: ${available.join(', ')}`,
        handlers: {
            'get-phase': () => roadmap.cmdRoadmapGetPhase(cwd, args[2], raw),
            analyze: () => roadmap.cmdRoadmapAnalyze(cwd, raw),
            'update-plan-progress': () => roadmap.cmdRoadmapUpdatePlanProgress(cwd, args[2], raw),
            'annotate-dependencies': () => roadmap.cmdRoadmapAnnotateDependencies(cwd, args[2], raw),
            'validate': () => {
                const roadmapPath = node_path_1.default.join(planningDir(cwd), 'ROADMAP.md');
                let roadmapContent = '';
                try {
                    roadmapContent = node_fs_1.default.readFileSync(roadmapPath, 'utf8');
                }
                catch {
                    // ROADMAP.md missing — return empty warnings
                }
                // W021 only fires when phase_id_convention is explicitly 'milestone-prefixed'.
                // Authoritative source: .planning/config.json (set by the upgrade command).
                // Fallback: ROADMAP.md frontmatter (for projects that set the field there directly).
                let convention;
                try {
                    const cfg = loadConfig(cwd);
                    convention = cfg['phase_id_convention'];
                }
                catch {
                    convention = undefined;
                }
                if (convention === undefined || convention === null) {
                    // Fallback: read from ROADMAP.md frontmatter
                    const fmMatch = roadmapContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
                    if (fmMatch) {
                        const kvMatch = fmMatch[1].match(/^phase_id_convention:\s*(.*)$/m);
                        if (kvMatch) {
                            const val = kvMatch[1].trim();
                            if (val !== 'null' && val !== '') {
                                convention = val.replace(/^["']|["']$/g, '');
                            }
                        }
                    }
                }
                const warnings = (convention === 'milestone-prefixed')
                    ? checkW021(roadmapContent)
                    : [];
                const result = { warnings };
                if (raw)
                    process.stdout.write(JSON.stringify(result));
                else
                    process.stdout.write(JSON.stringify(result, null, 2));
            },
            'upgrade': () => {
                const dryRun = !args.includes('--apply');
                // Parse `--convention <value>` and `--convention=<value>`. When the flag is
                // absent entirely, default to the only supported convention; when present
                // with a missing/unsupported value, fall through to the rejection below
                // (fail-closed — never silently run a migration the user did not request).
                let convention = 'milestone-prefixed';
                const conventionFlagIdx = args.findIndex((a) => a === '--convention' || a.startsWith('--convention='));
                if (conventionFlagIdx !== -1) {
                    const token = args[conventionFlagIdx];
                    convention = token.includes('=')
                        ? token.slice(token.indexOf('=') + 1)
                        : (args[conventionFlagIdx + 1] ?? '');
                }
                if (convention !== 'milestone-prefixed') {
                    // No-throw hub contract (ADR-0012): a hub-dispatched handler must not call
                    // process.exit. Throw instead — the hub converts this to HandlerFailure and
                    // the adapter routes it through the injected error() boundary.
                    throw new Error('Only --convention milestone-prefixed is supported');
                }
                const plan = roadmapUpgrade.computeMigrationPlan(cwd);
                roadmapUpgrade.applyMigration(cwd, plan, { dryRun });
            },
        },
    });
}
module.exports = {
    routeRoadmapCommand,
};
