#!/usr/bin/env node
/**
 * clip-storyboard.mjs: keep every feature clip's STORYBOARD.md and its index.html in sync.
 *
 *   node scripts/clip-storyboard.mjs [--check]        report drift across all compositions
 *   node scripts/clip-storyboard.mjs --apply <name>   write storyboard labels into index.html
 *
 * The storyboard's Beats table is the editing surface for beat labels. Timings and
 * rects stay code-owned: they are measured element boxes off the captured DOM and
 * hand-editing them in prose would break the camera, so --apply never writes them back.
 *
 * Everything is parsed with regex over the source text. Nothing is evaluated. A file
 * that does not match the expected shape is reported and skipped, never guessed at.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS_DIR = join(ROOT, 'media', 'feature-clips');

/* ------------------------------------------------------------------ parsing */

const BEATS_RE = /(var\s+BEATS\s*=\s*\[)([\s\S]*?)(\n[ \t]*\];)/;
const CUTS_RE = /(var\s+CUTS\s*=\s*\[)([\s\S]*?)(\n[ \t]*\];)/;
const OBJECT_RE = /\{[^{}]*\}/g;
const LABEL_FIELD_RE = /"label"\s*:\s*"(?:[^"\\]|\\.)*"/;
/*
  The optional <span class="eb"> is the eyebrow naming the region, and it is
  deliberately swallowed by group 1 rather than captured as text. Group 3 has to
  stay the caption alone: it is compared against BEATS.label, and its offsets
  are what --apply rewrites. Let the eyebrow into group 3 and --apply would
  overwrite it with a caption.
*/
const LBL_EL_RE =
  /(<div\s+class="lbl[^"]*"\s+id="lbl(\d+)"[^>]*>(?:<span class="eb">[^<]*<\/span>)?)([^<]*)(<\/div>)/g;

/** Pull one `var NAME = [ ... ];` array out of the source, with absolute offsets. */
function findArray(html, re) {
  const m = re.exec(html);
  if (!m) return null;
  return { bodyStart: m.index + m[1].length, body: m[2] };
}

/** Split an array body into its top-level object literals, with absolute offsets. */
function splitObjects(bodyStart, body) {
  const out = [];
  OBJECT_RE.lastIndex = 0;
  let m;
  while ((m = OBJECT_RE.exec(body)) !== null) {
    out.push({ text: m[0], start: bodyStart + m.index, end: bodyStart + m.index + m[0].length });
  }
  return out;
}

function parseIndexHtml(html) {
  const beatsArr = findArray(html, BEATS_RE);
  if (!beatsArr) return { shape: 'no-beats-array' };

  const cutsArr = findArray(html, CUTS_RE);
  if (!cutsArr) return { shape: 'no-cuts-array' };

  const beatObjects = splitObjects(beatsArr.bodyStart, beatsArr.body);
  if (beatObjects.length === 0) return { shape: 'empty-beats-array' };

  const beats = [];
  for (let i = 0; i < beatObjects.length; i++) {
    const obj = beatObjects[i];
    let parsed;
    try {
      parsed = JSON.parse(obj.text);
    } catch {
      return { shape: 'unparsable-beat', detail: `beat ${i + 1} is not a JSON object literal` };
    }
    if (typeof parsed.t !== 'number') {
      return { shape: 'unparsable-beat', detail: `beat ${i + 1} has no numeric "t"` };
    }
    if ('label' in parsed && typeof parsed.label !== 'string') {
      return { shape: 'unparsable-beat', detail: `beat ${i + 1} has a non-string "label"` };
    }
    beats.push({
      index: i,
      t: parsed.t,
      label: typeof parsed.label === 'string' ? parsed.label : null,
      objStart: obj.start,
      objText: obj.text,
    });
  }

  const cuts = splitObjects(cutsArr.bodyStart, cutsArr.body);

  // On-screen label text lives in the .lbl elements; BEATS.label only decides which
  // beat gets one. Both have to move together or --apply changes nothing on screen.
  const elements = [];
  LBL_EL_RE.lastIndex = 0;
  let em;
  while ((em = LBL_EL_RE.exec(html)) !== null) {
    elements.push({
      id: Number(em[2]),
      text: em[3],
      textStart: em.index + em[1].length,
      textEnd: em.index + em[1].length + em[3].length,
    });
  }
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].id !== i) {
      return { shape: 'non-contiguous-labels', detail: `label elements are not lbl0..lbl${elements.length - 1}` };
    }
  }

  const labelled = beats.filter((b) => b.label !== null);
  if (labelled.length !== elements.length) {
    return {
      shape: 'label-count-mismatch',
      detail: `${labelled.length} labelled beats but ${elements.length} label elements`,
    };
  }

  return { shape: 'ok', beats, cutCount: cuts.length, elements };
}

