import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { PRESET_ID_PATTERN, PRESET_QUERY_PATTERN, SpecPreset, SpecPresetItem } from '../../protocol/pipeline';

const PRESETS_REL = path.join('.specify', 'presets');
const EXTENSIONS_REL = path.join('.specify', 'extensions.yml');
const EXEMPT_PRESET = 'companion-standard';
const COMPANION_TEMPLATES = [
    'constitution-template', 'spec-template', 'plan-template', 'tasks-template',
    'checklist-template', 'agent-file-template',
];
const STRATEGIES = ['replace', 'prepend', 'append', 'wrap', 'replace-section'];

export type PresetVerb = 'search' | 'add' | 'update' | 'remove';

export function isPresetId(id: unknown): id is string {
    return typeof id === 'string' && PRESET_ID_PATTERN.test(id);
}

export function cleanQuery(query: unknown): string | null {
    if (typeof query !== 'string') { return null; }
    const trimmed = query.trim();
    return PRESET_QUERY_PATTERN.test(trimmed) ? trimmed : null;
}

export function presetCommandLine(verb: PresetVerb, arg: string): string | null {
    if (verb === 'search') {
        const query = cleanQuery(arg);
        return query ? `specify preset search "${query}"` : null;
    }
    return isPresetId(arg) ? `specify preset ${verb} ${arg}` : null;
}

function loadYaml(file: string): Record<string, unknown> | null {
    try {
        const parsed = yaml.load(fs.readFileSync(file, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch { return null; }
}

function loadJson(file: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch { return null; }
}

function companionCommands(root: string): Set<string> {
    const commands = new Set<string>();
    const hooks = loadYaml(path.join(root, EXTENSIONS_REL))?.hooks;
    if (!hooks || typeof hooks !== 'object') { return commands; }
    for (const [key, rows] of Object.entries(hooks as Record<string, unknown>)) {
        const step = /^(?:before|after)_(.+)$/.exec(key)?.[1];
        if (!step || !Array.isArray(rows)) { continue; }
        const ours = rows.some(row => row && typeof row === 'object'
            && String((row as Record<string, unknown>).command ?? '').startsWith('speckit.companion.'));
        if (ours) { commands.add(`speckit.${step}`); }
    }
    return commands;
}

function readItems(manifest: Record<string, unknown>): SpecPresetItem[] {
    const templates = (manifest.provides as Record<string, unknown> | undefined)?.templates;
    if (!Array.isArray(templates)) { return []; }
    return templates.filter(t => t && typeof t === 'object').map(t => {
        const row = t as Record<string, unknown>;
        const name = String(row.name ?? '');
        const type = ['template', 'command', 'script'].includes(String(row.type))
            ? row.type as SpecPresetItem['type'] : 'template';
        const strategy = STRATEGIES.includes(String(row.strategy))
            ? row.strategy as SpecPresetItem['strategy'] : 'replace';
        return { type, name, replaces: String(row.replaces ?? name), strategy, file: String(row.file ?? '') };
    });
}

function normalizeCommand(name: string): string {
    return `speckit.${name.trim().replace(/\.md$/, '').replace(/^speckit[.-]/, '')}`;
}

function normalizeTemplate(name: string): string {
    const base = name.trim().replace(/\.md$/, '');
    return base.endsWith('-template') ? base : `${base}-template`;
}

export function presetClashes(id: string, items: SpecPresetItem[], commands: Set<string>): string[] {
    if (id === EXEMPT_PRESET) { return []; }
    const clashes: string[] = [];
    for (const item of items) {
        let hit: string | null = null;
        if (item.type === 'command') {
            const command = normalizeCommand(item.replaces);
            if (commands.has(command) && (item.strategy === 'replace' || item.strategy === 'wrap')) { hit = command; }
        } else if (item.type === 'template') {
            const template = normalizeTemplate(item.replaces);
            if (COMPANION_TEMPLATES.includes(template)
                && (item.strategy === 'replace' || item.strategy === 'replace-section')) { hit = template; }
        }
        if (hit && !clashes.includes(hit)) { clashes.push(hit); }
    }
    return clashes;
}

export function readSpecPresets(root: string): SpecPreset[] {
    if (!root) return [];
    const dir = path.join(root, PRESETS_REL);
    let ids: string[] = [];
    try {
        ids = fs.readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && PRESET_ID_PATTERN.test(entry.name))
            .map(entry => entry.name).sort();
    } catch { return []; }
    const listed = loadJson(path.join(dir, '.registry'))?.presets;
    const registry = (listed && typeof listed === 'object' && !Array.isArray(listed) ? listed : {}) as Record<string, Record<string, unknown>>;
    const commands = companionCommands(root);
    const gone = Object.keys(registry).filter(id => PRESET_ID_PATTERN.test(id) && !ids.includes(id)).sort()
        .map((id): SpecPreset => ({
            id, name: id, version: String(registry[id]?.version ?? ''), description: '',
            source: 'local', enabled: registry[id]?.enabled !== false,
            priority: typeof registry[id]?.priority === 'number' ? registry[id].priority as number : 10,
            items: [], clashes: [], problem: 'listed in .registry but its folder is gone',
        }));
    return [...ids.map(id => {
        const entry = registry[id] ?? {};
        const source = entry.source;
        const base = {
            id,
            source: typeof source === 'string' ? source
                : !source ? 'local' : String((source as Record<string, unknown> | undefined)?.catalog ?? 'catalog'),
            enabled: entry.enabled !== false,
            priority: typeof entry.priority === 'number' ? entry.priority : 10,
        };
        const manifest = loadYaml(path.join(dir, id, 'preset.yml'));
        const meta = manifest?.preset as Record<string, unknown> | undefined;
        if (!manifest || !meta) {
            return {
                ...base, name: id, version: String(entry.version ?? ''), description: '',
                items: [], clashes: [], problem: 'preset.yml could not be read',
            };
        }
        const items = readItems(manifest);
        return {
            ...base,
            name: String(meta.name ?? id),
            version: String(meta.version ?? entry.version ?? ''),
            description: String(meta.description ?? '').trim(),
            items,
            clashes: presetClashes(id, items, commands),
        };
    }), ...gone];
}
