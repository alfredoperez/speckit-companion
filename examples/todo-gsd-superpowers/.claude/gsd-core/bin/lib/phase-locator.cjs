"use strict";
/**
 * Phase Locator — Phase-directory search and location
 *
 * ADR-857 rollout phase 2d: extracted from core.cts (issue #881).
 * Owns active-phase discovery against the `.planning/phases/` tree
 * (`searchPhaseInDir`, `findPhaseInternal`) and archived-phase-dir
 * enumeration (`getArchivedPhaseDirs`), matching phase ids/tokens against
 * the filesystem. Behaviour is preserved byte-for-behaviour from the prior
 * location; only the module boundary moved. The core.cjs re-export spine
 * was retired in epic #1267; callers import phase-locator helpers directly.
 *
 * Dependencies (leaf modules only — no loadConfig):
 *   - node:fs / node:path (stdlib)
 *   - ./phase-id.cjs       (normalizePhaseName, phaseTokenMatches, extractPhaseToken)
 *   - ./core-utils.cjs     (readSubdirectories, getPhaseFileStats, extractCanonicalPlanId, toPosixPath)
 *   - ./planning-workspace.cjs (planningDir)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const phaseIdModule = require("./phase-id.cjs");
const { normalizePhaseName, phaseTokenMatches, extractPhaseToken } = phaseIdModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const coreUtilsModule = require("./core-utils.cjs");
const { readSubdirectories, getPhaseFileStats, extractCanonicalPlanId, toPosixPath } = coreUtilsModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planningWorkspace = require("./planning-workspace.cjs");
const { planningDir } = planningWorkspace;
// ─── Phase search helpers ─────────────────────────────────────────────────────
function searchPhaseInDir(baseDir, relBase, normalized) {
    try {
        const dirs = readSubdirectories(baseDir, true);
        const match = dirs.find(d => phaseTokenMatches(d, normalized));
        if (!match)
            return null;
        const phaseToken = extractPhaseToken(match);
        const phaseNumber = phaseToken || normalized;
        const afterToken = match.slice(phaseToken ? phaseToken.length : 0).replace(/^-/, '');
        const phaseName = afterToken || null;
        const phaseDir = node_path_1.default.join(baseDir, match);
        const { plans: unsortedPlans, summaries: unsortedSummaries, hasResearch, hasContext, hasVerification, hasReviews } = getPhaseFileStats(phaseDir);
        const plans = unsortedPlans.sort();
        const summaries = unsortedSummaries.sort();
        const completedPlanIds = new Set(summaries.flatMap(s => {
            const exact = s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '');
            const canonical = extractCanonicalPlanId(s);
            return canonical === exact ? [exact] : [exact, canonical];
        }));
        const incompletePlans = plans.filter(p => {
            const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
            const canonical = extractCanonicalPlanId(p);
            return !completedPlanIds.has(planId) && !completedPlanIds.has(canonical);
        });
        return {
            found: true,
            directory: toPosixPath(node_path_1.default.join(relBase, match)),
            phase_number: phaseNumber,
            phase_name: phaseName,
            phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
            plans,
            summaries,
            incomplete_plans: incompletePlans,
            has_research: hasResearch,
            has_context: hasContext,
            has_verification: hasVerification,
            has_reviews: hasReviews,
        };
    }
    catch {
        return null;
    }
}
function findPhaseInternal(cwd, phase) {
    if (!phase)
        return null;
    const phasesDir = node_path_1.default.join(planningDir(cwd), 'phases');
    const normalized = normalizePhaseName(phase);
    const relPhasesDir = toPosixPath(node_path_1.default.relative(cwd, phasesDir));
    const current = searchPhaseInDir(phasesDir, relPhasesDir, normalized);
    if (current)
        return current;
    const milestonesDir = node_path_1.default.join(cwd, '.planning', 'milestones');
    if (!node_fs_1.default.existsSync(milestonesDir))
        return null;
    try {
        const milestoneEntries = node_fs_1.default.readdirSync(milestonesDir, { withFileTypes: true });
        const archiveDirs = milestoneEntries
            .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
            .map(e => e.name)
            .sort()
            .reverse();
        for (const archiveName of archiveDirs) {
            const versionMatch = archiveName.match(/^(v[\d.]+)-phases$/);
            const version = versionMatch[1];
            const archivePath = node_path_1.default.join(milestonesDir, archiveName);
            const relBase = '.planning/milestones/' + archiveName;
            const result = searchPhaseInDir(archivePath, relBase, normalized);
            if (result) {
                result.archived = version;
                return result;
            }
        }
    }
    catch { /* intentionally empty */ }
    return null;
}
function getArchivedPhaseDirs(cwd) {
    const milestonesDir = node_path_1.default.join(cwd, '.planning', 'milestones');
    const results = [];
    if (!node_fs_1.default.existsSync(milestonesDir))
        return results;
    try {
        const milestoneEntries = node_fs_1.default.readdirSync(milestonesDir, { withFileTypes: true });
        const phaseDirs = milestoneEntries
            .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
            .map(e => e.name)
            .sort()
            .reverse();
        for (const archiveName of phaseDirs) {
            const versionMatch = archiveName.match(/^(v[\d.]+)-phases$/);
            const version = versionMatch[1];
            const archivePath = node_path_1.default.join(milestonesDir, archiveName);
            const dirs = readSubdirectories(archivePath, true);
            for (const dir of dirs) {
                results.push({
                    name: dir,
                    milestone: version,
                    basePath: node_path_1.default.join('.planning', 'milestones', archiveName),
                    fullPath: node_path_1.default.join(archivePath, dir),
                });
            }
        }
    }
    catch { /* intentionally empty */ }
    return results;
}
module.exports = {
    searchPhaseInDir,
    findPhaseInternal,
    getArchivedPhaseDirs,
};
