#!/usr/bin/env python3
"""The living-spec shape check — read-only, never a gate.

A living spec is only worth keeping if what gets folded into it is trustworthy,
and nothing checked the shape of one before writing to it. This reports six
kinds of break with a file, a line, a severity, a stable code and a one-line
fix. It changes nothing and always exits 0: a report that can fail the shell it
runs in is a gate wearing a report's clothes.

The fold imports this module and refuses on an error-level finding. The VS Code
extension carries its own twin in `src/features/specs/specShapeCheck.ts`,
because the shipped extension cannot assume these scripts are installed; the two
are pinned to `tests/fixtures/spec-shape/`.

Stdlib only."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path  # noqa: E402
from spec_context import feature_spec_path  # noqa: E402

import companion_config as cc  # noqa: E402 — reached through the path above

_REQ_RE = re.compile(r"^###(?!#)\s+(.+?)\s*$")
_SCENARIO_RE = re.compile(r"^####(?!#)\s+Scenario\s*:\s*(.+?)\s*$", re.IGNORECASE)
_SECTION_RE = re.compile(r"^##(?!#)\s+(.+?)\s*$")
_TOUCHES_RE = re.compile(r"^\s*<!--\s*touches:\s*(.+?)\s*-->\s*$")
_CAP_MARKER_RE = re.compile(r"^\s*<!--\s*capability:\s*([^\s>]+)\s*-->\s*$", re.IGNORECASE)
#: Past these a spec is a folder's worth of concerns in one file. Warnings, not
#: gates — see `spec-too-large`.
MAX_REQUIREMENTS = 8
MAX_LINES = 160

_DELTA_HEADER_RE = re.compile(r"^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$",
                              re.IGNORECASE)
#: Any markdown bullet, ordered or not. `+` is a bullet and a numbered list is
#: ordinary prose shape; refusing a whole capability over one is not a check, it
#: is a formatting preference with teeth.
_BULLET = r"^\s*(?:[-*+]|\d+[.)])\s*"
#: The emphasis is optional for the same reason the bullet shape is. A scenario
#: written `- WHEN x` states its condition as plainly as `- **WHEN** x` does, and
#: reading it as "this scenario has no condition" is both false and, at error
#: severity, enough to refuse the fold that would have written it.
_WHEN_RE = re.compile(_BULLET + r"\*{0,2}(WHEN|GIVEN)\*{0,2}\b", re.IGNORECASE)
# `AND` continues whichever half came before it, so it is never evidence of an
# outcome. Counting it as one is how a scenario with a condition and no result
# passes a check written to catch exactly that.
_THEN_RE = re.compile(_BULLET + r"\*{0,2}THEN\*{0,2}\b", re.IGNORECASE)

#: Severity decides one thing: whether a fold stops. Nothing else reads it.
ERROR = "error"
WARNING = "warning"


def _fence_flags(lines: list) -> list:
    """True for every line inside a fenced block, and for the fences themselves."""
    flags, inside = [], False
    for line in lines:
        if re.match(r"^\s*(```|~~~)", line):
            inside = not inside
            flags.append(True)
            continue
        flags.append(inside)
    return flags


def _finding(severity, code, path, line, message, fix, capability=None) -> dict:
    return {
        "severity": severity, "code": code, "path": path, "line": line,
        "message": message, "fix": fix, "capability": capability,
    }


_RESOLVER = None
_RESOLVER_TRIED = False


def _load_resolver():
    """The registry reader and its glob matcher, or None when unavailable.

    Cached: executing the resolver module is not free, and the checks ask for it
    once per requirement.
    """
    global _RESOLVER, _RESOLVER_TRIED
    if _RESOLVER_TRIED:
        return _RESOLVER
    _RESOLVER_TRIED = True
    try:
        import importlib.util

        here = os.path.dirname(os.path.abspath(__file__))
        spec = importlib.util.spec_from_file_location(
            "_rsp_for_validate", os.path.join(here, "resolve-spec-paths.py"))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _RESOLVER = mod
    except Exception:  # noqa: BLE001
        _RESOLVER = None
    return _RESOLVER


_PATHS_CACHE: dict = {}
_SKIP_DIRS = {".git", "node_modules", "__pycache__", "dist", "out",
              ".venv", "venv", "storybook-static", "coverage"}


def repo_paths(root: str) -> list:
    """Every repository-relative path under `root`, files and the directories
    holding them.

    Tracked files where git can say, because build output is not what a marker
    means by "on disk" and scanning it made this ten times slower than the work
    it guards. Falls back to a walk where git cannot answer.
    """
    key = os.path.abspath(root)
    cached = _PATHS_CACHE.get(key)
    if cached is not None:
        return cached
    files = _tracked_files(key)
    if files is None:
        files = []
        for dirpath, dirnames, filenames in os.walk(key):
            dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
            rel_dir = os.path.relpath(dirpath, key).replace(os.sep, "/")
            rel_dir = "" if rel_dir == "." else rel_dir
            files.extend(f"{rel_dir}/{n}" if rel_dir else n for n in filenames)
    # A marker may name a directory, so every ancestor is a path too.
    out = set(files)
    for f in files:
        parts = f.split("/")
        for i in range(1, len(parts)):
            out.add("/".join(parts[:i]))
    ordered = sorted(out)
    _PATHS_CACHE[key] = ordered
    return ordered


def _tracked_files(root: str):
    """Git's own file list, or None when git cannot answer."""
    import subprocess

    def ask(args):
        try:
            res = subprocess.run(["git", "-C", root, "ls-files", "-z"] + args,
                                 capture_output=True, timeout=20)
        except Exception:  # noqa: BLE001
            return None
        if res.returncode != 0:
            return None
        return [p for p in res.stdout.decode("utf-8", "replace").split("\0") if p]

    # Tracked AND untracked-but-not-ignored. Tracked alone reads every file a
    # feature branch just added as absent, so a marker on new code — the
    # commonest marker there is — reported as matching nothing.
    files = ask(["--cached", "--others", "--exclude-standard"])
    if files is None:
        return None
    # A second call for submodule contents, because git refuses to combine
    # `--recurse-submodules` with `--others`. A repo with no submodules answers
    # this with what the first call already said.
    nested = ask(["--cached", "--recurse-submodules"])
    if nested:
        files = list(dict.fromkeys(files + nested))
    return files


