"""Loader + merge contract for `.specify/companion.yml` (the node-hook / recipe config).

The orchestrator is PROSE — at run time the AI reads `companion.yml` and acts on
it. This module is the executable spec of that contract: it parses the same file,
merges hooks in declared order, resolves a recipe's node-list override, validates
`reads:` against the active node set, and applies the failure table. CI unit-tests
it so the prose and the code never drift.

Failure table (mirrors mark-complete's "never fail the host command" tone):
  - absent companion.yml      -> shipped defaults, no warning
  - malformed companion.yml   -> shipped defaults + a warning
  - hook anchor not in recipe -> warn + skip that anchor's hooks
  - type: node, ref: missing  -> error

Stdlib only — includes a minimal YAML reader for the constrained config subset
(block maps, block seqs, inline flow maps/seqs, quoted/bare scalars). Anything
outside that subset raises, which the loader surfaces as "malformed".
"""
from __future__ import annotations

import os

HOOK_TYPES = {"command", "prompt", "node"}
WHENS = ("before", "after")


class ConfigError(Exception):
    """Raised for a hard failure-table case (e.g. type: node ref missing)."""


# --------------------------------------------------------------------------- #
# Minimal YAML reader (constrained subset)
# --------------------------------------------------------------------------- #
def _split_flow(s: str) -> list:
    """Split a flow body on top-level commas, respecting quotes and nesting."""
    out, buf, depth, quote = [], [], 0, None
    for ch in s:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
            buf.append(ch)
        elif ch in "[{":
            depth += 1
            buf.append(ch)
        elif ch in "]}":
            depth -= 1
            buf.append(ch)
        elif ch == "," and depth == 0:
            out.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if "".join(buf).strip():
        out.append("".join(buf))
    return out


def _scalar(s: str):
    s = s.strip()
    if not s:
        return None
    if s[0] in "\"'" and s[-1] == s[0]:
        return s[1:-1]
    if s.lstrip("-").isdigit():
        return int(s)
    if s in ("true", "false"):
        return s == "true"
    return s


def _parse_flow(s: str):
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        body = s[1:-1].strip()
        return [_parse_flow(x) for x in _split_flow(body)] if body else []
    if s.startswith("{") and s.endswith("}"):
        body = s[1:-1].strip()
        out = {}
        for piece in _split_flow(body):
            if ":" not in piece:
                raise ValueError(f"flow map entry without ':' -> {piece!r}")
            k, v = piece.split(":", 1)
            out[k.strip()] = _parse_flow(v)
        return out
    return _scalar(s)


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _strip_comment(line: str) -> str:
    """Drop a trailing `# …` comment. A `#` is a comment only at line start or after
    whitespace and outside quotes — so `run: "echo #x"` and `a#b` keep their hash."""
    quote = None
    for i, ch in enumerate(line):
        if quote:
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i].rstrip()
    return line


def _starts_block_map(rest: str) -> bool:
    """True for a seq item that opens a block mapping (`key: val`), not a scalar.
    A colon followed by end-or-space marks the key/value split; `http://x` (colon
    then `/`) and bare scalars (`resolve-dir`) stay scalars."""
    ci = rest.find(":")
    return ci != -1 and (ci + 1 == len(rest) or rest[ci + 1] == " ")