/** Pull the Beats table out of a storyboard. Returns rows of { t, label }. */
function parseStoryboard(md) {
  const heading = /^##[ \t]+Beats\b.*$/m.exec(md);
  if (!heading) return { shape: 'no-beats-heading' };

  const after = md.slice(heading.index + heading[0].length);
  const nextHeading = /^##[ \t]/m.exec(after);
  const section = nextHeading ? after.slice(0, nextHeading.index) : after;

  const lines = section.split('\n').map((l) => l.trim());
  const first = lines.findIndex((l) => l.startsWith('|'));
  if (first === -1) return { shape: 'no-table' };
  let last = first;
  while (last + 1 < lines.length && lines[last + 1].startsWith('|')) last++;
  const table = lines.slice(first, last + 1);
  if (table.length < 3) return { shape: 'table-too-short' };

  const cells = (row) =>
    row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  const header = cells(table[0]).map((c) => c.toLowerCase());
  const tCol = header.indexOf('t');
  const labelCol = header.indexOf('label');
  if (tCol === -1 || labelCol === -1) {
    return { shape: 'unexpected-columns', detail: `header is | ${header.join(' | ')} |` };
  }

  const rows = [];
  for (let i = 2; i < table.length; i++) {
    const c = cells(table[i]);
    if (c.length <= Math.max(tCol, labelCol)) {
      return { shape: 'short-row', detail: `row ${i - 1} has ${c.length} cells` };
    }
    const raw = c[tCol];
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
      return { shape: 'unparsable-t', detail: `row ${i - 1} has t "${raw}"` };
    }
    const label = c[labelCol];
    rows.push({ t: Number(raw), label: label === '—' || label === '-' || label === '' ? null : label });
  }
  if (rows.length === 0) return { shape: 'no-rows' };
  return { shape: 'ok', rows };
}

/* ----------------------------------------------------------------- checking */

const SHAPE_TEXT = {
  'no-beats-array': 'no BEATS array, hand-authored timeline, nothing to compare',
  'no-cuts-array': 'a BEATS array but no CUTS array',
  'empty-beats-array': 'BEATS array is empty',
  'unparsable-beat': 'a beat is not in the expected {"t":…,"label":…} shape',
  'non-contiguous-labels': 'label elements are not numbered from lbl0',
  'label-count-mismatch': 'labelled beats and label elements do not line up',
  'no-beats-heading': 'no "## Beats" heading',
  'no-table': 'the Beats section has no table',
  'table-too-short': 'the Beats table has no rows',
  'unexpected-columns': 'the Beats table has no "t" and "Label" columns',
  'short-row': 'a Beats table row is missing cells',
  'unparsable-t': 'a Beats table t value is not a number',
  'no-rows': 'the Beats table has no rows',
};

function describeShape(res) {
  const base = SHAPE_TEXT[res.shape] || res.shape;
  return res.detail ? `${base} (${res.detail})` : base;
}

const fmt = (n) => String(n);

