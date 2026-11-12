/**
 * The subset the runtime parser accepts, mirrored so the editor cannot claim a
 * config is fine while every command rejects it.
 *
 * Kept deliberately small and mechanical: it detects the same four shapes the
 * runtime refuses — a tab indent, a document separator, an anchor or alias, and
 * a block scalar. Anything subtler is left to js-yaml, because a second full
 * YAML implementation here would drift from the first one immediately. Pinned
 * against the same fixtures as the runtime reader.
 */
export function unsupportedForRuntime(text: string): string | null {
    const quoted = /"[^"]*"|'[^']*'/g;
    // An anchor only exists where it starts a token; `2>&1` in a shell command
    // and an unquoted glob like `*.min.js` are not anchors.
    const anchorDef = /(?:^|(?<=[\s,[{]))&([A-Za-z0-9_.+/-]+)(?=[\s,\]}]|$)/;
    const aliasRef = /(?:^|(?<=[\s,[{]))\*([A-Za-z0-9_.+/-]+)(?=[\s,\]}]|$)/;
    const lines = text.split('\n');
    const anchors = new Set<string>();
    for (const raw of lines) {
        const m = anchorDef.exec(stripComment(raw).replace(quoted, ''));
        if (m) { anchors.add(m[1]); }
    }
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = stripComment(raw);
        if (!line.trim()) { continue; }
        const n = i + 1;
        if (/^\s*\t|\t/.test(line.split(':')[0] ?? '')) {
            return `line ${n}: tab indentation is not supported — use spaces`;
        }
        if (/^(---|\.\.\.)\s*$/.test(line.trim())) {
            return `line ${n}: multiple documents are not supported — keep one document per file`;
        }
        const bare = line.replace(quoted, '');
        if (anchorDef.test(bare)) {
            return `line ${n}: anchors and aliases are not supported`;
        }
        const alias = aliasRef.exec(bare);
        if (alias && anchors.has(alias[1])) {
            return `line ${n}: anchors and aliases are not supported`;
        }
        if (/:\s*[|>][-+0-9]*\s*$/.test(bare)) {
            return `line ${n}: block scalars are not supported — use a quoted single-line value`;
        }
    }
    return null;
}

function stripComment(line: string): string {
    let quote: string | null = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            if (ch === quote) { quote = null; }
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '#' && (i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t')) {
            return line.slice(0, i).replace(/\s+$/, '');
        }
    }
    return line;
}

