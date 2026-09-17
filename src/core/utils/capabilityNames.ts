/** `commands-living-load` reads as `Commands Living Load`. */
export function readableName(name: string): string {
    return name.split(/[-_]+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Drops the leading words every label shares, keeping at least one word per label. */
export function stripSharedLeadingWords(labels: string[]): string[] {
    if (labels.length < 2) return labels;
    const words = labels.map(l => l.split(' '));
    const most = Math.min(...words.map(w => w.length)) - 1;
    let shared = 0;
    while (shared < most && words.every(w => w[shared] === words[0][shared])) shared++;
    return words.map(w => w.slice(shared).join(' '));
}
