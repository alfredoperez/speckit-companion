#!/usr/bin/env node
// refresh-upstreams.mjs — what moved in spec-kit since the version we support. Copied from kaiju.
//
// Reads the nearest upstreams.yml (or --ledger <path>), probes each upstream's
// current HEAD/version, diffs it against the pinned ref, and reports what moved
// inside the paths you actually took. It never adopts anything on its own:
// --apply only restamps last_checked, and --adopt moves one pin forward after
// you have decided to.
//
//   node scripts/refresh-upstreams.mjs                  report every entry
//   node scripts/refresh-upstreams.mjs --only wayfinder  filter by id OR skill name
//   node scripts/refresh-upstreams.mjs --json            machine-readable
//   node scripts/refresh-upstreams.mjs --apply           restamp last_checked
//   node scripts/refresh-upstreams.mjs --adopt <id>      move the pin to HEAD
//   … --ledger ~/dev/GitHub/factory/upstreams.yml        another repo's ledger
//
// Zero dependencies. The YAML reader below understands exactly the shape
// upstreams.yml uses (see its header comment) and nothing more — if you add a
// construct it does not handle, it will tell you which line it choked on.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const value = (n) => {
  const i = argv.indexOf(n);
  return i === -1 ? null : argv[i + 1] ?? null;
};
const OPT = {
  add: value("--add"),
  role: value("--role"),
  skill: value("--skill"),
  only: value("--only"),
  json: flag("--json"),
  apply: flag("--apply"),
  adopt: value("--adopt"),
  ledger: value("--ledger"),
  help: flag("--help") || flag("-h"),
};

// One script serves every repo with a ledger: --ledger wins, then the nearest
// upstreams.yml above this script (kaiju's own layout), then the cwd's.
function findLedger() {
  if (OPT.ledger) return resolve(OPT.ledger);
  for (let d = dirname(SCRIPT); ; d = dirname(d)) {
    if (existsSync(resolve(d, "upstreams.yml"))) return resolve(d, "upstreams.yml");
    if (dirname(d) === d) break;
  }
  return resolve("upstreams.yml");
}
const LEDGER = findLedger();
const CMD = `node ${relative(process.cwd(), SCRIPT) || SCRIPT}${OPT.ledger ? ` --ledger ${OPT.ledger}` : ""}`;

// Watched rows get diffed. learn-from (an app we read for ideas worth a ticket)
// and supports (a tool our product has to keep up with) are other repos' roles.
const WATCHED = new Set(["ported-from", "documents-tool", "wraps-api", "installed-as-is", "learn-from", "supports"]);

if (OPT.help) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 20).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}

