import * as fs from 'fs';
import * as path from 'path';
import type { SpecDocument, DocumentType } from '../spec-viewer/types';

export interface ReportSet<K extends string> {
    id: 'bugs' | 'ideas';
    dir: string;
    kinds: readonly K[];
    labels: Record<K, string>;
    titlePrefixes: Record<K, string>;
    panelPrefix: string;
    fallbackBadge: string;
}

export interface ReportFile<K extends string> {
    kind: K;
    label: string;
    fileName: string;
    path: string;
    exists: boolean;
}

export interface ReportFolder<K extends string> {
    slug: string;
    directory: string;
    title: string;
    reports: Record<K, ReportFile<K>>;
    stages: K[];
    fields: Record<K, Map<string, string>>;
}

export function reportFile<K extends string>(set: ReportSet<K>, directory: string, kind: K): ReportFile<K> {
    const fileName = `${kind}.md`;
    const filePath = path.join(directory, fileName);
    return { kind, label: set.labels[kind], fileName, path: filePath, exists: isFileInside(directory, filePath) };
}

/** True when `target` is a file whose resolved path stays inside `root`, so a link cannot reach outside it. */
function isFileInside(root: string, target: string): boolean {
    try {
        const rel = path.relative(fs.realpathSync(root), fs.realpathSync(target));
        return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && fs.statSync(target).isFile();
    } catch {
        return false;
    }
}

/** The `- **Label**: value` bullets of the block right under the title, keyed by label. */
/**
 * The known value a report line states, or nothing. These files are written by people and assistants,
 * so a value may be decorated (`Verified ✅`, `verified (3/3 checks)`) or spelled with a space for a hyphen.
 * A value followed by more words, or by another option (`go/no-go`, `verified | partial`), is not a statement.
 */
export function knownValue<T extends string>(values: readonly T[], raw: string | undefined): T | undefined {
    if (typeof raw !== 'string') return undefined;
    const stated = raw.toLowerCase().replace(/^[^a-z0-9]+/, '');
    return [...values]
        .sort((a, b) => b.length - a.length)
        .find(value => {
            const spelled = value
                .split(/[\s-]+/)
                .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('[\\s_-]+');
            return new RegExp(`^${spelled}(?![\\w-])(?!\\s*[a-z0-9|/])`).test(stated);
        });
}

export function parseReportHeader(markdown: string): { title?: string; fields: Map<string, string> } {
    const fields = new Map<string, string>();
    let title: string | undefined;
    let inBlock = false;
    for (const raw of markdown.split(/\r?\n/)) {
        const line = raw.trim();
        if (!title && /^#\s+/.test(line)) {
            title = line.replace(/^#\s+/, '');
            continue;
        }
        const field = /^[-*]\s+\*\*([^*]+)\*\*\s*:\s*(.*)$/.exec(line);
        if (field) {
            inBlock = true;
            const value = field[2].trim();
            if (value) fields.set(field[1].trim().toLowerCase(), value);
            continue;
        }
        if (line === '' && !inBlock) continue;
        break;
    }
    return { title, fields };
}

function stripTitlePrefix(heading: string, prefix: string): string | undefined {
    if (!heading.startsWith(prefix)) return undefined;
    const rest = heading.slice(prefix.length).trim();
    return rest || undefined;
}

function readText(filePath: string): string {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return '';
    }
}

/** True when `directory` is a real folder whose resolved path stays inside the already-resolved `realRoot`. */
function isFolderInside(realRoot: string, directory: string): boolean {
    try {
        const real = fs.realpathSync(directory);
        const rel = path.relative(realRoot, real);
        return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && fs.statSync(real).isDirectory();
    } catch {
        return false;
    }
}

export function readReportFolder<K extends string>(set: ReportSet<K>, directory: string): ReportFolder<K> | undefined {
    const slug = path.basename(directory);
    const reports = {} as Record<K, ReportFile<K>>;
    const fields = {} as Record<K, Map<string, string>>;
    for (const kind of set.kinds) {
        reports[kind] = reportFile(set, directory, kind);
        fields[kind] = new Map();
    }
    const stages = set.kinds.filter(kind => reports[kind].exists);
    if (stages.length === 0) return undefined;

    let title: string | undefined;
    for (const kind of stages) {
        const header = parseReportHeader(readText(reports[kind].path));
        fields[kind] = header.fields;
        title ??= header.title ? stripTitlePrefix(header.title, set.titlePrefixes[kind]) : undefined;
    }
    return { slug, directory, title: title ?? slug, reports, stages, fields };
}

/** Every report folder under `<workspaceRoot>/<set.dir>/`, ordered by folder name. Empty when the folder is absent. */
export function readReportFolders<K extends string>(set: ReportSet<K>, workspaceRoot: string): ReportFolder<K>[] {
    const setRoot = path.join(workspaceRoot, set.dir);
    let names: string[];
    let realRoot: string;
    try {
        names = fs.readdirSync(setRoot);
        realRoot = fs.realpathSync(setRoot);
        const rel = path.relative(fs.realpathSync(workspaceRoot), realRoot);
        if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return [];
    } catch {
        return [];
    }
    const folders: ReportFolder<K>[] = [];
    for (const name of names.sort()) {
        const directory = path.join(setRoot, name);
        if (!isFolderInside(realRoot, directory)) continue;
        const folder = readReportFolder(set, directory);
        if (folder) folders.push(folder);
    }
    return folders;
}

function segmentsOf(value: string): string[] {
    return value.replace(/\\/g, '/').split('/').filter(part => part !== '' && part !== '.');
}

function endsWithSegments(segments: string[], tail: string[]): boolean {
    if (tail.length === 0 || tail.length > segments.length) return false;
    const offset = segments.length - tail.length;
    return tail.every((part, index) => segments[offset + index] === part);
}

/** True for any path at or under the set's folder, which no spec path ever is. */
export function isReportPath<K extends string>(set: ReportSet<K>, filePath: string): boolean {
    const segments = segmentsOf(filePath);
    const dir = segmentsOf(set.dir);
    return segments.some((_, index) => endsWithSegments(segments.slice(0, index + 1), dir));
}

/** The folder a report path belongs to, or undefined when it is not `<set.dir>/<slug>/<kind>.md`. */
export function reportDirectoryOf<K extends string>(set: ReportSet<K>, filePath: string): string | undefined {
    const directory = path.dirname(filePath);
    const segments = segmentsOf(filePath);
    if (!endsWithSegments(segments.slice(0, -2), segmentsOf(set.dir))) return undefined;
    const fileName = segments[segments.length - 1];
    return set.kinds.some(kind => fileName === `${kind}.md`) ? directory : undefined;
}

export function reportKindOf<K extends string>(set: ReportSet<K>, filePath: string): K | undefined {
    if (!reportDirectoryOf(set, filePath)) return undefined;
    const fileName = segmentsOf(filePath).pop();
    return set.kinds.find(kind => fileName === `${kind}.md`);
}

/** The set's reports as viewer documents, in the set's order. */
export function reportDocuments<K extends string>(set: ReportSet<K>, directory: string): SpecDocument[] {
    return set.kinds.map(kind => {
        const file = reportFile(set, directory, kind);
        return {
            type: kind as DocumentType,
            label: file.label,
            fileName: file.fileName,
            filePath: file.path,
            exists: file.exists,
            isCore: true,
            category: 'core',
        };
    });
}
