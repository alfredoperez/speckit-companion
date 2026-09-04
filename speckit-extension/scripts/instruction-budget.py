#!/usr/bin/env python3
"""Count the directives each assembled command carries, and say where they come from.

Instruction adherence diffuses past roughly forty directives in one prompt — a model
half-attends to everything rather than failing loudly, so which rules land becomes a
lottery. That number is only actionable if somebody can see it, and until now nothing
in this repository counted anything: the figure could only be produced by hand.

The split matters as much as the total. A command is its own nodes plus the shared
parts injected into every command. If most of the load is shared, then splitting nodes
into separate dispatches makes the problem worse rather than better, because each
dispatch re-pays the shared half. Read the `own` column before designing around this.

Read-only. Exit 0 unless --strict is given and a command is over the ceiling.
"""
from __future__ import annotations

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)
COMMANDS = os.path.join(EXT, "commands")
PARTS = os.path.join(EXT, "presets", "_parts")

sys.path.insert(0, HERE)
# The fence pattern is imported, not restated: a second copy here meant a change
# to the marker syntax silently stopped this script splitting own from shared,
# and it would have gone on reporting a number.
from _command_parts import PART_FENCE as _PART_FENCE  # noqa: E402

#: Horthy's threshold, the point past which adherence is understood to diffuse.
DEFAULT_CEILING = 40

_FRONTMATTER = re.compile(r"\A---\n.*?\n---\n", re.S)
_FENCED_CODE = re.compile(r"```.*?```", re.S)


def directives(text: str) -> int:
    """Count the instructions a reader is expected to obey.

    A directive is a numbered step, a list item, or a bolded lead-in that opens a
    paragraph — the shapes this corpus uses to tell the model to do something.
    Fenced code is excluded: it is what the model runs, not another thing to
    remember. Headings and prose continuation lines are excluded for the same reason.
    """
    text = _FRONTMATTER.sub("", text)
    text = _FENCED_CODE.sub("", text)
    n = 0
    for raw in text.split("\n"):
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("<!--"):
            continue
        if re.match(r"^(\d+[.)]|[-*+])\s+\S", line):
            n += 1
        elif re.match(r"^\*\*[^*]+\*\*", line):
            n += 1
    return n


def measure(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        body = fh.read()
    shared = {}
    for m in _PART_FENCE.finditer(body):
        shared[m.group(1)] = directives(m.group(2))
    own = directives(_PART_FENCE.sub("", body))
    return {
        "command": os.path.basename(path),
        "own": own,
        "shared": sum(shared.values()),
        "total": own + sum(shared.values()),
        "parts": shared,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ceiling", type=int, default=DEFAULT_CEILING)
    ap.add_argument("--json", dest="as_json", action="store_true")
    ap.add_argument("--strict", action="store_true",
                    help="exit non-zero when a command is over the ceiling")
    args = ap.parse_args()

    rows = [measure(os.path.join(COMMANDS, f))
            for f in sorted(os.listdir(COMMANDS)) if f.endswith(".md")]
    rows.sort(key=lambda r: -r["total"])

    if args.as_json:
        import json
        print(json.dumps({"ceiling": args.ceiling, "commands": rows}, indent=2))
    else:
        print(f"{'command':46} {'own':>5} {'shared':>7} {'total':>6}  over?")
        for r in rows:
            flag = "  ⚠" if r["total"] > args.ceiling else ""
            print(f"{r['command']:46} {r['own']:>5} {r['shared']:>7} {r['total']:>6}{flag}")
        worst = rows[0]
        if worst["shared"] > worst["own"]:
            print(f"\nMost of {worst['command']}'s load is shared, not its own: "
                  f"{worst['shared']} of {worst['total']}. Splitting its nodes into separate "
                  f"dispatches would re-pay the shared half each time.")

    over = [r for r in rows if r["total"] > args.ceiling]
    if args.strict and over:
        print(f"\n{len(over)} command(s) over the {args.ceiling}-directive ceiling.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
