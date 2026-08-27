#!/usr/bin/env python3
"""Assemble a namespaced Companion command body from its node files.

A command under nodes/<command>/ is composed of:
  1. `_frame.md`  — the non-reorderable preamble (command frontmatter + User Input
                    block + the `## Outline` lead-in). Verbatim, no node frontmatter.
  2. the nodes named in `_order.yml` (or a recipe override), each a markdown file
     with YAML frontmatter (id/kind/command/writes/reads) + a body; bodies are
     concatenated in order.
Then the assembled text passes the existing part-fence step (shared with
build-commands.py) so inner ``<!-- speckit-companion:part NAME -->`` fences fill,
and — when present — the orchestrator part is appended.

This is a behavior-preserving refactor: the output must equal the frozen golden
(tests/golden/commands/) byte-for-byte. Default mode writes each command body;
`--check` re-assembles in memory and exits 1 + a diff on any drift from golden.
Stdlib only.
"""
import difflib
import importlib
import json
import os
import sys

from _command_parts import (
    DEBUG_TIMING,
    EXT,
    append_part,
    debug_on,
    decomposed_commands,
    fill_parts,
    golden_path,
    nodes_command_dir,
    parse_order,
    parse_phases,
    part_path,
    read_node,
    strip_node_markers,
)

ORCHESTRATOR = "orchestrator"


def _wrap_node(node_id: str, body: str) -> str:
    """Fence one node's contribution with its boundary markers.

    Pure line insertion: a marker line goes before the body and another after it,
    and the body is not touched — no trimming, no added or removed blank lines.
    That makes wrapping the exact inverse of `strip_node_markers`, which is the
    property `--check` leans on to prove the markers changed nothing.

    Node bodies end with a newline (the reader guarantees it), so the closing
    marker always starts at a line boundary.
    """
    if not body.endswith("\n"):
        body += "\n"
    return (
        f"<!-- speckit-companion:node {node_id} -->\n"
        f"{body}"
        f"<!-- /speckit-companion:node {node_id} -->\n"
    )


def phases_for(command: str, order: list) -> list:
    """The phase grouping for an order — `[{name, nodes}, ...]`.

    A command whose `_order.yml` declares no phases gets none, and assembles
    exactly as it did before. When a recipe changes the order, each phase keeps
    only the nodes the recipe still runs, and a phase left with nothing is
    dropped rather than rendered empty.
    """
    declared = parse_phases(os.path.join(nodes_command_dir(command), "_order.yml"))
    if not declared:
        return []
    kept = set(order)
    grouped = []
    seen = set()
    for phase in declared:
        nodes = [n for n in phase["nodes"] if n in kept]
        if nodes:
            grouped.append({"name": phase["name"], "nodes": nodes})
            seen.update(nodes)
    # A recipe may name a node no phase claims. It still runs — order is the
    # authority — so it goes in a trailing phase rather than being dropped.
    unclaimed = [n for n in order if n not in seen]
    if unclaimed:
        grouped.append({"name": "other", "nodes": unclaimed})
    return grouped


def _wrap_phase(name: str, body: str) -> str:
    """Fence one phase's nodes. Pure line insertion, like the node markers."""
    if not body.endswith("\n"):
        body += "\n"
    return (
        f"<!-- speckit-companion:phase {name} -->\n"
        f"{body}"
        f"<!-- /speckit-companion:phase {name} -->\n"
    )


def assemble_command(command: str, order: list = None, debug: bool = False,
                     markers: bool = True) -> str:
    """Return the full command body assembled from nodes/<command>/.

    With `debug`, the debug-timing part is appended after the orchestrator part.
    Without it the part is absent from the output entirely — not present and
    inactive — so an off render stays byte-identical to the frozen golden.

    Each node's contribution is fenced with its id so a hook or a replacement can
    name an exact point in the finished command. `markers=False` renders the same
    body without them, which is what the golden comparison uses.
    """
    cdir = nodes_command_dir(command)
    frame_path = os.path.join(cdir, "_frame.md")
    out = ""
    if os.path.isfile(frame_path):
        with open(frame_path, encoding="utf-8") as fh:
            out = fh.read()

    ids = order if order is not None else parse_order(os.path.join(cdir, "_order.yml"))

    def node_text(node_id: str) -> str:
        _, body = read_node(command, node_id)
        return _wrap_node(node_id, body) if markers else body

    grouped = phases_for(command, ids) if markers else []
    if grouped:
        for phase in grouped:
            out += _wrap_phase(phase["name"], "".join(node_text(n) for n in phase["nodes"]))
    else:
        for node_id in ids:
            out += node_text(node_id)

    rel = f"commands/speckit.companion.{command}.md"
    out = fill_parts(out, rel)

    if os.path.isfile(part_path(ORCHESTRATOR)):
        out = append_part(out, ORCHESTRATOR)
    if debug and os.path.isfile(part_path(DEBUG_TIMING)):
        out = append_part(out, DEBUG_TIMING)
    return out


