import { normaliseSlug, PROCESS_TEXT_LIMIT, type ProcessCreateKind } from '../../../src/protocol/processCreate';

export interface CreateForm {
    kind: ProcessCreateKind;
    text: string;
    extra: string;
    slug: string;
    existingSlugs: readonly string[];
}

/** Why the slug cannot be sent, or undefined when it can. */
export function slugProblem(kind: ProcessCreateKind, slug: string, existingSlugs: readonly string[]): string | undefined {
    if (!slug) {
        return 'A slug is needed.';
    }
    if (existingSlugs.includes(slug)) {
        return `${kind === 'bug' ? 'A bug' : 'An idea'} named ${slug} already exists.`;
    }
    return undefined;
}

export function isOverLimit(form: Pick<CreateForm, 'text' | 'extra'>): boolean {
    return form.text.length > PROCESS_TEXT_LIMIT || form.extra.length > PROCESS_TEXT_LIMIT;
}

export function canSend(form: CreateForm, sending: boolean): boolean {
    return !sending
        && form.text.trim().length > 0
        && !isOverLimit(form)
        && slugProblem(form.kind, form.slug, form.existingSlugs) === undefined;
}

export function hasTypedText(form: Pick<CreateForm, 'text' | 'extra'>): boolean {
    return form.text.trim().length > 0 || form.extra.trim().length > 0;
}

/** The slug as it stands mid-typing: a trailing dash is kept so the next word can follow it. */
export function typingSlug(typed: string): string {
    const clean = normaliseSlug(typed);
    return clean && /[^a-z0-9]$/i.test(typed) ? `${clean}-` : clean;
}

/** Where the caret belongs in the normalised slug, given where it sat in the typed one. */
export function slugCaret(typed: string, caret: number): number {
    return Math.min(typingSlug(typed.slice(0, caret)).length, typingSlug(typed).length);
}