_PATTERN_CACHE: dict = {}


def _glob_matches_anything(pattern: str, root: str) -> bool:
    """Whether a `touches` pattern names at least one path that exists.

    The pattern is compiled once. Compiling it per path made a check over
    fourteen capabilities take thirteen seconds, which is not a cost a fold can
    pay before every write.
    """
    rsp = _load_resolver()
    if rsp is None:
        return True  # unanswerable, so never reported
    rx = _PATTERN_CACHE.get(pattern)
    if rx is None:
        try:
            rx = re.compile(rsp._glob_to_regex(pattern.replace("\\", "/")))
        except Exception:  # noqa: BLE001
            return True  # a pattern we cannot compile is not evidence of a miss
        _PATTERN_CACHE[pattern] = rx
    return any(rx.match(p) for p in repo_paths(root))


def fences_are_balanced(text: str) -> bool:
    """False when a fence is opened and never closed.

    Everything after an unclosed fence is invisible to every reader — the
    slicer, the coverage denominator, the shape check and the fold alike — so a
    count taken from such a document cannot be trusted by any of them.
    """
    opened = 0
    for line in text.splitlines():
        if re.match(r"^\s*(```|~~~)", line):
            opened += 1
    return opened % 2 == 0


def _split_advice(path: str) -> str:
    """Where this spec's siblings go, which depends on how it is stored."""
    if _posix_path(path).startswith(f"{cc.DEFAULT_CAPABILITY_ROOT}/"):
        folder = _posix_path(path).rsplit("/", 1)[0]
        return (f"Split it into granular specs in {folder}/, one per concern — "
                f"`<concern>.spec.md` — and give each its own registry entry.")
    folder, name = _posix_path(path).rsplit("/", 1)
    stem = name[: -len(".spec.md")] if name.endswith(".spec.md") else name
    return (f"Split it into sibling specs in {folder}/, one per concern — "
            f"`{stem}-<concern>.spec.md` — and give each its own registry entry.")


