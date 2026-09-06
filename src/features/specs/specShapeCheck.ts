/**
 * The living-spec shape check — the editor's half.
 *
 * The shipped extension is only what is in the package, so it cannot assume the
 * spec-kit scripts are installed, and a subprocess in the save path is a cost on
 * every write. So the checks exist here too. The risk is divergence, not
 * duplication: this and `speckit-extension/scripts/living_validate.py` are
 * pinned to `speckit-extension/tests/fixtures/spec-shape/`, and the guard there
 * fails the build when either side skips an example.
 *
 * Pure text in, findings out. No editor import, so the tests need no harness.
 */

import { globMatches } from './livingSpecsModel';

/** Severity decides one thing: whether a fold stops. Nothing else reads it. */
export type Severity = 'error' | 'warning';

export interface Finding {
    severity: Severity;
    /** Stable across rewordings, so a refusal message can be searched for. */
    code: string;
    path: string;
    /** One-based, on the heading or bullet the finding is about. */
    line: number;
    message: string;
    fix: string;
    capability?: string;
}

const REQ_RE = /^###(?!#)\s+(.+?)\s*$/;
const SCENARIO_RE = /^####(?!#)\s+Scenario\s*:\s*(.+?)\s*$/i;
const SECTION_RE = /^##(?!#)\s+(.+?)\s*$/;
const TOUCHES_RE = /^\s*<!--\s*touches:\s*(.+?)\s*-->\s*$/;
const CAP_MARKER_RE = /^\s*<!--\s*capability:\s*([^\s>]+)\s*-->\s*$/i;
const DELTA_HEADER_RE = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i;
// Any markdown bullet, ordered or not. `+` is a bullet and a numbered list is
// ordinary prose shape; refusing a whole capability over one is not a check, it
// is a formatting preference with teeth.
const BULLET = String.raw`^\s*(?:[-*+]|\d+[.)])\s*`;
const WHEN_RE = new RegExp(BULLET + String.raw`\*{1,2}(WHEN|GIVEN)\*{1,2}`, 'i');
// `AND` continues whichever half came before it, so it is never evidence of an
// outcome. Counting it as one is how a scenario with a condition and no result
// passes a check written to catch exactly that.
const THEN_RE = new RegExp(BULLET + String.raw`\*{1,2}THEN\*{1,2}`, 'i');

/**
 * False when a fence is opened and never closed.
 *
 * Everything after an unclosed fence is invisible to every reader — the slicer,
 * the coverage denominator, the shape check and the fold alike — so a count
 * taken from such a document cannot be trusted by any of them.
 */
export function fencesAreBalanced(text: string): boolean {
    let opened = 0;
    for (const line of text.split(/\r?\n/)) {
        if (/^\s*(```|~~~)/.test(line)) opened += 1;
    }
    return opened % 2 === 0;
}

/** True for every line inside a fenced block, and for the fences themselves. */
function fenceFlags(lines: string[]): boolean[] {
    const flags: boolean[] = [];
    let inside = false;
    for (const line of lines) {
        if (/^\s*(```|~~~)/.test(line)) {
            inside = !inside;
            flags.push(true);
            continue;
        }
        flags.push(inside);
    }
    return flags;
}

function finding(
    severity: Severity, code: string, path: string, line: number,
    message: string, fix: string, capability?: string
): Finding {
    return capability
        ? { severity, code, path, line, message, fix, capability }
        : { severity, code, path, line, message, fix };
}

export interface LivingOptions {
    /** Repository root, used only to answer whether a marker matches anything. */
    root?: string;
    /** Every path in the repository. Supplied by the caller so one walk serves many files. */
    paths?: string[];
    capability?: string;
    /** Added to every finding's line, for a slice checked out of a larger file. */
    offset?: number;
}

/**
 * Every shape finding in one living spec, ordered by line.
 *
 * Requirements are counted off every `###` in the document with fences ignored —
 * the same headings the slicer and the coverage denominator count. Counting them
 * differently here is how a finding comes to name a requirement no other reader
 * believes exists.
 */
