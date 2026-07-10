"use strict";
/**
 * Workstream Inventory Module
 *
 * Owns discovery and read-only projection of .planning/workstreams/* state.
 * Command handlers should render outputs from this inventory instead of
 * rescanning workstream directories directly.
 *
 * Pure projection logic lives in workstream-inventory-builder.cts.
 * This module handles I/O orchestration only.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/workstream-inventory.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved byte-for-behaviour
 * from the prior hand-written .cjs; only types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const coreUtilsMod = require("./core-utils.cjs");
const { readSubdirectories } = coreUtilsMod;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planScan = require("./plan-scan.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planningWorkspace = require("./planning-workspace.cjs");
const { planningPaths, planningRoot, getActiveWorkstream } = planningWorkspace;
const state_document_cjs_1 = require("./state-document.cjs");
const workstream_inventory_builder_cjs_1 = require("./workstream-inventory-builder.cjs");
// ─── Implementation ───────────────────────────────────────────────────────────
function workstreamsRoot(cwd) {
    return node_path_1.default.join(planningRoot(cwd), 'workstreams');
}
function countRoadmapPhases(roadmapPath, fallbackCount) {
    try {
        const roadmapContent = node_fs_1.default.readFileSync(roadmapPath, 'utf-8');
        const matches = roadmapContent.match(/^#{2,4}\s+Phase\s+[\w][\w.-]*/gm);
        return matches ? matches.length : fallbackCount;
    }
    catch {
        return fallbackCount;
    }
}
function countPhaseFiles(phaseDir) {
    const scan = planScan(phaseDir);
    return { planCount: scan.planCount, summaryCount: scan.summaryCount };
}
function readStateProjection(statePath) {
    try {
        const stateContent = node_fs_1.default.readFileSync(statePath, 'utf-8');
        return {
            status: (0, state_document_cjs_1.stateExtractField)(stateContent, 'Status') || 'unknown',
            current_phase: (0, state_document_cjs_1.stateExtractField)(stateContent, 'Current Phase'),
            last_activity: (0, state_document_cjs_1.stateExtractField)(stateContent, 'Last Activity'),
        };
    }
    catch {
        return {
            status: 'unknown',
            current_phase: null,
            last_activity: null,
        };
    }
}
function sortWorkstreamInventories(inventories, activeWorkstreamName) {
    return [...inventories].sort((a, b) => {
        const aActive = a.name === activeWorkstreamName ? 1 : 0;
        const bActive = b.name === activeWorkstreamName ? 1 : 0;
        if (aActive !== bActive) {
            return bActive - aActive;
        }
        return a.name.localeCompare(b.name);
    });
}
function inspectWorkstream(cwd, name, options = {}) {
    const wsDir = node_path_1.default.join(workstreamsRoot(cwd), name);
    if (!node_fs_1.default.existsSync(wsDir))
        return null;
    const activeWorkstreamName = options.active === undefined ? getActiveWorkstream(cwd) : options.active;
    const p = planningPaths(cwd, name);
    const phaseDirNames = readSubdirectories(p.phases);
    // Collect per-phase file counts
    const phaseFilesCounts = phaseDirNames.map(dir => {
        const counts = countPhaseFiles(node_path_1.default.join(p.phases, dir));
        return { directory: dir, planCount: counts.planCount, summaryCount: counts.summaryCount };
    });
    return (0, workstream_inventory_builder_cjs_1.buildWorkstreamInventory)({
        name,
        projectDir: cwd,
        workstreamDir: wsDir,
        phaseDirNames,
        activeWorkstreamName: activeWorkstreamName ?? '',
        phaseFilesCounts,
        roadmapPhaseCount: countRoadmapPhases(p.roadmap, phaseDirNames.length),
        stateProjection: readStateProjection(p.state),
        filesExist: {
            roadmap: node_fs_1.default.existsSync(p.roadmap),
            state: node_fs_1.default.existsSync(p.state),
            requirements: node_fs_1.default.existsSync(p.requirements),
        },
    });
}
function listWorkstreamInventories(cwd) {
    const wsRoot = workstreamsRoot(cwd);
    if (!node_fs_1.default.existsSync(wsRoot)) {
        return {
            mode: 'flat',
            active: null,
            workstreams: [],
            count: 0,
            message: 'No workstreams — operating in flat mode',
        };
    }
    const active = getActiveWorkstream(cwd);
    const entries = node_fs_1.default.readdirSync(wsRoot, { withFileTypes: true });
    const workstreams = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const inventory = inspectWorkstream(cwd, entry.name, { active });
        if (inventory)
            workstreams.push(inventory);
    }
    const ordered = sortWorkstreamInventories(workstreams, active);
    return {
        mode: 'workstream',
        active,
        workstreams: ordered,
        count: ordered.length,
    };
}
function getOtherActiveWorkstreamInventories(cwd, excludeWs) {
    return listWorkstreamInventories(cwd).workstreams
        .filter(inventory => inventory.name !== excludeWs)
        .filter(inventory => !(0, workstream_inventory_builder_cjs_1.isCompletedInventory)(inventory.status));
}
module.exports = {
    countPhaseFiles,
    countRoadmapPhases,
    getOtherActiveWorkstreamInventories,
    inspectWorkstream,
    isCompletedInventory: workstream_inventory_builder_cjs_1.isCompletedInventory,
    listWorkstreamInventories,
    sortWorkstreamInventories,
    workstreamsRoot,
};
