// The board's rules with no IO, ported from the VS Code viewer and bundled into apps/claude-mod by its build.

import { countTaskCheckboxes, listTasks, phaseProgress } from './tasks.mjs';
import { deriveStepHistory, deriveTimingSummary, formatElapsed } from './vendor/step-history.mjs';

export { countTaskCheckboxes, listTasks, phaseProgress, formatElapsed };

export const PIPELINE_STEPS = ['specify', 'plan', 'tasks', 'implement'];
export const DEFAULT_SPEC_DIRS = ['specs', '.specify/specs'];

const STATUS_LABELS = {
    draft: 'Draft',
    specifying: 'Specifying',
    specified: 'Specified',
    planning: 'Planning',
    planned: 'Planned',
    tasking: 'Tasking',
    'ready-to-implement': 'Ready to Implement',
    implementing: 'Implementing',
    implemented: 'Implemented',
    completed: 'Completed',
    archived: 'Archived',
};

// How far along the pipeline each status puts a spec: steps finished, and the step in flight.
const STATUS_REACH = {
    draft: [0, null],
    specifying: [0, 'specify'],
    specified: [1, null],
    planning: [1, 'plan'],
    planned: [2, null],
    tasking: [2, 'tasks'],
    'ready-to-implement': [3, null],
    implementing: [3, 'implement'],
    implemented: [4, null],
    completed: [4, null],
    archived: [4, null],
};

const TERMINAL = new Set(['completed', 'archived']);
const NAMED_SPEC_SUFFIX = '.spec.md';

export function specStatusLabel(status) {
    if (!status) return 'No record';
    return (Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status] : null) ?? status.split('-').filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join(' ');
}

/** `spec.md`, or the folder's own `<name>.spec.md` when the living-spec naming is in use. */
export function pickFeatureSpecName(folderName, fileNames) {
    const named = fileNames.filter(n => n.endsWith(NAMED_SPEC_SUFFIX)).sort();
    if (named.length > 0) {
        const own = folderName.replace(/^\d+-/, '') + NAMED_SPEC_SUFFIX;
        return named.includes(own) ? own : named[0];
    }
    return 'spec.md';
}

/** A folder holds a spec when it has a markdown file or a run record. */
export function isSpecFolder(fileNames) {
    return fileNames.some(n => n.endsWith('.md') || n === '.spec-context.json');
}

/** `speckit.specDirectories` from a workspace `settings.json` text, or null when it is unset or unreadable. */
export function parseSpecDirsSetting(raw) {
    try {
        const settings = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
        const dirs = settings['speckit.specDirectories'];
        if (Array.isArray(dirs) && dirs.length > 0) {
            return dirs.filter(d => typeof d === 'string' && !/[*?[\]{}]/.test(d));
        }
    } catch { /* not JSON */ }
    return null;
}

