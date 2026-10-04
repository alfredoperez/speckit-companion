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