def _posix_path(p: str) -> str:
    return p.replace(os.sep, "/")


def check_living_spec(text: str, path: str, root: str | None = ".",
                      capability: str | None = None, offset: int = 0) -> list:
    """Every shape finding in one living spec, ordered by line.

    Requirements are counted off every `###` in the document, fences ignored —
    the same headings the slicer and the coverage denominator count. Counting
    them differently here is how a finding comes to name a requirement no other
    reader believes exists.
    """
    lines = text.splitlines()
    fenced = _fence_flags(lines)
    findings: list = []
    seen: dict = {}

    def is_req(i):
        return not fenced[i] and _REQ_RE.match(lines[i])

    def is_section(i):
        return not fenced[i] and _SECTION_RE.match(lines[i])

    i = 0
    while i < len(lines):
        head = is_req(i)
        if not head:
            i += 1
            continue
        heading = head.group(1)
        # A requirement ends at the next requirement or the next section, so a
        # requirement before an uncovered section does not absorb it.
        j = i + 1
        while j < len(lines) and not is_req(j) and not is_section(j):
            j += 1

        first = seen.get(heading)
        if first is not None:
            findings.append(_finding(
                ERROR, "duplicate-requirement", path, i + 1,
                f'"{heading}" is already a requirement in this spec, at line {first}.',
                "Rename one of them, or merge the two into a single requirement.",
                capability))
        else:
            seen[heading] = i + 1

        scenarios = [k for k in range(i + 1, j)
                     if not fenced[k] and _SCENARIO_RE.match(lines[k])]
        if not scenarios:
            findings.append(_finding(
                WARNING, "requirement-without-scenario", path, i + 1,
                f'"{heading}" states a rule and never says how anyone would know it held.',
                "Add a `#### Scenario:` with a WHEN and a THEN under this requirement.",
                capability))

        for n, start in enumerate(scenarios):
            end = scenarios[n + 1] if n + 1 < len(scenarios) else j
            body = [lines[k] for k in range(start + 1, end) if not fenced[k]]
            has_when = any(_WHEN_RE.match(b) for b in body)
            has_then = any(_THEN_RE.match(b) for b in body)
            if has_when and has_then:
                continue
            absent = "no outcome" if has_when else "no condition"
            findings.append(_finding(
                ERROR, "scenario-missing-half", path, start + 1,
                f'This scenario has {absent}, so nothing about it can be checked.',
                "Give the scenario both halves: a WHEN bullet and a THEN bullet.",
                capability))

        marker = _TOUCHES_RE.match(lines[i + 1]) if i + 1 < j else None
        if marker and root is not None:
            globs = [g.strip() for g in marker.group(1).split(",") if g.strip()]
            missing = [g for g in globs if not _glob_matches_anything(g, root)]
            if missing and len(missing) == len(globs):
                findings.append(_finding(
                    WARNING, "unmatched-touches-glob", path, i + 2,
                    f"This marker names {', '.join(missing)}, which matches nothing on disk.",
                    "Point the marker at the files this requirement describes, or remove it.",
                    capability))
        i = j

    reqs = sum(1 for i in range(len(lines)) if is_req(i))
    if reqs > MAX_REQUIREMENTS or len(lines) > MAX_LINES:
        # A capability with a wide surface is one folder, not one file. Warning
        # only: splitting is a judgement about where the seams are, and a gate
        # that blocks on it would just teach people to write fewer scenarios.
        findings.append(_finding(
            WARNING, "spec-too-large", path, 1,
            f"{reqs} requirements over {len(lines)} lines — past "
            f"{MAX_REQUIREMENTS} requirements or {MAX_LINES} lines a spec stops "
            f"being something a reader holds in their head.",
            _split_advice(path), capability))

    if not fences_are_balanced(text):
        # Reported first and at line 1, because everything below the unclosed
        # fence is invisible to this check too — the finding is about the file,
        # not about anything in it.
        findings.append(_finding(
            WARNING, "unbalanced-fence", path, 1,
            "A code fence is opened and never closed, so everything after it is "
            "invisible to every reader of this spec.",
            "Close the fence, or remove it.", capability))

    if offset:
        for f in findings:
            f["line"] += offset
    findings.sort(key=lambda f: (f["line"], f["code"]))
    return findings