// ── adding a source ──────────────────────────────────────────────────────────
// One command, because a ledger you have to hand-edit YAML for is a ledger that
// stops getting entries. Role defaults to inspired-by: most sources you meet are
// ideas, and an idea is a citation rather than something to watch.
function addSource() {
  const url = OPT.add.replace(/\/+$/, "");
  const role = OPT.role || "inspired-by";
  const skill = OPT.skill || "TODO";
  const m = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
  const id = (m ? `${m[1]}-${m[2]}` : url.replace(/^https?:\/\//, "").split("/")[0])
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const watched = WATCHED.has(role);
  const today = new Date().toISOString().slice(0, 10);
  let ref = "null";
  if (m && watched) {
    try {
      ref = execFileSync("git", ["ls-remote", url, "HEAD"], { encoding: "utf8" }).trim().split(/\s+/)[0];
    } catch { /* leave null; the user fills it */ }
  }
  const row = [
    `  - id: ${id}`,
    `    name: ${m ? `${m[1]}/${m[2]}` : url}`,
    `    skills: [${skill}]`,
    `    role: ${role}`,
    `    kind: ${m ? "repo" : "api"}`,
    `    url: ${url}`,
    ...(m ? [`    repo: ${m[1]}/${m[2]}`] : []),
    ...(watched ? [`    paths:`, `      - TODO  # scope the diff to what you actually took`] : []),
    `    ref: ${ref}`,
    `    ref_date: ${watched ? today : "null"}`,
    `    last_checked: ${today}`,
    `    license: TODO`,
    `    what: >-`,
    `      TODO — what you took, in plain language.`,
    `    notes: >-`,
    `      TODO — anything you deliberately did differently, so a later refresh does`,
    `      not read your fork as drift.`,
    ``,
  ].join("\n");
  const text = readFileSync(LEDGER, "utf8");
  writeFileSync(LEDGER, text.replace(/\nupstreams:\n/, `\nupstreams:\n${row}`));
  console.log(`Added ${id} as ${role}.`);
  console.log(watched
    ? `  Pinned at ${String(ref).slice(0, 7)} (today).\n  If you took it EARLIER, backfill ref and ref_date — a pin at HEAD reports "no drift" forever.`
    : `  Not watched: ${role} is a citation. There is nothing to diff, and that is the point.`);
  console.log(`  Now fill the TODOs in upstreams.yml.`);
}

if (OPT.add) { addSource(); process.exit(0); }

// ── the small YAML reader ────────────────────────────────────────────────────
// Handles: `key: scalar`, `key: [a, b]`, `key:` + `  - item` blocks,
// `key: >-` folded blocks, `#` comments, and a top-level `upstreams:` sequence
// of mappings. Records each entry's line span so edits can be surgical.
function parseLedger(text) {
  const lines = text.split("\n");
  const entries = [];
  let cur = null;
  let i = 0;

  const bare = (v) => {
    const s = v.trim();
    if (s === "null" || s === "~" || s === "") return null;
    if (/^\[.*\]$/.test(s)) {
      const inner = s.slice(1, -1).trim();
      return inner ? inner.split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")) : [];
    }
    return s.replace(/^["']|["']$/g, "");
  };

  // skip to the sequence
  while (i < lines.length && !/^upstreams:\s*$/.test(lines[i])) i++;
  if (i === lines.length) fail("no `upstreams:` key found");
  i++;

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;

    const start = line.match(/^ {2}- (\w[\w-]*): (.*)$/);
    if (start) {
      cur = { __line: {}, __start: i, __end: i };
      entries.push(cur);
      cur[start[1]] = bare(start[2]);
      cur.__line[start[1]] = i;
      continue;
    }

    const kv = line.match(/^ {4}(\w[\w-]*):(.*)$/);
    if (kv && cur) {
      const [, key, restRaw] = kv;
      const rest = restRaw.trim();
      cur.__line[key] = i;
      cur.__end = i;

      if (rest === ">-" || rest === ">" || rest === "|" || rest === "|-") {
        const buf = [];
        while (i + 1 < lines.length && /^ {6}\S/.test(lines[i + 1])) {
          buf.push(lines[++i].trim());
          cur.__end = i;
        }
        cur[key] = buf.join(" ");
      } else if (rest === "") {
        const buf = [];
        while (i + 1 < lines.length && /^ {6}- /.test(lines[i + 1])) {
          buf.push(lines[++i].replace(/^ {6}- /, "").trim());
          cur.__end = i;
        }
        cur[key] = buf;
      } else {
        cur[key] = bare(rest);
      }
      continue;
    }

    if (/^\S/.test(line)) break; // left the sequence
    if (line.trim() && !kv && !start && cur === null) fail(`cannot parse line ${i + 1}: ${line}`);
  }

  return { lines, entries };
}

function fail(msg) {
  console.error(`refresh-upstreams: ${msg}`);
  process.exit(1);
}

// ── probes ───────────────────────────────────────────────────────────────────
function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function probeRepo(e) {
  const head = sh("git", ["ls-remote", e.url, "HEAD"]).split(/\s+/)[0];
  if (!head) throw new Error("git ls-remote returned nothing");
  if (!e.ref) return { current: head, state: "unpinned" };
  if (head === e.ref) return { current: head, state: "current" };

  // What moved, scoped to the paths we took.
  let ahead = null;
  let files = [];
  let truncated = false;
  let commits = [];
  if (e.repo) {
    const raw = sh("gh", ["api", `repos/${e.repo}/compare/${e.ref}...${head}`, "--jq",
      '{ahead: .ahead_by, files: [.files[]?.filename], truncated: (.files|length) >= 300, ' +
      'commits: [.commits[]? | {sha: .sha[0:7], date: .commit.committer.date[0:10], subject: (.commit.message | split("\\n")[0])}]}']);
    const cmp = JSON.parse(raw);
    ahead = cmp.ahead;
    commits = cmp.commits ?? [];
    truncated = cmp.truncated;
    files = cmp.files ?? [];
  }
  const scoped = e.paths?.length
    ? files.filter((f) => e.paths.some((p) => f === p || f.startsWith(p.replace(/\/$/, "") + "/")))
    : files;
  // Newest first; "since last check" is what a re-read actually has to cover.
  commits.reverse();
  const sinceChecked = e.last_checked ? commits.filter((c) => c.date >= e.last_checked).length : null;
  return { current: head, state: "behind", ahead, files: scoped, allFiles: files.length, truncated, commits, sinceChecked };
}

function probeNpm(e) {
  const pkg = e.package || e.name.replace(/\s*\(npm\)$/, "");
  const current = sh("npm", ["view", pkg, "version"]);
  return { current, state: !e.ref ? "unpinned" : current === e.ref ? "current" : "behind" };
}

function probeCli(e) {
  const current = sh(e.command || e.package, [e.version_arg || "--version"]).split("\n")[0];
  return { current, state: !e.ref ? "unpinned" : current.includes(e.ref) ? "current" : "behind" };
}

function probe(e) {
  // An idea cannot drift. `inspired-by` and `reference-work` rows are citations,
  // not watches — probing them adds a line to every report that never needs a
  // decision, and a report you skim is a report that has stopped working.
  if (e.role === "queries-tool") return { current: null, state: "live" };
  if (!WATCHED.has(e.role)) return { current: null, state: "citation" };
  try {
    switch (e.kind) {
      case "repo": return probeRepo(e);
      case "npm": return probeNpm(e);
      case "cli": return probeCli(e);
      default: return { current: null, state: "manual" };
    }
  } catch (err) {
    return { current: null, state: "error", error: String(err.message || err).split("\n")[0] };
  }
}

// ── report ───────────────────────────────────────────────────────────────────
const { lines, entries } = parseLedger(readFileSync(LEDGER, "utf8"));

const selected = entries.filter((e) => {
  if (!OPT.only) return true;
  const q = OPT.only.toLowerCase();
  return e.id?.toLowerCase() === q || (e.skills || []).some((s) => s.toLowerCase() === q);
});
if (!selected.length) fail(`--only ${OPT.only} matched no entry`);

const results = selected.map((e) => ({ entry: e, ...probe(e) }));

if (OPT.json) {
  console.log(JSON.stringify(results.map(({ entry, ...r }) => ({
    id: entry.id, skills: entry.skills, role: entry.role, kind: entry.kind,
    pinned: entry.ref, ref_date: entry.ref_date, last_checked: entry.last_checked, ...r,
  })), null, 2));
} else {
  const SYM = { current: "✓", behind: "→", manual: "·", unpinned: "?", error: "✗", citation: "·", live: "·" };
  for (const r of results) {
    const e = r.entry;
    console.log(`\n${SYM[r.state]} ${e.id}${e.skills?.length ? `  (${e.skills.join(", ")})` : ""}`);
    console.log(`  ${e.role} · ${e.kind} · ${e.url}`);
    if (r.state === "current") {
      console.log(`  current at ${short(e.ref)} (${e.ref_date}) — nothing to adopt.`);
    } else if (r.state === "behind") {
      const aheadTxt = r.ahead == null ? "" : `, upstream is ${r.ahead} commit${r.ahead === 1 ? "" : "s"} ahead`;
      console.log(`  pinned at ${short(e.ref)} (${e.ref_date})${aheadTxt}; HEAD is ${short(r.current)}`);
      if (r.sinceChecked != null) console.log(`  ${r.sinceChecked} on or after last checked (${e.last_checked})`);
      if (r.files) {
        if (r.files.length) {
          console.log(`  changed files in the paths you watch (${r.files.length}):`);
          for (const f of r.files.slice(0, 20)) console.log(`    ${f}`);
          if (r.files.length > 20) console.log(`    … ${r.files.length - 20} more`);
        } else if (e.paths?.length) {
          console.log(`  nothing changed under your paths (${r.allFiles} files changed elsewhere) — safe to skip.`);
        }
        if (r.truncated) console.log(`  NOTE: GitHub truncated the file list; treat "nothing changed" as unproven.`);
      }
      console.log(`  adopt with: ${CMD} --adopt ${e.id}`);
    } else if (r.state === "citation") {
      console.log(`  ${e.role} — a citation, not a watch. Never checked by design.`);
    } else if (r.state === "live") {
      console.log(`  queries-tool — the skill reads the installed artifact at runtime, so it`);
      console.log(`  cannot go stale. Nothing to diff. Verify by running the tool, not by diffing a repo.`);
    } else if (r.state === "manual") {
      console.log(`  ${e.kind} has no version surface — nothing to check.`);
    } else if (r.state === "unpinned") {
      console.log(`  no pin recorded; HEAD is ${short(r.current)}. Set ref: in upstreams.yml.`);
    } else {
      console.log(`  could not probe: ${r.error}`);
    }
    if (e.notes) console.log(`  note: ${wrap(e.notes, 4)}`);
  }

  const behind = results.filter((r) => r.state === "behind");
  const moved = behind.filter((r) => !r.files || r.files.length);
  console.log(`\n${results.length} checked · ${behind.length} behind · ${moved.length} with changes in ported paths`);
  if (results.some((r) => r.state === "error")) console.log("Some probes failed — see ✗ rows above.");
}

// ── writes ───────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);

function setField(entry, key, val) {
  const ln = entry.__line[key];
  if (ln == null) fail(`entry ${entry.id} has no \`${key}:\` line to update`);
  lines[ln] = lines[ln].replace(/^(\s*[\w-]+:).*$/, `$1 ${val}`);
}

if (OPT.adopt) {
  const e = entries.find((x) => x.id === OPT.adopt);
  if (!e) fail(`--adopt ${OPT.adopt} matched no entry`);
  const r = results.find((x) => x.entry === e) ?? { ...probe(e), entry: e };
  if (!r.current) fail(`cannot adopt ${e.id}: nothing to pin to (${r.state})`);
  setField(e, "ref", r.current);
  setField(e, "ref_date", today);
  setField(e, "last_checked", today);
  writeFileSync(LEDGER, lines.join("\n"));
  console.log(`\nAdopted ${e.id}: ref → ${short(r.current)} (${today}).`);
  console.log("The pin moved. Porting the actual change into the skill is still yours to do.");
} else if (OPT.apply) {
  let n = 0;
  for (const r of results) {
    if (r.state === "error") continue;
    setField(r.entry, "last_checked", today);
    n++;
  }
  writeFileSync(LEDGER, lines.join("\n"));
  console.log(`\nRestamped last_checked on ${n} entr${n === 1 ? "y" : "ies"} → ${today}. Pins unchanged.`);
}

function short(s) { return s && /^[0-9a-f]{40}$/.test(s) ? s.slice(0, 7) : s; }
function wrap(s, indent) {
  const width = 76 - indent;
  const out = [];
  let line = "";
  for (const w of s.split(/\s+/)) {
    if ((line + " " + w).trim().length > width) { out.push(line.trim()); line = w; }
    else line += " " + w;
  }
  if (line.trim()) out.push(line.trim());
  return out.join("\n" + " ".repeat(indent) + "      ");
}
