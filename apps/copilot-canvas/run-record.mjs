// The run record the board keeps itself where nothing else can: one step it sent, written once that chat turn ended with the
// step's document on disk. Both times are ones the board saw, so a step run any other way gets no entry and no time.

import { readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { parseSpecContext, statusFromSteps } from './spec-rules.mjs';

const FILE = '.spec-context.json';
const FINISHED = new Set(['completed', 'archived']);

/**
 * Append a step's start and finish to the spec's record, creating the record when there is none. Writes nothing and returns false
 * when the folder leads outside the project, the record is unreadable, the spec is already closed, or its history ends in a step
 * that started and never finished.
 */
export function recordStep(root, { id, title }, step, startedAt, endedAt) {
    const dir = join(root, id);
    try {
        if (!realpathSync(dir).startsWith(realpathSync(root) + sep)) return false;
    } catch {
        return false;
    }
    let text = null;
    try {
        text = readFileSync(join(dir, FILE), 'utf8');
    } catch { /* no record yet */ }
    const existing = parseSpecContext(text);
    if ((text != null && !existing) || FINISHED.has(existing?.status)) return false;
    const history = Array.isArray(existing?.history) ? existing.history : [];
    // An open step would be closed by this one's start and so gain a time nobody measured.
    if (history.filter(e => e && e.substep == null && e.task == null).at(-1)?.kind === 'start') return false;
    const ctx = existing ?? { workflow: 'speckit', specName: title, selectedAt: startedAt };
    const entry = (kind, at) => ({ step, substep: null, kind, by: 'extension', at });
    const next = {
        ...ctx,
        currentStep: step,
        status: statusFromSteps({ [step]: 'completed' }),
        history: [...history, entry('start', startedAt), entry('complete', endedAt)],
    };
    const temp = join(dir, `${FILE}.${process.pid}.tmp`);
    writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`);
    renameSync(temp, join(dir, FILE));
    return true;
}
