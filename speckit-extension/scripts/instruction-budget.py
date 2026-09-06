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

Read-only. Exit 0 unless --strict is given and a command carries more directives
than the recorded high-water mark beside this script. That mark is a ratchet, not a
target: a body may always shed directives, and `--record` writes the lower number
back. Gating on the ideal ceiling instead would fail every build from the first one,
because the bodies are already over it, and a gate that is red on arrival gets
switched off rather than fixed.
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
#: What the bodies should reach, and what --ceiling flags them against.
DEFAULT_CEILING = 40

#: Per-command high-water marks. `--strict` fails a command that exceeds its own
#: entry, so the corpus can only get lighter. Regenerate with `--record`.
HIGH_WATER = os.path.join(HERE, "instruction-budget.json")

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
                    help="exit non-zero when a command carries more directives than its recorded mark")
    ap.add_argument("--record", action="store_true",
                    help="write the current counts back as the high-water marks")
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

    import json
    marks = {}
    if os.path.exists(HIGH_WATER):
        with open(HIGH_WATER, encoding="utf-8") as fh:
            marks = json.load(fh).get("commands", {})

    if args.record:
        with open(HIGH_WATER, "w", encoding="utf-8") as fh:
            json.dump({"ceiling": DEFAULT_CEILING,
                       "commands": {r["command"]: r["total"] for r in sorted(
                           rows, key=lambda r: r["command"])}}, fh, indent=2)
            fh.write("\n")
        print(f"\nRecorded {len(rows)} high-water marks in {os.path.basename(HIGH_WATER)}.")
        return 0

    if not args.strict:
        return 0

    risen = [(r, marks[r["command"]]) for r in rows
             if r["command"] in marks and r["total"] > marks[r["command"]]]
    new = [r for r in rows if r["command"] not in marks and r["total"] > args.ceiling]
    for r, mark in risen:
        print(f"{r['command']}: {r['total']} directives, up from {mark}. "
              f"Shed one elsewhere or run --record deliberately.", file=sys.stderr)
    for r in new:
        print(f"{r['command']}: new command at {r['total']} directives, over the "
              f"{args.ceiling} ceiling.", file=sys.stderr)
    lowered = [(r, marks[r["command"]]) for r in rows
               if r["command"] in marks and r["total"] < marks[r["command"]]]
    if lowered and not risen and not new:
        print("\nLighter than recorded: "
              + ", ".join(f"{r['command']} {mark}->{r['total']}" for r, mark in lowered)
              + ". Run --record to lock it in.")
    return 1 if (risen or new) else 0


if __name__ == "__main__":
    sys.exit(main())
