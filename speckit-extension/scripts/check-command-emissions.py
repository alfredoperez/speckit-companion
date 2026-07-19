#!/usr/bin/env python3
"""Inventory gate: everything downstream of `extension.yml` must agree with it.

`provides.commands` is the authority. Four surfaces are held against it, each of
which has drifted in this repo before:

  (a) EMISSIONS  — the command files the installer writes into each agent's dir.
      A renamed command leaves the old file behind (the CLI's reinstall merges
      names and never deletes, and it skips overwriting a skill that already
      exists), so the retired name stays live in the agent's command list.
      Failure: `orphan emission:` / `missing emission:`.

  (b) RECORDS    — `.specify/extensions/.registry` and the hook registrations in
      `.specify/extensions.yml`. These are what the uninstall path reads, so a
      stale entry is what makes a later clean removal impossible.
      Failure: `stale record:` / `unrecorded command:` / `stale hook:`.

  (c) DOCS       — README's command table and docs/commands.md.
      Failure: `undocumented command:`.

  (d) COVERAGE   — the set of install areas the run actually scanned. Areas are
      DISCOVERED and then required to be in KNOWN_AREAS, rather than iterated
      from KNOWN_AREAS directly: a hardcoded list silently stops covering a new
      agent dir, which is the same drift this gate exists to catch, hidden one
      level down. Failure: `unknown install area:` / `unresolvable entry:`.

Exit 0 on agreement, 1 on any drift or any input that could not be resolved.
Stdlib only.
"""
from __future__ import annotations

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT_ROOT = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(EXT_ROOT)

if HERE not in sys.path:
    sys.path.insert(0, HERE)

from _command_parts import declared_command_names  # noqa: E402

PREFIX = "speckit.companion."
DASHED_PREFIX = "speckit-companion-"

# An emission is a DASHED directory or a DOTTED file, never the reverse. Matching
# the prefix alone is too loose: `.claude/speckit-companion-prompt.md` is a
# dev-workspace note that would otherwise read as an install area.
DASHED_DIR = re.compile(r"^speckit-companion-")
DOTTED_FILE = re.compile(r"^speckit\.companion\.")

# Never scanned, with the reason attached so a later reader does not "tidy" one away.
SKIP_DIRS = {
    ".git": "not a working tree",
    "node_modules": "vendored dependencies",
    "out": "build output",
    "dist": "build output",
    # Deliberately frozen at pre-rename command names: the rename commit kept them
    # because rewriting them would falsify the record of what was decided then.
    "examples": "frozen pre-rename fixtures",
    # Spec folders quote command names as prose, and are a record of past runs.
    "specs": "historical spec records",
    # The extension's own source and its installed copy are the SOURCE of an
    # emission, not an emission. Scanning them would compare the manifest to itself.
    "speckit-extension": "extension source",
    ".specify": "install source, checked as records instead",
}

# How a command name becomes an entry in each agent's install dir. `dir` areas hold
# one directory per command; `file` areas hold one file per command.
KNOWN_AREAS = {
    ".claude/skills": ("dir", ""),
    ".agents/skills": ("dir", ""),
    ".cursor/skills": ("dir", ""),
    ".github/prompts": ("file", ".prompt.md"),
    ".github/agents": ("file", ".agent.md"),
    ".qwen/commands": ("file", ".md"),
    ".gemini/commands": ("file", ".toml"),
}

DOCS = {
    "speckit-extension/README.md": "the README command table",
    "speckit-extension/docs/commands.md": "the command reference",
}

REGISTRY = ".specify/extensions/.registry"
EXTENSIONS_YML = ".specify/extensions.yml"


def entry_for(name: str, area: str) -> str:
    """The on-disk entry a command name takes in this area."""
    style, suffix = KNOWN_AREAS[area]
    if style == "dir":
        return DASHED_PREFIX + name[len(PREFIX):]
    return name + suffix


def name_for(entry: str, area: str) -> str | None:
    """The command name an on-disk entry stands for, or None if it fits no shape.

    Only the PREFIX is translated, never the whole string: `living-move` must map
    back to `speckit.companion.living-move`, not `speckit.companion.living.move`.
    """
    style, suffix = KNOWN_AREAS[area]
    if style == "dir":
        return PREFIX + entry[len(DASHED_PREFIX):] if entry.startswith(DASHED_PREFIX) else None
    if entry.startswith(PREFIX) and entry.endswith(suffix) and len(entry) > len(suffix):
        return entry[: -len(suffix)]
    return None


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def discover_areas(root: str) -> list:
    """Every directory under `root` that holds a Companion-shaped entry.

    Discovery rather than a fixed list, so a new agent dir shows up as a loud
    `unknown install area` failure instead of going unscanned forever.
    """
    found = set()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        rel = os.path.relpath(dirpath, root)
        if rel == ".":
            continue
        if any(DASHED_DIR.match(d) for d in dirnames) or any(DOTTED_FILE.match(f) for f in filenames):
            found.add(rel.replace(os.sep, "/"))
    return sorted(found)


