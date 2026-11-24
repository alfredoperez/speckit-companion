/**
 * The stock Spec Kit workflow, read from the project's own files.
 *
 * Nothing here comes from the extension's bundle. A stock project has no
 * `companion.yml`, no nodes and no phases, so a board drawn from Companion's
 * shipped pipeline would be describing a run this project cannot perform.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
    HookWhen, StockHookRow, StockStepRow, StockTemplate, StockTemplateLayer,
    StockWorkflowChoice, StockWorkflowView,
} from '../../protocol/pipeline';

const WORKFLOWS_REL = path.join('.specify', 'workflows');
const EXTENSIONS_REL = path.join('.specify', 'extensions.yml');
const TEMPLATES_REL = path.join('.specify', 'templates');
const OVERRIDES_REL = path.join(TEMPLATES_REL, 'overrides');
const PRESETS_REL = path.join('.specify', 'presets');
const EXTENSION_DIRS_REL = path.join('.specify', 'extensions');
const STRATEGIES: Array<StockTemplateLayer['strategy']> = [
    'replace', 'prepend', 'append', 'wrap', 'replace-section',
];
/** Spec Kit's id rule for presets and extensions it resolves templates from. */
const SAFE_ID = /^[a-z0-9-]+$/;
const CONSTITUTION_REL = path.join('.specify', 'memory', 'constitution.md');

const WHENS: HookWhen[] = ['before', 'after'];

/** Stock Spec Kit's own steps, in the order a run takes them. */
const STOCK_ORDER = [
    'constitution', 'specify', 'clarify', 'plan', 'tasks',
    'analyze', 'checklist', 'implement', 'taskstoissues',
];

/** How each stock step reads, and the documents its template produces. */
const STOCK_STEPS: Record<string, { label: string; writes: string[] }> = {
    constitution: { label: 'Set the constitution', writes: ['memory/constitution.md'] },
    specify: { label: 'Write the spec', writes: ['spec.md'] },
    clarify: { label: 'Clarify the spec', writes: ['spec.md'] },
    plan: { label: 'Plan the work', writes: ['plan.md', 'research.md', 'data-model.md'] },
    tasks: { label: 'Break it into tasks', writes: ['tasks.md'] },
    analyze: { label: 'Analyse the documents', writes: [] },
    checklist: { label: 'Write a checklist', writes: ['checklists/'] },
    implement: { label: 'Implement the tasks', writes: [] },
    taskstoissues: { label: 'Turn tasks into issues', writes: [] },
};

/**
 * What each template shapes, in the order a run reaches them.
 *
 * A note never spells a command. Every command on the board is named in a
 * `command` field, so one formatter decides how all of them read — a dotted
 * name written into prose resolves to nothing in a host that registered dashes.
 */
const STOCK_TEMPLATES: Array<Omit<StockTemplate, 'path'>> = [
    {
        file: 'constitution-template.md', label: 'Constitution',
        note: 'The principles written into memory/constitution.md by',
        command: 'speckit.constitution',
    },
    {
        file: 'spec-template.md', label: 'Spec',
        note: 'The shape of spec.md, filled in by',
        command: 'speckit.specify',
    },
    {
        file: 'plan-template.md', label: 'Plan',
        note: 'The shape of plan.md, filled in by',
        command: 'speckit.plan',
    },
    {
        file: 'tasks-template.md', label: 'Tasks',
        note: 'The shape of tasks.md, filled in by',
        command: 'speckit.tasks',
    },
    {
        file: 'checklist-template.md', label: 'Checklist',
        note: 'The shape of a checklist under checklists/, written by',
        command: 'speckit.checklist',
    },
    {
        file: 'agent-file-template.md', label: 'Agent context',
        note: 'The context file a plan writes for your assistant',
        command: '',
    },
];

/** Where an installed `/speckit.*` command can be found, by provider layout. */
const COMMAND_DIRS = [
    '.github/prompts',
    '.claude/commands',
    '.claude/skills',
    '.codex/prompts',
    '.agents/skills',
    '.gemini/commands',
    '.opencode/command',
];

