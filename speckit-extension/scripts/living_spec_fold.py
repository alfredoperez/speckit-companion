#!/usr/bin/env python3
"""The living-spec fold-back: apply a feature spec's requirement deltas to the durable spec.

At mark-complete, the feature spec was the proposal and the living spec becomes
the record. Opt-in (livingSpecs.enabled), best-effort, and a clean no-op when the
feature spec carries no delta block.

Re-folding the same deltas is a no-op — ADDED resolves its heading through the
delta set's renames before both the existence check and the append, so it can
never re-add a section a RENAMED verb just renamed away from.

Stdlib only."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from capture import set_living_specs_synced
from spec_context import _repo_root_for
from spec_deltas import _REQ_HEADING_RE, _has_deltas, parse_spec_deltas


def _living_requirement_span(living_lines: list[str], heading: str) -> tuple[int, int] | None:
    """Find the [start, end) line span of a `### <heading>` requirement in a living
    spec, end being the next `###`/`##` or EOF. Heading match is exact (stripped)."""
    start = None
    for i, line in enumerate(living_lines):
        m = _REQ_HEADING_RE.match(line)
        if m and m.group(1).strip() == heading:
            start = i
            break
    if start is None:
        return None
    end = len(living_lines)
    for j in range(start + 1, len(living_lines)):
        s = living_lines[j]
        if s.startswith("### ") or s.startswith("## "):
            end = j
            break
    return start, end


def _rename_map(deltas: dict) -> dict[str, str]:
    """The delta set's old-heading -> new-heading map, first rename of a heading winning.

    Renames whose chain loops back on itself are dropped: a cycle names no final
    heading, so it is unsatisfiable input and skipped like any unmatched target."""
    mapping: dict[str, str] = {}
    for old_head, new_head in deltas["renamed"]:
        mapping.setdefault(old_head, new_head)
    cyclic: set[str] = set()
    for start in mapping:
        chain = [start]
        current = start
        while current in mapping:
            current = mapping[current]
            if current in chain:
                cyclic.update(chain)
                break
            chain.append(current)
    return {old: new for old, new in mapping.items() if old not in cyclic}


def _resolve_rename(heading: str, mapping: dict[str, str]) -> str:
    """Follow a rename chain to its end. The map is already cycle-free."""
    current = heading
    for _ in range(len(mapping) + 1):
        if current not in mapping:
            break
        current = mapping[current]
    return current


def _retitle(section: str, heading: str) -> str:
    """The same requirement section under a different `### ` heading."""
    lines = section.splitlines()
    for i, line in enumerate(lines):
        if _REQ_HEADING_RE.match(line):
            lines[i] = re.sub(r"^(###\s+).+$", lambda m: m.group(1) + heading, line)
            break
    return "\n".join(lines) + "\n"


def apply_deltas(living_text: str, deltas: dict) -> tuple[str, dict]:
    """Apply ADDED/MODIFIED/REMOVED/RENAMED deltas to a living-spec text.

    ADDED appends a requirement, MODIFIED replaces the matching requirement in
    place, REMOVED deletes it, RENAMED rewrites the matching heading's name.
    Unmatched MODIFIED/REMOVED/RENAMED targets are skipped (best-effort).

    Re-applying a delta set to its own output is a no-op. ADDED runs last, so it
    resolves its heading through this delta set's renames before both the
    existence check and the append — otherwise it would re-add the section the
    RENAMED verb had just renamed away from, once per apply, without limit. A
    MODIFIED body for the same resolved heading wins over the ADDED body, so an
    add-plus-edit pair settles instead of alternating between the two.

    Returns the updated text and the per-verb count of what was applied."""
    lines = living_text.splitlines()
    applied = {"added": 0, "modified": 0, "removed": 0, "renamed": 0}
    renames = _rename_map(deltas)
    modified_bodies = {head: section for head, section in deltas["modified"]}

    for old_head, new_head in renames.items():
        span = _living_requirement_span(lines, old_head)
        if span:
            i = span[0]
            lines[i] = re.sub(r"^(###\s+).+$", lambda m: m.group(1) + new_head, lines[i])
            applied["renamed"] += 1

    for head, _ in deltas["removed"]:
        span = _living_requirement_span(lines, head)
        if span:
            del lines[span[0]:span[1]]
            applied["removed"] += 1

    for head, section in deltas["modified"]:
        span = _living_requirement_span(lines, head)
        if span:
            lines[span[0]:span[1]] = section.rstrip("\n").splitlines()
            applied["modified"] += 1

    appended = "\n".join(lines).rstrip() + "\n"
    for head, section in deltas["added"]:
        target = _resolve_rename(head, renames)
        body = modified_bodies.get(target) or modified_bodies.get(head) or section
        if _living_requirement_span(appended.splitlines(), target) is not None:
            continue  # already present under its final heading
        appended = appended.rstrip() + "\n\n" + _retitle(body, target).rstrip() + "\n"
        applied["added"] += 1
    return appended, applied


def _initial_living_spec(capability_name: str) -> str:
    """A minimal well-formed living-spec scaffold for a capability whose spec.md
    doesn't exist yet, so the first ADDED fold creates a titled, sectioned spec
    (the accumulation story LS·4 relies on) rather than a headerless fragment.
    The slug is humanized into a title; ADDED requirements append under
    `## Requirements`."""
    title = capability_name.replace("-", " ").replace("_", " ").strip()
    if title:
        title = title[0].upper() + title[1:]
    else:
        title = capability_name
    return f"# {title} — Living Spec\n\n## Requirements\n"


def _git_changed_files(root: Path) -> list[str]:
    """Files this feature branch changed vs its merge-base with the default branch.

    Best-effort: returns [] if git can't answer (detached/odd checkout, no
    merge-base). On the write-side fold, an empty result means the caller
    (`_resolve_fold_targets`) folds ONLY capabilities named by an explicit
    `<!-- capability: ... -->` marker and never fans out to every durable spec —
    the conservative choice for a write path."""
    for base in ("origin/main", "main", "origin/master", "master"):
        try:
            mb = subprocess.run(
                ["git", "merge-base", base, "HEAD"], cwd=str(root),
                capture_output=True, text=True, check=True,
            ).stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
        if not mb:
            continue
        try:
            out = subprocess.run(
                ["git", "diff", "--name-only", mb, "HEAD"], cwd=str(root),
                capture_output=True, text=True, check=True,
            ).stdout
        except (subprocess.CalledProcessError, FileNotFoundError):
            return []
        return [f.strip() for f in out.splitlines() if f.strip()]
    return []


def _load_resolver():
    """Import the LS·1 resolver (hyphenated filename) by file path, or None."""
    try:
        import importlib.util
        path = Path(__file__).resolve().parent / "resolve-spec-paths.py"
        spec = importlib.util.spec_from_file_location("resolve_spec_paths", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception:  # noqa: BLE001 - best-effort
        return None


def _resolve_fold_targets(rsp, living: dict, root: Path, deltas: dict) -> list[dict]:
    """Capabilities to fold into: the most-specific match for the change surface,
    plus any capability explicitly named by a `<!-- capability: <name> -->` marker.

    Write-most-specific: from the (most-specific-first) matched list keep only the
    head. Markered targets are added by name from the full capability set, so a
    block can route to a different/additional capability than the code change
    resolves to. When git can't determine the changed files, this folds ONLY the
    markered capabilities (never fans out to every durable spec) — the conservative
    choice for a write path; the no-changed-files fallback is logged so the
    markers-only narrowing is observable rather than a silent no-op."""
    changed = _git_changed_files(root)
    if not changed:
        print(
            "[companion] Living-spec fold: could not determine changed files; "
            "folding markered capabilities only (no fan-out to all durable specs).",
            file=sys.stderr,
        )
    matched = rsp.match_changed(changed, living, str(root)) if changed else []
    targets: list[dict] = []
    seen: set[str] = set()
    if matched:
        head = matched[0]
        targets.append(head)
        seen.add(head["name"])

    marker_names = {v for v in deltas.get("markers", {}).values() if v}
    if marker_names:
        by_name = {c["name"]: c for c in living["capabilities"]}
        all_entries = rsp.discover_all(living, str(root))
        entry_by_name = {e["name"]: e for e in all_entries}
        for name in marker_names:
            if name in seen:
                continue
            entry = entry_by_name.get(name)
            if entry is None and name in by_name:
                try:
                    entry = rsp._entry(by_name[name], str(root))
                except Exception:  # noqa: BLE001
                    entry = None
            if entry is not None:
                targets.append(entry)
                seen.add(name)
    return targets


def fold_living_spec(feature_dir: Path, by: str) -> Path | None:
    """Fold the feature spec's requirement deltas into the resolved living spec(s).

    Opt-in (livingSpecs.enabled) and best-effort: any miss (feature off, no
    config, no resolver, no delta block, no spec file) is a clean no-op that
    returns None and writes nothing. On a real fold, applies the deltas to each
    target's capabilities/<name>/spec.md, records the synced names onto
    livingSpecs.synced, logs a one-line per-capability summary, and returns the
    updated .spec-context.json path. Idempotent: re-running folds nothing new."""
    root = _repo_root_for(feature_dir)
    rsp = _load_resolver()
    if rsp is None:
        return None
    try:
        living = rsp.load_living(str(root))
    except Exception:  # noqa: BLE001
        return None
    if not living.get("enabled"):
        return None

    spec_md = feature_dir / "spec.md"
    try:
        spec_text = spec_md.read_text(encoding="utf-8")
    except OSError:
        return None
    deltas = parse_spec_deltas(spec_text)
    if not _has_deltas(deltas):
        return None  # common additive case — clean no-op

    try:
        targets = _resolve_fold_targets(rsp, living, root, deltas)
    except Exception:  # noqa: BLE001
        targets = []
    if not targets:
        print(
            "[companion] Living-spec fold: no capability resolved for this change; "
            "nothing folded.",
            file=sys.stderr,
        )
        return None

    synced: list[str] = []
    for cap in targets:
        spec_rel = cap.get("spec")
        if not spec_rel:
            continue
        living_path = root / spec_rel
        try:
            before = living_path.read_text(encoding="utf-8") if living_path.exists() else _initial_living_spec(cap.get("name") or living_path.parent.name)
        except OSError:
            continue
        after, applied = apply_deltas(before, deltas)
        if after == before:
            print(
                f"[companion] Living-spec fold: {cap['name']} already up to date "
                f"({spec_rel}); no change.",
                file=sys.stderr,
            )
            continue
        try:
            living_path.parent.mkdir(parents=True, exist_ok=True)
            living_path.write_text(after, encoding="utf-8")
        except OSError as exc:
            print(f"[companion] Living-spec fold: could not write {spec_rel}: {exc}", file=sys.stderr)
            continue
        synced.append(cap["name"])
        counts = (
            f"+{applied['added']} added, ~{applied['modified']} modified, "
            f"-{applied['removed']} removed, ↻{applied['renamed']} renamed"
        )
        unmatched = sum(len(deltas[verb]) - applied[verb]
                        for verb in ("modified", "removed", "renamed"))
        already_present = len(deltas["added"]) - applied["added"]
        reasons = []
        if unmatched:
            reasons.append(f"{unmatched} change(s) skipped: no matching requirement heading")
        if already_present:
            reasons.append(f"{already_present} addition(s) skipped: heading already present")
        note = f" — {'; '.join(reasons)}" if reasons else ""
        print(f"[companion] Living-spec fold: {cap['name']} ← {counts} ({spec_rel}){note}",
              file=sys.stderr)

    if not synced:
        return None
    return set_living_specs_synced(feature_dir, synced)
