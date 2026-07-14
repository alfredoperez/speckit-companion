#!/usr/bin/env python3
"""The packing list for the release archive — which scripts ship, for the CI gate and the publish flow.

`RUNTIME_SCRIPTS` is what goes into the archive. `--check` independently derives
what the shipped commands actually reach for (scan the command bodies for the
installed script path, then follow each script's sibling imports to a fixed point)
and asserts the derived closure equals the declared list in BOTH directions:

  - needed but not packaged  -> a command would break on a real install
  - packaged but unreachable -> dead weight, or the scanner missed a reference
  - unclassified             -> a new script with no ship/don't-ship decision
  - declared but absent      -> a typo, or a deleted script
  - referenced but missing   -> a command calls a script that exists nowhere
  - command file absent      -> extension.yml lists a command markdown that is gone

The declared list is kept rather than replaced by the derived set on purpose: a
bare derivation would make an unrecognized reference form silently drop a script,
which is the failure this gate exists to prevent. The two-way compare turns every
disagreement into a named, blocking error instead.

`--copy-to <dir>` fills an archive from the same list, so the shipped bits and the
gated list cannot disagree: it clears any leftover scripts already in the destination
so what lands there is exactly the list, and refuses a destination it cannot reduce to
the list safely (anything but `.py` files, or the source directory itself). Exit 0
clean, 1 on any problem. Stdlib only.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT_ROOT = os.path.dirname(HERE)

RUNTIME_SCRIPTS = frozenset({
    "write-context.py",
    "status-context.py",
    "derive-from-files.py",
    "resolve-spec-paths.py",
    "companion_config.py",
    "register-capability.py",
    "drift.py",
    "check-coverage.py",
})

BUILD_ONLY = frozenset({
    "build-commands.py",
    "check-shape-parity.py",
    "assemble-nodes.py",
    "capture-golden.py",
    "_command_parts.py",
    "package-manifest.py",
})

INSTALLED_SCRIPT_REF = re.compile(
    r"\.specify/extensions/companion/scripts/([A-Za-z0-9_.-]+\.py)"
)
MANIFEST_COMMAND_FILE = re.compile(r"^\s*file:\s*(\S+)", re.MULTILINE)
QUOTED_NAME = re.compile(r"""["']([A-Za-z0-9_.-]+)["']""")
PLAIN_IMPORT = re.compile(r"^\s*(?:import|from)\s+([A-Za-z0-9_]+)", re.MULTILINE)


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def _script_files() -> set[str]:
    return {f for f in os.listdir(HERE) if f.endswith(".py")}


def _resolve_sibling(name: str, existing: set[str]) -> str | None:
    """Map a candidate name to a sibling script, or None if it isn't one."""
    for candidate in (name, f"{name}.py"):
        if candidate in existing:
            return candidate
    return None


def declared_command_files() -> list[str]:
    """Every command file `extension.yml` declares, whether or not it exists."""
    manifest = os.path.join(EXT_ROOT, "extension.yml")
    if not os.path.exists(manifest):
        return []
    return [os.path.join(EXT_ROOT, rel) for rel in MANIFEST_COMMAND_FILE.findall(_read(manifest))]


def missing_command_files() -> list[str]:
    return sorted(
        os.path.relpath(p, EXT_ROOT) for p in declared_command_files() if not os.path.exists(p)
    )


def shipped_command_bodies() -> list[str]:
    """Every command file the manifest declares, plus the shipped workflows."""
    paths = [p for p in declared_command_files() if os.path.exists(p)]
    workflows = os.path.join(EXT_ROOT, "workflows")
    if os.path.isdir(workflows):
        for entry in sorted(os.listdir(workflows)):
            if entry.endswith((".yml", ".yaml", ".md")):
                paths.append(os.path.join(workflows, entry))
    return paths


def direct_refs() -> set[str]:
    """Scripts named outright by shipped command text."""
    found: set[str] = set()
    for path in shipped_command_bodies():
        found.update(INSTALLED_SCRIPT_REF.findall(_read(path)))
    return found


def sibling_deps(script: str, existing: set[str]) -> set[str]:
    """Sibling scripts that `script` imports, by any of the three forms used here:
    a plain import, an import_module of a hyphenated name, or a load-by-filename."""
    path = os.path.join(HERE, script)
    if not os.path.exists(path):
        return set()
    source = _read(path)
    candidates = set(QUOTED_NAME.findall(source)) | set(PLAIN_IMPORT.findall(source))
    deps = set()
    for name in candidates:
        resolved = _resolve_sibling(name, existing)
        if resolved and resolved != script:
            deps.add(resolved)
    return deps


def derive_closure() -> set[str]:
    """The roots plus everything reachable from them, to a fixed point."""
    existing = _script_files()
    closure: set[str] = set()
    pending = [s for s in direct_refs() if s in existing]
    while pending:
        script = pending.pop()
        if script in closure:
            continue
        closure.add(script)
        pending.extend(sibling_deps(script, existing) - closure)
    return closure


def check() -> list[str]:
    """Every disagreement between the declared list and reality. Empty means clean."""
    problems = []
    existing = _script_files()
    closure = derive_closure()

    for script in sorted(closure - RUNTIME_SCRIPTS):
        problems.append(
            f"needed but not packaged: {script} — a shipped command reaches it, "
            f"but it is not in RUNTIME_SCRIPTS, so a real install would break"
        )
    for script in sorted(RUNTIME_SCRIPTS - closure):
        problems.append(
            f"packaged but unreachable: {script} — nothing shipped reaches it. "
            f"Either drop it, or the reference scanner missed a real dependency"
        )
    for script in sorted(existing - RUNTIME_SCRIPTS - BUILD_ONLY):
        problems.append(
            f"unclassified: {script} — add it to RUNTIME_SCRIPTS (it ships) "
            f"or BUILD_ONLY (it does not)"
        )
    for script in sorted(RUNTIME_SCRIPTS - existing):
        problems.append(f"declared but absent: {script} — no such file in scripts/")
    for script in sorted(direct_refs() - existing):
        problems.append(
            f"referenced but missing: {script} — a shipped command calls it, "
            f"but no such file exists in scripts/"
        )
    for rel in missing_command_files():
        problems.append(
            f"command file absent: {rel} — extension.yml declares it under "
            f"provides.commands, but no such file exists, so nothing scans it"
        )
    return problems


def unsafe_dest(dest: str) -> str | None:
    """Why `dest` cannot be reduced to exactly the packing list, or None if it can.

    Only loose `.py` files are ever removed, so a mistyped path (`/`, a populated
    source tree, a directory holding anything else) is refused rather than emptied."""
    if os.path.realpath(dest) == os.path.realpath(HERE):
        return "it is the source scripts/ directory — clearing it would delete the build-only scripts"
    if not os.path.exists(dest):
        return None
    if not os.path.isdir(dest):
        return "it exists and is not a directory"
    strays = [
        entry
        for entry in sorted(os.listdir(dest))
        if not (entry.endswith(".py") and os.path.isfile(os.path.join(dest, entry)))
    ]
    if strays:
        return (
            f"it holds entries that are not packaged scripts ({', '.join(strays)}) and this "
            f"script only ever removes loose .py files — point --copy-to at an empty or fresh directory"
        )
    return None


def _copy_to(dest: str) -> int:
    problems = check()
    if problems:
        print("[package-manifest] refusing to build an archive from a failing list:")
        for problem in problems:
            print(f"  ✗ {problem}")
        return 1
    unsafe = unsafe_dest(dest)
    if unsafe:
        print(f"[package-manifest] refusing to fill {dest}: {unsafe}")
        return 1
    cleared = 0
    if os.path.isdir(dest):
        for entry in sorted(os.listdir(dest)):
            os.remove(os.path.join(dest, entry))
            cleared += 1
    os.makedirs(dest, exist_ok=True)
    for script in sorted(RUNTIME_SCRIPTS):
        shutil.copy2(os.path.join(HERE, script), os.path.join(dest, script))
    note = f" (cleared {cleared} pre-existing script(s))" if cleared else ""
    print(f"[package-manifest] copied {len(RUNTIME_SCRIPTS)} runtime scripts to {dest}{note}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true", help="gate the packing list")
    group.add_argument(
        "--copy-to",
        metavar="DIR",
        help="fill an archive from the list (clears leftover scripts in DIR first)",
    )
    group.add_argument("--list", action="store_true", help="print the packing list")
    args = parser.parse_args()

    if args.list:
        for script in sorted(RUNTIME_SCRIPTS):
            print(script)
        return 0

    if args.copy_to:
        return _copy_to(args.copy_to)

    problems = check()
    if problems:
        print("[package-manifest] FAIL — the packing list disagrees with the commands:")
        for problem in problems:
            print(f"  ✗ {problem}")
        return 1
    print(
        f"[package-manifest] OK — {len(RUNTIME_SCRIPTS)} runtime scripts, "
        f"closure matches the declared list"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
