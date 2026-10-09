#!/usr/bin/env python3
"""Grades the scripted checks of surface-map.yml from the results the real-window check wrote, one PASS, FAIL or BLOCKED line per check."""
import argparse
import json
import re
import sys
from pathlib import Path

CHECK = re.compile(r"^  ([\w-]+): \{ kind: scripted,(.*)\}\s*$")
STEPS = re.compile(r"\bsteps: \[([^\]]*)\]")
BOTH = re.compile(r"\bthemes: both\b")


def scripted_checks(map_text):
    checks = []
    for line in map_text.splitlines():
        found = CHECK.match(line)
        if not found:
            if "kind: scripted" in line and not line.lstrip().startswith("#"):
                raise ValueError(f"cannot read this scripted check: {line.strip()[:80]}")
            continue
        steps = STEPS.search(found.group(2))
        names = [name.strip() for name in steps.group(1).split(",") if name.strip()] if steps else []
        checks.append((found.group(1), names, ["light", "dark"] if BOTH.search(found.group(2)) else ["light"]))
    return checks


def read_results(folder, theme):
    """The theme's steps by name, or None when the file is missing or unreadable."""
    try:
        entries = json.loads((Path(folder) / f"results.{theme}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(entries, list):
        return None
    return {entry.get("name"): entry for entry in entries if isinstance(entry, dict)}


def grade(steps, themes, folder):
    if not steps:
        return "BLOCKED", "the check names no steps"
    results = {}
    for theme in themes:
        results[theme] = read_results(folder, theme)
        if results[theme] is None:
            return "BLOCKED", f"results.{theme}.json not found in {folder}"
    for theme in themes:
        for name in steps:
            entry = results[theme].get(name)
            if entry is None:
                return "BLOCKED", f"{name} ({theme}) did not run"
            if entry.get("skipped"):
                return "BLOCKED", f"{name} ({theme}) was skipped"
            if entry.get("ok") is not True:
                return "FAIL", f"{name} ({theme}): {str(entry.get('note') or 'no note').splitlines()[0]}"
    return "PASS", f"{len(steps)} steps ok ({', '.join(themes)})"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, epilog="Exits 0 when every line is PASS, 1 otherwise, 2 when the map cannot be graded.")
    parser.add_argument("--map", required=True)
    parser.add_argument("--results", required=True)
    parser.add_argument("--check", action="append", default=[], help="grade only this check id; repeatable")
    args = parser.parse_args(argv)
    try:
        checks = scripted_checks(Path(args.map).read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        print(f"cannot read {args.map}: {error}", file=sys.stderr)
        return 2
    if not checks:
        print(f"{args.map} holds no scripted check", file=sys.stderr)
        return 2
    unknown = [name for name in args.check if name not in {check[0] for check in checks}]
    if unknown:
        print(f"not a scripted check: {', '.join(unknown)}", file=sys.stderr)
        return 2
    passed = True
    for check, steps, themes in checks:
        if args.check and check not in args.check:
            continue
        status, note = grade(steps, themes, args.results)
        passed = passed and status == "PASS"
        print(f"{check} {status}: {note}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