def default_order(command: str) -> list:
    return parse_order(os.path.join(nodes_command_dir(command), "_order.yml"))


def node_reads_map(command: str, order: list) -> dict:
    """{node_id: reads_list} for every node in an order — input to validate_reads."""
    return {nid: (read_node(command, nid)[0].get("reads") or []) for nid in order}


def command_path(command: str) -> str:
    return os.path.join(EXT, "commands", f"speckit.companion.{command}.md")


def _report_budget(commands) -> None:
    """Print each assembled command's directive count, own vs shared.

    Printed here because assembly is the moment the number changes, and so the
    only moment anyone is placed to act on it. Measured-but-unreported is how a
    command reached seventy-five directives unremarked — and how it went unnoticed
    that most of that load is the shared parts, which every additional dispatch
    would re-pay.

    Never fails the build. This reports; `instruction-budget.py --strict` gates.
    """
    try:
        budget = importlib.import_module("instruction-budget")
    except Exception:  # noqa: BLE001 — reporting must never break assembly
        return
    rows = []
    for command in commands:
        path = command_path(command)
        if os.path.isfile(path):
            rows.append(budget.measure(path))
    if not rows:
        return
    rows.sort(key=lambda r: -r["total"])
    parts = []
    for r in rows:
        name = r["command"]
        if name.startswith("speckit.companion."):
            name = name[len("speckit.companion."):]
        if name.endswith(".md"):
            name = name[: -len(".md")]
        parts.append(f"{name} {r['total']} ({r['own']} own)")
    print("[assemble] directives — " + ", ".join(parts))


def _report_manifest(write: bool) -> None:
    """State what a run of the assembled pipeline is expected to produce.

    A build that cannot say what it will write cannot be checked against what a
    run actually wrote, which is how a step that stopped producing its document
    looked identical to one that produced it.

    Never fails the build — the manifest reports; the run checks against it.
    """
    try:
        manifest_mod = importlib.import_module("manifest")
        manifest = manifest_mod.build()
    except Exception:  # noqa: BLE001 — reporting must never break assembly
        return
    print(manifest_mod.render(manifest))
    if write:
        try:
            with open(manifest_mod.MANIFEST_PATH, "w", encoding="utf-8") as fh:
                json.dump(manifest, fh, indent=2)
                fh.write("\n")
        except OSError as err:
            print(f"[assemble] could not write the manifest: {err}")


def main() -> int:
    check = "--check" in sys.argv[1:]
    commands = decomposed_commands()
    if not commands:
        print("[assemble] no nodes/<command>/ dirs — nothing to assemble")
        return 0

    # Opt-in per invocation, never from ambient config: these bodies are committed,
    # gated artifacts, and `--check` always compares the OFF render.
    debug = "--debug" in sys.argv[1:] and not check
    if debug:
        print("[assemble] --debug — bodies carry timing instrumentation (do not commit)")

    drift = []
    for command in commands:
        assembled = assemble_command(command, debug=debug)
        gpath = golden_path(f"commands/speckit.companion.{command}.md")
        if check:
            if not os.path.isfile(gpath):
                drift.append((command, f"missing golden for {command}"))
                continue
            with open(gpath, encoding="utf-8") as fh:
                golden = fh.read()
            # The goldens stay marker-free, so this comparison is what proves the
            # boundaries are additive: strip the marker lines and the body must be
            # byte-identical to the contract frozen before they existed.
            if strip_node_markers(assembled) != golden:
                diff = "".join(
                    difflib.unified_diff(
                        golden.splitlines(keepends=True),
                        strip_node_markers(assembled).splitlines(keepends=True),
                        fromfile=f"{command} (golden)",
                        tofile=f"{command} (assembled)",
                    )
                )
                drift.append((command, diff))
        else:
            open(command_path(command), "w", encoding="utf-8").write(assembled)

    if check and drift:
        print("[assemble] DRIFT — assembled bodies differ from golden:")
        for command, diff in drift:
            print(f"  - {command}")
            print(diff)
        return 1
    verb = "checked" if check else "assembled"
    print(f"[assemble] OK — {verb} {len(commands)} command bodies from nodes")
    _report_budget(commands)
    _report_manifest(write=not check)
    return 0


if __name__ == "__main__":
    sys.exit(main())