function inspect(name) {
  const dir = join(CLIPS_DIR, name);
  const indexPath = join(dir, 'index.html');
  const storyboardPath = join(dir, 'STORYBOARD.md');

  if (!existsSync(indexPath)) {
    return { name, status: 'fail', problems: ['no index.html'] };
  }

  const idx = parseIndexHtml(readFileSync(indexPath, 'utf8'));
  if (idx.shape === 'no-beats-array') {
    return { name, status: 'skip', note: describeShape(idx) };
  }
  if (idx.shape !== 'ok') {
    return { name, status: 'skip', note: `index.html: ${describeShape(idx)}` };
  }

  if (!existsSync(storyboardPath)) {
    return {
      name,
      status: 'fail',
      problems: [`no STORYBOARD.md, and index.html has ${idx.beats.length} beats and nothing mirrors them`],
    };
  }

  const sb = parseStoryboard(readFileSync(storyboardPath, 'utf8'));
  if (sb.shape !== 'ok') {
    return { name, status: 'fail', problems: [`STORYBOARD.md: ${describeShape(sb)}`] };
  }

  const problems = [];

  if (sb.rows.length !== idx.beats.length) {
    problems.push(
      `beat count: index.html has ${idx.beats.length}, STORYBOARD.md has ${sb.rows.length}`,
    );
  }

  const pairs = Math.min(sb.rows.length, idx.beats.length);
  for (let i = 0; i < pairs; i++) {
    const beat = idx.beats[i];
    const row = sb.rows[i];
    if (Math.abs(beat.t - row.t) > 1e-9) {
      problems.push(`beat ${i + 1}: t is ${fmt(beat.t)} in index.html, ${fmt(row.t)} in STORYBOARD.md`);
    }
    if (beat.label === null && row.label !== null) {
      problems.push(`beat ${i + 1}: index.html has no label, STORYBOARD.md has "${row.label}"`);
    } else if (beat.label !== null && row.label === null) {
      problems.push(`beat ${i + 1}: index.html has "${beat.label}", STORYBOARD.md has no label`);
    } else if (beat.label !== null && beat.label !== row.label) {
      problems.push(`beat ${i + 1}: "${beat.label}" in index.html, "${row.label}" in STORYBOARD.md`);
    }
  }

  // index.html has to agree with itself too: BEATS.label and the .lbl element it drives.
  const labelled = idx.beats.filter((b) => b.label !== null);
  for (let i = 0; i < labelled.length; i++) {
    const onScreen = decodeEntities(idx.elements[i].text);
    if (labelled[i].label !== onScreen) {
      problems.push(
        `beat ${labelled[i].index + 1}: BEATS says "${labelled[i].label}", lbl${i} on screen reads "${onScreen}"`,
      );
    }
  }

  if (problems.length > 0) return { name, status: 'fail', problems };
  return {
    name,
    status: 'ok',
    note: `${idx.beats.length} beats, ${idx.cutCount} cuts, ${labelled.length} labels in sync`,
  };
}

/* ------------------------------------------------------------------ applying */