function read(file: string): string | null {
    try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function loadYaml(file: string): Record<string, unknown> | null {
    const text = read(file);
    if (text === null) { return null; }
    try {
        const parsed = yaml.load(text);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch { return null; }
}

/**
 * Hooks stock Spec Kit's extension registry attaches to one step.
 *
 * A disabled hook is kept rather than dropped — on this board the switch is the
 * one thing a person can change, and a hook that is off has to be visible to be
 * turned back on.
 */
function registryHooks(
    registry: Record<string, unknown> | null, step: string, installed: ReadonlySet<string>,
): StockHookRow[] {
    const hooks = registry?.hooks;
    if (!hooks || typeof hooks !== 'object') { return []; }
    const rows: StockHookRow[] = [];
    for (const when of WHENS) {
        const entries = (hooks as Record<string, unknown>)[`${when}_${step}`];
        if (!Array.isArray(entries)) { continue; }
        entries.forEach((entry, index) => {
            if (!entry || typeof entry !== 'object') { return; }
            const row = entry as Record<string, unknown>;
            const extension = typeof row.extension === 'string' ? row.extension : '';
            rows.push({
                when,
                step,
                index,
                extension: String(row.extension ?? 'an extension'),
                command: String(row.command ?? ''),
                description: String(row.description ?? '').trim(),
                // Absent `enabled` means enabled, matching the command bodies.
                enabled: row.enabled !== false,
                optional: Boolean(row.optional),
                conditional: Boolean(String(row.condition ?? '').trim()),
                // Spec Kit purges hooks only by an installed extension's id,
                // so an entry naming none is the person's and stays theirs.
                own: !installed.has(extension),
                prompt: typeof row.prompt === 'string' ? row.prompt.trim() : '',
            });
        });
    }
    return rows;
}

interface InstalledWorkflow {
    /** The directory under `.specify/workflows/`, which is its address. */
    dir: string;
    rel: string;
    id: string;
    name: string;
    description: string;
    steps: Array<Record<string, unknown>>;
}

/** Every workflow installed in the project, each with its step graph. */
function installedWorkflows(workspaceRoot: string): InstalledWorkflow[] {
    const dir = path.join(workspaceRoot, WORKFLOWS_REL);
    let dirs: string[] = [];
    try {
        dirs = fs.readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    } catch { return []; }
    const found: InstalledWorkflow[] = [];
    for (const name of dirs) {
        const rel = path.join(WORKFLOWS_REL, name, 'workflow.yml');
        const doc = loadYaml(path.join(workspaceRoot, rel));
        const steps = doc?.steps;
        if (!Array.isArray(steps)) { continue; }
        const meta = (doc?.workflow ?? {}) as Record<string, unknown>;
        found.push({
            dir: name,
            rel,
            id: String(meta.id ?? name),
            name: String(meta.name ?? name),
            description: String(meta.description ?? '').trim(),
            steps: steps.filter(step => step && typeof step === 'object') as Array<Record<string, unknown>>,
        });
    }
    return found;
}

/** The `/speckit.*` commands this project actually has, by step name. */
function installedCommands(workspaceRoot: string): string[] {
    const found = new Set<string>();
    for (const rel of COMMAND_DIRS) {
        let entries: string[] = [];
        try { entries = fs.readdirSync(path.join(workspaceRoot, rel)); } catch { continue; }
        for (const entry of entries) {
            const named = /^speckit[.-]([a-z][a-z-]*)/.exec(entry);
            // Nothing under the `companion` namespace is a stock step.
            if (named && !/^companion/.test(named[1])) { found.add(named[1]); }
        }
    }
    return [
        ...STOCK_ORDER.filter(step => found.has(step)),
        ...[...found].filter(step => !STOCK_ORDER.includes(step)).sort(),
    ];
}

/** The step a lifecycle hook key would name, from the command it dispatches. */
function stepName(command: string, id: string): string {
    const named = /^speckit[.-]([a-z][a-z-]*)/.exec(command);
    return named ? named[1] : id;
}

/**
 * Every command in the view, spelled the way this project registers them.
 *
 * One pass over the whole view rather than a call at each site: the board draws
 * command names in three places, and a reader seeing two spellings in one view
 * cannot tell which of them a host would answer to. The formatter is passed in
 * so this module stays free of the editor's configuration.
 */
export function formatStockCommands(
    view: StockWorkflowView, format: (command: string) => string,
): StockWorkflowView {
    const spelled = (command: string) => (command ? format(command) : command);
    return {
        ...view,
        steps: view.steps.map(step => ({ ...step, command: spelled(step.command) })),
        templates: view.templates.map(
            template => ({ ...template, command: spelled(template.command) })),
        constitution: view.constitution
            ? { ...view.constitution, command: spelled(view.constitution.command) }
            : null,
    };
}

/**
 * The file this project would open for a path the board offered, or null.
 *
 * Membership of what the board drew, not a shape test: the panel opens one of
 * the paths it just handed out, so a path invented anywhere else — a traversal,
 * a file outside `.specify/` — has nothing to match and is refused.
 */
export function stockFileToOpen(
    workspaceRoot: string, rel: string, drawing?: string,
): string | null {
    const view = readStockWorkflow(workspaceRoot, drawing);
    const offered = [
        ...view.templates.flatMap(template => [
            template.path, ...(template.layers ?? []).map(layer => layer.path)]),
        ...view.workflows.map(choice => choice.path),
        ...(view.registry ? [view.registry.path] : []),
        ...(view.constitution?.path ? [view.constitution.path] : []),
    ];
    if (!offered.includes(rel)) { return null; }
    const file = path.join(workspaceRoot, rel);
    return fs.existsSync(file) ? file : null;
}

function subdirs(dir: string): string[] {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isDirectory()).map(entry => entry.name);
    } catch { return []; }
}

