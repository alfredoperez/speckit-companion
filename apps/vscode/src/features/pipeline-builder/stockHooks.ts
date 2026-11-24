/**
 * Switching one `.specify/extensions.yml` hook on or off.
 *
 * Edited as text rather than loaded and dumped: the registry is spec-kit's own
 * file, and a round trip through a YAML writer rewrites every entry it did not
 * touch — reordering keys and dropping the comments and the block style the CLI
 * wrote. One line changes, and the rest of the file is byte-for-byte as it was.
 */

import * as yaml from 'js-yaml';
import { HookWhen, StockHookDraft } from '../../protocol/pipeline';

export interface HookSwitch {
    step: string;
    when: HookWhen;
    index: number;
    enabled: boolean;
}

interface Refused { error: string }

/** The file's lines and the line ending it uses, so a write keeps a CRLF file CRLF. */
function splitLines(text: string): { lines: string[]; eol: string } {
    return { lines: text.split(/\r?\n/), eol: text.includes('\r\n') ? '\r\n' : '\n' };
}

function indentOf(line: string): number {
    return line.length - line.replace(/^\s+/, '').length;
}

/** The lines of one list entry, starting at its `- ` line. */
function entrySpan(lines: string[], start: number): number {
    const bullet = indentOf(lines[start]);
    let end = start + 1;
    while (end < lines.length) {
        const line = lines[end];
        if (line.trim() === '') { end += 1; continue; }
        if (indentOf(line) <= bullet) { break; }
        end += 1;
    }
    return end;
}

/**
 * Flip one hook's `enabled`, returning the whole file or the reason it was not
 * touched. A refusal leaves the caller with the text it passed in.
 */
export function setHookEnabled(text: string, flip: HookSwitch): { text: string } | Refused {
    const { lines, eol } = splitLines(text);
    const key = `${flip.when}_${flip.step}:`;
    const at = lines.findIndex(line => line.trim() === key);
    if (at < 0) { return { error: `${key.slice(0, -1)} is not in this registry.` }; }

    const keyIndent = indentOf(lines[at]);
    const entries: number[] = [];
    for (let i = at + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') { continue; }
        const indent = indentOf(line);
        if (indent < keyIndent || (indent === keyIndent && !line.trim().startsWith('- '))) { break; }
        if (line.trim().startsWith('- ')) { entries.push(i); }
    }

    const start = entries[flip.index];
    if (start === undefined) {
        return { error: `There is no hook ${flip.index + 1} ${flip.when} ${flip.step}.` };
    }

    const end = entrySpan(lines, start);
    const value = flip.enabled ? 'true' : 'false';
    for (let i = start; i < end; i++) {
        const found = /^(\s*(?:- )?enabled:\s*)\S.*$/.exec(lines[i]);
        if (found) {
            lines[i] = `${found[1]}${value}`;
            return { text: lines.join(eol) };
        }
    }

    // No `enabled` at all means the hook runs, so the switch is written in.
    const bullet = indentOf(lines[start]);
    lines.splice(start + 1, 0, `${' '.repeat(bullet + 2)}enabled: ${value}`);
    return { text: lines.join(eol) };
}

/** The extension id written on a hook the person adds. No installed extension may own it. */
export const OWN_HOOK_EXTENSION = 'project';

const COMMAND_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const STEP_NAME = /^[a-z][a-z-]*$/;
const WHENS: readonly HookWhen[] = ['before', 'after'];

export interface HookAddress {
    step: string;
    when: HookWhen;
    index: number;
}

type Written = { text: string } | Refused;
type Doc = Record<string, unknown>;

/** A value YAML reads back exactly: plain when it survives, double-quoted otherwise. */
function scalar(value: string): string {
    try {
        const back = yaml.load(`k: ${value}`) as Doc | undefined;
        if (back && back.k === value) { return value; }
    } catch { /* quoted below */ }
    return JSON.stringify(value);
}

function parse(text: string): { doc: Doc } | Refused {
    try {
        const doc = yaml.load(text);
        if (doc === undefined || doc === null) { return { doc: {} }; }
        if (typeof doc !== 'object' || Array.isArray(doc)) {
            return { error: '.specify/extensions.yml is not a mapping, so it was left as it is.' };
        }
        return { doc: doc as Doc };
    } catch (error) {
        return {
            error: `.specify/extensions.yml could not be read (${(error as Error).message.split('\n')[0]}), `
                + 'so it was left as it is.',
        };
    }
}

