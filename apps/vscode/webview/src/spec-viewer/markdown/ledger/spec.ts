/**
 * Ledger spec document: turns a spec.md into SpecHeader, StoryIndex, StoryCard,
 * RequirementRow, SuccessCriteria, EdgeCaseList, AssumptionList, EntityGlossary,
 * ClarificationList and VerbatimList. Works on stock spec-kit text alone; a
 * tasks.md, when the viewer has one, adds progress, coverage and "built by".
 *
 * Each component is one HTML line (the renderer passes such lines through and
 * wraps them as commentable lines). Every repository string goes through
 * escapeHtml or parseInline.
 */

import { escapeHtml, parseInline } from '../inline';
import { codicon, eyebrow, idChip, priorityMark, slugForId, statusDot, type Family, type Status } from './primitives';
import {
    emptyModel, idsIn, isSpecDocument, parseTasks, scenarioFor, splitScenario, taskRange,
    type SpecEdge, type SpecModel, type SpecStory, type SpecTask,
} from './specModel';

export const SPEC_LEDGER_LINE = /^<div class="lg-sp[ "]/;

const FOLD_AFTER = 2;

let tasks: SpecTask[] = [];

/** Give the spec components the tasks.md that belongs to the spec (or none). */
export function setSpecLedgerTasks(tasksMarkdown: string | null | undefined): void {
    tasks = tasksMarkdown ? parseTasks(tasksMarkdown) : [];
}

const inl = (text: string): string => parseInline(text.trim());

function plural(n: number, one: string, many = `${one}s`): string {
    return `${n} ${n === 1 ? one : many}`;
}

function root(cls: string, inner: string, id?: string): string {
    const idAttr = id ? ` id="${slugForId(id)}"` : '';
    return `<div class="lg-sp ${cls}"${idAttr}><div class="lg-sp-grid">${inner}</div></div>`;
}

function emphasizeModals(html: string): string {
    return html.split(/(<[^>]+>)/).map((part) => part.startsWith('<') ? part : part.replace(/\b(MUST NOT|MUST|SHOULD NOT|SHOULD|SHALL NOT|SHALL)\b/g, '<strong>$1</strong>')).join('');
}

function emphasizeNumbers(html: string): string {
    return html.split(/(<[^>]+>)/).map((part) => part.startsWith('<') ? part : part.replace(/(?<![\w-])(\d+(?:[.,]\d+)?(?:%|\s+(?:seconds?|minutes?|ms|hours?|days?|MB|GB)\b)?)/g, '<strong class="lg-sp-num">$1</strong>')).join('');
}

function note(text: string): string {
    return text ? ` <span class="lg-sp-note">${escapeHtml(text)}</span>` : '';
}

function status(kind: Status, word: string): string {
    return `<span class="lg-sp-status">${statusDot(kind)}${escapeHtml(word)}</span>`;
}

function chips(ids: string[], model: SpecModel, limit = 6): string {
    const known = new Set<string>([...model.reqs.map((r) => r.id), ...model.criteria.map((c) => c.id), ...model.stories.map((s) => s.id)]);
    const shown = ids.slice(0, limit).map((id) => idChip(id, { resolved: known.has(id) }));
    const rest = ids.length > limit ? `<span class="lg-sp-note">+${ids.length - limit}</span>` : '';
    return shown.join(' ') + rest;
}

function taskChip(list: SpecTask[]): string {
    return `<span class="lg-chip">${codicon('tasklist')}${escapeHtml(taskRange(list))}</span>`;
}

function mentions(text: string, id: string): boolean {
    return new RegExp(`(?<![\\w-])${id}(?![\\w-])`).test(text);
}

function sectionEyebrow(family: Family, label: string, count: number, tail = ''): string {
    return root('lg-sp-eyebrow', `<div class="lg-sp-eyebrow-line">${eyebrow(family, label, count)}${note(tail)}</div>`);
}

/* ---------- header and index ---------- */

function statusKind(value: string): Status {
    if (/implement|complete|done|ship/i.test(value)) return 'done';
    if (/progress|running|implementing/i.test(value)) return 'running';
    return 'todo';
}

function progress(done: number, total: number): string {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<span class="lg-sp-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="lg-sp-count">${done}/${total}</span>`;
}