function encodeEntities(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function apply(name) {
  const dir = join(CLIPS_DIR, name);
  const indexPath = join(dir, 'index.html');
  const storyboardPath = join(dir, 'STORYBOARD.md');

  if (!existsSync(indexPath)) return fail(`${name}: no index.html at ${indexPath}`);
  if (!existsSync(storyboardPath)) return fail(`${name}: no STORYBOARD.md, nothing to apply from`);

  const html = readFileSync(indexPath, 'utf8');
  const idx = parseIndexHtml(html);
  if (idx.shape !== 'ok') return fail(`${name}: ${describeShape(idx)}, refusing to guess`);

  const sb = parseStoryboard(readFileSync(storyboardPath, 'utf8'));
  if (sb.shape !== 'ok') return fail(`${name}: STORYBOARD.md ${describeShape(sb)}, refusing to guess`);

  if (sb.rows.length !== idx.beats.length) {
    return fail(
      `${name}: ${idx.beats.length} beats in index.html but ${sb.rows.length} rows in STORYBOARD.md. ` +
        'Beat counts must match before labels can be written back.',
    );
  }

  // Labels only move onto beats that already carry one. A storyboard cannot add or
  // remove a beat's label, because that changes which .lbl element each beat drives.
  for (let i = 0; i < idx.beats.length; i++) {
    const beat = idx.beats[i];
    const row = sb.rows[i];
    if (beat.label === null && row.label !== null) {
      return fail(
        `${name}: beat ${i + 1} has no label in index.html but "${row.label}" in STORYBOARD.md. ` +
          'Adding a label is a code change, not a document edit.',
      );
    }
    if (beat.label !== null && row.label === null) {
      return fail(
        `${name}: beat ${i + 1} has a label in index.html but none in STORYBOARD.md. ` +
          'Removing a label is a code change, not a document edit.',
      );
    }
  }

  const labelled = idx.beats.filter((b) => b.label !== null);
  const edits = [];
  const changed = [];

  for (let i = 0; i < labelled.length; i++) {
    const beat = labelled[i];
    const next = sb.rows[beat.index].label;
    if (next === beat.label) continue;

    const rel = LABEL_FIELD_RE.exec(beat.objText);
    if (!rel) return fail(`${name}: beat ${beat.index + 1} has no "label" field to write into`);
    edits.push({
      start: beat.objStart + rel.index,
      end: beat.objStart + rel.index + rel[0].length,
      text: `"label":${JSON.stringify(next)}`,
    });

    const el = idx.elements[i];
    edits.push({ start: el.textStart, end: el.textEnd, text: encodeEntities(next) });

    changed.push(`beat ${beat.index + 1}: "${beat.label}" -> "${next}"`);
  }

  if (edits.length === 0) {
    console.log(`${name}: labels already match STORYBOARD.md, nothing written.`);
    return 0;
  }

  edits.sort((a, b) => b.start - a.start);
  let out = html;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  writeFileSync(indexPath, out, 'utf8');

  console.log(`${name}: wrote ${changed.length} label${changed.length === 1 ? '' : 's'} into index.html`);
  for (const line of changed) console.log(`  ${line}`);
  console.log('  Re-render the clip to see the new text on screen.');
  return 0;
}

/* ---------------------------------------------------------------------- cli */

function fail(message) {
  console.error(message);
  return 1;
}

// An underscore prefix marks a directory that is scaffolding rather than a
// clip: _template is copied by scripts/new-clip.mjs and is never rendered,
// encoded, or registered in the manifest.
function compositions() {
  return readdirSync(CLIPS_DIR)
    .filter((n) => !n.startsWith('.') && !n.startsWith('_'))
    .filter((n) => statSync(join(CLIPS_DIR, n)).isDirectory())
    .sort();
}

function check() {
  const results = compositions().map(inspect);
  const failures = results.filter((r) => r.status === 'fail');

  console.log('Clip storyboards vs compositions, in media/feature-clips\n');
  for (const r of results) {
    if (r.status === 'ok') {
      console.log(`  ok    ${r.name.padEnd(16)} ${r.note}`);
    } else if (r.status === 'skip') {
      console.log(`  skip  ${r.name.padEnd(16)} ${r.note}`);
    } else {
      console.log(`  DRIFT ${r.name.padEnd(16)} ${r.problems.length} problem${r.problems.length === 1 ? '' : 's'}`);
      for (const p of r.problems) console.log(`        - ${p}`);
    }
  }

  reportTimingDrift();

  const ok = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  console.log(`\n${ok} in sync, ${skipped} skipped, ${failures.length} drifting.`);
  if (failures.length > 0) {
    console.log('Edit the STORYBOARD.md and run --apply to move a label, or fix the timing in index.html.');
  }
  return failures.length > 0 ? 1 : 0;
}

/*
  Every composition carries its own copy of the animation constants, and that is
  deliberate: a clip references nothing outside its own directory, which is what
  lets it render deterministically offline. A shared timing module would buy one
  source of truth at the cost of that guarantee, which is the wrong trade.

  The cost of the copies is that one can drift without anyone choosing it. So
  report the odd one out instead of centralising: if twelve clips fade a label in
  over 0.34s and one does it in 0.30s, nobody decided that, and it shows up here.
*/
const TIMING_CONSTANTS = ['LBL_IN', 'LBL_OUT', 'MOVE_DUR', 'MARKER_PAD'];

function reportTimingDrift() {
  const values = new Map(TIMING_CONSTANTS.map((k) => [k, new Map()]));

  for (const name of compositions()) {
    const file = join(CLIPS_DIR, name, 'index.html');
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    for (const key of TIMING_CONSTANTS) {
      const m = html.match(new RegExp(`var\\s+${key}\\s*=\\s*([0-9.]+)`));
      if (!m) continue;
      const byValue = values.get(key);
      if (!byValue.has(m[1])) byValue.set(m[1], []);
      byValue.get(m[1]).push(name);
    }
  }

  const odd = [];
  for (const [key, byValue] of values) {
    if (byValue.size < 2) continue;
    // The value most compositions agree on is the house setting; the rest drifted.
    const sorted = [...byValue.entries()].sort((a, b) => b[1].length - a[1].length);
    const [houseValue, houseClips] = sorted[0];
    for (const [value, clips] of sorted.slice(1)) {
      if (clips.length >= houseClips.length) continue; // a genuine split, not drift
      odd.push(`${key} is ${value} in ${clips.join(', ')} — ${houseValue} in the other ${houseClips.length}`);
    }
  }

  if (odd.length === 0) return;
  console.log('\nTiming constants that differ from the rest:');
  for (const line of odd) console.log(`        - ${line}`);
}

/**
 * A clip read as a shot list, for reviewing the cut without opening the file or
 * scrubbing the video.
 *
 * Every line is one beat: when it lands, how long it holds before the next one,
 * and what the label on screen says. A rest beat is the return to the opening
 * pose, which is what closes the loop. Cuts are counted per beat so a state
 * change is visible where it happens rather than buried in a separate array.
 *
 * The point is to make pacing arguable. A four second hold on a dense panel and
 * a four second hold on a one line label are different mistakes, and neither is
 * obvious from the source.
 */
function outline(only) {
  const names = only ? [only] : compositions();
  for (const name of names) {
    const dir = join(CLIPS_DIR, name);
    if (!existsSync(join(dir, 'index.html'))) continue;
    const idx = parseIndexHtml(readFileSync(join(dir, 'index.html'), 'utf8'));

    if (idx.shape !== 'ok') {
      console.log(`\n${name}\n  ${describeShape(idx)}`);
      continue;
    }

    const beats = idx.beats;
    const last = beats[beats.length - 1];
    const total = last ? last.t : 0;

    console.log(`\n${name}  ${beats.length} beats, ${idx.cutCount} state cuts, about ${total.toFixed(0)}s`);
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      const next = beats[i + 1];
      const hold = next ? next.t - b.t : null;
      const when = `${b.t.toFixed(1)}s`.padStart(6);
      const held = hold === null ? '  to end' : `${hold.toFixed(1)}s hold`.padStart(9);
      const what = b.label ?? '(rest: back to the opening pose)';
      console.log(`  ${when} ${held}   ${what}`);
    }

    /*
      A clip whose every beat holds for the same length reads as a metronome.
      Nothing is emphasised, because nothing gets more time than anything else,
      and by the third beat a viewer is predicting the cut instead of reading
      the screen. It is invisible in the source — the numbers look deliberate,
      one per beat — and it only shows up when you watch.
      So say it here, where the holds are already in front of you.

      Not a failure. Even pacing is a legitimate choice for a short loop; it is
      the wrong one for anything carrying narration or an argument.
    */
    const holds = beats.slice(0, -1).map((b, i) => beats[i + 1].t - b.t);
    if (holds.length >= 4) {
      const mean = holds.reduce((a, h) => a + h, 0) / holds.length;
      const spread = Math.max(...holds) - Math.min(...holds);
      if (mean > 0 && spread / mean < 0.08) {
        console.log(
          `\n  note: every beat holds ${mean.toFixed(1)}s (spread ${spread.toFixed(2)}s).` +
            `\n        Even pacing reads as a metronome once there is narration or an` +
            `\n        argument to follow. Give the dense panels longer than the short ones.`,
        );
      }
    }
  }
  return 0;
}

