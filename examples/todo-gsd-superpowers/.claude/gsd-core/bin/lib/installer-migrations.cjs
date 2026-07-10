"use strict";
/**
 * Installer migrations engine — plan, apply, and track filesystem-mutation
 * migrations for GSD runtime config directories.
 *
 * ADR-457 build-at-publish: the hand-written bin/lib/installer-migrations.cjs
 * collapsed to a TypeScript source of truth. Behaviour is preserved
 * byte-for-behaviour from the prior hand-written .cjs; only types are added.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const installer_migration_authoring_cjs_1 = require("./installer-migration-authoring.cjs");
const shell_command_projection_cjs_1 = require("./shell-command-projection.cjs");
const clock_cjs_1 = require("./clock.cjs");
const MANIFEST_NAME = 'gsd-file-manifest.json';
const INSTALL_STATE_NAME = 'gsd-install-state.json';
const INSTALL_MIGRATION_LOCK_NAME = 'gsd-install-migration.lock';
const DEFAULT_MIGRATIONS_DIR = node_path_1.default.join(__dirname, 'installer-migrations');
const DEFAULT_LOCK_TIMEOUT_MS = 30_000;
const STRICT_JSON = Symbol('strict-json');
function sha256File(filePath) {
    const hash = node_crypto_1.default.createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    const fd = node_fs_1.default.openSync(filePath, 'r');
    try {
        while (true) {
            const bytesRead = node_fs_1.default.readSync(fd, buffer, 0, buffer.length, null);
            if (bytesRead === 0)
                break;
            hash.update(buffer.subarray(0, bytesRead));
        }
    }
    finally {
        node_fs_1.default.closeSync(fd);
    }
    return hash.digest('hex');
}
function sha256Text(value) {
    return node_crypto_1.default.createHash('sha256').update(value).digest('hex');
}
function readJsonIfPresent(filePath, fallback) {
    if (!node_fs_1.default.existsSync(filePath))
        return fallback;
    try {
        return JSON.parse(node_fs_1.default.readFileSync(filePath, 'utf8'));
    }
    catch (error) {
        if (fallback === STRICT_JSON) {
            throw new Error(`invalid installer migration state JSON: ${filePath}: ${error.message}`);
        }
        return fallback;
    }
}
function readInstallManifest(configDir) {
    const manifest = readJsonIfPresent(node_path_1.default.join(configDir, MANIFEST_NAME), null);
    if (!manifest || typeof manifest !== 'object') {
        return { version: null, timestamp: null, mode: null, files: {} };
    }
    const m = manifest;
    return {
        version: typeof m.version === 'string' ? m.version : null,
        timestamp: typeof m.timestamp === 'string' ? m.timestamp : null,
        mode: typeof m.mode === 'string' ? m.mode : null,
        files: m.files && typeof m.files === 'object' ? m.files : {},
    };
}
function readInstallState(configDir) {
    const state = readJsonIfPresent(node_path_1.default.join(configDir, INSTALL_STATE_NAME), STRICT_JSON);
    if (!state || typeof state !== 'object') {
        return { schemaVersion: 1, appliedMigrations: [] };
    }
    const s = state;
    return {
        schemaVersion: typeof s.schemaVersion === 'number' ? s.schemaVersion : 1,
        appliedMigrations: Array.isArray(s.appliedMigrations) ? s.appliedMigrations : [],
    };
}
// Strict atomic write for the install state: must never be left half-written.
// Bypasses the seam because platformWriteSync falls back to a direct write on
// rename failure, which would silently violate this invariant.
function atomicWriteInstallState(configDir, content) {
    node_fs_1.default.mkdirSync(configDir, { recursive: true });
    const filePath = node_path_1.default.join(configDir, INSTALL_STATE_NAME);
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    try {
        node_fs_1.default.writeFileSync(tmpPath, content, 'utf8');
        node_fs_1.default.renameSync(tmpPath, filePath);
    }
    catch (error) {
        try {
            node_fs_1.default.rmSync(tmpPath, { force: true });
        }
        catch { /* best-effort */ }
        throw error;
    }
}
function writeInstallState(configDir, state) {
    atomicWriteInstallState(configDir, JSON.stringify(state, null, 2) + '\n');
    return state;
}
function readJson(configDir, relPath) {
    const { fullPath } = ensureInsideConfig(configDir, relPath);
    if (!node_fs_1.default.existsSync(fullPath)) {
        return { exists: false, value: null, error: null };
    }
    try {
        return { exists: true, value: JSON.parse(node_fs_1.default.readFileSync(fullPath, 'utf8')), error: null };
    }
    catch (error) {
        return { exists: true, value: null, error: error };
    }
}
function normalizeRelPath(relPath) {
    if (typeof relPath !== 'string' || relPath.trim() === '') {
        throw new Error('migration action relPath must be a non-empty string');
    }
    const normalized = relPath.replace(/\\/g, '/');
    if (node_path_1.default.isAbsolute(normalized) || node_path_1.default.win32.isAbsolute(normalized)) {
        throw new Error(`migration action relPath must stay inside configDir: ${relPath}`);
    }
    const segments = normalized.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
        throw new Error(`migration action relPath must stay inside configDir: ${relPath}`);
    }
    return segments.join('/');
}
function classifyArtifact(configDir, relPath, manifest) {
    const normalized = normalizeRelPath(relPath);
    const originalHash = manifest.files[normalized] || null;
    const fullPath = node_path_1.default.join(configDir, normalized);
    if (!node_fs_1.default.existsSync(fullPath)) {
        return { classification: originalHash ? 'managed-missing' : 'missing', originalHash, currentHash: null };
    }
    const currentHash = sha256File(fullPath);
    if (!originalHash) {
        return { classification: 'unknown', originalHash: null, currentHash };
    }
    if (currentHash === originalHash) {
        return { classification: 'managed-pristine', originalHash, currentHash };
    }
    return { classification: 'managed-modified', originalHash, currentHash };
}
function appliedMigrationIds(state) {
    return new Set(state.appliedMigrations
        .filter((entry) => entry && typeof entry.id === 'string')
        .map((entry) => entry.id));
}
function appliedMigrationEntries(state) {
    const entries = new Map();
    for (const entry of state.appliedMigrations) {
        if (entry && typeof entry.id === 'string' && !entries.has(entry.id)) {
            entries.set(entry.id, entry);
        }
    }
    return entries;
}
function migrationChecksum(migration) {
    const checksum = migration.checksum;
    if (typeof checksum === 'string' && checksum)
        return checksum;
    const serializable = {
        id: migration.id,
        title: migration.title || null,
        description: migration.description || null,
        introducedIn: migration.introducedIn || null,
        runtimes: migration.runtimes || null,
        scopes: migration.scopes || null,
        destructive: migration.destructive === true,
        runtimeContract: migration.runtimeContract || null,
        plan: typeof migration.plan === 'function' ? migration.plan.toString() : null,
    };
    return `sha256:${sha256Text(JSON.stringify(serializable))}`;
}
// Rewrite the stored checksum of any already-applied entry whose id drifted, so the
// drift is reconciled durably and not re-detected on every subsequent run (issue #670).
// Returns the number of entries actually changed (so callers know whether a write is needed).
function reconcileDriftedChecksums(appliedEntries, checksumDrift) {
    if (!Array.isArray(checksumDrift) || checksumDrift.length === 0)
        return 0;
    const reconcile = new Map(checksumDrift.map((d) => [d.id, d.currentChecksum]));
    let changed = 0;
    for (let i = 0; i < appliedEntries.length; i++) {
        const existing = appliedEntries[i];
        if (existing && typeof existing.id === 'string' && reconcile.has(existing.id)) {
            const next = reconcile.get(existing.id);
            if (existing.checksum !== next) {
                appliedEntries[i] = { ...existing, checksum: next };
                changed += 1;
            }
        }
    }
    return changed;
}
function collectAppliedChecksumDrift(applied, migrations) {
    const drift = [];
    for (const migration of migrations) {
        const entry = applied.get(migration.id);
        if (!entry || !entry.checksum)
            continue;
        const currentChecksum = migrationChecksum(migration);
        if (entry.checksum !== currentChecksum) {
            // An already-applied migration is never re-run (it is filtered out of `pending`),
            // so a checksum drift here is functionally inert. A prior release may have edited a
            // shipped migration body (see issue #670). Surface it for reconciliation instead of
            // hard-aborting the user's upgrade.
            drift.push({
                id: migration.id,
                storedChecksum: entry.checksum,
                currentChecksum,
            });
        }
    }
    return drift;
}
function migrationMatchesContext(migration, { runtime, scope }) {
    if (Array.isArray(migration.runtimes) && migration.runtimes.length > 0) {
        if (!runtime || !migration.runtimes.includes(runtime))
            return false;
    }
    if (Array.isArray(migration.scopes) && migration.scopes.length > 0) {
        if (!scope || !migration.scopes.includes(scope))
            return false;
    }
    return true;
}
function discoverInstallerMigrations({ migrationsDir }) {
    if (!migrationsDir || !node_fs_1.default.existsSync(migrationsDir))
        return [];
    return node_fs_1.default.readdirSync(migrationsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.cjs'))
        .map((entry) => entry.name)
        .sort()
        .flatMap((fileName) => {
        const source = node_path_1.default.join(migrationsDir, fileName);
        delete require.cache[require.resolve(source)];
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const exported = require(source);
        const records = Array.isArray(exported) ? exported : [exported];
        return records.map((record) => (0, installer_migration_authoring_cjs_1.validateInstallerMigrationRecord)(record, source));
    });
}
function journalTimestamp(now) {
    return now().replace(/[:.]/g, '-');
}
function migrationRunId(appliedAt) {
    return `${journalTimestamp(() => appliedAt)}-${node_crypto_1.default.randomBytes(8).toString('hex')}`;
}
function sleepSync(ms) {
    const buffer = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(buffer), 0, 0, ms);
}
/**
 * Check whether a given PID is alive on the current host.
 * Uses process.kill(pid, 0) which works on POSIX and Windows (Node's
 * implementation maps it to OpenProcess + GetExitCodeProcess on win32).
 * Returns true if alive or permission-denied (live but not ours),
 * false if ESRCH (no such process).
 */
