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
    HookWhen, StockHookRow, StockStepRow, StockTemplate, StockWorkflowChoice, StockWorkflowView,
} from '../../protocol/pipeline';

const WORKFLOWS_REL = path.join('.specify', 'workflows');
const EXTENSIONS_REL = path.join('.specify', 'extensions.yml');
const PRESETS_REL = path.join('.specify', 'presets');
const TEMPLATES_REL = path.join('.specify', 'templates');
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

/** What each template shapes, in the order a run reaches them. */
const STOCK_TEMPLATES: Array<{ file: string; label: string; note: string }> = [
    {
        file: 'constitution-template.md', label: 'Constitution',
        note: 'The principles /speckit.constitution writes into memory/constitution.md',
    },
    {
        file: 'spec-template.md', label: 'Spec',
        note: 'The shape of spec.md, filled in by /speckit.specify',
    },
    {
        file: 'plan-template.md', label: 'Plan',
        note: 'The shape of plan.md, filled in by /speckit.plan',
    },
    {
        file: 'tasks-template.md', label: 'Tasks',
        note: 'The shape of tasks.md, filled in by /speckit.tasks',
    },
    {
        file: 'checklist-template.md', label: 'Checklist',
        note: 'The shape of a checklist under checklists/, written by /speckit.checklist',
    },
    {
        file: 'agent-file-template.md', label: 'Agent context',
        note: 'The context file a plan writes for your assistant',
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
function registryHooks(registry: Record<string, unknown> | null, step: string): StockHookRow[] {
    const hooks = registry?.hooks;
    if (!hooks || typeof hooks !== 'object') { return []; }
    const rows: StockHookRow[] = [];
    for (const when of WHENS) {
        const entries = (hooks as Record<string, unknown>)[`${when}_${step}`];
        if (!Array.isArray(entries)) { continue; }
        entries.forEach((entry, index) => {
            if (!entry || typeof entry !== 'object') { return; }
            const row = entry as Record<string, unknown>;
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

function presets(workspaceRoot: string): StockWorkflowView['presets'] {
    const dir = path.join(workspaceRoot, PRESETS_REL);
    let ids: string[] = [];
    try {
        ids = fs.readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    } catch { return []; }
    return ids.map(id => {
        const meta = (loadYaml(path.join(dir, id, 'preset.yml'))?.preset
            ?? {}) as Record<string, unknown>;
        return {
            id,
            name: String(meta.name ?? id),
            description: String(meta.description ?? '').trim(),
        };
    });
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
        ...view.templates.map(template => template.path),
        ...view.workflows.map(choice => choice.path),
        ...(view.registry ? [view.registry.path] : []),
    ];
    if (!offered.includes(rel)) { return null; }
    const file = path.join(workspaceRoot, rel);
    return fs.existsSync(file) ? file : null;
}

/** The templates this project has, named by what their step does with them. */
function templates(workspaceRoot: string): StockTemplate[] {
    const dir = path.join(workspaceRoot, TEMPLATES_REL);
    let files: string[] = [];
    try {
        files = fs.readdirSync(dir).filter(file => file.endsWith('.md'));
    } catch { return []; }
    const known = STOCK_TEMPLATES
        .filter(template => files.includes(template.file))
        .map(template => ({ ...template, path: path.join(TEMPLATES_REL, template.file) }));
    const rest = files
        .filter(file => !STOCK_TEMPLATES.some(template => template.file === file))
        .sort()
        .map(file => ({
            file,
            path: path.join(TEMPLATES_REL, file),
            label: file.replace(/-template\.md$/, '').replace(/\.md$/, ''),
            note: 'A template this project added',
        }));
    return [...known, ...rest];
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
                hooks: gate ? [] : registryHooks(registry, step),
            };
        })
        : installedCommands(workspaceRoot).map(step => ({
            id: step,
            command: `speckit.${step}`,
            kind: 'command' as const,
            label: STOCK_STEPS[step]?.label ?? step,
            writes: STOCK_STEPS[step]?.writes ?? [],
            hooks: registryHooks(registry, step),
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
        constitution: {
            // Named by the panel, which knows the spelling this project
            // registers; the reader cannot see the editor's configuration.
            command: 'speckit.constitution',
            written: fs.existsSync(path.join(workspaceRoot, CONSTITUTION_REL)),
        },
        presets: presets(workspaceRoot),
        registry: registry !== null ? { path: EXTENSIONS_REL } : null,
        buildBlocked: 'Build writes Companion\'s command files, so nothing here is built.',
    };
}
