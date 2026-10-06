/**
 * Preprocessing strips, collapses and expands lines, so a line's position in the
 * processed document is not its line in the file. Every line action (comment,
 * edit, remove, tick) is sent to the extension by file line, so each rendered
 * line needs the number it has on disk.
 *
 * Lines the preprocessors left alone are found again in order and anchor the
 * map. A line they rewrote sits between two anchors: when the stretch kept its
 * length the position is exact, otherwise it counts back from the next anchor,
 * because a collapsed block is emitted where its source region ends.
 */
export function mapToSourceLines(source: string, processed: string): number[] {
    const processedLines = processed.split('\n');
    if (source === processed) return processedLines.map((_, i) => i + 1);

    const sourceLines = source.split('\n');
    const map = new Array<number>(processedLines.length).fill(0);

    let cursor = 0;
    for (let i = 0; i < processedLines.length; i++) {
        const line = processedLines[i];
        if (!line.trim()) continue;
        const found = sourceLines.indexOf(line, cursor);
        if (found === -1) continue;
        map[i] = found + 1;
        cursor = found + 1;
    }

    let prevIndex = -1;
    let prevSource = 0;
    for (let i = 0; i <= processedLines.length; i++) {
        const atEnd = i === processedLines.length;
        if (!atEnd && map[i] === 0) continue;
        const nextSource = atEnd ? sourceLines.length + 1 : map[i];
        const floor = Math.min(prevSource + 1, Math.max(nextSource - 1, 1));
        for (let j = prevIndex + 1; j < i; j++) {
            map[j] = Math.max(floor, nextSource - (i - j));
        }
        prevIndex = i;
        prevSource = nextSource;
    }

    return map;
}