function checkDraft(draft: StockHookDraft): string | null {
    // The webview is a separate process; its message is checked like any input.
    if (!draft || typeof draft.command !== 'string' || typeof draft.description !== 'string'
        || typeof draft.optional !== 'boolean'
        || (draft.prompt !== undefined && typeof draft.prompt !== 'string')) {
        return 'That hook is missing its command, description or required flag.';
    }
    if (!COMMAND_NAME.test(draft.command.trim())) {
        return 'A hook names a skill or command: letters, digits, and . _ : / - only.';
    }
    if (!draft.description.trim()) { return 'A hook needs a description.'; }
    return null;
}

/** The value written after `key:` on a line, without a trailing comment. */
function inlineValue(line: string): string {
    return line.slice(line.indexOf(':') + 1).replace(/\s+#.*$/, '').trim();
}

/** One past the last non-blank line before `end`. */
function trimEnd(lines: string[], from: number, end: number): number {
    while (end > from + 1 && lines[end - 1].trim() === '') { end -= 1; }
    return end;
}

/** The `hooks:` section: its line, the indent of its keys, and where it ends. */
function hooksSection(lines: string[]): { at: number; childIndent: number; end: number } | null {
    const at = lines.findIndex(line => /^hooks\s*:/.test(line));
    if (at < 0) { return null; }
    let end = at + 1;
    let childIndent = 2;
    let seen = false;
    while (end < lines.length) {
        const line = lines[end];
        if (line.trim() !== '' && indentOf(line) === 0) { break; }
        if (!seen && line.trim() !== '' && !line.trim().startsWith('#')) {
            childIndent = indentOf(line);
            seen = true;
        }
        end += 1;
    }
    return { at, childIndent, end: trimEnd(lines, at, end) };
}

/** A `<when>_<step>:` key inside the section, its entry starts and where its list ends. */
function keySection(lines: string[], from: number, to: number, indent: number, key: string) {
    const at = lines.findIndex((line, i) => i > from && i < to
        && indentOf(line) === indent && new RegExp(`^${key}\\s*:`).test(line.trim()));
    if (at < 0) { return null; }
    let end = at + 1;
    const bullets: number[] = [];
    let bullet = -1;
    while (end < to) {
        const line = lines[end];
        if (line.trim() !== '') {
            const own = indentOf(line);
            if (own < indent || (own === indent && !line.trim().startsWith('- '))) { break; }
            if (line.trim().startsWith('- ') && (bullet < 0 || own === bullet)) {
                bullet = own;
                bullets.push(end);
            }
        }
        end += 1;
    }
    return { at, bullets, bullet: bullet < 0 ? indent : bullet, end: trimEnd(lines, at, end) };
}

function entryLines(bullet: number, draft: StockHookDraft): string[] {
    const pad = ' '.repeat(bullet + 2);
    const prompt = draft.prompt?.trim();
    return [
        `${' '.repeat(bullet)}- extension: ${OWN_HOOK_EXTENSION}`,
        `${pad}command: ${scalar(draft.command.trim())}`,
        `${pad}enabled: true`,
        `${pad}optional: ${draft.optional ? 'true' : 'false'}`,
        ...(prompt ? [`${pad}prompt: ${scalar(prompt)}`] : []),
        `${pad}description: ${scalar(draft.description.trim())}`,
    ];
}

function entriesOf(doc: Doc, key: string): unknown[] | undefined {
    const hooks = doc.hooks;
    if (!hooks || typeof hooks !== 'object') { return undefined; }
    const entries = (hooks as Doc)[key];
    return Array.isArray(entries) ? entries : undefined;
}

/** A string field as the board compares it: trimmed, so a block scalar's last newline does not count. */
function trimmed(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function matches(entry: unknown, draft: StockHookDraft): boolean {
    if (!entry || typeof entry !== 'object') { return false; }
    const row = entry as Doc;
    return typeof row.command === 'string' && trimmed(row.command) === draft.command.trim()
        && typeof row.description === 'string' && trimmed(row.description) === draft.description.trim()
        && Boolean(row.optional) === draft.optional
        && trimmed(row.prompt) === (draft.prompt?.trim() ?? '');
}

/** A line's `  # comment`, when cutting it leaves the value YAML read before. */
function trailingComment(line: string): string {
    const found = /\s+#.*$/.exec(line);
    if (!found) { return ''; }
    const value = line.slice(line.indexOf(':') + 1);
    try {
        const whole = yaml.load(`k: ${value}`) as Doc | undefined;
        const cut = yaml.load(`k: ${value.slice(0, value.length - found[0].length)}`) as Doc | undefined;
        return whole?.k === cut?.k ? found[0] : '';
    } catch {
        return '';
    }
}

const UNSAFE = 'is written in a form the board cannot edit safely, so it was left as it is.';
const UNSURE = 'The board could not write that safely, so .specify/extensions.yml was left as it is.';

/**
 * Add the person's own hook at the end of `<when>_<step>`.
 *
 * `text` is null when the project has no registry yet; the result is then a
 * new file holding only this hook. `installed` names the installed extensions,
 * which must not include the id the board writes on the person's hooks.
 */
export function addUserHook(
    text: string | null, step: string, when: HookWhen, draft: StockHookDraft,
    installed: ReadonlySet<string>,
): Written {
    if (!STEP_NAME.test(step) || !WHENS.includes(when)) {
        return { error: `${when} ${step} is not a place a hook can attach.` };
    }
    const bad = checkDraft(draft);
    if (bad) { return { error: bad }; }
    if (installed.has(OWN_HOOK_EXTENSION)) {
        return { error: `An installed extension is named ${OWN_HOOK_EXTENSION}, so a hook of your own would read as its.` };
    }
    const key = `${when}_${step}`;
    const source = text ?? '';
    const parsed = parse(source);
    if ('error' in parsed) { return parsed; }
    const { doc } = parsed;
    const before = entriesOf(doc, key)?.length ?? 0;

    const { lines: split, eol } = splitLines(source);
    const lines = source === '' ? [] : split;
    const hooks = hooksSection(lines);
    if (!hooks) {
        if (doc.hooks !== undefined) { return { error: `hooks ${UNSAFE}` }; }
        const keep = trimEnd(lines, -1, lines.length);
        lines.splice(keep, lines.length - keep, 'hooks:', `  ${key}:`, ...entryLines(2, draft), '');
    } else {
        if (inlineValue(lines[hooks.at]) !== '') { return { error: `hooks ${UNSAFE}` }; }
        const found = keySection(lines, hooks.at, hooks.end, hooks.childIndent, key);
        if (!found) {
            if (entriesOf(doc, key) || (doc.hooks as Doc | null)?.[key] !== undefined) {
                return { error: `${key} ${UNSAFE}` };
            }
            lines.splice(hooks.end, 0, `${' '.repeat(hooks.childIndent)}${key}:`,
                ...entryLines(hooks.childIndent, draft));
        } else {
            if (inlineValue(lines[found.at]) !== '') { return { error: `${key} ${UNSAFE}` }; }
            lines.splice(found.end, 0, ...entryLines(found.bullet, draft));
        }
    }

    const out = lines.join(eol);
    const after = parse(out);
    const entries = 'error' in after ? undefined : entriesOf(after.doc, key);
    if (!entries || entries.length !== before + 1 || !matches(entries[before], draft)) {
        return { error: UNSURE };
    }
    return { text: out };
}

/** Where one of the person's entries sits, or why it cannot be touched. */
function ownEntry(
    text: string, at: HookAddress, installed: ReadonlySet<string>,
): { doc: Doc; lines: string[]; eol: string; start: number; keyAt: number; key: string } | Refused {
    const parsed = parse(text);
    if ('error' in parsed) { return parsed; }
    const { doc } = parsed;
    const key = `${at.when}_${at.step}`;
    const entry = entriesOf(doc, key)?.[at.index];
    if (!entry || typeof entry !== 'object') {
        return { error: `There is no hook ${at.index + 1} ${at.when} ${at.step}.` };
    }
    const extension = (entry as Doc).extension;
    if (typeof extension === 'string' && installed.has(extension)) {
        return {
            error: `That hook belongs to the ${extension} extension, which rewrites it on install. `
                + 'It can be switched on or off here.',
        };
    }
    const { lines, eol } = splitLines(text);
    const hooks = hooksSection(lines);
    const found = hooks && keySection(lines, hooks.at, hooks.end, hooks.childIndent, key);
    if (!found || found.bullets.length !== entriesOf(doc, key)!.length) {
        return { error: `${key} ${UNSAFE}` };
    }
    return { doc, lines, eol, start: found.bullets[at.index], keyAt: found.at, key };
}

/**
 * Change the command, description, required flag and prompt of one of the
 * person's hooks. Every other line of the entry, its condition and priority
 * among them, stays as it was.
 */
export function updateUserHook(
    text: string, at: HookAddress, draft: StockHookDraft, installed: ReadonlySet<string>,
): Written {
    const bad = checkDraft(draft);
    if (bad) { return { error: bad }; }
    const found = ownEntry(text, at, installed);
    if ('error' in found) { return found; }
    const { lines, eol, start, key } = found;
    const bullet = indentOf(lines[start]);
    const fieldIndent = bullet + 2;
    const prompt = draft.prompt?.trim() ?? '';
    const row = entriesOf(found.doc, key)![at.index] as Doc;
    const fields: Array<[string, string | null, boolean]> = [
        ['command', scalar(draft.command.trim()), trimmed(row.command) === draft.command.trim()],
        ['optional', draft.optional ? 'true' : 'false', Boolean(row.optional) === draft.optional],
        ['prompt', prompt ? scalar(prompt) : null, trimmed(row.prompt) === prompt],
        ['description', scalar(draft.description.trim()), trimmed(row.description) === draft.description.trim()],
    ];

    // Only a value that changed is rewritten, so the person's comments and block style survive.
    for (const [field, value, same] of fields) {
        if (same) { continue; }
        const end = trimEnd(lines, start, entrySpan(lines, start));
        const name = new RegExp(`^${field}\\s*:`);
        let line = -1;
        for (let i = start; i < end; i++) {
            const body = i === start ? lines[i].trim().slice(2) : lines[i];
            if ((i === start || indentOf(lines[i]) === fieldIndent) && name.test(body.trim())) {
                line = i;
                break;
            }
        }
        if (line < 0) {
            if (value !== null) { lines.splice(end, 0, `${' '.repeat(fieldIndent)}${field}: ${value}`); }
            continue;
        }
        // A block or wrapped value runs on over the lines indented under it.
        let stop = line + 1;
        while (stop < end && (lines[stop].trim() === '' || indentOf(lines[stop]) > fieldIndent)) { stop += 1; }
        stop = trimEnd(lines, line, stop);
        const lead = line === start ? `${' '.repeat(bullet)}- ` : ' '.repeat(fieldIndent);
        if (value === null && line !== start) {
            lines.splice(line, stop - line);
        } else {
            lines.splice(line, stop - line, `${lead}${field}: ${value ?? '""'}${trailingComment(lines[line])}`);
        }
    }

    const out = lines.join(eol);
    const after = parse(out);
    const entries = 'error' in after ? undefined : entriesOf(after.doc, key);
    if (!entries || entries.length !== entriesOf(found.doc, key)!.length
        || !matches(entries[at.index], draft)) {
        return { error: UNSURE };
    }
    return { text: out };
}

/** Take one of the person's hooks out, and its key with it when that was the last one. */
export function removeUserHook(
    text: string, at: HookAddress, installed: ReadonlySet<string>,
): Written {
    const found = ownEntry(text, at, installed);
    if ('error' in found) { return found; }
    const { lines, eol, start, keyAt, key } = found;
    const count = entriesOf(found.doc, key)!.length;
    const end = trimEnd(lines, start, entrySpan(lines, start));
    if (count === 1) {
        lines.splice(keyAt, end - keyAt);
    } else {
        lines.splice(start, end - start);
    }

    const out = lines.join(eol);
    const after = parse(out);
    if ('error' in after || (entriesOf(after.doc, key)?.length ?? 0) !== count - 1) {
        return { error: UNSURE };
    }
    return { text: out };
}
