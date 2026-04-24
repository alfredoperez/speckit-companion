export function normalize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function fuzzyMatch(query: string, ...haystacks: Array<string | undefined>): boolean {
    const q = normalize(query);
    if (q.length === 0) return true;
    const hay = haystacks
        .filter((h): h is string => typeof h === 'string')
        .map(normalize)
        .join('');
    let i = 0;
    for (const ch of hay) {
        if (ch === q[i]) {
            i++;
            if (i === q.length) return true;
        }
    }
    return false;
}