def load_yaml(text: str):
    """Parse the constrained YAML subset into nested dict/list. Raises on the rest."""
    lines = [stripped for ln in text.split("\n") if (stripped := _strip_comment(ln)).strip()]
    pos = [0]

    def parse_block(min_indent: int):
        if pos[0] >= len(lines):
            return None
        first = lines[pos[0]]
        ind = _indent(first)
        if ind < min_indent:
            return None
        is_seq = first.lstrip().startswith("- ")
        return _parse_seq(ind) if is_seq else _parse_map(ind)

    def _parse_seq(ind: int):
        items = []
        while pos[0] < len(lines):
            line = lines[pos[0]]
            if _indent(line) != ind or not line.lstrip().startswith("- "):
                break
            rest = line.lstrip()[2:].strip()
            pos[0] += 1
            if rest.startswith("{") or rest.startswith("["):
                items.append(_parse_flow(rest))
            elif _starts_block_map(rest):
                # block-mapping item ("- key: val" + deeper-indented keys): re-anchor
                # the line at the key column and let _parse_map gather the whole entry.
                item_indent = ind + 2
                pos[0] -= 1
                lines[pos[0]] = " " * item_indent + rest
                items.append(_parse_map(item_indent))
            elif rest:
                items.append(_scalar(rest))
            else:
                items.append(parse_block(ind + 1))
        return items

    def _parse_map(ind: int):
        out = {}
        while pos[0] < len(lines):
            line = lines[pos[0]]
            if _indent(line) != ind or line.lstrip().startswith("- "):
                break
            stripped = line.strip()
            if ":" not in stripped:
                raise ValueError(f"map line without ':' -> {stripped!r}")
            key, val = stripped.split(":", 1)
            key, val = key.strip(), val.strip()
            pos[0] += 1
            if not val:
                out[key] = parse_block(ind + 1)
            elif val.startswith("{") or val.startswith("["):
                out[key] = _parse_flow(val)
            else:
                out[key] = _scalar(val)
        return out

    result = parse_block(0)
    return result if result is not None else {}


# --------------------------------------------------------------------------- #
# Loader + contract
# --------------------------------------------------------------------------- #
def load_config(path: str):
    """Return (config_dict, warnings). Absent -> ({}, []). Malformed -> ({}, [warn])."""
    if not os.path.isfile(path):
        return {}, []
    try:
        with open(path, encoding="utf-8") as fh:
            cfg = load_yaml(fh.read())
        if cfg is None:
            cfg = {}
        if not isinstance(cfg, dict):
            raise ValueError("top level must be a mapping")
        return cfg, []
    except Exception as exc:  # noqa: BLE001 — any parse failure degrades to defaults
        return {}, [f"malformed companion.yml ({exc}); using shipped defaults"]


def resolve_order(config: dict, command: str, default_order: list) -> list:
    """A recipe's `nodes: [...]` replaces the default order; else the default."""
    cmd = (config.get("commands") or {}).get(command) or {}
    nodes = cmd.get("nodes")
    return list(nodes) if isinstance(nodes, list) and nodes else list(default_order)


def merge_hooks(config: dict, command: str, active_nodes: list, nodes_dir: str = None):
    """Return (ordered_hooks, warnings).

    ordered_hooks is a flat list of dicts: {when, anchor, index, hook}. Hooks at a
    given (when, anchor) keep their declared order. An anchor not in active_nodes is
    warned + skipped. A `type: node` hook with no `ref` always raises ConfigError;
    when `nodes_dir` is given, a `ref` whose `.md` file is absent also raises.
    """
    warnings = []
    ordered = []
    active = set(active_nodes)
    cmd = (config.get("commands") or {}).get(command) or {}
    hooks = cmd.get("hooks") or {}
    for when in WHENS:
        anchors = hooks.get(when) or {}
        if not isinstance(anchors, dict):
            continue
        for anchor, hook_list in anchors.items():
            if anchor not in active:
                warnings.append(f"hook anchor '{anchor}' for {command}.{when} not in active recipe — skipped")
                continue
            if not isinstance(hook_list, list):
                hook_list = [hook_list]
            for i, hook in enumerate(hook_list):
                if not isinstance(hook, dict) or hook.get("type") not in HOOK_TYPES:
                    warnings.append(f"ignoring malformed hook at {command}.{when}.{anchor}[{i}]")
                    continue
                if hook["type"] == "node":
                    ref = hook.get("ref")
                    ref_path = os.path.join(nodes_dir, f"{ref}.md") if nodes_dir else None
                    if not ref or (ref_path and not os.path.isfile(ref_path)):
                        raise ConfigError(
                            f"hook {command}.{when}.{anchor}[{i}] type:node ref '{ref}' has no node file"
                        )
                ordered.append({"when": when, "anchor": anchor, "index": i, "hook": hook})
    return ordered, warnings


def validate_reads(active_meta: dict):
    """active_meta: {node_id: reads_list}. A kept node reading a dropped node is an error."""
    active = set(active_meta)
    for node_id, reads in active_meta.items():
        for dep in reads or []:
            if dep not in active:
                raise ConfigError(
                    f"node '{node_id}' reads dropped node '{dep}' — recipe broke the pipeline"
                )