function slug(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function renderSpecHeader(model: SpecModel): string {
    const meta = ['SPEC', model.branch, model.created ? `CREATED ${model.created}` : ''].filter(Boolean).map(escapeHtml).join(' · ');
    const done = tasks.filter((t) => t.done).length;
    const trail = tasks.length
        ? `<div class="lg-sp-headtrail"><span class="lg-sp-prog">${progress(done, tasks.length)}</span><span class="lg-sp-note">tasks done</span></div>`
        : '';
    const counts = [
        model.stories.length ? plural(model.stories.length, 'story', 'stories') : '',
        model.reqs.length ? plural(model.reqs.length, 'requirement') : '',
        model.criteria.length ? plural(model.criteria.length, 'criterion', 'criteria') : '',
        model.edges.length ? plural(model.edges.length, 'edge case') : '',
    ].filter(Boolean).join(' · ');
    const chip = model.status ? `<span class="lg-sp-statuschip">${statusDot(statusKind(model.status))}${escapeHtml(model.status)}</span>` : '';
    return root('lg-sp-header',
        `<div class="lg-sp-meta">${meta}</div>` +
        `<div class="lg-sp-titlerow"><h1 class="lg-sp-title" id="${slug(model.title) || 'spec'}">${inl(model.title)}</h1>${trail}</div>` +
        `<div class="lg-sp-sub">${chip}<span>${escapeHtml(counts)}</span></div>`);
}

function firstSentence(text: string, max = 120): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    const cut = clean.match(/^(.+?[.!?])(\s|$)/);
    const sentence = cut ? cut[1] : clean;
    return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

function storyProgress(story: SpecStory): { done: number; total: number } | null {
    const mine = tasks.filter((t) => t.story === story.n);
    return mine.length ? { done: mine.filter((t) => t.done).length, total: mine.length } : null;
}

export function renderStoryIndex(model: SpecModel): string {
    if (model.stories.length === 0) return '';
    const p1 = model.stories.filter((s) => s.priority === 1).length;
    const tail = p1 ? ` · ${p1 === 1 ? 'one is' : `${p1} are`} P1` : '';
    const rows = model.stories.map((s) => {
        const pr = storyProgress(s);
        const trail = `<span class="lg-sp-trail">${priorityMark(s.priority)}${pr ? `<span class="lg-sp-note">${pr.done}/${pr.total} tasks</span>` : ''}</span>`;
        return `<a class="lg-sp-index-row" href="#${slugForId(s.id)}" data-ref="${escapeHtml(s.id)}"><span class="lg-sp-id lg-fam-story">${escapeHtml(s.id)}</span>` +
            `<span class="lg-sp-main"><span class="lg-sp-rowtitle">${inl(s.title)}</span>` +
            `${s.desc ? `<span class="lg-sp-sub">${inl(firstSentence(s.desc))}</span>` : ''}</span>${trail}</a>`;
    }).join('');
    return root('lg-sp-index', `<div class="lg-sp-eyebrow-line">${eyebrow('story', 'User stories', model.stories.length)}${note(tail.replace(/^ · /, '· '))}</div>${rows}`);
}

/* ---------- story card ---------- */

function scenarioHtml(scenario: string): string {
    const rows = splitScenario(scenario).map((step) => {
        const kw = step.kw ? `<span class="lg-sp-kw lg-sp-kw--${step.kw}">${step.kw.toUpperCase()}</span>` : '<span class="lg-sp-kw"></span>';
        return `<div class="lg-sp-step">${kw}<span class="lg-sp-steptext">${inl(step.text)}</span></div>`;
    }).join('');
    return `<div class="lg-sp-scn">${rows}</div>`;
}

export function renderStoryCard(story: SpecStory, model: SpecModel): string {
    const pr = storyProgress(story);
    const trail = pr ? `<div class="lg-sp-headtrail"><span class="lg-sp-prog">${progress(pr.done, pr.total)}</span></div>` : '';
    const why = story.why ? `<div class="lg-sp-why"><span class="lg-sp-whylabel">WHY P${story.priority}</span> ${inl(story.why)}</div>` : '';
    const test = story.test
        ? `<div class="lg-sp-test lg-fam-story lg-wash"><div class="lg-sp-testlabel">Test it alone</div><div>${inl(story.test)}</div></div>`
        : `<div class="lg-sp-notest">${statusDot('warn')}No independent test written.</div>`;
    const shown = story.scenarios.slice(0, FOLD_AFTER).map(scenarioHtml).join('');
    const hidden = story.scenarios.slice(FOLD_AFTER);
    const fold = hidden.length
        ? `<details class="lg-sp-fold"><summary><span class="lg-sp-more">${plural(hidden.length, 'more scenario')}</span><span class="lg-sp-less">Hide ${plural(hidden.length, 'other scenario')}</span></summary>${hidden.map(scenarioHtml).join('')}</details>`
        : '';
    const requires = idsIn(story.raw).filter((id) => !id.startsWith('SC-'));
    const proves = model.criteria.filter((c) => mentions(c.text, story.id) || new RegExp(`User Story ${story.n}\\b`, 'i').test(c.text)).map((c) => c.id);
    const mine = tasks.filter((t) => t.story === story.n);
    const links: string[] = [];
    if (requires.length) links.push(`<span class="lg-sp-linkgroup"><span class="lg-sp-note">Requires</span> ${chips(requires, model)}</span>`);
    if (proves.length) links.push(`<span class="lg-sp-linkgroup"><span class="lg-sp-note">Proved by</span> ${chips(proves, model)}</span>`);
    if (mine.length) links.push(`<span class="lg-sp-linkgroup"><span class="lg-sp-note">Built by</span> ${taskChip(mine)}</span>`);
    else if (tasks.length) links.push('<span class="lg-sp-linkgroup"><span class="lg-sp-note">Built by no tasks yet</span></span>');
    return root('lg-sp-story lg-fam-story',
        `<div class="lg-sp-lane"><span class="lg-chip lg-sp-own">${escapeHtml(story.id)}</span>${priorityMark(story.priority)}</div>` +
        `<div class="lg-sp-body"><div class="lg-sp-titlerow"><h3 class="lg-sp-storytitle">${inl(story.title)}</h3>${trail}</div>` +
        `${story.desc ? `<div class="lg-sp-desc">${inl(story.desc)}</div>` : ''}${why}${test}` +
        `${shown}${fold}${links.length ? `<div class="lg-sp-links">${links.join('')}</div>` : ''}</div>`,
        story.id);
}

/* ---------- requirement, criteria ---------- */

function referencedBy(id: string, model: SpecModel): string {
    const refs: string[] = [];
    model.stories.filter((s) => mentions(s.raw, id)).forEach((s) => refs.push(idChip(s.id, { title: s.title })));
    model.criteria.filter((c) => c.id !== id && mentions(c.text, id)).forEach((c) => refs.push(idChip(c.id)));
    const t = tasks.filter((task) => task.refs.includes(id));
    if (t.length) refs.push(taskChip(t));
    return refs.length ? `<span class="lg-sp-note">Referenced by</span> ${refs.join(' ')}` : '';
}

export function renderRequirement(id: string, text: string, model: SpecModel): string {
    const t = tasks.filter((task) => task.refs.includes(id));
    const trail = tasks.length
        ? (t.length ? `${status('done', 'Covered')}<span class="lg-sp-note">${plural(t.length, 'task')}</span>` : status('warn', 'Untested'))
        : '';
    const by = referencedBy(id, model);
    const gap = tasks.length && t.length === 0 ? ' <span class="lg-sp-note">· no task builds it</span>' : '';
    return root('lg-sp-row lg-sp-req lg-fam-req',
        `<span class="lg-sp-id">${escapeHtml(id)}</span>` +
        `<span class="lg-sp-main"><span class="lg-sp-text">${emphasizeModals(inl(text))}</span>${by || gap ? `<span class="lg-sp-sub">${by}${gap}</span>` : ''}</span>` +
        `<span class="lg-sp-trail">${trail}</span>`, id);
}

export function renderUnresolved(id: string, model: SpecModel): string {
    const by = model.stories.filter((s) => mentions(s.raw, id)).map((s) => s.id);
    const named = by.length ? `Named by ${by.join(', ')} but not found in this spec.` : 'Named but not found in this spec.';
    return root('lg-sp-row lg-sp-unresolved',
        `<span class="lg-sp-id lg-sp-id--missing">${escapeHtml(id)}</span>` +
        `<span class="lg-sp-main"><span class="lg-sp-text">${escapeHtml(named)}</span><span class="lg-sp-sub">Not a link: there is nowhere to jump to.</span></span>` +
        '<span class="lg-sp-trail"><span class="lg-sp-note">unresolved</span></span>');
}

export function renderCriterion(id: string, text: string, model: SpecModel): string {
    const withdrawn = /~~|\(withdrawn/i.test(text);
    const body = inl(text.replace(/\*?\(withdrawn[^)]*\)\*?/i, ''));
    const proves = [...model.stories.filter((s) => mentions(text, s.id) || mentions(text, `US-${s.n}`)).map((s) => s.id), ...idsIn(text).filter((r) => r !== id)];
    const sub = !withdrawn && proves.length ? `<span class="lg-sp-sub"><span class="lg-sp-note">Proves</span> ${chips(proves, model)}</span>` : '';
    return root(`lg-sp-row lg-sp-sc lg-fam-req${withdrawn ? ' lg-sp-withdrawn' : ''}`,
        `<span class="lg-sp-id">${escapeHtml(id)}</span>` +
        `<span class="lg-sp-main"><span class="lg-sp-text">${withdrawn ? body : emphasizeNumbers(body)}</span>${sub}</span>` +
        `<span class="lg-sp-trail">${withdrawn ? '<span class="lg-sp-note">withdrawn</span>' : ''}</span>`, id);
}

/* ---------- edge cases, assumptions, entities ---------- */

export function renderEdge(edge: SpecEdge, model: SpecModel): string {
    const hit = scenarioFor(edge, model.stories);
    const trail = hit
        ? `${status('done', 'Covered by a scenario')}<span class="lg-sp-note">${idChip(hit.id, { title: hit.title })}</span>`
        : `${status('warn', 'No scenario')}`;
    return root('lg-sp-row lg-sp-edge lg-fam-guard',
        `<span class="lg-sp-id">${escapeHtml(edge.id)}</span>` +
        `<span class="lg-sp-main"><span class="lg-sp-text lg-sp-strong">${inl(edge.trigger)}</span>` +
        `${edge.outcome ? `<span class="lg-sp-sub">→ ${inl(edge.outcome)}</span>` : ''}</span>` +
        `<span class="lg-sp-trail">${trail}</span>`, edge.id);
}

export function renderAssumption(id: string, text: string, confirmed: boolean, question?: string): string {
    const trail = confirmed ? `${status('done', 'Confirmed')}${question ? `<span class="lg-sp-note">${escapeHtml(question)}</span>` : ''}` : status('todo', 'Assumed');
    return root('lg-sp-row lg-sp-assume lg-fam-guard',
        `<span class="lg-sp-id">${escapeHtml(id)}</span>` +
        `<span class="lg-sp-main"><span class="lg-sp-text">${emphasizeNumbers(inl(text))}</span></span>` +
        `<span class="lg-sp-trail">${trail}</span>`, id);
}

export function renderEntity(name: string, desc: string, model: SpecModel): string {
    const key = name.toLowerCase();
    const users = key.length >= 4 ? model.reqs.filter((r) => r.text.toLowerCase().includes(key)).map((r) => r.id) : [];
    const used = users.length ? `<span class="lg-sp-note">used by</span> ${chips(users, model, 4)}` : '';
    return root('lg-sp-row lg-sp-entity lg-fam-data',
        '<span class="lg-sp-id"><i class="lg-sp-square"></i></span>' +
        `<span class="lg-sp-main"><span class="lg-sp-text lg-sp-strong">${inl(name)}</span>${desc ? `<span class="lg-sp-sub">${inl(desc)}</span>` : ''}</span>` +
        `<span class="lg-sp-trail">${used}</span>`);
}

/* ---------- verbatim and clarifications ---------- */

export function renderVerbatim(input: string): string {
    const text = input.replace(/^User description:\s*/i, '').replace(/^["“](.*)["”]$/s, '$1').trim();
    if (!text) return '';
    return root('lg-sp-verbatim lg-fam-decision',
        `<div class="lg-sp-eyebrow-line">${eyebrow('decision', 'Verbatim')}${note('· user input, as written')}</div>` +
        `<blockquote class="lg-sp-quote">“${escapeHtml(text)}”</blockquote>`);
}

export function renderClarifications(model: SpecModel): string[] {
    return model.sessions.map((session) => {
        const answered = session.items.filter((q) => q.a !== undefined).length;
        const open = session.items.length - answered;
        const rows = session.items.map((q) => {
            const refs = q.a ? idsIn(q.a) : [];
            const trail = q.a !== undefined
                ? `${status('done', 'Answered')}${refs.length ? `<span class="lg-sp-note">${chips(refs, model, 3)}</span>` : ''}`
                : status('warn', 'Open');
            const body = q.a !== undefined ? `<span class="lg-sp-answer">${inl(q.a)}</span>` : '<span class="lg-sp-sub">No answer yet.</span>';
            return `<div class="lg-sp-row lg-sp-clar"><div class="lg-sp-grid"><span class="lg-sp-id">Q${q.n}</span>` +
                `<span class="lg-sp-main"><span class="lg-sp-text lg-sp-strong">${inl(q.q)}</span>${body}</span><span class="lg-sp-trail">${trail}</span></div></div>`;
        }).join('');
        const summary = `${eyebrow('decision', 'Clarifications')}${session.date ? ` <span class="lg-sp-note">session ${escapeHtml(session.date)}</span>` : ''}` +
            `${note(`· ${answered} answered${open ? ` · ${open} open` : ''}`)}`;
        return `<div class="lg-sp lg-sp-clars lg-fam-decision"><details class="lg-sp-clarfold"${open ? ' open' : ''}><summary>${summary}</summary>${rows}</details></div>`;
    });
}

/* ---------- the preprocessor ---------- */

type Slot = string | { render: () => string };

const MANDATORY = /\s*\*?\((?:mandatory|include if[^)]*)\)\*?\s*$/i;