/**
 * The extensions installed here: the registry's `installed` list and every
 * folder under `.specify/extensions/`. A hook naming none of them is the
 * person's own.
 */
export function installedExtensions(
    workspaceRoot: string, registry = loadYaml(path.join(workspaceRoot, EXTENSIONS_REL)),
): Set<string> {
    const listed = Array.isArray(registry?.installed) ? registry.installed.map(String) : [];
    const folders = subdirs(path.join(workspaceRoot, EXTENSION_DIRS_REL))
        .filter(name => !name.startsWith('.'));
    return new Set([...listed, ...folders]);
}

/** The steps the board drew that a hook can attach to, by their lifecycle name. */
export function hookableSteps(workspaceRoot: string, drawing?: string): string[] {
    return readStockWorkflow(workspaceRoot, drawing).steps
        .filter(step => step.kind === 'command')
        .map(step => stepName(step.command, step.id));
}

/** Spec Kit's priority rule: a whole number from 1 up, else 10. */
function priority(value: unknown): number {
    const number = typeof value === 'boolean' ? NaN : Number(value);
    return Number.isInteger(number) && number >= 1 ? number : 10;
}

function readJson(file: string): Record<string, unknown> | null {
    const text = read(file);
    if (text === null) { return null; }
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch { return null; }
}

/** Enabled ids from a `.registry`, lowest priority first, then by id. */
function ranked(entries: Record<string, unknown>): Array<[number, string]> {
    return Object.entries(entries)
        .filter(([id, meta]) => SAFE_ID.test(id) && meta && typeof meta === 'object'
            && (meta as Record<string, unknown>).enabled !== false)
        .map(([id, meta]) => [priority((meta as Record<string, unknown>).priority), id]);
}

function byRank(a: [number, string], b: [number, string]): number {
    return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
}

/** Presets in the order Spec Kit tries them: the registry when it reads, else the folders. */
function presetOrder(workspaceRoot: string): string[] {
    const dir = path.join(workspaceRoot, PRESETS_REL);
    const presets = readJson(path.join(dir, '.registry'))?.presets;
    if (presets && typeof presets === 'object') {
        return ranked(presets as Record<string, unknown>).sort(byRank).map(([, id]) => id);
    }
    return subdirs(dir).filter(id => SAFE_ID.test(id)).sort();
}