export function checkLivingSpec(
    text: string, path: string, options: LivingOptions = {}
): Finding[] {
    const offset = options.offset ?? 0;
    const lines = text.split(/\r?\n/);
    const fenced = fenceFlags(lines);
    const findings: Finding[] = [];
    const seen = new Map<string, number>();
    const cap = options.capability;

    const isReq = (i: number) => !fenced[i] && REQ_RE.test(lines[i]);
    const isSection = (i: number) => !fenced[i] && SECTION_RE.test(lines[i]);

    let i = 0;
    while (i < lines.length) {
        const head = isReq(i) ? lines[i].match(REQ_RE) : null;
        if (!head) {
            i++;
            continue;
        }
        const heading = head[1];
        // A requirement ends at the next requirement or the next section, so one
        // before an uncovered section does not absorb it.
        let j = i + 1;
        while (j < lines.length && !isReq(j) && !isSection(j)) j++;

        const first = seen.get(heading);
        if (first !== undefined) {
            findings.push(finding(
                'error', 'duplicate-requirement', path, i + 1,
                `"${heading}" is already a requirement in this spec, at line ${first}.`,
                'Rename one of them, or merge the two into a single requirement.', cap));
        } else {
            seen.set(heading, i + 1);
        }

        const scenarios: number[] = [];
        for (let k = i + 1; k < j; k++) {
            if (!fenced[k] && SCENARIO_RE.test(lines[k])) scenarios.push(k);
        }
        if (scenarios.length === 0) {
            findings.push(finding(
                'warning', 'requirement-without-scenario', path, i + 1,
                `"${heading}" states a rule and never says how anyone would know it held.`,
                'Add a `#### Scenario:` with a WHEN and a THEN under this requirement.', cap));
        }

        for (let n = 0; n < scenarios.length; n++) {
            const start = scenarios[n];
            const end = n + 1 < scenarios.length ? scenarios[n + 1] : j;
            let hasWhen = false;
            let hasThen = false;
            for (let k = start + 1; k < end; k++) {
                if (fenced[k]) continue;
                if (WHEN_RE.test(lines[k])) hasWhen = true;
                if (THEN_RE.test(lines[k])) hasThen = true;
            }
            if (hasWhen && hasThen) continue;
            findings.push(finding(
                'error', 'scenario-missing-half', path, start + 1,
                `This scenario has ${hasWhen ? 'no outcome' : 'no condition'}, so nothing about it can be checked.`,
                'Give the scenario both halves: a WHEN bullet and a THEN bullet.', cap));
        }

        const marker = i + 1 < j ? lines[i + 1].match(TOUCHES_RE) : null;
        if (marker && options.paths) {
            const globs = marker[1].split(',').map(g => g.trim()).filter(Boolean);
            const missing = globs.filter(
                g => !options.paths!.some(p => globMatches(g, p)));
            if (globs.length > 0 && missing.length === globs.length) {
                findings.push(finding(
                    'warning', 'unmatched-touches-glob', path, i + 2,
                    `This marker names ${missing.join(', ')}, which matches nothing on disk.`,
                    'Point the marker at the files this requirement describes, or remove it.', cap));
            }
        }
        i = j;
    }

    if (!fencesAreBalanced(text)) {
        // Reported at line 1, because everything below the unclosed fence is
        // invisible to this check too: the finding is about the file.
        findings.push(finding(
            'warning', 'unbalanced-fence', path, 1,
            'A code fence is opened and never closed, so everything after it is '
            + 'invisible to every reader of this spec.',
            'Close the fence, or remove it.', options.capability));
    }

    if (offset) for (const f of findings) f.line += offset;
    findings.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
    return findings;
}

interface DeltaBlock {
    verb: string;
    capability: string | null;
    markerLine: number;
    start: number;
    end: number;
    headings: { heading: string; line: number }[];
}

