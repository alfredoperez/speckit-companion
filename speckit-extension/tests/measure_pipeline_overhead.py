#!/usr/bin/env python3
"""Quantify the shared-part boilerplate that repeats across a Companion auto run.

Every `/speckit.companion.*` pipeline command inlines the shared parts (timing,
orchestrator, self-advance, speckit-hooks, …) verbatim via the part-fence
mechanism. In a single-session auto run every step dispatches, so a part shared
by K of the dispatched steps ships K times — K-1 of those are pure repeat after
the first delivery. This reports that redundant footprint honestly, from the
assembled command bodies on disk, so the number tracks the real files.

Run: `python3 speckit-extension/tests/measure_pipeline_overhead.py`
Named `measure_*` (not `test_*`) so `unittest discover` skips it. Stdlib only.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scripts"))
from _command_parts import EXT, PART_FENCE  # noqa: E402

# A representative single-session auto run: the steps that dispatch in order.
RUN = ["specify", "plan", "tasks", "implement"]


def est_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars/token, the common English heuristic."""
    return round(len(text) / 4)


def parts_in(command: str) -> dict:
    """{part_name: inner_text} for every part fence in an assembled command body."""
    path = os.path.join(EXT, "commands", f"speckit.companion.{command}.md")
    with open(path, encoding="utf-8") as fh:
        return {name: body for name, body in PART_FENCE.findall(fh.read())}


def measure(run: list) -> dict:
    per_command = {c: parts_in(c) for c in run}
    # deliveries[part] = list of commands that inline it, in run order.
    deliveries: dict = {}
    bodies: dict = {}
    for c in run:
        for name, body in per_command[c].items():
            deliveries.setdefault(name, []).append(c)
            bodies[name] = body

    rows = []
    total_redundant = 0
    for name in sorted(deliveries, key=lambda n: -est_tokens(bodies[n]) * (len(deliveries[n]) - 1)):
        count = len(deliveries[name])
        tok = est_tokens(bodies[name])
        words = len(bodies[name].split())
        redundant = tok * (count - 1)
        total_redundant += redundant
        rows.append((name, count, words, tok, redundant))
    return {"rows": rows, "total_redundant": total_redundant, "per_command": per_command}


def main() -> int:
    result = measure(RUN)
    print(f"Representative auto run: {' -> '.join(RUN)}\n")
    print(f"{'part':<16}{'dispatches':>11}{'words':>8}{'tokens':>8}{'redundant':>11}")
    print("-" * 54)
    for name, count, words, tok, redundant in result["rows"]:
        print(f"{name:<16}{count:>11}{words:>8}{tok:>8}{redundant:>11}")
    print("-" * 54)
    print(f"{'TOTAL redundant tokens after first delivery':<43}{result['total_redundant']:>11}")
    print(
        f"\n{result['total_redundant']} redundant tokens ship across the {len(RUN)}-step run "
        "(every shared part after its first delivery)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
