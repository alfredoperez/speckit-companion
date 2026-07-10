"use strict";
/**
 * CLI I/O primitives — output(), error(), ERROR_REASON, JSON-error mode,
 * and the temp-file helpers that output() depends on.
 *
 * Extracted from core.cts (ADR-857 rollout phase 1 / issue #859).
 * The hand-written bodies are preserved byte-for-behaviour; only the module
 * boundary moved. The core.cjs re-export spine was retired in epic #1267;
 * callers import I/O primitives from io.cjs directly.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const shell_command_projection_cjs_1 = require("./shell-command-projection.cjs");
// ─── Temp-file helpers (needed by output()) ──────────────────────────────────
/**
 * Dedicated GSD temp directory: path.join(os.tmpdir(), 'gsd').
 * Created on first use. Keeps GSD temp files isolated from the system
 * temp directory so reap scans only GSD files (#1975).
 */
const GSD_TEMP_DIR = node_path_1.default.join(node_os_1.default.tmpdir(), 'gsd');
function ensureGsdTempDir() {
    (0, shell_command_projection_cjs_1.platformEnsureDir)(GSD_TEMP_DIR);
}
/**
 * Remove stale gsd-* temp files/dirs older than maxAgeMs (default: 5 minutes).
 * Runs opportunistically before each new temp file write to prevent unbounded accumulation.
 * @param prefix - filename prefix to match (e.g., 'gsd-')
 * @param opts
 * @param opts.maxAgeMs - max age in ms before removal (default: 5 min)
 * @param opts.dirsOnly - if true, only remove directories (default: false)
 */
function reapStaleTempFiles(prefix = 'gsd-', { maxAgeMs = 5 * 60 * 1000, dirsOnly = false } = {}) {
    try {
        ensureGsdTempDir();
        const now = Date.now();
        const entries = node_fs_1.default.readdirSync(GSD_TEMP_DIR);
        for (const entry of entries) {
            if (!entry.startsWith(prefix))
                continue;
            const fullPath = node_path_1.default.join(GSD_TEMP_DIR, entry);
            try {
                const stat = node_fs_1.default.statSync(fullPath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    if (stat.isDirectory()) {
                        node_fs_1.default.rmSync(fullPath, { recursive: true, force: true });
                    }
                    else if (!dirsOnly) {
                        node_fs_1.default.unlinkSync(fullPath);
                    }
                }
            }
            catch {
                // File may have been removed between readdir and stat — ignore
            }
        }
    }
    catch {
        // Non-critical — don't let cleanup failures break output
    }
}
// ─── Output helpers ───────────────────────────────────────────────────────────
/**
 * Transient write errnos. When stdout/stderr is a NON-BLOCKING pipe — as it is
 * under the parallel `node --test` runner on Linux CI — a full pipe buffer makes
 * `fs.writeSync` throw EAGAIN, and a signal can interrupt it with EINTR. Both
 * clear on retry once the reader drains. This is the same transient class the
 * STATE.md lock path already retries (ACQUIRE_LOCK_RETRY_ERRNOS, #3776); #1008.
 */
const WRITE_RETRY_ERRNOS = new Set(['EAGAIN', 'EINTR']);
// Bounded so a pathological never-draining fd cannot spin forever. Each retry
// yields the thread for ~1ms via Atomics.wait (the project's sync-sleep idiom —
// see clock.cts realClock.sleep), so the cap is ~1s of total back-pressure wait.
const WRITE_MAX_RETRIES = 1000;
const WRITE_RETRY_BACKOFF_MS = 1;
// Sleep buffer is lazily allocated on the FIRST back-pressure retry (rare — only
// when a non-blocking pipe is full) and then reused. Keeping it out of module
// load costs nothing on the overwhelmingly common no-retry path and avoids
// perturbing SharedArrayBuffer-allocation accounting in other modules (perf-316).
let _writeSleepBuf = null;
function backoffOnce() {
    if (_writeSleepBuf === null)
        _writeSleepBuf = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(_writeSleepBuf, 0, 0, WRITE_RETRY_BACKOFF_MS);
}
/**
 * Write the entire payload to `fd`, tolerating non-blocking-pipe back-pressure.
 *
 * `fs.writeSync` does NOT block on a non-blocking pipe: a full buffer throws
 * EAGAIN, and a partially-drained buffer returns a SHORT count (fewer bytes than
 * requested). The previous bare `fs.writeSync(fd, string)` call assumed it always
 * blocked until the kernel accepted every byte — false under load, which both
 * threw spurious errors and risked silently truncating output (#1008).
 *
 * This loops on short counts (advancing the offset) and retries EAGAIN/EINTR with
 * a brief Atomics.wait backoff that yields the thread so the reader can drain.
 * Non-transient errors (e.g. EPIPE) propagate unchanged.
 */
