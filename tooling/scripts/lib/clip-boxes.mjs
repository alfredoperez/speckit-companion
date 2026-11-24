/**
 * clip-boxes.mjs: the pure half of the highlight-box drift check.
 *
 * A clip's BEATS carry rects measured once off a captured story. This file reads a
 * composition's beats, says which capture each beat is drawn over, and compares a
 * stored rect with a freshly measured one. It touches no browser and no disk beyond
 * the composition's own index.html, so a test can drive it with strings.
 */

/** A rect is [x, y, w, h] in the capture's own CSS pixels. Edges may move this far before a box counts as moved. */
export const TOLERANCE_PX = 4;

function arrayBody(html, name) {
    const m = new RegExp(`var\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\n[ \\t]*\\];`).exec(html);
    if (!m) return null;
    const body = m[1].trim();
    return body ? JSON.parse(`[${body}]`) : [];
}

/** BEATS, CUTS and the capture file behind each shot id, read from a composition's index.html. */
export function readComposition(html) {
    const beats = arrayBody(html, 'BEATS');
    if (!beats) return null;
    const shots = [];
    for (const m of html.matchAll(/id="sh(\d+)"\s+src="assets\/captures\/([^"]+)"/g)) {
        shots[Number(m[1])] = m[2];
    }
    return { beats, cuts: arrayBody(html, 'CUTS') ?? [], shots };
}

/** Which shot is on screen when a beat starts: the last cut at or before it, else shot 0. */
export function shotAtBeat(beat, cuts) {
    let shot = 0;
    for (const cut of cuts) if (cut.t <= beat.t) shot = cut.to;
    return shot;
}

/** The largest single-edge distance between two rects, and the edge it was on. */
export function rectShift(stored, measured) {
    const [sx, sy, sw, sh] = stored;
    const [mx, my, mw, mh] = measured;
    const edges = [
        ['left', mx - sx],
        ['top', my - sy],
        ['right', (mx + mw) - (sx + sw)],
        ['bottom', (my + mh) - (sy + sh)],
    ];
    let worst = edges[0];
    for (const e of edges) if (Math.abs(e[1]) > Math.abs(worst[1])) worst = e;
    return { edge: worst[0], px: worst[1] };
}

/** A drawn ring is padded around its element on purpose; past this many pixels it is aiming somewhere else. */
export const AIM_WARN_PX = 16;

const round = (n) => Math.round(n * 10) / 10;
const fmt = (r) => `[${r.map(round).join(', ')}]`;
const nameOf = ({ clip, beat, label, selector }) => `${clip} beat ${beat + 1}${label ? ` "${label}"` : ''} (${selector})`;

/** The composition's drawn rect no longer matches the one the baseline was recorded against. */
export function describeEdited({ drawn, baseline, ...box }, tolerance = TOLERANCE_PX) {
    if (!baseline) return null;
    const { edge, px } = rectShift(baseline, drawn);
    if (Math.abs(px) <= tolerance) return null;
    return `${nameOf(box)}: the BEATS rect changed (${edge} edge ${round(px)}px) since its baseline, re-check the ring and run --update`;
}

/** A warning when the rect a clip draws sits far from the element it is meant to ring, else null. */
export function describeAim({ drawn, measured, ...box }, limit = AIM_WARN_PX) {
    if (!measured) return null;
    const { edge, px } = rectShift(drawn, measured);
    if (Math.abs(px) <= limit) return null;
    return `${nameOf(box)}: the drawn ring ${fmt(drawn)} is ${round(Math.abs(px))}px off its element ${fmt(measured)} (${edge} edge)`;
}

/**
 * Compare one stored rect with a measurement. Returns null when it held, otherwise the
 * sentence the check prints: it names the clip and the box and says which way it moved.
 */
export function describeDrift({ clip, beat, label, selector, stored, measured }, tolerance = TOLERANCE_PX) {
    const name = nameOf({ clip, beat, label, selector });
    if (!measured) return `${name}: element not found, nothing to measure`;
    const { edge, px } = rectShift(stored, measured);
    if (Math.abs(px) <= tolerance) return null;
    return `${name}: ${edge} edge moved ${round(px)}px, was ${fmt(stored)} now ${fmt(measured)}`;
}
