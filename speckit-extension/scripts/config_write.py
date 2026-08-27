"""Write one key back into `.specify/companion.yml` without disturbing the rest.

The reader in `companion_config.py` parses a constrained subset; this writes a
single `commands.<command>.nodes` list back into the same file as TEXT. It is
deliberately not a YAML emitter: a project's configuration is a file people read
and review, and round-tripping it through a parser would reformat comments,
blank lines and quoting that someone chose on purpose.

So the edit is surgical — replace the existing `nodes:` value for that command,
or insert one — and everything outside those lines comes through byte-identical.

Stdlib only.
"""
from __future__ import annotations

import os
import re

INDENT = "  "

#: A `key:` that opens a block, capturing its indent.
_KEY = re.compile(r"^(\s*)([A-Za-z0-9_.\"'-]+):\s*(.*)$")


class ConfigWriteError(Exception):
    """The file could not be edited without guessing at what someone meant."""


def _indent_of(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _is_blank(line: str) -> bool:
    return not line.strip() or line.lstrip().startswith("#")


def _find_key(lines: list, key: str, start: int, end: int, indent: int):
    """The index of `key:` at exactly `indent` within [start, end), or None."""
    for i in range(start, end):
        if _is_blank(lines[i]):
            continue
        match = _KEY.match(lines[i])
        if match and len(match.group(1)) == indent and match.group(2).strip("\"'") == key:
            return i
    return None


def _block_end(lines: list, start: int, indent: int, limit: int) -> int:
    """Where the block opened at `start` stops — the first line back at `indent` or less."""
    for i in range(start + 1, limit):
        if _is_blank(lines[i]):
            continue
        if _indent_of(lines[i]) <= indent:
            return i
    return limit


def _render_nodes(nodes: list, indent: str) -> list:
    """A `nodes:` block sequence. One node per line, which is what a diff wants."""
    return [f"{indent}nodes:"] + [f"{indent}{INDENT}- {node}" for node in nodes]


def set_nodes(text: str, command: str, nodes: list) -> str:
    """Return `text` with `commands.<command>.nodes` set to `nodes`.

    Creates the `commands:` and `<command>:` blocks when they are absent. An
    existing `nodes:` is replaced whether it was written as a block sequence or
    inline. Everything else in the file is untouched.
    """
    if not nodes:
        raise ConfigWriteError("refusing to write an empty node list — that is not a pipeline")

    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text

    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        block = ["commands:", f"{INDENT}{command}:"] + _render_nodes(nodes, INDENT * 2)
        body = lines + ([""] if lines and lines[-1].strip() else []) + block
        return "\n".join(body) + ("\n" if trailing_newline else "")

    commands_end = _block_end(lines, commands_at, 0, len(lines))
    # The indent a command entry sits at — taken from the file, not assumed, so
    # a configuration written with four spaces stays written with four.
    cmd_indent = next(
        (_indent_of(lines[i]) for i in range(commands_at + 1, commands_end)
         if not _is_blank(lines[i])),
        len(INDENT),
    )

    command_at = _find_key(lines, command, commands_at + 1, commands_end, cmd_indent)
    if command_at is None:
        block = [f"{' ' * cmd_indent}{command}:"] + _render_nodes(nodes, ' ' * (cmd_indent * 2))
        out = lines[:commands_end] + block + lines[commands_end:]
        return "\n".join(out) + ("\n" if trailing_newline else "")

    command_end = _block_end(lines, command_at, cmd_indent, commands_end)
    key_indent = next(
        (_indent_of(lines[i]) for i in range(command_at + 1, command_end)
         if not _is_blank(lines[i])),
        cmd_indent * 2,
    )

    nodes_at = _find_key(lines, "nodes", command_at + 1, command_end, key_indent)
    block = _render_nodes(nodes, " " * key_indent)
    if nodes_at is None:
        out = lines[:command_at + 1] + block + lines[command_at + 1:]
    else:
        nodes_end = _block_end(lines, nodes_at, key_indent, command_end)
        out = lines[:nodes_at] + block + lines[nodes_end:]
    return "\n".join(out) + ("\n" if trailing_newline else "")


def write_nodes(path: str, command: str, nodes: list) -> str:
    """Apply `set_nodes` to the file at `path`, creating it if absent."""
    text = ""
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    updated = set_nodes(text, command, nodes)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(updated)
    return updated


def _quote(value: str) -> str:
    """A quoted scalar this project's reader gives back unchanged.

    The constrained subset strips a matching pair of quotes and does not
    unescape, so `\\"` would read back literally. There is therefore no escape to
    reach for: pick the quote the value does not contain, and refuse a value that
    contains both rather than write one that reads back wrong.
    """
    text = str(value)
    if "\n" in text:
        raise ConfigWriteError("a hook's text has to be one line here — edit companion.yml for more")
    if '"' not in text:
        return f'"{text}"'
    if "'" not in text:
        return f"'{text}'"
    raise ConfigWriteError(
        "this text mixes both quote characters, which this file's format cannot "
        "hold on one line — edit companion.yml directly"
    )


def _hook_line(hook: dict) -> str:
    """One hook as an inline flow map — one line, which is what a diff wants."""
    pairs = [f"type: {hook['type']}"]
    for key in ("ref", "run", "text"):
        if hook.get(key):
            pairs.append(f"{key}: {_quote(hook[key])}")
    return "{ " + ", ".join(pairs) + " }"


def add_hook(text: str, command: str, when: str, anchor: str, hook: dict) -> str:
    """Return `text` with one hook appended under `commands.<command>.hooks.<when>.<anchor>`.

    Appended, never replaced: hooks at one anchor run in declared order, so a
    second one is a second line rather than an overwrite. Every level of nesting
    that is missing gets created; everything present is left as it was.
    """
    if when not in ("before", "after"):
        raise ConfigWriteError(f"a hook runs before or after, not '{when}'")
    if hook.get("type") not in ("command", "prompt", "node", "skill"):
        raise ConfigWriteError(f"unknown hook type '{hook.get('type')}'")
    if hook["type"] in ("node", "skill") and not str(hook.get("ref", "")).strip():
        raise ConfigWriteError(f"a {hook['type']} hook needs a ref")
    if hook["type"] == "prompt" and not str(hook.get("text", "")).strip():
        raise ConfigWriteError("a prompt hook needs its text")
    if hook["type"] == "command" and not str(hook.get("run", "")).strip():
        raise ConfigWriteError("a command hook needs something to run")

    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text
    line = _hook_line(hook)

    def emit(indent: int, *keys: str) -> list:
        """The missing nesting, each level one deeper, ending with the hook."""
        out = []
        for depth, key in enumerate(keys):
            out.append(f"{' ' * (indent + depth * len(INDENT))}{key}:")
        return out + [f"{' ' * (indent + len(keys) * len(INDENT))}- {line}"]

    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        block = ["commands:"] + emit(len(INDENT), command, "hooks", when, anchor)
        body = lines + ([""] if lines and lines[-1].strip() else []) + block
        return "\n".join(body) + ("\n" if trailing_newline else "")

    commands_end = _block_end(lines, commands_at, 0, len(lines))
    cmd_indent = next(
        (_indent_of(lines[i]) for i in range(commands_at + 1, commands_end)
         if not _is_blank(lines[i])),
        len(INDENT),
    )
    command_at = _find_key(lines, command, commands_at + 1, commands_end, cmd_indent)
    if command_at is None:
        block = emit(cmd_indent, command, "hooks", when, anchor)
        out = lines[:commands_end] + block + lines[commands_end:]
        return "\n".join(out) + ("\n" if trailing_newline else "")

    # Walk hooks -> when -> anchor, creating the first level that is absent.
    at, end, indent = command_at, _block_end(lines, command_at, cmd_indent, commands_end), cmd_indent
    for depth, key in enumerate(("hooks", when, anchor)):
        step = next(
            (_indent_of(lines[i]) for i in range(at + 1, end) if not _is_blank(lines[i])),
            indent + len(INDENT),
        )
        found = _find_key(lines, key, at + 1, end, step)
        if found is None:
            block = emit(step, *("hooks", when, anchor)[depth:])
            out = lines[:at + 1] + block + lines[at + 1:]
            return "\n".join(out) + ("\n" if trailing_newline else "")
        at, indent = found, step
        end = _block_end(lines, found, step, end)

    # The anchor exists: append after its last entry, keeping declared order.
    last = max((i for i in range(at + 1, end) if not _is_blank(lines[i])), default=at)
    item_indent = _indent_of(lines[last]) if last > at else indent + len(INDENT)
    out = lines[:last + 1] + [f"{' ' * item_indent}- {line}"] + lines[last + 1:]
    return "\n".join(out) + ("\n" if trailing_newline else "")


def check_order(command: str, nodes: list) -> None:
    """Refuse an order the pipeline cannot honour, before it reaches the file.

    A configuration that is written and then refused at every build is worse
    than one that was never written: the panel would show the new order and the
    assistant would keep reading the old body.
    """
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    assemble = importlib.import_module("assemble-nodes")
    import companion_config as cc

    default = assemble.default_order(command)
    unknown = [n for n in nodes if n not in default]
    if unknown:
        raise ConfigWriteError(f"{command}: no such node: {', '.join(unknown)}")
    if sorted(nodes) != sorted(set(nodes)):
        raise ConfigWriteError(f"{command}: the same node is listed twice")

    stray = assemble.unexpressible_order(command, nodes)
    if stray:
        raise ConfigWriteError(
            f"{command}: '{stray}' would move across a phase boundary. A phase is one "
            f"contiguous run of the command, so a node can only be reordered within its own."
        )
    try:
        cc.validate_reads(assemble.node_reads_map(command, nodes))
    except cc.ConfigError as err:
        raise ConfigWriteError(f"{command}: {err}") from err

    rank = {node_id: i for i, node_id in enumerate(nodes)}
    for node_id in nodes:
        meta, _body = __import__("_command_parts").read_node(command, node_id)
        for dep in meta.get("reads") or []:
            if dep in rank and rank[dep] > rank[node_id]:
                raise ConfigWriteError(
                    f"{command}: '{node_id}' reads '{dep}', so it cannot run before it."
                )


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project", default=os.getcwd())
    ap.add_argument("--command", required=True)
    ap.add_argument("--nodes", help="comma-separated node ids, in order")
    ap.add_argument("--hook", help="hook type: command | prompt | node | skill")
    ap.add_argument("--when", choices=("before", "after"))
    ap.add_argument("--anchor", help="the node or phase the hook attaches to")
    ap.add_argument("--ref", default="")
    ap.add_argument("--run", default="")
    ap.add_argument("--text", default="")
    args = ap.parse_args()

    path = os.path.join(os.path.abspath(args.project), ".specify", "companion.yml")
    try:
        if args.hook:
            if not args.when or not args.anchor:
                raise ConfigWriteError("a hook needs --when and --anchor")
            hook = {"type": args.hook, "ref": args.ref, "run": args.run, "text": args.text}
            existing = ""
            if os.path.isfile(path):
                with open(path, encoding="utf-8") as fh:
                    existing = fh.read()
            updated = add_hook(existing, args.command, args.when, args.anchor, hook)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(updated)
            print(f"[config] {args.command}: {args.hook} hook added {args.when} {args.anchor}")
            return 0

        if not args.nodes:
            raise ConfigWriteError("nothing to write — pass --nodes or --hook")
        nodes = [n.strip() for n in args.nodes.split(",") if n.strip()]
        check_order(args.command, nodes)
        write_nodes(path, args.command, nodes)
    except ConfigWriteError as err:
        print(f"[config] {err}")
        return 1
    print(f"[config] {args.command}: order saved to .specify/companion.yml")
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