/** The run record from its text, or null when missing, malformed, or not an object. */
export function parseSpecContext(text) {
    if (typeof text !== 'string') return null;
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

const isStepLevel = entry => entry && entry.substep == null && entry.task == null;

/** not-started | in-progress | completed for each pipeline step, from the run record. */
export function deriveStepBadges(ctx) {
    const history = Array.isArray(ctx?.history) ? ctx.history : [];
    const [reached, inFlight] = (typeof ctx?.status === 'string' && Object.hasOwn(STATUS_REACH, ctx.status)) ? STATUS_REACH[ctx.status] : [0, null];
    const currentIdx = PIPELINE_STEPS.indexOf(ctx?.currentStep);
    const badges = {};
    PIPELINE_STEPS.forEach((step, idx) => {
        const entries = history.filter(e => e?.step === step);
        const finished = entries.some(e => e.kind === 'complete' && isStepLevel(e));
        if (finished || idx < reached || (currentIdx >= 0 && idx < currentIdx)) {
            badges[step] = 'completed';
        } else if (inFlight === step || (step === ctx?.currentStep && entries.length > 0 && !TERMINAL.has(ctx?.status))) {
            badges[step] = 'in-progress';
        } else {
            badges[step] = 'not-started';
        }
    });
    return badges;
}

/** The same badges read off the files alone, for a folder with no run record. */
export function deriveBadgesFromFiles(files, tasks) {
    const done = step => (files[step] ? 'completed' : 'not-started');
    let implement = 'not-started';
    if (tasks && tasks.total > 0) {
        if (tasks.checked === tasks.total) implement = 'completed';
        else if (tasks.checked > 0) implement = 'in-progress';
    }
    return { specify: done('spec'), plan: done('plan'), tasks: done('tasks'), implement };
}

function firstHeading(markdown) {
    const line = markdown?.split('\n').find(l => /^#\s+/.test(l));
    return line ? line.replace(/^#\s+/, '').replace(/^Feature Specification:\s*/i, '').trim() : null;
}

/** The board row for one spec folder, from the texts read off disk; `files` names the spec, plan and tasks files that exist. */
export function buildSpecRow({ id, ctx, specText, files, tasksText, updatedAt }) {
    const name = id.split('/').pop();
    const tasks = tasksText != null ? countTaskCheckboxes(tasksText) : null;
    const status = typeof ctx?.status === 'string' ? ctx.status : null;
    const steps = ctx ? deriveStepBadges(ctx) : deriveBadgesFromFiles(files, tasks);
    const history = Array.isArray(ctx?.history) ? ctx.history : [];
    const lastActivity = history.reduce((max, e) => (typeof e?.at === 'string' && e.at > max ? e.at : max), '') || null;
    const done = status ? TERMINAL.has(status) : steps.implement === 'completed';
    const pendingReviews = Array.isArray(ctx?.reviewComments)
        ? ctx.reviewComments.filter(c => c?.status !== 'applied').length
        : 0;

    return {
        id,
        name,
        number: name.match(/^(\d+)-/)?.[1] ?? null,
        local: name.startsWith('_'),
        title: (typeof ctx?.specName === 'string' && ctx.specName) || firstHeading(specText) || name,
        workflow: typeof ctx?.workflow === 'string' ? ctx.workflow : null,
        branch: typeof ctx?.branch === 'string' ? ctx.branch : null,
        hasContext: ctx != null,
        status,
        statusLabel: specStatusLabel(status),
        currentStep: typeof ctx?.currentStep === 'string' ? ctx.currentStep : null,
        steps,
        tasks,
        files,
        done,
        pendingReviews,
        lastActivity,
        updatedAt: updatedAt ?? null,
    };
}

// The run record's last event is the real "last touched"; file times only mean something without one (a checkout resets them).
const sortKey = spec => spec.lastActivity ?? spec.updatedAt ?? '';

/** Rows most recently touched first, in place. */
export function sortSpecs(rows) {
    return rows.sort((a, b) => sortKey(b).localeCompare(sortKey(a)) || b.name.localeCompare(a.name));
}

/** Find a spec by id (`specs/042-x`), folder name (`042-x`), or number (`042`). */
export function findSpec(specs, query) {
    const q = String(query ?? '').trim().replace(/\/+$/, '');
    if (!q) return null;
    return specs.find(s => s.id === q)
        ?? specs.find(s => s.name === q)
        ?? specs.find(s => s.number && s.number === q.padStart(s.number.length, '0'))
        ?? specs.find(s => s.name.toLowerCase().includes(q.toLowerCase()))
        ?? null;
}

/** The task in flight: started in the history and not finished since. */
export function currentTask(ctx) {
    const open = new Set();
    for (const entry of Array.isArray(ctx?.history) ? ctx.history : []) {
        if (typeof entry?.task !== 'string') continue;
        if (entry.kind === 'start') open.add(entry.task);
        else if (entry.kind === 'complete') open.delete(entry.task);
    }
    return [...open].pop() ?? null;
}

/** Each step's span and whether it counts as measured, derived exactly as the VS Code viewer derives it. */
export function stepTiming(ctx) {
    const history = (Array.isArray(ctx?.history) ? ctx.history : []).filter(entry => entry && typeof entry.step === 'string' && typeof entry.at === 'string');
    return deriveStepHistory(history, ctx?.currentStep, ctx?.status);
}

/** Each recorded phase's measured duration (or null), and the active total once every pipeline step was measured. */
export function phaseTimings(ctx) {
    const timing = stepTiming(ctx);
    const known = PIPELINE_STEPS.filter(s => timing[s]);
    const names = [...known, ...Object.keys(timing).filter(s => !PIPELINE_STEPS.includes(s))];
    const phases = names.map(step => {
        const entry = timing[step];
        const measured = entry.durationTrusted && entry.completedAt && !entry.folded;
        return {
            step,
            durationMs: measured ? Date.parse(entry.completedAt) - Date.parse(entry.startedAt) : null,
            inFlight: Boolean(entry.startedAt && !entry.completedAt),
        };
    });
    const summary = deriveTimingSummary(timing, PIPELINE_STEPS);
    const totalMs = summary.complete && summary.elapsedMs !== undefined ? summary.elapsedMs : null;
    return { phases, totalMs, measuredPhases: summary.measuredPhases, expectedPhases: summary.expectedPhases };
}

/** `12m active` once every step was measured, else how many were. */
export function timingSummaryText(timings) {
    return timings.totalMs != null
        ? `${formatElapsed(timings.totalMs)} active`
        : `Timing coverage: ${timings.measuredPhases} of ${timings.expectedPhases} phases`;
}