/* ------------------------------------------------------------------ scenes */

const SHOT_EL_RE = /id="sh(\d+)"[^>]*src="[^"]*\/([^"/]+)"/g;
const CUT_RE = /\{\s*"t"\s*:\s*(-?[\d.]+)\s*,\s*"from"\s*:\s*(\d+)\s*,\s*"to"\s*:\s*(\d+)/g;

/** The shot files a composition mounts, in sh order. */
function readShots(html) {
  const shots = [];
  SHOT_EL_RE.lastIndex = 0;
  let m;
  while ((m = SHOT_EL_RE.exec(html)) !== null) shots[Number(m[1])] = m[2];
  return shots;
}

/** Cuts as {t, to}, so a beat's active shot is the last cut at or before it. */
function readCuts(html) {
  const arr = findArray(html, CUTS_RE);
  if (!arr) return [];
  const cuts = [];
  CUT_RE.lastIndex = 0;
  let m;
  while ((m = CUT_RE.exec(arr.body)) !== null) cuts.push({ t: Number(m[1]), to: Number(m[3]) });
  return cuts.sort((a, b) => a.t - b.t);
}

/** The two prose tables a storyboard carries, keyed for lookup. */
function readStoryboardProse(md) {
  const cells = (row) => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const rowsUnder = (headingRe) => {
    const h = headingRe.exec(md);
    if (!h) return [];
    const after = md.slice(h.index);
    const lines = after.split('\n').map((l) => l.trim());
    const first = lines.findIndex((l) => l.startsWith('|'));
    if (first === -1) return [];
    let last = first;
    while (last + 1 < lines.length && lines[last + 1].startsWith('|')) last++;
    return lines.slice(first, last + 1).map(cells);
  };

  const shotRows = rowsUnder(/^\|\s*Shot\s*\|/m).slice(2);
  const scenes = {};
  for (const r of shotRows) {
    if (r.length >= 3) scenes[r[1].replace(/`/g, '')] = r[2];
  }

  const beatRows = rowsUnder(/^\|\s*t\s*\|\s*Region\s*\|/m).slice(2);
  const regions = [];
  for (const r of beatRows) {
    if (r.length >= 3) regions.push({ t: Number(r[0]), region: r[1] });
  }
  return { scenes, regions };
}

/**
 * Turn a storyboard's one-paragraph scene description into a short name plus a
 * list of what is on screen.
 *
 * These descriptions are written as prose, and a rich screen produces a sixty
 * word sentence that is unreadable as a single bullet. The first sentence is
 * almost always the scene's name; everything after it is an inventory, usually
 * comma separated, sometimes introduced by a colon. Split on those boundaries,
 * but never inside brackets, because timings and counts live in parentheses and
 * cutting one in half is worse than a long line.
 */
function splitSceneDescription(description, fallbackFile) {
  if (!description) return { name: fallbackFile, shows: [] };

  const sentences = description
    .split(/(?<=\.)\s+(?=[A-Z"'`])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const name = (sentences.shift() ?? description).replace(/\.$/, '');
  const rest = sentences.join(' ');
  if (!rest) return { name, shows: [] };

  // Split on top-level separators only: depth counts brackets and quotes so a
  // parenthesised list stays whole.
  const parts = [];
  let buf = '';
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === '"' || ch === '`') inQuote = !inQuote;
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;

    const atTop = depth === 0 && !inQuote;
    const isComma = ch === ',' && atTop;
    const isColon = ch === ':' && atTop;
    const isStop = ch === '.' && atTop && i < rest.length - 1;

    if (isComma || isColon || isStop) {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());

  // Rejoin anything too short to stand alone, so the list does not fragment into
  // half clauses like "and one registered capability whose spec", and so an enumeration such as
  // "the rail with Specification, Plan and Tasks" stays one line.
  const shows = [];
  for (const part of parts) {
    const cleaned = part.replace(/^and\s+/i, '').replace(/\.$/, '').trim();
    if (!cleaned) continue;
    if (cleaned.length < 30 && shows.length > 0) {
      shows[shows.length - 1] += `, ${cleaned}`;
    } else {
      shows.push(cleaned);
    }
  }
  return { name, shows };
}

/**
 * Every clip as a nested list: one bullet per SCENE, meaning the screen that is
 * on camera, with one child bullet per action taken while it is up.
 *
 * A scene changes when the composition cuts to a different capture, so the
 * grouping is the cut list rather than a judgement call. Seconds are left out on
 * purpose: this document exists to argue about what a clip SHOWS and in what
 * order, and timings only get in the way of that. The outline mode carries the
 * pacing when pacing is the question.
 */
function scenes(only) {
  const names = (only ? [only] : compositions()).filter((n) =>
    existsSync(join(CLIPS_DIR, n, 'index.html')),
  );

  const out = [];
  for (const name of names) {
    const dir = join(CLIPS_DIR, name);
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    const idx = parseIndexHtml(html);

    out.push(`## ${name}\n`);

    if (idx.shape !== 'ok') {
      out.push(`Hand-authored timeline, so it has no beat list to read. ${describeShape(idx)}\n`);
      continue;
    }

    const sbPath = join(dir, 'STORYBOARD.md');
    const prose = existsSync(sbPath)
      ? readStoryboardProse(readFileSync(sbPath, 'utf8'))
      : { scenes: {}, regions: [] };

    const shots = readShots(html);
    const cuts = readCuts(html);
    const regionAt = (t) => {
      const hit = prose.regions.find((r) => Math.abs(r.t - t) < 0.05);
      return hit ? hit.region : null;
    };

    let current = -1;
    let sceneNo = 0;
    let stepNo = 0;

    for (const beat of idx.beats) {
      let shot = 0;
      for (const c of cuts) if (c.t <= beat.t) shot = c.to;

      if (shot !== current) {
        current = shot;
        sceneNo++;
        stepNo = 0;
        const file = shots[shot] ?? `shot ${shot}`;
        const { name, shows } = splitSceneDescription(prose.scenes[file], file);
        out.push(`- **Scene ${sceneNo} · ${name}**`);
        for (const line of shows) out.push(`  - On screen: ${line}`);
      }

      if (beat.label === null) {
        out.push(`  - Settle back to the opening pose, so the loop closes`);
        continue;
      }
      stepNo++;
      const region = regionAt(beat.t);
      out.push(`  - Step ${stepNo}: highlight ${region ?? 'a region'}`);
      out.push(`    - "${beat.label}"`);
    }
    out.push('');
  }
  console.log(out.join('\n'));
  return 0;
}

function main(argv) {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/clip-storyboard.mjs [--check] | --apply <composition> | --outline [composition] | --scenes [composition]');
    return 0;
  }

  const scenesAt = args.indexOf('--scenes');
  if (scenesAt !== -1) {
    const raw = args[scenesAt + 1];
    if (raw && !raw.startsWith('-')) {
      const name = basename(raw.replace(/\/+$/, ''));
      if (!existsSync(join(CLIPS_DIR, name))) {
        return fail(`No composition named "${name}". Known: ${compositions().join(', ')}`);
      }
      return scenes(name);
    }
    return scenes(null);
  }

  const outlineAt = args.indexOf('--outline');
  if (outlineAt !== -1) {
    const raw = args[outlineAt + 1];
    if (raw && !raw.startsWith('-')) {
      const name = basename(raw.replace(/\/+$/, ''));
      if (!existsSync(join(CLIPS_DIR, name))) {
        return fail(`No composition named "${name}". Known: ${compositions().join(', ')}`);
      }
      return outline(name);
    }
    return outline(null);
  }

  const applyAt = args.indexOf('--apply');
  if (applyAt !== -1) {
    const raw = args[applyAt + 1];
    if (!raw) return fail('--apply needs a composition name, for example: --apply step-rail');
    const name = basename(raw.replace(/\/+$/, ''));
    if (!existsSync(join(CLIPS_DIR, name))) {
      return fail(`No composition named "${name}" under media/feature-clips. Known: ${compositions().join(', ')}`);
    }
    return apply(name);
  }

  const unknown = args.filter((a) => a !== '--check');
  if (unknown.length > 0) return fail(`Unknown argument: ${unknown[0]}`);
  return check();
}

process.exit(main(process.argv));
