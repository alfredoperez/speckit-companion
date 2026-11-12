/**
 * Defensive coercion for `task_summaries[*].concerns` and `.files` shapes
 * the AI writers may emit. The canonical contract is `string[]`, but
 * writers occasionally emit a plain string ("None", a sentence) or null.
 * Coerce to a safe `string[]` so card render code can iterate without
 * type-checking each value. See spec 095.
 */

const EMPTY_SENTINELS = new Set(['', 'none', 'n/a']);

export function toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === 'string');
    }
    if (value == null) return [];
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (EMPTY_SENTINELS.has(trimmed.toLowerCase())) return [];
        return [trimmed];
    }
    return [];
}
