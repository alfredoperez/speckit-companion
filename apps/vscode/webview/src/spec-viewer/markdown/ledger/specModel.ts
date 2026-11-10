/**
 * Ledger spec model: plain data parsed from a spec.md plus the cross-references
 * derived from it. Nothing here builds HTML.
 */

export interface SpecScenarioStep {
    kw: 'given' | 'when' | 'then' | 'and' | 'but' | '';
    text: string;
}

export interface SpecStory {
    n: number;
    id: string;
    title: string;
    priority: 1 | 2 | 3;
    desc: string;
    why: string;
    test: string;
    scenarios: string[];
    raw: string;
}

export interface SpecItem {
    id: string;
    text: string;
}

export interface SpecEdge {
    id: string;
    trigger: string;
    outcome: string;
}

export interface SpecAssumption {
    id: string;
    text: string;
    confirmed: boolean;
    question?: string;
}

export interface SpecEntity {
    name: string;
    desc: string;
}

export interface SpecClarification {
    n: number;
    q: string;
    a?: string;
}

export interface SpecClarSession {
    date: string;
    items: SpecClarification[];
}

export interface SpecModel {
    title: string;
    branch: string;
    created: string;
    status: string;
    input: string;
    stories: SpecStory[];
    reqs: SpecItem[];
    criteria: SpecItem[];
    edges: SpecEdge[];
    assumptions: SpecAssumption[];
    entities: SpecEntity[];
    sessions: SpecClarSession[];
}

export interface SpecTask {
    id: string;
    done: boolean;
    story: number | null;
    refs: string[];
}

export function emptyModel(): SpecModel {
    return { title: '', branch: '', created: '', status: '', input: '', stories: [], reqs: [], criteria: [], edges: [], assumptions: [], entities: [], sessions: [] };
}

const REF_ID = /\b(?:FR|NFR|SC)-\d+[a-z]?\b/g;

export function idsIn(text: string): string[] {
    return Array.from(new Set(text.match(REF_ID) ?? []));
}

/** Tasks from a tasks.md: id, done flag, `[US2]` story marker and the requirement ids the line names. */
export function parseTasks(markdown: string): SpecTask[] {
    const tasks: SpecTask[] = [];
    for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
        const m = line.match(/^\s*-\s+\[([ xX])\]\s+\**(T\d+)\**\s*(.*)$/);
        if (!m) continue;
        const us = m[3].match(/\[US(\d+)\]/i);
        tasks.push({ id: m[2], done: m[1].toLowerCase() === 'x', story: us ? Number(us[1]) : null, refs: idsIn(m[3]) });
    }
    return tasks;
}

export function taskRange(tasks: SpecTask[]): string {
    const ids = tasks.map((t) => t.id).sort();
    if (ids.length <= 2) return ids.join(', ');
    return `${ids[0]} – ${ids[ids.length - 1]}`;
}

/** Split a scenario sentence into Given / When / Then / And steps. */
export function splitScenario(line: string): SpecScenarioStep[] {
    const text = line.replace(/\s+/g, ' ').trim();
    const marker = /(?:^|[,;]?\s+)\**(Given|When|Then|And|But)\**[:\s]\s*/gi;
    const hits: { kw: string; start: number; end: number }[] = [];
    for (let m = marker.exec(text); m; m = marker.exec(text)) {
        hits.push({ kw: m[1].toLowerCase(), start: m.index, end: marker.lastIndex });
    }
    if (hits.length === 0 || hits[0].start !== 0) return [{ kw: '', text }];
    return hits.map((h, i) => ({
        kw: h.kw as SpecScenarioStep['kw'],
        text: text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : undefined).replace(/[,;\s]+$/, '').replace(/\*\*/g, '').trim(),
    }));
}

const STOP = new Set(['the', 'and', 'that', 'with', 'when', 'from', 'this', 'into', 'for', 'are', 'not', 'user', 'users']);

function words(text: string): Set<string> {
    return new Set((text.toLowerCase().match(/[a-zÀ-ɏ]{5,}/g) ?? []).filter((w) => !STOP.has(w)));
}

/** The story whose scenarios speak to an edge case: shared distinctive words, or an explicit id. */
export function scenarioFor(edge: SpecEdge, stories: SpecStory[]): SpecStory | undefined {
    const wanted = words(edge.trigger);
    if (wanted.size === 0) return undefined;
    const need = Math.min(2, wanted.size);
    return stories.find((s) => {
        const hay = s.scenarios.join(' ');
        if (new RegExp(`\\b${edge.id}\\b`).test(hay)) return true;
        const have = words(hay);
        let shared = 0;
        wanted.forEach((w) => { if (have.has(w)) shared++; });
        return shared >= need;
    });
}

export function isSpecDocument(markdown: string): boolean {
    if (/^#[ \t]+.*checklist/im.test(markdown.slice(0, 400))) return false;
    if (/^##[ \t]+Phase\b/m.test(markdown)) return false;
    if (/^#[ \t]+Feature Specification\b/m.test(markdown)) return true;
    if (/^###[ \t]+User Story\s*\d+/m.test(markdown)) return true;
    return /^##[ \t]+Requirements\b/m.test(markdown) && /^-[ \t]+\*\*(?:FR|NFR)-\d+\*\*/m.test(markdown);
}