function isPidAlive(pid) {
    if (typeof pid !== 'number' || !Number.isFinite(pid) || pid <= 0)
        return false;
    try {
        process.kill(pid, 0);
        return true; // alive (or permission denied — treat as live)
    }
    catch (err) {
        return err.code !== 'ESRCH';
    }
}
/**
 * Try to read and parse the lock file JSON. Returns null on any error
 * (missing, invalid JSON, I/O failure).
 */
function readLockFile(lockPath) {
    try {
        const raw = node_fs_1.default.readFileSync(lockPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && typeof parsed.pid === 'number') {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
function acquireInstallMigrationLock(configDir, { timeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {}, clock = clock_cjs_1.realClock) {
    node_fs_1.default.mkdirSync(configDir, { recursive: true });
    const lockPath = node_path_1.default.join(configDir, INSTALL_MIGRATION_LOCK_NAME);
    const started = clock.now();
    while (true) {
        let fd = null;
        let lockCreatedByUs = false;
        try {
            fd = node_fs_1.default.openSync(lockPath, 'wx');
            // Close the open descriptor before writing so the file handle is
            // released on Windows before the release closure unlinks it.
            // Write payload via writeFileSync with the path (not the fd) so we
            // don't hold an open fd across the lifetime of the lock.
            node_fs_1.default.closeSync(fd);
            fd = null;
            lockCreatedByUs = true; // we own the file; clean it up on any subsequent error
            node_fs_1.default.writeFileSync(lockPath, JSON.stringify({
                pid: process.pid,
                acquiredAt: new Date().toISOString(),
            }) + '\n');
            lockCreatedByUs = false; // release closure owns cleanup from here
            return () => {
                const failures = [];
                // Use unlinkSync (not rmSync with { force: true }) so EPERM errors
                // are NOT silently swallowed. On Windows, if the unlink fails
                // transiently, the error surfaces via releaseError so the caller
                // can observe and surface it rather than leaving a stale lock.
                try {
                    node_fs_1.default.unlinkSync(lockPath);
                }
                catch (error) {
                    failures.push(error);
                }
                if (failures.length > 0) {
                    const releaseError = new Error(`failed to release installer migration lock: ${lockPath}`);
                    releaseError.failures = failures;
                    throw releaseError;
                }
            };
        }
        catch (error) {
            if (fd !== null) {
                try {
                    node_fs_1.default.closeSync(fd);
                }
                catch { /* best-effort */ }
                try {
                    node_fs_1.default.unlinkSync(lockPath);
                }
                catch { /* best-effort */ }
                fd = null;
            }
            else if (lockCreatedByUs) {
                // fd was closed but writeFileSync threw before we returned the release
                // closure — the empty lock file is still on disk and must be removed
                // so it does not orphan as an unreadable (empty/invalid JSON) stale lock.
                try {
                    node_fs_1.default.unlinkSync(lockPath);
                }
                catch { /* best-effort */ }
            }
            const err = error;
            if (err && err.code === 'EEXIST') {
                // Stale-lock reclamation: read the on-disk PID and check liveness.
                // If the PID is dead (ESRCH) or is our own process (same-process
                // re-entry caused by rmSync silently swallowing an unlink error on
                // a previous call in the same invocation — the root cause of #3670),
                // reclaim the lock by removing the stale file and retrying.
                const lockData = readLockFile(lockPath);
                if (lockData !== null) {
                    const holderPid = lockData.pid;
                    const isSameProcess = holderPid === process.pid;
                    const isDeadProcess = !isPidAlive(holderPid);
                    if (isSameProcess || isDeadProcess) {
                        // Reclaim: remove the stale lock and loop back to openSync.
                        // Only continue (retry) when unlink actually succeeds — a silent
                        // continue on reclaim failure recreates the original deadlock:
                        // the lock stays on disk and we spin indefinitely.
                        let reclaimed = false;
                        try {
                            node_fs_1.default.unlinkSync(lockPath);
                            reclaimed = true;
                        }
                        catch { /* unlink failed — fall through to timeout path */ }
                        if (reclaimed)
                            continue;
                    }
                }
                if (clock.now() - started >= timeoutMs) {
                    const holderInfo = lockData ? ` (held by pid ${lockData.pid} since ${lockData.acquiredAt})` : '';
                    throw new Error(`installer migration lock is held: ${lockPath}${holderInfo}`);
                }
                clock.sleep(Math.min(50, Math.max(1, timeoutMs - (clock.now() - started))));
                continue;
            }
            throw error;
        }
    }
}
function ensureInsideConfig(configDir, relPath) {
    const normalized = normalizeRelPath(relPath);
    const fullPath = node_path_1.default.resolve(configDir, normalized);
    const root = node_path_1.default.resolve(configDir);
    if (fullPath !== root && !fullPath.startsWith(root + node_path_1.default.sep)) {
        throw new Error(`migration path escapes configDir: ${relPath}`);
    }
    return { normalized, fullPath };
}
function isStructurallyEmpty(value) {
    if (value === null || value === undefined)
        return true;
    if (Array.isArray(value))
        return value.length === 0;
    return typeof value === 'object' && Object.keys(value).length === 0;
}
function journalAction(action, status, extras = {}) {
    const { value: _value, ...safeAction } = action;
    return { ...safeAction, ...extras, status };
}
function planInstallerMigrations({ configDir, runtime = null, scope = null, migrations, baselineScan = false, now = () => new Date().toISOString(), }) {
    if (!configDir)
        throw new Error('configDir is required');
    if (!Array.isArray(migrations))
        throw new Error('migrations must be an array');
    const manifest = readInstallManifest(configDir);
    const state = readInstallState(configDir);
    const validatedMigrations = migrations.map((migration) => (0, installer_migration_authoring_cjs_1.validateInstallerMigrationRecord)(migration));
    const scopedMigrations = validatedMigrations.filter((migration) => migrationMatchesContext(migration, { runtime, scope }));
    const applied = appliedMigrationEntries(state);
    const checksumDrift = collectAppliedChecksumDrift(applied, scopedMigrations);
    const pending = scopedMigrations.filter((migration) => !applied.has(migration.id));
    const actions = [];
    const blocked = [];
    const classifications = new Map();
    const classify = (relPath) => {
        const normalized = normalizeRelPath(relPath);
        if (!classifications.has(normalized)) {
            classifications.set(normalized, classifyArtifact(configDir, normalized, manifest));
        }
        return classifications.get(normalized);
    };
    for (const migration of pending) {
        const planFn = migration.plan;
        const plannedActions = planFn({
            configDir,
            runtime,
            scope,
            manifest,
            state,
            baselineScan,
            now,
            classifyArtifact: classify,
            readJson: (relPath) => readJson(configDir, relPath),
        });
        (0, installer_migration_authoring_cjs_1.validateInstallerMigrationActions)(plannedActions, migration);
        const checksum = migrationChecksum(migration);
        for (const rawAction of plannedActions) {
            const relPath = normalizeRelPath(rawAction.relPath);
            const classification = rawAction.classification
                ? {
                    classification: rawAction.classification,
                    originalHash: rawAction.originalHash || null,
                    currentHash: rawAction.currentHash || null,
                }
                : classify(relPath);
            let protectedType = rawAction.type;
            if (rawAction.type === 'remove-managed' && classification.classification === 'managed-modified') {
                protectedType = 'backup-and-remove';
            }
            if (rawAction.type === 'remove-managed' && classification.classification === 'unknown') {
                protectedType = 'preserve-user';
            }
            const action = {
                migrationId: migration.id,
                migrationChecksum: checksum,
                type: protectedType,
                relPath,
                reason: rawAction.reason || migration.description || '',
                classification: classification.classification,
                originalHash: classification.originalHash,
                currentHash: classification.currentHash,
            };
            if (action.type !== rawAction.type) {
                action.requestedType = rawAction.type;
            }
            if (action.type === 'backup-and-remove') {
                action.backupRelPath = null;
            }
            if (action.type === 'rewrite-json') {
                action.value = rawAction.value;
                action.deleteIfEmpty = rawAction.deleteIfEmpty === true;
            }
            if (rawAction.prompt)
                action.prompt = rawAction.prompt;
            if (Array.isArray(rawAction.choices))
                action.choices = rawAction.choices;
            if (action.type === 'prompt-user') {
                blocked.push(action);
            }
            else if (action.classification === 'unknown' &&
                action.type !== 'rewrite-json' &&
                action.type !== 'record-baseline' &&
                action.type !== 'baseline-preserve-user') {
                blocked.push(action);
            }
            actions.push(action);
        }
    }
    return {
        generatedAt: now(),
        manifest,
        state,
        pendingMigrationIds: pending.map((migration) => migration.id),
        pendingMigrations: pending,
        actions,
        blocked,
        checksumDrift,
    };
}
function uniqueActionMigrationIds(actions) {
    return [...new Set(actions.map((action) => action.migrationId).filter(Boolean))];
}
function rollbackAppliedMigrationResult({ configDir, journal, journalPath, rollbackRoot, backupRoot, previousInstallStateBytes }) {
    const failures = [];
    for (const action of [...journal.actions].reverse()) {
        if (!action.rollbackRelPath)
            continue;
        const rollbackPath = node_path_1.default.join(configDir, action.rollbackRelPath);
        const dest = node_path_1.default.join(configDir, action.relPath);
        try {
            if (node_fs_1.default.existsSync(rollbackPath)) {
                node_fs_1.default.mkdirSync(node_path_1.default.dirname(dest), { recursive: true });
                node_fs_1.default.copyFileSync(rollbackPath, dest);
            }
        }
        catch (error) {
            failures.push({ relPath: action.relPath, error: error.message });
        }
        if (action.backupRelPath) {
            try {
                node_fs_1.default.rmSync(node_path_1.default.join(configDir, action.backupRelPath), { force: true });
            }
            catch {
                // backup cleanup is best-effort; preserve restore failures above
            }
        }
    }
    try {
        if (previousInstallStateBytes === null) {
            node_fs_1.default.rmSync(node_path_1.default.join(configDir, INSTALL_STATE_NAME), { force: true });
        }
        else {
            atomicWriteInstallState(configDir, previousInstallStateBytes);
        }
    }
    catch (error) {
        failures.push({ relPath: INSTALL_STATE_NAME, error: error.message });
    }
    try {
        node_fs_1.default.rmSync(journalPath, { force: true });
        node_fs_1.default.rmSync(rollbackRoot, { recursive: true, force: true });
        node_fs_1.default.rmSync(backupRoot, { recursive: true, force: true });
    }
    catch {
        // journal cleanup is best-effort; the rollback above is the safety-critical part
    }
    if (failures.length > 0) {
        const error = new Error('migration rollback incomplete');
        error.rollbackFailures = failures;
        throw error;
    }
}
function cleanupMigrationRunArtifacts(journalPath, rollbackRoot, backupRoot) {
    try {
        node_fs_1.default.rmSync(journalPath, { force: true });
    }
    catch { /* best-effort */ }
    try {
        node_fs_1.default.rmSync(rollbackRoot, { recursive: true, force: true });
    }
    catch { /* best-effort */ }
    try {
        node_fs_1.default.rmSync(backupRoot, { recursive: true, force: true });
    }
    catch { /* best-effort */ }
}
function applyInstallerMigrationPlan({ configDir, plan, now = () => new Date().toISOString(), }) {
    if (!configDir)
        throw new Error('configDir is required');
    if (!plan || !Array.isArray(plan.actions))
        throw new Error('plan with actions is required');
    if (Array.isArray(plan.blocked) && plan.blocked.length > 0) {
        throw new Error(`migration plan has ${plan.blocked.length} blocked action(s)`);
    }
    const appliedAt = now();
    const runId = migrationRunId(appliedAt);
    const journalRelPath = node_path_1.default.posix.join('gsd-migration-journal', `${runId}.json`);
    const journalPath = node_path_1.default.join(configDir, journalRelPath);
    const rollbackRootRelPath = node_path_1.default.posix.join('gsd-migration-journal', `${runId}-rollback`);
    const rollbackRoot = node_path_1.default.join(configDir, rollbackRootRelPath);
    const backupRootRelPath = node_path_1.default.posix.join('gsd-migration-journal', `${runId}-backups`);
    const backupRoot = node_path_1.default.join(configDir, backupRootRelPath);
    const journal = {
        schemaVersion: 1,
        appliedAt,
        appliedMigrationIds: uniqueActionMigrationIds(plan.actions),
        actions: [],
    };
    const rollback = [];
    const installStatePath = node_path_1.default.join(configDir, INSTALL_STATE_NAME);
    const previousInstallStateBytes = node_fs_1.default.existsSync(installStatePath)
        ? node_fs_1.default.readFileSync(installStatePath, 'utf8')
        : null;
    try {
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(journalPath), { recursive: true });
        (0, shell_command_projection_cjs_1.platformWriteSync)(journalPath, JSON.stringify(journal, null, 2) + '\n');
        for (const action of plan.actions) {
            if (action.type !== 'remove-managed' &&
                action.type !== 'backup-and-remove' &&
                action.type !== 'rewrite-json' &&
                action.type !== 'record-baseline' &&
                action.type !== 'baseline-preserve-user') {
                throw new Error(`unsupported migration action type: ${action.type}`);
            }
            const { normalized, fullPath } = ensureInsideConfig(configDir, action.relPath);
            if (!node_fs_1.default.existsSync(fullPath)) {
                journal.actions.push(journalAction(action, 'missing'));
                continue;
            }
            if (action.type === 'record-baseline' || action.type === 'baseline-preserve-user') {
                journal.actions.push(journalAction(action, action.type === 'record-baseline' ? 'recorded' : 'preserved'));
                continue;
            }
            const rollbackPath = node_path_1.default.join(rollbackRoot, normalized);
            node_fs_1.default.mkdirSync(node_path_1.default.dirname(rollbackPath), { recursive: true });
            node_fs_1.default.copyFileSync(fullPath, rollbackPath);
            rollback.push({ relPath: normalized, rollbackPath });
            if (action.type === 'rewrite-json') {
                if (action.deleteIfEmpty && isStructurallyEmpty(action.value)) {
                    node_fs_1.default.rmSync(fullPath, { force: true });
                    journal.actions.push(journalAction(action, 'removed', {
                        rollbackRelPath: node_path_1.default.posix.join(rollbackRootRelPath, normalized),
                    }));
                }
                else {
                    (0, shell_command_projection_cjs_1.platformWriteSync)(fullPath, JSON.stringify(action.value, null, 2) + '\n');
                    journal.actions.push(journalAction(action, 'rewritten', {
                        rollbackRelPath: node_path_1.default.posix.join(rollbackRootRelPath, normalized),
                    }));
                }
                continue;
            }
            if (action.type === 'backup-and-remove') {
                const backupRelPath = action.backupRelPath || node_path_1.default.posix.join(backupRootRelPath, normalized);
                const backupPath = node_path_1.default.join(configDir, backupRelPath);
                node_fs_1.default.mkdirSync(node_path_1.default.dirname(backupPath), { recursive: true });
                node_fs_1.default.copyFileSync(fullPath, backupPath);
                journal.actions.push(journalAction(action, 'removed', {
                    backupRelPath,
                    rollbackRelPath: node_path_1.default.posix.join(rollbackRootRelPath, normalized),
                }));
            }
            else {
                journal.actions.push(journalAction(action, 'removed', {
                    rollbackRelPath: node_path_1.default.posix.join(rollbackRootRelPath, normalized),
                }));
            }
            node_fs_1.default.rmSync(fullPath, { force: true });
        }
        (0, shell_command_projection_cjs_1.platformWriteSync)(journalPath, JSON.stringify(journal, null, 2) + '\n');
        const state = readInstallState(configDir);
        const applied = appliedMigrationIds(state);
        const nextApplied = [...state.appliedMigrations];
        reconcileDriftedChecksums(nextApplied, plan.checksumDrift);
        const actionsByMigrationId = new Map();
        for (const action of plan.actions) {
            if (action.migrationId && !actionsByMigrationId.has(action.migrationId)) {
                actionsByMigrationId.set(action.migrationId, action);
            }
        }
        for (const id of journal.appliedMigrationIds) {
            if (!applied.has(id)) {
                const action = actionsByMigrationId.get(id);
                nextApplied.push({
                    id,
                    appliedAt,
                    journal: journalRelPath,
                    checksum: action && action.migrationChecksum ? action.migrationChecksum : null,
                });
            }
        }
        writeInstallState(configDir, {
            schemaVersion: 1,
            appliedMigrations: nextApplied,
        });
        return {
            appliedMigrationIds: journal.appliedMigrationIds,
            journalRelPath,
            rollback: () => rollbackAppliedMigrationResult({ configDir, journal, journalPath, rollbackRoot, backupRoot, previousInstallStateBytes }),
        };
    }
    catch (error) {
        const rollbackFailures = [];
        for (const entry of rollback.reverse()) {
            const dest = node_path_1.default.join(configDir, entry.relPath);
            try {
                node_fs_1.default.mkdirSync(node_path_1.default.dirname(dest), { recursive: true });
                node_fs_1.default.copyFileSync(entry.rollbackPath, dest);
            }
            catch (rollbackError) {
                rollbackFailures.push({
                    relPath: entry.relPath,
                    rollbackPath: entry.rollbackPath,
                    error: rollbackError.message,
                });
            }
        }
        if (rollbackFailures.length > 0) {
            const rollbackError = new Error(`migration apply failed and rollback incomplete: ${error.message}`);
            rollbackError.cause = error;
            rollbackError.rollbackFailures = rollbackFailures;
            throw rollbackError;
        }
        cleanupMigrationRunArtifacts(journalPath, rollbackRoot, backupRoot);
        throw error;
    }
}
function markPendingMigrationsApplied({ configDir, plan, now = () => new Date().toISOString(), }) {
    if (!plan)
        return [];
    const hasPending = Array.isArray(plan.pendingMigrationIds) && plan.pendingMigrationIds.length > 0;
    const hasDrift = Array.isArray(plan.checksumDrift) && plan.checksumDrift.length > 0;
    if (!hasPending && !hasDrift)
        return [];
    const appliedAt = now();
    const state = readInstallState(configDir);
    const applied = appliedMigrationIds(state);
    const nextApplied = [...state.appliedMigrations];
    const reconciledCount = reconcileDriftedChecksums(nextApplied, plan.checksumDrift);
    const newlyApplied = [];
    if (hasPending) {
        const checksumsByMigrationId = new Map();
        for (const migration of plan.pendingMigrations || []) {
            checksumsByMigrationId.set(migration.id, migrationChecksum(migration));
        }
        for (const id of plan.pendingMigrationIds) {
            if (applied.has(id))
                continue;
            nextApplied.push({
                id,
                appliedAt,
                journal: null,
                checksum: checksumsByMigrationId.get(id) || null,
            });
            newlyApplied.push(id);
        }
    }
    if (newlyApplied.length > 0 || reconciledCount > 0) {
        writeInstallState(configDir, {
            schemaVersion: 1,
            appliedMigrations: nextApplied,
        });
    }
    return newlyApplied;
}
function runInstallerMigrations({ configDir, runtime = null, scope = null, migrationsDir = DEFAULT_MIGRATIONS_DIR, migrations = discoverInstallerMigrations({ migrationsDir }), baselineScan = false, now = () => new Date().toISOString(), lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS, } = { configDir: '' }) {
    const releaseLock = acquireInstallMigrationLock(configDir, { timeoutMs: lockTimeoutMs });
    let primaryError = null;
    let completed = false;
    try {
        const plan = planInstallerMigrations({ configDir, runtime, scope, migrations, baselineScan, now });
        if (plan.actions.length === 0) {
            const newlyApplied = markPendingMigrationsApplied({ configDir, plan, now });
            completed = true;
            return {
                appliedMigrationIds: newlyApplied,
                journalRelPath: null,
                plan,
            };
        }
        if (plan.blocked.length > 0) {
            completed = true;
            return {
                appliedMigrationIds: [],
                journalRelPath: null,
                plan,
                blocked: plan.blocked,
            };
        }
        const result = applyInstallerMigrationPlan({ configDir, plan, now });
        completed = true;
        return { ...result, plan };
    }
    catch (error) {
        primaryError = error;
        throw error;
    }
    finally {
        try {
            releaseLock();
        }
        catch (releaseError) {
            if (primaryError) {
                primaryError.suppressed = [...(primaryError.suppressed || []), releaseError];
            }
            else if (completed) {
                throw releaseError;
            }
            else {
                throw releaseError;
            }
        }
    }
}
// Unused but kept to satisfy eslint — sleepSync is referenced in the original
// and may be used by test code that patches this module.
void sleepSync;
module.exports = {
    DEFAULT_MIGRATIONS_DIR,
    INSTALL_MIGRATION_LOCK_NAME,
    INSTALL_STATE_NAME,
    MANIFEST_NAME,
    acquireInstallMigrationLock,
    applyInstallerMigrationPlan,
    classifyArtifact,
    discoverInstallerMigrations,
    migrationChecksum,
    planInstallerMigrations,
    readInstallManifest,
    readInstallState,
    runInstallerMigrations,
    writeInstallState,
};
