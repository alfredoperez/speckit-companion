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
import { HookWhen, StockHookRow, StockStepRow, StockWorkflowView } from '../../protocol/pipeline';

const WORKFLOWS_REL = path.join('.specify', 'workflows');
const EXTENSIONS_REL = path.join('.specify', 'extensions.yml');
const PRESETS_REL = path.join('.specify', 'presets');

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

/** The workflow a run would take, when the project has one installed. */
function installedWorkflow(workspaceRoot: string): {
    file: string; id: string; name: string; description: string;
    steps: Array<Record<string, unknown>>;
} | null {
    const dir = path.join(workspaceRoot, WORKFLOWS_REL);
    let ids: string[] = [];
    try {
        ids = fs.readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    } catch { return null; }
    for (const id of ids) {
        const file = path.join(dir, id, 'workflow.yml');
        const doc = loadYaml(file);
        const steps = doc?.steps;
        if (!Array.isArray(steps)) { continue; }
        const meta = (doc?.workflow ?? {}) as Record<string, unknown>;
        return {
            file,
            id: String(meta.id ?? id),
            name: String(meta.name ?? id),
            description: String(meta.description ?? '').trim(),
            steps: steps.filter(step => step && typeof step === 'object') as Array<Record<string, unknown>>,
        };
    }
    return null;
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

/** The workflow file the board drew its steps from, when it drew them from one. */
export function stockWorkflowFile(workspaceRoot: string): string | null {
    return installedWorkflow(workspaceRoot)?.file ?? null;
}

/**
 * The whole stock board: the steps in run order, each with what it writes and
 * the registry hooks attached to it.
 */
export function readStockWorkflow(workspaceRoot: string): StockWorkflowView {
    const registry = loadYaml(path.join(workspaceRoot, EXTENSIONS_REL));
    const workflow = installedWorkflow(workspaceRoot);

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

    return {
        source: workflow ? 'workflow' : 'commands',
        workflow: workflow
            ? { id: workflow.id, name: workflow.name, description: workflow.description }
            : null,
        steps,
        presets: presets(workspaceRoot),
        registry: registry !== null,
        buildBlocked: 'Build writes Companion\'s command files, and this project '
            + 'runs stock Spec Kit. Nothing here is built.',
    };
}
