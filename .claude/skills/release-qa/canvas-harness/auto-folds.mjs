// Judges the canvas-auto-folds check from what a run left behind, so it can be tested without a live session.

// A shell can read a command's files but cannot run a slash command, so it counts as a read too.
const READS = new Set(['view', 'glob', 'rg', 'grep', 'read', 'read_file', 'ls', 'search', 'bash', 'shell', 'powershell']);
const COMMAND = /speckit[.-]companion[.-](plan|tasks)\b/;
const FILE_MENTION = /\S*speckit[.-]companion[.-](plan|tasks)\b\S*\.md\b/g;
const FOLD_WINDOW_MS = 1000;

/** A tool call that runs the plan or tasks command, as opposed to reading one of their files. */
export const invokesPlanOrTasks = (tool) => !READS.has(tool.name) && COMMAND.test((tool.detail ?? '').replace(FILE_MENTION, ''));

/** Plan and tasks each have a start and a complete, all written by the extension within one second: what `--fold plan,tasks` writes. */
export function foldSignature(history = []) {
    const boundaries = ['plan', 'tasks'].flatMap((step) => ['start', 'complete'].map((kind) => history.find((h) => h.step === step && h.kind === kind && !h.task && !h.substep)));
    if (boundaries.some((h) => !h)) return { folded: false, why: 'plan and tasks are not both recorded as started and done' };
    if (boundaries.some((h) => h.by !== 'extension')) return { folded: false, why: 'a plan or tasks boundary was not written by the extension' };
    const times = boundaries.map((h) => Date.parse(h.at));
    const span = Math.max(...times) - Math.min(...times);
    if (!Number.isFinite(span)) return { folded: false, why: 'a plan or tasks boundary has no valid timestamp' };
    return span <= FOLD_WINDOW_MS ? { folded: true, span } : { folded: false, why: `plan and tasks were recorded ${Math.round(span / 1000)}s apart, not in one fold` };
}

/** PASS when no plan or tasks command ran, the record carries the fold signature and tasks.md exists. */
export function judgeAutoFold({ tools = [], replies = [], context, tasksWritten }) {
    const ran = tools.filter(invokesPlanOrTasks).map((t) => `${t.name}: ${t.detail}`);
    const fold = foldSignature(context?.history);
    const problems = [
        ran.length && `it ran ${ran.join(' | ')}`,
        !fold.folded && fold.why,
        !tasksWritten && 'no tasks.md was written',
    ].filter(Boolean);
    const said = replies.some((reply) => /folded plan and tasks|fast path/i.test(reply)) ? 'said it folded' : 'never said it folded';
    const ok = `no plan or tasks command ran; folded in ${fold.span}ms`;
    return { result: problems.length ? 'FAIL' : 'PASS', evidence: `${problems.length ? problems.join('; ') : ok}; ${said}` };
}