def _delta_blocks(text: str) -> list:
    """Each delta block as (verb, capability, marker_line, [(heading, line)])."""
    lines = text.splitlines()
    fenced = _fence_flags(lines)
    blocks: list = []
    cur = None
    for i, line in enumerate(lines):
        if fenced[i]:
            continue
        hm = _DELTA_HEADER_RE.match(line)
        if hm:
            # Close the previous block. Leaving it open let one block's slice
            # run into the next, so a heading in ADDED and the same heading in
            # MODIFIED read as a duplicate inside one block.
            if cur is not None:
                cur["end"] = i
            cur = {"verb": hm.group(1).upper(), "capability": None,
                   "marker_line": i + 1, "start": i + 1, "end": len(lines),
                   "headings": []}
            blocks.append(cur)
            continue
        if cur is None:
            continue
        if _SECTION_RE.match(line):
            cur["end"] = i
            cur = None
            continue
        cm = _CAP_MARKER_RE.match(line)
        if cm:
            cur["capability"] = cm.group(1).strip()
            cur["marker_line"] = i + 1
            continue
        rm = _REQ_RE.match(line)
        if rm:
            cur["headings"].append((rm.group(1), i + 1))
    return blocks


def check_feature_deltas(text: str, path: str, known_capabilities: list,
                         target_texts: dict, default_capability=None) -> list:
    """Every shape finding in one feature spec's delta sections, ordered by line.

    `target_texts` maps a capability name to the current text of its living
    spec, so a modification or removal can be checked against what is actually
    there. A capability with no entry is not checked for missing headings —
    absent is not evidence.

    An unmarked block belongs to `default_capability`, exactly as the fold
    routes it. Leaving it unresolved is how an unmarked delta escaped the check
    that exists to catch it.
    """
    known = set(known_capabilities or [])
    findings: list = []
    for block in _delta_blocks(text):
        cap = block["capability"] or default_capability
        if cap and cap not in known:
            findings.append(_finding(
                ERROR, "unknown-capability", path, block["marker_line"],
                f'This block is marked for "{cap}", which the living-specs registry does not list.',
                "Correct the capability name, or register it in living-specs.yml.",
                cap))
            continue
        # The delta's own requirements are what becomes permanent, so they are
        # held to the same shape as anything already in a living spec. Without
        # this the fold happily wrote a scenario nobody could ever check.
        if block["verb"] in ("ADDED", "MODIFIED"):
            body = "\n".join(text.splitlines()[block["start"]:block["end"]])
            # `root=None` skips the marker check rather than running it and
            # discarding the result. Running it indexed the tree — a git call,
            # or an unbounded walk when git could not answer — for a finding
            # this never keeps, on the path the fold takes before every write.
            findings.extend(check_living_spec(
                body, path, root=None, capability=cap, offset=block["start"]))

        target = target_texts.get(cap) if cap else None
        if target is None:
            continue
        present = {s["heading"] for s in _requirement_headings(target)}
        if block["verb"] == "ADDED":
            # An addition that restates an existing heading in other words is
            # that requirement changed, and belongs under MODIFIED. Folded as
            # ADDED it becomes a second requirement for one behaviour, which is
            # the way a spec grows without anything having been decided.
            for heading, line in block["headings"]:
                near = _nearest_heading(heading, present)
                if near:
                    findings.append(_finding(
                        WARNING, "added-heading-near-existing", path, line,
                        f'ADDED "{heading}" reads like "{near}", which {cap}\'s spec already has.',
                        "If it is the same requirement changed, put it under MODIFIED with the existing heading.",
                        cap))
            continue
        if block["verb"] not in ("MODIFIED", "REMOVED"):
            continue
        for heading, line in block["headings"]:
            if heading in present:
                continue
            # A warning, not an error: the fold promotes a MODIFIED with no
            # match into an addition and a REMOVED with no match removes
            # nothing. Both are defined outcomes, so neither damages the record
            # — but a typo'd heading quietly becomes a near-duplicate
            # requirement, which is worth saying out loud.
            findings.append(_finding(
                WARNING, "delta-heading-not-found", path, line,
                f'{block["verb"]} names "{heading}", which {cap}\'s spec does not have.',
                "Use the heading exactly as it appears in the spec, or ADDED for a new one.",
                cap))
    findings.sort(key=lambda f: (f["line"], f["code"]))
    return findings