function cleanHeading(text: string): string {
    return text.replace(MANDATORY, '').trim();
}

function balanceBold(text: string): string {
    const marks = (text.match(/\*\*/g) ?? []).length;
    return marks % 2 === 1 && !text.startsWith('**') ? `**${text}` : text;
}

function continuation(lines: string[], from: number): { text: string; next: number } {
    let text = '';
    let j = from;
    while (j < lines.length && /^\s{2,}\S/.test(lines[j]) && !/^\s*[-*]\s/.test(lines[j]) && !/^\s*\d+[.)]\s/.test(lines[j])) {
        text += ` ${lines[j].trim()}`;
        j++;
    }
    return { text, next: j };
}

function parseStory(lines: string[], start: number, head: RegExpMatchArray): { story: SpecStory; next: number } {
    const n = Number(head[1]);
    const prio = head[3] ? Math.min(3, Math.max(1, Number(head[3]))) : 2;
    const story: SpecStory = { n, id: `US${n}`, title: head[2].trim(), priority: prio as 1 | 2 | 3, desc: '', why: '', test: '', scenarios: [], raw: '' };
    let mode: 'desc' | 'why' | 'test' | 'scen' = 'desc';
    let j = start + 1;
    const raw: string[] = [];
    for (; j < lines.length && !/^#{1,3}[ \t]/.test(lines[j]); j++) {
        const line = lines[j];
        raw.push(line);
        if (/^-{3,}\s*$/.test(line)) continue;
        const label = line.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
        const name = label ? label[1].toLowerCase().replace(/:$/, '') : '';
        if (label && name.startsWith('why')) { mode = 'why'; story.why = label[2]; continue; }
        if (label && name.startsWith('independent test')) { mode = 'test'; story.test = label[2]; continue; }
        if (label && name.startsWith('acceptance scenario')) { mode = 'scen'; continue; }
        if (!line.trim()) { if (mode !== 'scen') mode = 'desc'; continue; }
        if (mode === 'scen') {
            const item = line.match(/^\s*(?:\d+[.)]|[-*])\s+(.*)$/);
            if (item) story.scenarios.push(item[1]);
            else if (story.scenarios.length) story.scenarios[story.scenarios.length - 1] += ` ${line.trim()}`;
            continue;
        }
        if (mode === 'why') story.why += ` ${line.trim()}`;
        else if (mode === 'test') story.test += ` ${line.trim()}`;
        else story.desc += `${story.desc ? ' ' : ''}${line.trim()}`;
    }
    story.raw = raw.join('\n');
    return { story, next: j };
}

