import * as fs from 'fs';
import * as path from 'path';
import type { SpecDocument, DocumentType } from '../spec-viewer/types';

export const BUGS_DIR = path.join('.specify', 'bugs');

export type BugReportKind = 'assessment' | 'fix' | 'test';

export const BUG_REPORT_KINDS: readonly BugReportKind[] = ['assessment', 'fix', 'test'];

const LABELS: Record<BugReportKind, string> = { assessment: 'Assessment', fix: 'Fix', test: 'Test' };

const STAGE_WORDS: Record<BugReportKind, string> = { assessment: 'assess', fix: 'fix', test: 'test' };

const TITLE_PREFIXES: Record<BugReportKind, string> = {
    assessment: 'Bug Assessment:',
    fix: 'Bug Fix:',
    test: 'Bug Verification:',
};

export interface BugReportFile {
    kind: BugReportKind;
    label: string;
    fileName: string;
    path: string;
    exists: boolean;
}

export interface BugReport {
    slug: string;
    directory: string;
    title: string;
    reports: Record<BugReportKind, BugReportFile>;
    stages: BugReportKind[];
    verdict?: string;
    severity?: string;
    fixStatus?: string;
    testResult?: string;
    outcome?: string;
}

export function bugReportFile(directory: string, kind: BugReportKind): BugReportFile {
    const fileName = `${kind}.md`;
    const filePath = path.join(directory, fileName);
    return { kind, label: LABELS[kind], fileName, path: filePath, exists: isFileInside(directory, filePath) };
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

function stripTitlePrefix(heading: string, kind: BugReportKind): string | undefined {
    const prefix = TITLE_PREFIXES[kind];
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
function isInsideBugsRoot(realRoot: string, directory: string): boolean {
    try {
        const real = fs.realpathSync(directory);
        const rel = path.relative(realRoot, real);
        return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && fs.statSync(real).isDirectory();
    } catch {
        return false;
    }
}

export function readBugReport(directory: string): BugReport | undefined {
    const slug = path.basename(directory);
    const reports = {} as Record<BugReportKind, BugReportFile>;
    for (const kind of BUG_REPORT_KINDS) reports[kind] = bugReportFile(directory, kind);
    const stages = BUG_REPORT_KINDS.filter(kind => reports[kind].exists);
    if (stages.length === 0) return undefined;

    const bug: BugReport = { slug, directory, title: slug, reports, stages };
    let titled = false;
    for (const kind of stages) {
        const header = parseReportHeader(readText(reports[kind].path));
        const title = header.title ? stripTitlePrefix(header.title, kind) : undefined;
        if (title && !titled) {
            bug.title = title;
            titled = true;
        }
        if (kind === 'assessment') {
            bug.verdict = header.fields.get('verdict');
            bug.severity = header.fields.get('severity');
        } else if (kind === 'fix') {
            bug.fixStatus = header.fields.get('status');
        } else {
            bug.testResult = header.fields.get('result');
        }
    }
    bug.outcome = bug.testResult ?? bug.fixStatus ?? bug.verdict;
    return bug;
}

/** Every bug report under `<workspaceRoot>/.specify/bugs/`, ordered by slug. Empty when the folder is absent. */
export function readBugReports(workspaceRoot: string): BugReport[] {
    const bugsRoot = path.join(workspaceRoot, BUGS_DIR);
    let names: string[];
    let realRoot: string;
    try {
        names = fs.readdirSync(bugsRoot);
        realRoot = fs.realpathSync(bugsRoot);
        const rel = path.relative(fs.realpathSync(workspaceRoot), realRoot);
        if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return [];
    } catch {
        return [];
    }
    const bugs: BugReport[] = [];
    for (const name of names.sort()) {
        const directory = path.join(bugsRoot, name);
        if (!isInsideBugsRoot(realRoot, directory)) continue;
        const bug = readBugReport(directory);
        if (bug) bugs.push(bug);
    }
    return bugs;
}

/** The stages present, in words, then the latest outcome: `assess · fix · test · verified`. */
export function bugReportSummary(bug: BugReport): string {
    const parts = bug.stages.map(kind => STAGE_WORDS[kind]);
    if (bug.outcome) parts.push(bug.outcome);
    return parts.join(' · ');
}

/** True for any path at or under a `.specify/bugs` folder, which no spec path ever is. */
export function isBugsPath(filePath: string): boolean {
    return /(^|\/)\.specify\/bugs(\/|$)/.test(filePath.replace(/\\/g, '/'));
}

/** The bug folder a report path belongs to, or undefined when it is not `.specify/bugs/<slug>/<kind>.md`. */
export function bugDirectoryOf(filePath: string): string | undefined {
    const directory = path.dirname(filePath);
    const parent = path.dirname(directory);
    if (path.basename(parent) !== 'bugs' || path.basename(path.dirname(parent)) !== '.specify') return undefined;
    return BUG_REPORT_KINDS.some(kind => path.basename(filePath) === `${kind}.md`) ? directory : undefined;
}

export function bugReportKindOf(filePath: string): BugReportKind | undefined {
    return BUG_REPORT_KINDS.find(kind => path.basename(filePath) === `${kind}.md`);
}

/** The bug's three reports as viewer documents, in assessment, fix, test order. */
export function bugReportDocuments(directory: string): SpecDocument[] {
    return BUG_REPORT_KINDS.map(kind => {
        const file = bugReportFile(directory, kind);
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
