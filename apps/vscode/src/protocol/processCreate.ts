/** The contract between the New Bug / New Idea screen and the extension host; both sides compile it, so no `vscode` import. */

export type ProcessCreateKind = 'bug' | 'idea';

export const PROCESS_TEXT_LIMIT = 20000;

const SLUG_WORDS = 4;
const SLUG_LENGTH = 40;

/** Lowercase kebab-case over `a-z0-9`; anything else becomes a single dash. `../x` gives `x`, `/` gives nothing. */
export function normaliseSlug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, SLUG_LENGTH)
        .replace(/-+$/, '');
}

/** A short folder name suggested from what was typed: its first few words. */
export function slugFromText(text: string): string {
    const words = normaliseSlug(text.slice(0, 200)).split('-').filter(Boolean);
    return normaliseSlug(words.slice(0, SLUG_WORDS).join('-'));
}

export type ProcessCreateToExtension =
    | { type: 'ready' }
    | { type: 'submit'; text: string; extra: string; slug: string }
    | { type: 'cancel'; typed?: boolean };

export type ExtensionToProcessCreate =
    | { type: 'init'; kind: ProcessCreateKind; assistantName: string; existingSlugs: string[] }
    | { type: 'submissionStarted' }
    | { type: 'submissionComplete' }
    | { type: 'error'; message: string };