type Section = '' | 'stories' | 'req' | 'sc' | 'edges' | 'assume' | 'entities';

export function preprocessSpecLedger(markdown: string): string {
    if (!isSpecDocument(markdown)) return markdown;

    const lines = markdown.split('\n');
    const model = emptyModel();
    const out: Slot[] = [];
    let inFence = false;
    let section: Section = '';
    let sawH1 = false;
    let reqOpen = false;
    let edgeN = 0;
    let assumeN = 0;
    let questionN = 0;

    const slot = (render: () => string) => out.push({ render });
    const closeReq = () => {
        if (!reqOpen) return;
        reqOpen = false;
        slot(() => {
            const known = new Set([...model.reqs, ...model.criteria].map((r) => r.id));
            const missing = idsIn([...model.stories.map((s) => s.raw), ...model.criteria.map((c) => c.text)].join('\n')).filter((id) => !id.startsWith('SC-') && !known.has(id));
            return missing.map((id) => renderUnresolved(id, model)).join('\n');
        });
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; out.push(line); continue; }
        if (inFence) { out.push(line); continue; }

        const h1 = !sawH1 && line.match(/^#[ \t]+(.+)$/);
        if (h1) {
            sawH1 = true;
            model.title = cleanHeading(h1[1]).replace(/^(?:Feature )?Specification:\s*/i, '');
            let j = i + 1;
            for (; j < lines.length; j++) {
                if (!lines[j].trim()) continue;
                const meta = lines[j].match(/^\*\*([^*]+?):?\*\*:?\s*(.*)$/);
                if (!meta) break;
                const label = meta[1].trim().toLowerCase();
                const value = meta[2].replace(/`/g, '').trim();
                if (label.startsWith('feature branch')) model.branch = value;
                else if (label === 'created' || label === 'date') model.created = value;
                else if (label === 'status') model.status = value;
                else if (label === 'input') model.input = value;
            }
            i = j - 1;
            slot(() => `${renderSpecHeader(model)}\n${renderStoryIndex(model)}`);
            continue;
        }

        const head = line.match(/^(#{1,6})[ \t]+(.*)$/);
        if (head) {
            const level = head[1].length;
            const text = cleanHeading(head[2]);
            const lower = text.toLowerCase();
            const story = level === 3 ? line.match(/^###[ \t]+User Story\s*(\d+)\s*[-–—:]\s*(.+?)(?:\s*\(Priority:\s*P(\d)\))?\s*$/i) : null;
            if (story) {
                const parsed = parseStory(lines, i, story);
                model.stories.push(parsed.story);
                const s = parsed.story;
                slot(() => renderStoryCard(s, model));
                i = parsed.next - 1;
                continue;
            }
            if (/^clarifications\b/.test(lower)) {
                closeReq();
                section = '';
                let j = i + 1;
                let session = { date: '', items: [] as { n: number; q: string; a?: string }[] };
                const sessions = [session];
                const rest: string[] = [];
                for (; j < lines.length && !/^#{1,2}[ \t]/.test(lines[j]); j++) {
                    const sm = lines[j].match(/^###[ \t]+Session\s*(.*)$/i);
                    if (sm) { if (session.items.length || session.date) { session = { date: '', items: [] }; sessions.push(session); } session.date = sm[1].trim(); continue; }
                    const bullet = lines[j].match(/^[-*]\s+\**Q\d*\**:?\**:?\s*(.+)$/);
                    if (bullet) {
                        const c = continuation(lines, j + 1);
                        const joined = `${bullet[1]}${c.text}`;
                        const qa = joined.match(/^(.*?)\s*\**(?:->|\u2192|\u2014>)\s*\**A\**:?\**:?\s*(.*)$/);
                        j = c.next - 1;
                        if (qa) session.items.push({ n: ++questionN, q: qa[1].replace(/\*\*/g, '').trim(), a: balanceBold(qa[2].trim()) });
                        else session.items.push({ n: ++questionN, q: joined.replace(/\*\*/g, '').trim() });
                        continue;
                    }
                    if (lines[j].trim() && !/^###/.test(lines[j])) rest.push(lines[j]);
                }
                model.sessions.push(...sessions.filter((s) => s.items.length));
                slot(() => renderClarifications(model).join('\n'));
                rest.forEach((r) => out.push(r));
                i = j - 1;
                continue;
            }

            const prev = section;
            if (/^user scenarios/.test(lower)) section = 'stories';
            else if (/^edge cases/.test(lower)) section = 'edges';
            else if (/^requirements\b/.test(lower) && level <= 2) section = 'req';
            else if (/^success criteria/.test(lower)) section = 'sc';
            else if (/key entities/.test(lower)) section = 'entities';
            else if (/^assumptions/.test(lower)) section = 'assume';
            else if (level <= 2 || (level === 3 && section === 'stories')) section = '';
            if (prev === 'req' && section !== 'req') closeReq();

            if (section === 'edges' && prev !== 'edges') { slot(() => sectionEyebrow('guard', 'Edge cases', model.edges.length, `· ${model.edges.filter((e) => !scenarioFor(e, model.stories)).length} without a scenario`)); continue; }
            if (section === 'sc' && /^success criteria/.test(lower)) { slot(() => sectionEyebrow('req', 'Success criteria', model.criteria.length, `· ${model.criteria.filter((c) => /~~|\(withdrawn/i.test(c.text)).length} withdrawn`)); continue; }
            if (section === 'entities' && prev !== 'entities') { slot(() => sectionEyebrow('data', 'Key entities', model.entities.length)); continue; }
            if (section === 'assume' && prev !== 'assume') { slot(() => sectionEyebrow('guard', 'Assumptions', model.assumptions.length, `· ${model.assumptions.filter((a) => !a.confirmed).length} unconfirmed`)); continue; }
            if (prev === 'sc' && section === 'sc' && /^measurable outcomes/.test(lower)) continue;
            if (section === 'req' && /^requirements\b/.test(lower) && prev !== 'req') {
                reqOpen = true;
                slot(() => sectionEyebrow('req', 'Requirements', model.reqs.length, tasks.length ? `· ${model.reqs.filter((r) => !tasks.some((t) => t.refs.includes(r.id))).length} untested` : ''));
            }
            out.push(`${head[1]} ${text}`);
            continue;
        }

        if (section === 'req' || section === 'sc') {
            const m = line.match(/^[-*]\s+\**((?:[A-Z]{2,5})-\d+[a-z]?)\**:?\s*(.*)$/);
            if (m) {
                const c = continuation(lines, i + 1);
                const text = `${m[2]}${c.text}`.trim();
                const id = m[1];
                if (section === 'req') { model.reqs.push({ id, text }); slot(() => renderRequirement(id, text, model)); }
                else { model.criteria.push({ id, text }); slot(() => renderCriterion(id, text, model)); }
                i = c.next - 1;
                continue;
            }
        }
        if (section === 'edges') {
            const m = line.match(/^[-*]\s+(.+)$/);
            if (m) {
                const c = continuation(lines, i + 1);
                let body = `${m[1]}${c.text}`.trim();
                const idm = body.match(/^\*\*(EC-\d+)\*\*:?\s*/);
                const id = idm ? idm[1] : `EC-${++edgeN}`;
                if (idm) { body = body.slice(idm[0].length); edgeN++; }
                const split = body.match(/^(.+?)(?::\s+|\?\s+(?=\S))(.*)$/);
                const edge: SpecEdge = { id, trigger: split ? (body.includes('?') && !body.includes(': ') ? `${split[1]}?` : split[1]) : body, outcome: split ? split[2] : '' };
                model.edges.push(edge);
                slot(() => renderEdge(edge, model));
                i = c.next - 1;
                continue;
            }
        }
        if (section === 'assume') {
            const m = line.match(/^[-*]\s+(.+)$/);
            if (m) {
                const c = continuation(lines, i + 1);
                const text = `${m[1]}${c.text}`.trim();
                const id = `A-${++assumeN}`;
                const q = text.match(/\bQ(\d+)\b/);
                const confirmed = /\(confirmed\)|confirmed in Q\d/i.test(text) || !!q;
                model.assumptions.push({ id, text, confirmed, question: q ? `Q${q[1]}` : undefined });
                slot(() => renderAssumption(id, text, confirmed, q ? `Q${q[1]}` : undefined));
                i = c.next - 1;
                continue;
            }
        }
        if (section === 'entities') {
            const m = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*(\([^)]*\))?\s*[:—–-]?\s*(.*)$/);
            if (m) {
                const c = continuation(lines, i + 1);
                const entity = { name: m[1].replace(/:$/, ''), desc: `${m[2] ? `${m[2]} ` : ''}${m[3]}${c.text}`.trim() };
                model.entities.push(entity);
                slot(() => renderEntity(entity.name, entity.desc, model));
                i = c.next - 1;
                continue;
            }
        }
        out.push(line);
    }
    closeReq();
    if (model.input) slot(() => renderVerbatim(model.input));

    return out.map((s) => typeof s === 'string' ? s : s.render()).join('\n');
}
