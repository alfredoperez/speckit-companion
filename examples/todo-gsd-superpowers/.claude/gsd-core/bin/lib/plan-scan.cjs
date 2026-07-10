"use strict";
/**
 * Plan Scan Module — detects plan and summary files in a phase directory.
 * Supports both flat (pre-#3139) and nested (post-#3139) layouts.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/plan-scan.cjs collapsed
 * to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only types are added.
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
// Excluded derivative files
const PLAN_OUTLINE_RE = /-OUTLINE\.md$/i;
const PLAN_PRE_BOUNCE_RE = /\.pre-bounce\.md$/i;
function isRootPlanFile(fileName) {
    if (PLAN_OUTLINE_RE.test(fileName))
        return false;
    if (PLAN_PRE_BOUNCE_RE.test(fileName))
        return false;
    if (fileName.endsWith('-PLAN.md') || fileName === 'PLAN.md')
        return true;
    // A summary is never a plan. Reject summaries before the loose /PLAN/i
    // fallback so legacy `<N>-PLAN-<NN>-SUMMARY.md` names (which contain the
    // substring "PLAN") are not double-counted as plans. (#500 RC2)
    if (isRootSummaryFile(fileName))
        return false;
    return /\.md$/i.test(fileName) && /PLAN/i.test(fileName);
}
function isNestedPlanFile(fileName) {
    if (PLAN_OUTLINE_RE.test(fileName))
        return false;
    if (PLAN_PRE_BOUNCE_RE.test(fileName))
        return false;
    return /^PLAN-\d+.*\.md$/i.test(fileName) || /-PLAN-\d+.*\.md$/i.test(fileName);
}
function isRootSummaryFile(fileName) {
    return fileName.endsWith('-SUMMARY.md') || fileName === 'SUMMARY.md';
}
function isNestedSummaryFile(fileName) {
    return /^SUMMARY-\d+.*\.md$/i.test(fileName) || /-SUMMARY-\d+.*\.md$/i.test(fileName);
}
function scanPhasePlans(phaseDir) {
    let rootFiles;
    try {
        rootFiles = (0, node_fs_1.readdirSync)(phaseDir);
    }
    catch {
        return {
            planCount: 0,
            summaryCount: 0,
            completed: false,
            hasNestedPlans: false,
            planFiles: [],
            summaryFiles: [],
        };
    }
    const rootPlanFiles = rootFiles.filter(isRootPlanFile);
    const rootSummaryFiles = rootFiles.filter(isRootSummaryFile);
    let nestedPlanFiles = [];
    let nestedSummaryFiles = [];
    let hasNestedPlans = false;
    const nestedDir = (0, node_path_1.join)(phaseDir, 'plans');
    if ((0, node_fs_1.existsSync)(nestedDir)) {
        try {
            const nestedFiles = (0, node_fs_1.readdirSync)(nestedDir);
            nestedPlanFiles = nestedFiles.filter(isNestedPlanFile).map((file) => `plans/${file}`);
            nestedSummaryFiles = nestedFiles.filter(isNestedSummaryFile).map((file) => `plans/${file}`);
            hasNestedPlans = nestedPlanFiles.length > 0;
        }
        catch { /* ignore unreadable nested layout */ }
    }
    const planFiles = rootPlanFiles.concat(nestedPlanFiles);
    const summaryFiles = rootSummaryFiles.concat(nestedSummaryFiles);
    const planCount = planFiles.length;
    const summaryCount = summaryFiles.length;
    return {
        planCount,
        summaryCount,
        completed: planCount > 0 && summaryCount >= planCount,
        hasNestedPlans,
        planFiles,
        summaryFiles,
    };
}
module.exports = Object.assign(scanPhasePlans, {
    scanPhasePlans,
    isRootPlanFile,
    isNestedPlanFile,
    isRootSummaryFile,
    isNestedSummaryFile,
});
