// The run record the board keeps where nothing else can: a step it sent, once that chat turn ended with the step's document written.

import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { PIPELINE_STEPS, parseSpecContext, statusFromSteps, statusRank } from './spec-rules.mjs';

const FILE = '.spec-context.json';
const FINISHED = new Set(['completed', 'archived']);
const LOCK_ABANDONED_MS = 30000;

// Python's `Path.resolve()`, as `specContextWriter.ts` has it: symlinks followed as far as the path exists.
function realPath(target) {
    const abs = resolve(target);
    const trailing = [];
    for (let head = abs; ;) {
        try {
            return join(realpathSync(head), ...trailing);
        } catch {
            const parent = dirname(head);
            if (parent === head) return abs;
            trailing.unshift(basename(head));
            head = parent;
        }
    }
}

function lockRoot() {
    try {
        if (process.platform !== 'win32' && statSync('/tmp').isDirectory()) return '/tmp';
    } catch { /* no /tmp: use what this process was given */ }
    return tmpdir();
}

/** Where the cross-process lock for one record lives; must match `specContextLockPath` and `spec_context._lock_path`. */
export function recordLockPath(target) {
    const key = createHash('sha256').update(realPath(target), 'utf8').digest('hex').slice(0, 32);
    return join(lockRoot(), 'speckit-companion-locks', `${key}.lock`);
}

function pidScope() {
    try {
        return `${hostname()}.${statSync('/proc/self/ns/pid').ino}`;
    } catch {
        return hostname();
    }
}

// A holder is gone only when its pid is from this scope and no longer exists; anything unanswerable is not "gone".
function ownerIsGone(owner) {
    const [pid, scope, nonce] = owner.split(':');
    if (nonce === undefined || scope !== pidScope() || !(Number(pid) > 0)) return false;
    try {
        process.kill(Number(pid), 0);
        return false;
    } catch (error) {
        return error.code === 'ESRCH';
    }
}

const read = (path) => {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
};

/** Take the lock the other writers take: a token to release it with, null to write unlocked, false when a live writer holds it. */
function acquireLock(target) {
    const lock = recordLockPath(target);
    try {
        mkdirSync(dirname(lock), { recursive: true });
    } catch {
        return null;
    }
    try {
        chmodSync(dirname(lock), 0o1777);
    } catch { /* not ours to change */ }
    const token = `${process.pid}:${pidScope()}:${randomBytes(8).toString('hex')}`;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            writeFileSync(lock, token, { flag: 'wx' });
            return token;
        } catch (error) {
            if (error.code !== 'EEXIST') return null;
        }
        const owner = read(lock);
        const abandoned = Date.now() - (statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now()) >= LOCK_ABANDONED_MS;
        if (owner === null || !(ownerIsGone(owner) || abandoned)) return false;
        try {
            if (read(lock) === owner) unlinkSync(lock);
        } catch { /* someone else reclaimed it first */ }
    }
    return false;
}

function releaseLock(target, token) {
    const lock = recordLockPath(target);
    try {
        if (token && read(lock) === token) unlinkSync(lock);
    } catch { /* already gone */ }
}

// Only a missing file means there is no record; any other read error means there may be one, so nothing is written.
function readRecord(target) {
    try {
        return { text: readFileSync(target, 'utf8') };
    } catch (error) {
        return error.code === 'ENOENT' ? { text: null } : { unreadable: true };
    }
}

// The record with the step appended, or null when it must be left alone: unreadable, closed, mid-step, or already at or past this step.
function advanced(record, title, step, startedAt, endedAt) {
    if (record.unreadable) return null;
    const existing = parseSpecContext(record.text);
    if (record.text != null && !existing) return null;
    const status = statusFromSteps({ [step]: 'completed' });
    const history = Array.isArray(existing?.history) ? existing.history : [];
    if (existing) {
        if (FINISHED.has(existing.status) || statusRank(existing.status) < 0 || statusRank(existing.status) >= statusRank(status)) return null;
        if (PIPELINE_STEPS.indexOf(existing.currentStep) > PIPELINE_STEPS.indexOf(step)) return null;
        // An open step would be closed by this one's start and so gain a time nobody measured.
        if (history.filter(e => e && e.substep == null && e.task == null).at(-1)?.kind === 'start') return null;
    }
    const entry = (kind, at) => ({ step, substep: null, kind, by: 'extension', at });
    const base = existing ?? { workflow: 'speckit', specName: title, selectedAt: startedAt };
    return { ...base, currentStep: step, status, history: [...history, entry('start', startedAt), entry('complete', endedAt)] };
}

/** Append a step's start and finish to the spec's record, forward only and under the writers' lock; false when nothing was written. */
export function recordStep(root, { id, title }, step, startedAt, endedAt) {
    const dir = join(root, id);
    try {
        if (!realpathSync(dir).startsWith(realpathSync(root) + sep)) return false;
    } catch {
        return false;
    }
    const target = join(dir, FILE);
    const token = acquireLock(target);
    if (token === false) return false;
    try {
        const next = advanced(readRecord(target), title, step, startedAt, endedAt);
        if (!next) return false;
        const temp = join(dir, `${FILE}.${process.pid}.tmp`);
        writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`);
        renameSync(temp, target);
        return true;
    } finally {
        releaseLock(target, token);
    }
}