/** Extensions in the order Spec Kit tries them: registered by priority, unregistered at 10. */
function extensionOrder(workspaceRoot: string): string[] {
    const dir = path.join(workspaceRoot, EXTENSION_DIRS_REL);
    const listed = readJson(path.join(dir, '.registry'))?.extensions;
    const registered = listed && typeof listed === 'object' ? listed as Record<string, unknown> : {};
    const rest: Array<[number, string]> = subdirs(dir)
        .filter(id => SAFE_ID.test(id) && !(id in registered))
        .map(id => [10, id]);
    return [...ranked(registered), ...rest].sort(byRank).map(([, id]) => id);
}

/** `<base>/templates/<name>.md`, then `<base>/<name>.md`, workspace-relative. */
function conventional(workspaceRoot: string, baseRel: string, name: string): string | null {
    for (const rel of [path.join(baseRel, 'templates', `${name}.md`), path.join(baseRel, `${name}.md`)]) {
        if (fs.existsSync(path.join(workspaceRoot, rel))) { return rel; }
    }
    return null;
}

/** A preset's file and strategy for one template, as its manifest declares it. */
function presetLayer(workspaceRoot: string, id: string, name: string): StockTemplateLayer | null {
    const baseRel = path.join(PRESETS_REL, id);
    const fallback = conventional(workspaceRoot, baseRel, name);
    const layer = (rel: string, strategy: StockTemplateLayer['strategy']): StockTemplateLayer =>
        ({ kind: 'preset', source: id, path: rel, strategy });
    // simplified: an unreadable manifest falls back to the conventional file, where
    // Spec Kit stops the run with an error; show that error when a board needs it.
    const templates = (loadYaml(path.join(workspaceRoot, baseRel, 'preset.yml'))
        ?.provides as Record<string, unknown> | undefined)?.templates;
    if (Array.isArray(templates)) {
        const entry = templates.find(item => item && typeof item === 'object'
            && (item as Record<string, unknown>).name === name
            && ((item as Record<string, unknown>).type ?? 'template') === 'template') as
            Record<string, unknown> | undefined;
        if (entry) {
            const file = String(entry.file ?? '');
            const strategy = String(entry.strategy ?? 'replace').toLowerCase();
            const rel = path.join(baseRel, file);
            if (!file || path.isAbsolute(file) || file.split(/[\\/]/).includes('..')
                || !fs.existsSync(path.join(workspaceRoot, rel))
                || !STRATEGIES.includes(strategy as StockTemplateLayer['strategy'])) {
                return null;
            }
            return layer(rel, strategy as StockTemplateLayer['strategy']);
        }
    }
    return fallback ? layer(fallback, 'replace') : null;
}

/**
 * The layers one template resolves through, top first, in Spec Kit's order:
 * the project's override, then presets, then extensions, then core. The walk
 * stops at the first layer that replaces; the ones above it compose onto it.
 */
export function templateLayers(workspaceRoot: string, name: string): StockTemplateLayer[] {
    const override = path.join(OVERRIDES_REL, `${name}.md`);
    if (fs.existsSync(path.join(workspaceRoot, override))) {
        return [{ kind: 'override', source: '', path: override, strategy: 'replace' }];
    }
    const layers: StockTemplateLayer[] = [];
    for (const id of presetOrder(workspaceRoot)) {
        const layer = presetLayer(workspaceRoot, id, name);
        if (!layer) { continue; }
        layers.push(layer);
        if (layer.strategy === 'replace') { return layers; }
    }
    for (const id of extensionOrder(workspaceRoot)) {
        const rel = conventional(workspaceRoot, path.join(EXTENSION_DIRS_REL, id), name);
        if (rel) { return [...layers, { kind: 'extension', source: id, path: rel, strategy: 'replace' }]; }
    }
    const core = path.join(TEMPLATES_REL, `${name}.md`);
    if (fs.existsSync(path.join(workspaceRoot, core))) {
        layers.push({ kind: 'core', source: '', path: core, strategy: 'replace' });
    }
    return layers;
}

