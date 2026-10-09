/**
 * Switching one `.specify/extensions.yml` hook on or off.
 *
 * Edited as text rather than loaded and dumped: the registry is spec-kit's own
 * file, and a round trip through a YAML writer rewrites every entry it did not
 * touch — reordering keys and dropping the comments and the block style the CLI
 * wrote. One line changes, and the rest of the file is byte-for-byte as it was.
 */

import { HookWhen } from '../../protocol/pipeline';

export interface HookSwitch {
    step: string;
    when: HookWhen;
    index: number;
    enabled: boolean;
}

interface Refused { error: string }

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
    const lines = text.split('\n');
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
            return { text: lines.join('\n') };
        }
    }

    // No `enabled` at all means the hook runs, so the switch is written in.
    const bullet = indentOf(lines[start]);
    lines.splice(start + 1, 0, `${' '.repeat(bullet + 2)}enabled: ${value}`);
    return { text: lines.join('\n') };
}
