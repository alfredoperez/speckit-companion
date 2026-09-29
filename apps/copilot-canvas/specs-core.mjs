// Reads spec folders and derives what the board shows. Ports the rules of
// apps/vscode/src/features/specs/stepHistoryDerivation.ts and specStatusLabel.ts.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative, sep } from 'node:path';
import { countTaskCheckboxes, listTasks, phaseProgress } from './tasks.mjs';
import { renderMarkdown } from './markdown.mjs';

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
    return STATUS_LABELS[status] ?? status.split('-').filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join(' ');
}

/** `spec.md`, or the folder's own `<name>.spec.md` when the living-spec naming is in use. */
export function featureSpecName(specDir) {
    try {
        const named = readdirSync(specDir).filter(n => n.endsWith(NAMED_SPEC_SUFFIX)).sort();
        if (named.length > 0) {
            const own = basename(specDir).replace(/^\d+-/, '') + NAMED_SPEC_SUFFIX;
            return named.includes(own) ? own : named[0];
        }
    } catch { /* unreadable dir reads as stock */ }
    return 'spec.md';
}

/** The spec directories to scan: `speckit.specDirectories` from workspace settings when set, else the defaults. */
export function resolveSpecDirs(root) {
    try {
        const raw = readFileSync(join(root, '.vscode', 'settings.json'), 'utf8');
        const settings = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
        const dirs = settings['speckit.specDirectories'];
        if (Array.isArray(dirs) && dirs.length > 0) {
            return dirs.filter(d => typeof d === 'string' && !/[*?[\]{}]/.test(d));
        }
    } catch { /* no workspace settings */ }
    return DEFAULT_SPEC_DIRS;
}

function isSpecFolder(dir) {
    try {
        return readdirSync(dir).some(n => n.endsWith('.md') || n === '.spec-context.json');
    } catch {
        return false;
    }
}

/** Every spec folder under the spec directories, as root-relative POSIX ids. */
export function listSpecFolders(root, specDirs = DEFAULT_SPEC_DIRS) {
    const ids = [];
    for (const specDir of specDirs) {
        const base = join(root, specDir);
        let entries;
        try {
            entries = readdirSync(base, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
            const dir = join(base, entry.name);
            if (isSpecFolder(dir)) ids.push(relative(root, dir).split(sep).join('/'));
        }
    }
    return ids;
}

export function readSpecContext(dir) {
    try {
        const parsed = JSON.parse(readFileSync(join(dir, '.spec-context.json'), 'utf8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function readText(path) {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

const isStepLevel = entry => entry && entry.substep == null && entry.task == null;

/** not-started | in-progress | completed for each pipeline step, from the run record. */
export function deriveStepBadges(ctx) {
    const history = Array.isArray(ctx?.history) ? ctx.history : [];
    const [reached, inFlight] = STATUS_REACH[ctx?.status] ?? [0, null];
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

function latestMtime(dir) {
    let latest = 0;
    try {
        for (const name of readdirSync(dir)) {
            try {
                latest = Math.max(latest, statSync(join(dir, name)).mtimeMs);
            } catch { /* vanished mid-scan */ }
        }
    } catch { /* unreadable */ }
    return latest ? new Date(latest).toISOString() : null;
}

/** The board row for one spec folder. */
export function scanSpec(root, id) {
    const dir = join(root, id);
    const name = basename(dir);
    const ctx = readSpecContext(dir);
    const specFile = featureSpecName(dir);
    const specText = readText(join(dir, specFile));
    const files = {
        spec: specText != null ? specFile : null,
        plan: existsSync(join(dir, 'plan.md')) ? 'plan.md' : null,
        tasks: existsSync(join(dir, 'tasks.md')) ? 'tasks.md' : null,
    };
    const tasksText = files.tasks ? readText(join(dir, 'tasks.md')) : null;
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
        updatedAt: latestMtime(dir),
    };
}

// The run record's last event is the real "last touched"; file times only mean something without one (a checkout resets them).
function sortKey(spec) {
    return spec.lastActivity ?? spec.updatedAt ?? '';
}

/** Every spec, most recently touched first. */
export function buildSnapshot(root, specDirs = resolveSpecDirs(root)) {
    const specs = listSpecFolders(root, specDirs).map(id => scanSpec(root, id));
    specs.sort((a, b) => sortKey(b).localeCompare(sortKey(a)) || b.name.localeCompare(a.name));
    return {
        generatedAt: new Date().toISOString(),
        root,
        repoName: basename(root),
        specDirs,
        specs,
    };
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

const DOC_ORDER = ['spec', 'plan', 'tasks', 'research', 'data-model', 'quickstart'];
const DOC_LABELS = { spec: 'Spec', plan: 'Plan', tasks: 'Tasks', research: 'Research', 'data-model': 'Data model', quickstart: 'Quickstart' };

function listDocuments(dir, specFile) {
    const docs = [];
    let names = [];
    try {
        names = readdirSync(dir).filter(n => n.endsWith('.md')).sort();
    } catch { /* unreadable */ }
    for (const fileName of names) {
        const type = fileName === specFile ? 'spec' : fileName.replace(/\.md$/, '');
        docs.push({ type, fileName, label: DOC_LABELS[type] ?? type.replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase()) });
    }
    try {
        for (const fileName of readdirSync(join(dir, 'checklists')).filter(n => n.endsWith('.md')).sort()) {
            const type = `checklists/${fileName.replace(/\.md$/, '')}`;
            docs.push({ type, fileName: `checklists/${fileName}`, label: `Checklist: ${fileName.replace(/\.md$/, '').replace(/[-_]/g, ' ')}` });
        }
    } catch { /* no checklists */ }
    const rank = d => (DOC_ORDER.includes(d.type) ? DOC_ORDER.indexOf(d.type) : DOC_ORDER.length);
    return docs.sort((a, b) => rank(a) - rank(b) || a.fileName.localeCompare(b.fileName));
}

function asText(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return value.what ?? value.decision ?? value.summary ?? null;
    return null;
}

/** Everything the detail pane shows for one spec: rendered documents, tasks, history, and the record's narrative. */
export function readSpecDetail(root, id, { html = true } = {}) {
    const spec = scanSpec(root, id);
    const dir = join(root, id);
    const ctx = readSpecContext(dir) ?? {};
    const documents = listDocuments(dir, featureSpecName(dir)).map(doc => {
        const raw = readText(join(dir, doc.fileName));
        return html ? { ...doc, html: renderMarkdown(raw ?? '') } : doc;
    });
    const tasksText = spec.files.tasks ? readText(join(dir, 'tasks.md')) ?? '' : '';
    const history = (Array.isArray(ctx.history) ? ctx.history : [])
        .filter(e => e && typeof e.step === 'string' && typeof e.at === 'string')
        .map(e => ({ step: e.step, substep: e.substep ?? null, task: e.task ?? null, kind: e.kind ?? null, by: e.by ?? null, at: e.at }));
    const list = key => (Array.isArray(ctx[key]) ? ctx[key].map(asText).filter(Boolean) : []);

    return {
        spec,
        documents,
        taskList: listTasks(tasksText),
        phases: phaseProgress(tasksText),
        history,
        intent: typeof ctx.intent === 'string' ? ctx.intent : null,
        approach: typeof ctx.approach === 'string' ? ctx.approach : null,
        decisions: list('decisions'),
        verified: list('verified'),
        concerns: Array.isArray(ctx.concerns) ? ctx.concerns.map(asText).filter(Boolean) : (typeof ctx.concerns === 'string' ? [ctx.concerns] : []),
        lastAction: typeof ctx.last_action === 'string' ? ctx.last_action : null,
    };
}
