"use strict";
/**
 * Fallow binary resolution and report normalisation.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/fallow-runner.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved
 * byte-for-behaviour from the prior hand-written .cjs; only types are added.
 *
 * Parses the real fallow `audit --format json` schema (schema_version 3
 * envelope, nested dead_code/duplication sections). See fallow 2.70.0+.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFallowBinary = resolveFallowBinary;
exports.requireFallowBinary = requireFallowBinary;
exports.normalizeFallowReport = normalizeFallowReport;
exports.normalizeFallowReportFile = normalizeFallowReportFile;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function candidateNames() {
    return process.platform === 'win32'
        ? ['fallow.exe', 'fallow.cmd', 'fallow.bat', 'fallow']
        : ['fallow'];
}
function isExecutableFile(filePath) {
    try {
        const stat = node_fs_1.default.statSync(filePath);
        if (!stat.isFile())
            return false;
        if (process.platform === 'win32')
            return true;
        node_fs_1.default.accessSync(filePath, node_fs_1.default.constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function findInPath(envPath) {
    if (!envPath)
        return null;
    const names = candidateNames();
    const segments = envPath.split(node_path_1.default.delimiter).filter(Boolean);
    for (const segment of segments) {
        for (const name of names) {
            const candidate = node_path_1.default.join(segment, name);
            if (isExecutableFile(candidate))
                return candidate;
        }
    }
    return null;
}
function findInNodeModules(cwd) {
    const names = candidateNames();
    const binDir = node_path_1.default.join(cwd, 'node_modules', '.bin');
    for (const name of names) {
        const candidate = node_path_1.default.join(binDir, name);
        if (isExecutableFile(candidate))
            return candidate;
    }
    return null;
}
function resolveFallowBinary({ cwd, envPath = process.env['PATH'] ?? '' }) {
    return findInNodeModules(cwd) || findInPath(envPath) || null;
}
function requireFallowBinary({ cwd, envPath = process.env['PATH'] ?? '' }) {
    const binary = resolveFallowBinary({ cwd, envPath });
    if (binary)
        return binary;
    throw new Error('Fallow is enabled but no binary was found. Please install fallow via `npm install -D fallow` or `cargo install fallow`.');
}
function normalizeFallowReport(report) {
    const deadCodeRaw = report?.dead_code;
    const duplicationRaw = report?.duplication;
    const unusedExports = (Array.isArray(deadCodeRaw?.unused_exports)
        ? (deadCodeRaw?.unused_exports ?? [])
        : []).filter((x) => x !== null && typeof x === 'object');
    const unusedFiles = (Array.isArray(deadCodeRaw?.unused_files)
        ? (deadCodeRaw?.unused_files ?? [])
        : []).filter((x) => x !== null && typeof x === 'object');
    const circularDeps = (Array.isArray(deadCodeRaw?.circular_dependencies)
        ? (deadCodeRaw?.circular_dependencies ?? [])
        : []).filter((x) => x !== null && typeof x === 'object');
    const cloneGroups = (Array.isArray(duplicationRaw?.clone_groups)
        ? (duplicationRaw?.clone_groups ?? [])
        : []).filter((x) => x !== null && typeof x === 'object');
    const findings = [];
    for (const item of unusedExports) {
        if (!item || typeof item !== 'object')
            continue;
        findings.push({
            type: 'unused_export',
            message: `Unused export ${item.export_name ?? '<unknown>'}`,
            file: item.path ?? '',
            line: item.line ?? null,
        });
    }
    for (const item of unusedFiles) {
        if (!item || typeof item !== 'object')
            continue;
        findings.push({
            type: 'unused_file',
            message: `Unused file ${item.path ?? '<unknown>'}`,
            file: item.path ?? '',
            line: null,
        });
    }
    for (const item of circularDeps) {
        if (!item || typeof item !== 'object')
            continue;
        const files = Array.isArray(item.files) ? item.files : [];
        findings.push({
            type: 'circular_dependency',
            message: `Circular dependency: ${files.join(' -> ')}`,
            file: files.length > 0 ? files[0] : '',
            line: item.line ?? null,
        });
    }
    for (const group of cloneGroups) {
        if (!group || typeof group !== 'object')
            continue;
        const instances = Array.isArray(group.instances) ? group.instances : [];
        findings.push({
            type: 'duplicate_block',
            message: `Duplicate block (${instances.length} instances)`,
            file: instances[0]?.file ?? '',
            line: instances[0]?.start_line ?? null,
            related_file: instances[1]?.file ?? '',
        });
    }
    return {
        summary: {
            unused_exports: unusedExports.length,
            unused_files: unusedFiles.length,
            duplicates: cloneGroups.length,
            circular_dependencies: circularDeps.length,
            total: findings.length,
        },
        findings,
    };
}
function normalizeFallowReportFile(filePath) {
    try {
        const raw = node_fs_1.default.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return normalizeFallowReport(parsed);
    }
    catch {
        return normalizeFallowReport(null);
    }
}