function writeAllSync(fd, data) {
    const buf = Buffer.from(data, 'utf8');
    let offset = 0;
    let retries = 0;
    while (offset < buf.length) {
        try {
            offset += node_fs_1.default.writeSync(fd, buf, offset, buf.length - offset);
        }
        catch (err) {
            const code = err.code ?? '';
            if (WRITE_RETRY_ERRNOS.has(code) && retries < WRITE_MAX_RETRIES) {
                retries += 1;
                backoffOnce();
                continue;
            }
            throw err;
        }
    }
}
function output(result, raw, rawValue) {
    let data;
    if (raw && rawValue !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        data = String(rawValue);
    }
    else {
        const json = JSON.stringify(result, null, 2);
        // Large payloads exceed Claude Code's Bash tool buffer (~50KB).
        // Write to tmpfile and output the path prefixed with @file: so callers can detect it.
        if (json.length > 50000) {
            reapStaleTempFiles();
            ensureGsdTempDir();
            const tmpPath = node_path_1.default.join(GSD_TEMP_DIR, `gsd-${Date.now()}.json`);
            (0, shell_command_projection_cjs_1.platformWriteSync)(tmpPath, json);
            data = '@file:' + tmpPath;
        }
        else {
            data = json;
        }
    }
    // process.stdout.write() is async when stdout is a pipe — process.exit()
    // can tear down the process before the reader consumes the buffer. writeAllSync
    // pushes every byte synchronously (looping short counts, retrying EAGAIN/EINTR),
    // and skipping process.exit() lets the event loop drain naturally.
    writeAllSync(1, data);
}
/**
 * Frozen enum of typed reason codes used by error() for structured errors.
 * Each subcommand contributes its own codes; the enum exists so tests can
 * assert against typed values instead of grepping stderr (#2974).
 *
 * Adding a new code:
 *   - Pick a snake_case lowercase value (the JSON wire form)
 *   - Group by subsystem prefix (CONFIG_*, SDK_*, etc)
 *   - Pass it to error(msg, ERROR_REASON.NEW_CODE) at the call site
 */
const ERROR_REASON = Object.freeze({
    // config-get / config-set
    CONFIG_KEY_NOT_FOUND: 'config_key_not_found',
    CONFIG_NO_FILE: 'config_no_file',
    CONFIG_PARSE_FAILED: 'config_parse_failed',
    CONFIG_INVALID_KEY: 'config_invalid_key',
    // SDK / gsd-tools dispatch
    SDK_FAIL_FAST: 'sdk_fail_fast',
    SDK_UNKNOWN_COMMAND: 'sdk_unknown_command',
    SDK_MISSING_ARG: 'sdk_missing_arg',
    // workflow / phase
    PHASE_NOT_FOUND: 'phase_not_found',
    PHASE_VERIFICATION_INCOMPLETE: 'phase_verification_incomplete',
    SUMMARY_NO_PLANNING: 'summary_no_planning',
    // graphify
    GRAPHIFY_NO_GRAPH: 'graphify_no_graph',
    GRAPHIFY_INVALID_QUERY: 'graphify_invalid_query',
    // hooks
    HOOKS_OPT_OUT: 'hooks_opt_out',
    // security-scan
    SECURITY_SCAN_FAILED: 'security_scan_failed',
    // generic
    USAGE: 'usage',
    UNKNOWN: 'unknown',
});
/**
 * Process-level flag: when true, error() emits structured JSON to stderr
 * instead of plain "Error: <message>" text. Set by gsd-tools.cjs when the
 * CLI is invoked with `--json-errors`. Tests opt in to typed-IR error
 * assertions by passing that flag and parsing the JSON.
 *
 * Default off so existing callers and human operators keep their plain-text
 * diagnostics. The structured form is opt-in for tooling and tests (#2974).
 */
let _jsonErrorMode = false;
function setJsonErrorMode(v) { _jsonErrorMode = !!v; }
function getJsonErrorMode() { return _jsonErrorMode; }
/**
 * Emit an error and exit. When the second argument is provided it must be
 * a value from ERROR_REASON; tests can assert on `result.reason`. When the
 * process is in JSON-error mode, stderr receives `{ ok: false, reason,
 * message }` so callers can parse it; otherwise stderr keeps the plain
 * text form for human operators.
 */
function error(message, reason = ERROR_REASON.UNKNOWN) {
    if (_jsonErrorMode) {
        const payload = JSON.stringify({ ok: false, reason, message }) + '\n';
        writeAllSync(2, payload);
    }
    else {
        writeAllSync(2, 'Error: ' + message + '\n');
    }
    process.exit(1);
}
module.exports = {
    GSD_TEMP_DIR,
    ensureGsdTempDir,
    reapStaleTempFiles,
    output,
    ERROR_REASON,
    setJsonErrorMode,
    getJsonErrorMode,
    error,
};