function markdownFiles(dir: string): string[] {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
            .map(entry => entry.name);
    } catch { return []; }
}

/**
 * The templates this project has, named by what their step does with them,
 * each with the layer a run uses. An override for a template core does not
 * ship is a template of its own.
 */
function templates(workspaceRoot: string): StockTemplate[] {
    const files = [...new Set([
        ...markdownFiles(path.join(workspaceRoot, TEMPLATES_REL)),
        ...markdownFiles(path.join(workspaceRoot, OVERRIDES_REL)),
    ])];
    const coreFiles = new Set(markdownFiles(path.join(workspaceRoot, TEMPLATES_REL)));
    const where = (file: string) => coreFiles.has(file)
        ? path.join(TEMPLATES_REL, file) : path.join(OVERRIDES_REL, file);
    const known = STOCK_TEMPLATES
        .filter(template => files.includes(template.file))
        .map(template => ({ ...template, path: where(template.file) }));
    const rest = files
        .filter(file => !STOCK_TEMPLATES.some(template => template.file === file))
        .sort()
        .map(file => ({
            file,
            path: where(file),
            label: file.replace(/-template\.md$/, '').replace(/\.md$/, ''),
            note: coreFiles.has(file) ? 'A template this project added' : 'A template only your override provides',
            command: '',
        }));
    return [...known, ...rest].map(template => {
        const layers = templateLayers(workspaceRoot, template.file.replace(/\.md$/, ''));
        return { ...template, inForce: layers[0]?.kind ?? 'core', layers };
    });
}

/**
 * The whole stock board: the steps in run order, each with what it writes and
 * the registry hooks attached to it.
 *
 * `drawing` names which installed workflow to read the steps from. Absent, the
 * board draws the first one, which is what a project with one workflow wants.
 */
export function readStockWorkflow(workspaceRoot: string, drawing?: string): StockWorkflowView {
    const registry = loadYaml(path.join(workspaceRoot, EXTENSIONS_REL));
    const installed = installedExtensions(workspaceRoot, registry);
    const all = installedWorkflows(workspaceRoot);
    const workflow = all.find(found => found.id === drawing) ?? all[0];

    const steps: StockStepRow[] = workflow
        ? workflow.steps.map(raw => {
            const id = String(raw.id ?? '');
            const command = String(raw.command ?? '');
            const gate = raw.type === 'gate' || !command;
            const step = stepName(command, id);
            const known = STOCK_STEPS[step];
            return {
                id,
                command,
                kind: gate ? 'gate' as const : 'command' as const,
                label: gate
                    ? String(raw.message ?? 'Wait for a person').trim()
                    : known?.label ?? command,
                writes: gate ? [] : known?.writes ?? [],
                hooks: gate ? [] : registryHooks(registry, step, installed),
                ...(gate ? {} : { hookStep: step }),
            };
        })
        : installedCommands(workspaceRoot).map(step => ({
            id: step,
            command: `speckit.${step}`,
            kind: 'command' as const,
            label: STOCK_STEPS[step]?.label ?? step,
            writes: STOCK_STEPS[step]?.writes ?? [],
            hooks: registryHooks(registry, step, installed),
            hookStep: step,
        }));

    const choices: StockWorkflowChoice[] = all.map(found => ({
        id: found.id,
        name: found.name,
        description: found.description,
        path: found.rel,
        drawn: found.id === workflow?.id,
    }));

    return {
        source: workflow ? 'workflow' : 'commands',
        workflow: workflow
            ? { id: workflow.id, name: workflow.name, description: workflow.description }
            : null,
        workflows: choices,
        steps,
        templates: templates(workspaceRoot),
        constitution: fs.existsSync(path.join(workspaceRoot, CONSTITUTION_REL))
            ? { command: 'speckit.constitution', written: true, path: CONSTITUTION_REL.split(path.sep).join('/') }
            : { command: 'speckit.constitution', written: false },
        registry: registry !== null ? { path: EXTENSIONS_REL } : null,
        buildBlocked: 'Build writes Companion\'s command files, so nothing here is built.',
    };
}