function deltaBlocks(text: string): DeltaBlock[] {
    const lines = text.split(/\r?\n/);
    const fenced = fenceFlags(lines);
    const blocks: DeltaBlock[] = [];
    let cur: DeltaBlock | null = null;
    for (let i = 0; i < lines.length; i++) {
        if (fenced[i]) continue;
        const hm = lines[i].match(DELTA_HEADER_RE);
        if (hm) {
            // Close the previous block. Leaving it open let one block's slice
            // run into the next, so a heading in ADDED and the same heading in
            // MODIFIED read as a duplicate inside one block.
            if (cur) cur.end = i;
            cur = {
                verb: hm[1].toUpperCase(), capability: null, markerLine: i + 1,
                start: i + 1, end: lines.length, headings: [],
            };
            blocks.push(cur);
            continue;
        }
        if (!cur) continue;
        if (SECTION_RE.test(lines[i])) {
            cur.end = i;
            cur = null;
            continue;
        }
        const cm = lines[i].match(CAP_MARKER_RE);
        if (cm) {
            cur.capability = cm[1].trim();
            cur.markerLine = i + 1;
            continue;
        }
        const rm = lines[i].match(REQ_RE);
        if (rm) cur.headings.push({ heading: rm[1], line: i + 1 });
    }
    return blocks;
}

/** Every `###` heading in a spec, fences ignored. */
function headingsIn(text: string): Set<string> {
    const lines = text.split(/\r?\n/);
    const fenced = fenceFlags(lines);
    const out = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        if (fenced[i]) continue;
        const m = lines[i].match(REQ_RE);
        if (m) out.add(m[1]);
    }
    return out;
}

export interface DeltaOptions {
    knownCapabilities: string[];
    /** Capability name to the current text of its living spec. */
    targetTexts: Record<string, string>;
    /**
     * Where an unmarked block belongs, exactly as the fold routes it. Leaving it
     * unresolved is how an unmarked delta escapes the check meant to catch it.
     */
    defaultCapability?: string;
}

/**
 * Every shape finding in one feature spec's delta sections, ordered by line.
 *
 * A capability with no entry in `targetTexts` is not checked for missing
 * headings — absent is not evidence.
 */
export function checkFeatureDeltas(
    text: string, path: string, options: DeltaOptions
): Finding[] {
    const known = new Set(options.knownCapabilities ?? []);
    const findings: Finding[] = [];
    for (const block of deltaBlocks(text)) {
        const cap = block.capability ?? options.defaultCapability ?? null;
        if (cap && !known.has(cap)) {
            findings.push(finding(
                'error', 'unknown-capability', path, block.markerLine,
                `This block is marked for "${cap}", which the living-specs registry does not list.`,
                'Correct the capability name, or register it in living-specs.yml.', cap));
            continue;
        }
        // The delta's own requirements are what becomes permanent, so they are
        // held to the same shape as anything already in a living spec.
        if (block.verb === 'ADDED' || block.verb === 'MODIFIED') {
            const body = text.split(/\r?\n/).slice(block.start, block.end).join('\n');
            for (const f of checkLivingSpec(body, path, {
                capability: cap ?? undefined, offset: block.start,
            })) {
                // Needs the whole tree; the standalone run reports it.
                if (f.code !== 'unmatched-touches-glob') findings.push(f);
            }
        }

        if (block.verb !== 'MODIFIED' && block.verb !== 'REMOVED') continue;
        const target = cap ? options.targetTexts[cap] : undefined;
        if (target === undefined) continue;
        const present = headingsIn(target);
        for (const { heading, line } of block.headings) {
            if (present.has(heading)) continue;
            // A warning, not an error: the fold promotes a MODIFIED with no
            // match into an addition and a REMOVED with no match removes
            // nothing. Neither damages the record, but a typo'd heading quietly
            // becomes a near-duplicate requirement, which is worth saying.
            findings.push(finding(
                'warning', 'delta-heading-not-found', path, line,
                `${block.verb} names "${heading}", which ${cap}'s spec does not have.`,
                'Use the heading exactly as it appears in the spec, or ADDED for a new one.',
                cap ?? undefined));
        }
    }
    findings.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
    return findings;
}
