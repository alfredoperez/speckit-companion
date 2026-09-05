import * as path from 'path';

const ACRONYMS: Record<string, string> = {
    cli: 'CLI',
    api: 'API',
    ui: 'UI',
    ux: 'UX',
    id: 'ID',
    url: 'URL',
    uri: 'URI',
    css: 'CSS',
    html: 'HTML',
    json: 'JSON',
    yaml: 'YAML',
    md: 'MD',
    ai: 'AI',
    sdk: 'SDK',
    pr: 'PR',
    db: 'DB',
    ide: 'IDE',
    npm: 'npm',
    ci: 'CI',
    cd: 'CD',
    io: 'IO',
    os: 'OS',
    sql: 'SQL',
    http: 'HTTP',
    https: 'HTTPS',
    vscode: 'VS Code',
};

function caseWord(word: string): string {
    const lower = word.toLowerCase();
    const acronym = ACRONYMS[lower];
    if (acronym) {
        return acronym;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Title-case a slug or lowercase feature name while preserving known acronyms
 * (CLI, API, VS Code, …). Feature specs are named by slugs and capitalised for
 * display; a naive title-case mangles acronyms ("cli" → "Cli"), so this is the
 * one shared caser both the viewer header and the specs tree route through.
 * Not for living-spec headings — those are authored and shown verbatim.
 */
export function toDisplayCase(name: string): string {
    const words = name.replace(/[-_]+/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return name.trim();
    }
    const out: string[] = [];
    for (let i = 0; i < words.length; i++) {
        const lower = words[i].toLowerCase();
        if (lower === 'vs' && words[i + 1]?.toLowerCase() === 'code') {
            out.push('VS', 'Code');
            i++;
            continue;
        }
        out.push(caseWord(words[i]));
    }
    return out.join(' ');
}

/** Humanize a spec directory slug: "046-spec-viewer-header-redesign" → "Spec Viewer Header Redesign". */
export function deriveSpecName(specDir: string): string {
    const slug = path.basename(specDir);
    const withoutPrefix = slug.replace(/^\d+[-_]/, '');
    return withoutPrefix
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Resolve the readable display name for a spec, by preference:
 * recorded name → document heading (living specs) → humanized slug.
 *
 * Presentation-only: the directory slug stays the stable identifier.
 * Empty or whitespace-only inputs are treated as absent so a blank
 * label never wins over the humanized-slug fallback. Feature names (recorded
 * or slug-derived) are acronym-aware title-cased; a living-spec heading is
 * authored and returned verbatim.
 */
export function resolveSpecDisplayName(
    specName: string | undefined | null,
    specDir: string,
    heading?: string | null
): string {
    const recorded = specName?.trim();
    if (recorded) {
        return toDisplayCase(recorded);
    }
    const docHeading = heading?.trim();
    if (docHeading) {
        return docHeading;
    }
    return toDisplayCase(deriveSpecName(specDir));
}