_STOP = {"a", "an", "the", "is", "are", "to", "of", "and", "or", "in", "on", "for", "with",
         "its", "it", "their", "this", "that"}


def _words(heading: str) -> set:
    # A crude stem — "pages"/"page", "delegated"/"delegate" — is enough here; a
    # real stemmer is a dependency for a warning.
    return {re.sub(r"(ing|ed|es|e|s|d)$", "", w) if len(w) > 3 else w
            for w in re.findall(r"[a-z0-9]+", heading.lower()) if w not in _STOP}


def _nearest_heading(heading: str, present: set):
    """The existing heading this one mostly restates, or None.

    Word overlap, nothing cleverer: two headings sharing most of their content
    words are the same requirement said twice. An exact match is not "near",
    it is the case the MODIFIED check already handles.
    """
    mine = _words(heading)
    if not mine:
        return None
    for other in present:
        if other == heading:
            continue
        theirs = _words(other)
        if not theirs:
            continue
        overlap = len(mine & theirs) / len(mine | theirs)
        if overlap >= 0.6 or mine <= theirs or theirs <= mine:
            return other
    return None


def _requirement_headings(text: str) -> list:
    """Every `###` heading in a spec, fences ignored, with its line."""
    lines = text.splitlines()
    fenced = _fence_flags(lines)
    out = []
    for i, line in enumerate(lines):
        if fenced[i]:
            continue
        m = _REQ_RE.match(line)
        if m:
            out.append({"heading": m.group(1), "line": i + 1})
    return out


def _active_feature_specs(root: str) -> list:
    """Feature specs under `specs/` that are not already completed."""
    specs_dir = os.path.join(root, "specs")
    if not os.path.isdir(specs_dir):
        return []
    out = []
    for name in sorted(os.listdir(specs_dir)):
        spec_md = str(feature_spec_path(Path(specs_dir) / name))
        if not os.path.isfile(spec_md):
            continue
        ctx = os.path.join(specs_dir, name, ".spec-context.json")
        try:
            with open(ctx, encoding="utf-8") as fh:
                if json.load(fh).get("status") == "completed":
                    continue
        except Exception:  # noqa: BLE001
            pass  # unreadable context is not evidence the spec is done
        out.append(spec_md)
    return out


def _registry_above(root: str):
    """A `living-specs.yml` in an ancestor directory, or None."""
    here = os.path.abspath(root)
    while True:
        parent = os.path.dirname(here)
        if parent == here:
            return None
        here = parent
        candidate = os.path.join(here, "living-specs.yml")
        if os.path.isfile(candidate):
            return candidate