def check_areas(names, root: str) -> list:
    """Assert every discovered area is one we know how to read."""
    return [
        f"unknown install area: {area} — holds Companion commands but is not in "
        f"KNOWN_AREAS; add it there rather than leaving it unscanned"
        for area in discover_areas(root)
        if area not in KNOWN_AREAS
    ]


def check_area(area: str, names, root: str) -> list:
    """Hold one install area's entries against the manifest, both directions."""
    problems = []
    base = os.path.join(root, area)
    if not os.path.isdir(base):
        return problems
    declared = set(names)
    style, _suffix = KNOWN_AREAS[area]
    on_disk = {}
    for entry in sorted(os.listdir(base)):
        wants_dir = style == "dir"
        is_dir = os.path.isdir(os.path.join(base, entry))
        if not (DASHED_DIR.match(entry) or DOTTED_FILE.match(entry)):
            continue
        name = name_for(entry, area) if is_dir == wants_dir else None
        if name is None:
            problems.append(
                f"unresolvable entry: {area}/{entry} — inside {area} but matches no known naming shape"
            )
            continue
        on_disk[name] = f"{area}/{entry}"

    for name, path in sorted(on_disk.items()):
        if name not in declared:
            problems.append(
                f"orphan emission: {path} — no command named {name} in "
                f"extension.yml provides.commands"
            )
    for name in sorted(declared - set(on_disk)):
        problems.append(
            f"missing emission: {name} — declared in extension.yml but absent from {area}"
        )
    return problems


def _registered_commands(registry_path: str) -> dict:
    """`registered_commands` per agent from the install registry ({} when absent)."""
    if not os.path.isfile(registry_path):
        return {}
    with open(registry_path, encoding="utf-8") as fh:
        data = json.load(fh)
    companion = data.get("extensions", {}).get("companion", {})
    return companion.get("registered_commands", {})


def _hook_commands(extensions_yml: str) -> list:
    """(event, command) for every Companion hook registration."""
    if not os.path.isfile(extensions_yml):
        return []
    pairs, event, in_hooks = [], None, False
    for raw in _read(extensions_yml).splitlines():
        if re.match(r"^hooks:\s*$", raw):
            in_hooks = True
            continue
        if in_hooks and raw and not raw.startswith(" "):
            in_hooks = False
        if not in_hooks:
            continue
        m = re.match(r"^  (\w+):\s*$", raw)
        if m:
            event = m.group(1)
            continue
        m = re.match(r"^\s*command:\s*(\S+)\s*$", raw)
        if m and m.group(1).startswith(PREFIX):
            pairs.append((event, m.group(1)))
    return pairs


def check_records(names, registry_path: str, extensions_yml: str) -> list:
    """Hold the install records against the manifest, both directions."""
    problems = []
    declared = set(names)
    for agent, recorded in sorted(_registered_commands(registry_path).items()):
        recorded_set = {c for c in recorded if c.startswith(PREFIX)}
        for name in sorted(recorded_set - declared):
            problems.append(
                f"stale record: {name} registered for {agent} — not in "
                f"extension.yml provides.commands"
            )
        for name in sorted(declared - recorded_set):
            problems.append(
                f"unrecorded command: {name} — declared in extension.yml but not "
                f"registered for {agent}"
            )
    for event, command in _hook_commands(extensions_yml):
        if command not in declared:
            problems.append(
                f"stale hook: {event} triggers {command}, which extension.yml no longer declares"
            )
    return problems


def check_docs(names, docs: dict) -> list:
    """Every declared command must appear literally in every document.

    Matched on names, never on a count — a count still matches when one command
    is added and an unrelated one dropped in the same change.
    """
    problems = []
    for rel, label in sorted(docs.items()):
        path = os.path.join(REPO_ROOT, rel) if not os.path.isabs(rel) else rel
        if not os.path.isfile(path):
            problems.append(f"missing document: {rel} — {label} is gated but does not exist")
            continue
        text = _read(path)
        for name in names:
            if name not in text:
                problems.append(
                    f"undocumented command: {name} — declared in extension.yml but "
                    f"absent from {rel}"
                )
    return problems


def check(root: str = REPO_ROOT, docs: dict | None = None) -> list:
    """Compose the four comparisons. `root`/`docs` are parameters so a test can
    drive the real composition against a synthetic tree — a check() that only ever
    ran on the healthy repo would pass even if it returned nothing at all."""
    names = declared_command_names()
    problems = check_areas(names, root)
    for area in sorted(KNOWN_AREAS):
        problems += check_area(area, names, root)
    problems += check_records(
        names,
        os.path.join(root, REGISTRY),
        os.path.join(root, EXTENSIONS_YML),
    )
    problems += check_docs(names, DOCS if docs is None else docs)
    return sorted(problems)


def main() -> int:
    problems = check()
    if problems:
        print("[command-emissions] DRIFT")
        for p in problems:
            print("  -", p)
        return 1
    names = declared_command_names()
    areas = discover_areas(REPO_ROOT)
    agents = len(_registered_commands(os.path.join(REPO_ROOT, REGISTRY)))
    print(
        f"[command-emissions] OK — {len(names)} commands agree across {len(areas)} "
        f"install areas, {agents} agent records, and {len(DOCS)} documents"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
