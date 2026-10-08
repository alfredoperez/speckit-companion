const FENCE_LANGUAGE = /^[a-z0-9][a-z0-9_+#.-]{0,31}$/;
const OPTION = /([^\s=]+)(?:=("[^"]*"|'[^']*'|\S*))?/g;

export interface FenceInfo {
    language: string;
    title: string;
    options: Map<string, string | true>;
}

export const isFenceLine = (line: string): boolean => line.trim().startsWith('```');

/** A fence's info string is someone else's text: only a plain language name is ever safe to put in an attribute. */
export function fenceLanguage(word: string): string {
    const name = word.toLowerCase();
    return FENCE_LANGUAGE.test(name) ? name : '';
}

export function parseFenceInfo(info: string): FenceInfo {
    const text = info.trim();
    const first = text.split(/\s+/, 1)[0];
    const hasLanguage = !first.includes('=');
    const language = hasLanguage ? fenceLanguage(first) : '';
    const rest = hasLanguage ? text.slice(first.length) : text;
    const options = new Map<string, string | true>();
    let title = '';
    for (const [, key, raw] of rest.matchAll(OPTION)) {
        const value = raw === undefined ? true : raw.replace(/^(["'])(.*)\1$/, '$2');
        if (key === 'title' && typeof value === 'string') title = value;
        else options.set(key, value);
    }
    return { language, title, options };
}

/** Runs `fn` over the text between fences only; a fence is what the renderer's own loop treats as one. */
export function mapOutsideFences(markdown: string, fn: (run: string) => string): string {
    const lines = markdown.split('\n');
    if (!lines.some(isFenceLine)) return fn(markdown);

    const segments: { fenced: boolean; lines: string[] }[] = [];
    let inFence = false;
    for (const line of lines) {
        const marker = isFenceLine(line);
        const fenced = inFence || marker;
        const last = segments[segments.length - 1];
        if (last && last.fenced === fenced) last.lines.push(line);
        else segments.push({ fenced, lines: [line] });
        if (marker) inFence = !inFence;
    }

    return segments
        .map((segment, index) => {
            const text = segment.lines.join('\n');
            if (segment.fenced) return text;
            if (index === 0) return fn(text);
            const out = fn('\n' + text);
            return out.startsWith('\n') ? out.slice(1) : out;
        })
        .join('\n');
}