def build_report(root: str = ".") -> dict:
    """Every finding across the project's living specs and active feature specs.

    Best-effort throughout: any file that cannot be read becomes a skip with its
    reason, never a crash and never a missing finding reported as a clean one.
    """
    rsp = _load_resolver()
    if rsp is None:
        return {"enabled": False, "checked": 0, "findings": [],
                "skipped": [{"path": ".", "reason": "the capability resolver is unavailable"}]}
    try:
        living = rsp.load_living(root)
    except Exception as err:  # noqa: BLE001
        return {"enabled": False, "checked": 0, "findings": [],
                "skipped": [{"path": "living-specs.yml",
                             "reason": f"could not be read ({err.__class__.__name__})"}]}
    if not living.get("enabled"):
        # A registry one directory up is the commonest reason this looks off:
        # the command was run from a subdirectory, not from the repository root.
        if not os.path.isfile(os.path.join(root, "living-specs.yml")):
            found = _registry_above(root)
            if found:
                return {"enabled": False, "checked": 0, "findings": [], "skipped": [{
                    "path": os.path.relpath(found, root).replace(os.sep, "/"),
                    "reason": "the registry is above this directory — run from the "
                              "repository root, or pass --root",
                }]}
        return {"enabled": False, "checked": 0, "findings": [], "skipped": []}

    findings: list = []
    skipped: list = []
    checked = 0
    target_texts: dict = {}
    known: list = []

    for cap in living.get("capabilities") or []:
        name = cap.get("name")
        rel = rsp._resolve_spec(cap) if hasattr(rsp, "_resolve_spec") else cap.get("spec")
        known.append(name)
        if not rel:
            continue
        full = os.path.join(root, rel)
        if not os.path.isfile(full):
            continue  # not yet adopted; that is drift's business, not shape's
        try:
            with open(full, encoding="utf-8") as fh:
                text = fh.read()
        except (OSError, UnicodeDecodeError) as err:
            skipped.append({"path": rel, "reason": f"could not be read ({err.__class__.__name__})"})
            continue
        checked += 1
        target_texts[name] = text
        findings.extend(check_living_spec(text, rel, root=root, capability=name))

    for spec_md in _active_feature_specs(root):
        rel = os.path.relpath(spec_md, root).replace(os.sep, "/")
        try:
            with open(spec_md, encoding="utf-8") as fh:
                text = fh.read()
        except (OSError, UnicodeDecodeError) as err:
            skipped.append({"path": rel, "reason": f"could not be read ({err.__class__.__name__})"})
            continue
        checked += 1
        findings.extend(check_feature_deltas(text, rel, known, target_texts))

    findings.sort(key=lambda f: (f["path"], f["line"], f["code"]))
    return {"enabled": True, "checked": checked, "findings": findings, "skipped": skipped}


def render_human(report: dict) -> str:
    """The list a person reads. Modelled on the drift detector's output.

    A run that could not read the registry is not a run that found nothing, and
    saying "nothing to check" for both is how a clean report comes to be read as
    a verdict on files nobody examined. The skipped list carries the difference,
    so it is printed whether or not the feature resolved as on.
    """
    out = []
    if not report["enabled"]:
        if not report["skipped"]:
            return "Living specs are off in this repo; nothing to check."
        out.append("Nothing was checked. Why:")
        for s in report["skipped"]:
            out.append(f"  {s['path']} — {s['reason']}")
        return "\n".join(out)
    if not report["findings"]:
        out.append(f"✓ {report['checked']} spec(s) checked, nothing to report.")
    else:
        errors = sum(1 for f in report["findings"] if f["severity"] == ERROR)
        warnings = len(report["findings"]) - errors
        out.append(f"{report['checked']} spec(s) checked — {errors} error(s), {warnings} warning(s).")
        out.append("")
        for f in report["findings"]:
            out.append(f"{f['severity']:>7}  {f['path']}:{f['line']}  [{f['code']}]")
            out.append(f"         {f['message']}")
            out.append(f"         → {f['fix']}")
            out.append("")
    if report["skipped"]:
        out.append("Skipped:")
        for s in report["skipped"]:
            out.append(f"  {s['path']} — {s['reason']}")
    return "\n".join(out).rstrip()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Check the shape of Companion living specs.")
    ap.add_argument("--root", default=".", help="repo root (default: cwd)")
    ap.add_argument("--json", action="store_true",
                    help="emit the machine-readable object instead of the human list")
    args = ap.parse_args(argv)
    try:
        report = build_report(args.root)
    except Exception as err:  # noqa: BLE001
        # A report that can fail the shell it runs in is a gate wearing a
        # report's clothes. Say what broke and still exit 0.
        print(f"[companion] Living-spec check could not run: {err}", file=sys.stderr)
        return 0
    print(json.dumps(report, indent=2) if args.json else render_human(report))
    return 0  # never halts


if __name__ == "__main__":
    raise SystemExit(main())
