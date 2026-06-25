#!/usr/bin/env python3
"""Append one Living-Specs capability to `.specify/companion.yml` (LS·5 adoption).

The deterministic half of the brownfield adoption wizard. The wizard's prose
drafts a living spec from a code area's surface; this helper does the one part
that must be exact and idempotent: register the confirmed capability so the
shipped resolver starts recognizing it.

Contract (incremental, never a whole-repo bootstrap):
  - absent config      -> create a minimal well-formed `livingSpecs` block
                          (enabled: true) carrying the one capability.
  - name not present   -> append the capability; every existing capability and
                          unrelated config is preserved.
  - name present       -> no-op; file byte-identical; reported on stderr.
  - malformed config   -> refuse to write (exit 2); the file is never truncated
                          or overwritten — fix the parse error first.

Reuses `companion_config` (the LS·1 reader) so the registry never diverges from
the parser the rest of the pipeline trusts. Stdlib only.

Usage:
  register-capability.py --name billing --match "src/billing/**" [--match …]
                         [--exclude …] [--spec capabilities/billing/spec.md]
                         [--root .] [--json]
"""
from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import companion_config as cc  # noqa: E402

CONFIG_REL = os.path.join(".specify", "companion.yml")


def _yaml_flow_list(items: list[str]) -> str:
    """Render a string list as a YAML flow sequence with double-quoted scalars,
    matching the style the shipped companion.yml fixtures use (`["a", "b"]`)."""
    return "[" + ", ".join(f'"{i}"' for i in items) + "]"


def _capability_block(cap: dict) -> list[str]:
    """Render one capability as companion.yml block-seq lines.

    The seq item sits at 4-space indent under the 2-space `capabilities:` key —
    the constrained reader needs the `- ` deeper than its parent key, and this
    matches the shipped fixture style (`    - name: …`)."""
    lines = [f"    - name: {cap['name']}"]
    lines.append(f"      match: {_yaml_flow_list(cap['match'])}")
    if cap.get("exclude"):
        lines.append(f"      exclude: {_yaml_flow_list(cap['exclude'])}")
    if cap.get("spec"):
        lines.append(f"      spec: {cap['spec']}")
    return lines


def _render_living_specs(enabled: bool, capabilities: list[dict]) -> str:
    """Render the whole `livingSpecs` block from a normalized capability list.

    The helper re-emits the block rather than splicing raw bytes so the output
    always round-trips through `companion_config.load_yaml`. A capability's
    `spec` is emitted only when it differs from the centralized default, keeping
    the file terse (the resolver fills the default itself)."""
    lines = ["livingSpecs:", f"  enabled: {'true' if enabled else 'false'}"]
    if capabilities:
        lines.append("  capabilities:")
        for cap in capabilities:
            lines.extend(_capability_block(cap))
    else:
        lines.append("  capabilities: []")
    return "\n".join(lines) + "\n"


def _is_top_level_key(line: str) -> bool:
    """True for a column-0 mapping key (`livingSpecs:`, `commands:`) — the start
    of a sibling top-level block. Comments and blanks are not block boundaries."""
    return bool(line) and not line[0].isspace() and not line.lstrip().startswith("#")


def _splice_living_specs(original: str, rendered_block: str) -> str:
    """Replace the existing `livingSpecs:` block in `original` with `rendered_block`,
    leaving every sibling top-level block and comment untouched.

    The block runs from its `livingSpecs:` line through the line before the next
    top-level key (its own indented body plus any trailing blanks/comments). If no
    `livingSpecs:` block exists, the rendered block is appended at the end."""
    lines = original.splitlines(keepends=True)
    start = None
    for i, ln in enumerate(lines):
        if _is_top_level_key(ln) and ln.split(":", 1)[0].strip() == "livingSpecs":
            start = i
            break
    if start is None:
        if not original.strip():
            return rendered_block
        prefix = original if original.endswith("\n") else original + "\n"
        return prefix + "\n" + rendered_block
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if _is_top_level_key(lines[j]):
            end = j
            break
    return "".join(lines[:start]) + rendered_block + "".join(lines[end:])


def _default_spec(name: str) -> str:
    return f"{cc.DEFAULT_CAPABILITY_ROOT}/{name}/spec.md"


def _normalize_existing(living: dict) -> list[dict]:
    """Turn the reader's normalized capabilities into emit-ready dicts, dropping
    the centralized `spec` default so re-emission stays terse and stable."""
    out = []
    for cap in living.get("capabilities", []):
        entry = {"name": cap["name"], "match": list(cap.get("match") or [])}
        if cap.get("exclude"):
            entry["exclude"] = list(cap["exclude"])
        if cap.get("spec") and cap["spec"] != _default_spec(cap["name"]):
            entry["spec"] = cap["spec"]
        out.append(entry)
    return out


def register(root: str, name: str, match: list[str], exclude: list[str],
             spec: str | None) -> dict:
    """Append one capability idempotently. Returns the result object.

    Raises ValueError on a malformed existing config (the CLI maps it to exit 2)
    so a file the reader can't fully parse is never overwritten."""
    config_path = os.path.join(root, CONFIG_REL)
    existed = os.path.isfile(config_path)

    # The constrained YAML emitter double-quotes scalars and the reader can't
    # unescape; a value with a quote/newline would emit invalid YAML and risk
    # corrupting the file. Reject up-front (CLI maps ValueError to exit 2).
    for val in [name, spec or "", *match, *(exclude or [])]:
        if val and ('"' in val or "\n" in val or "\r" in val):
            raise ValueError(
                f"unsupported character (quote/newline) in value: {val!r}"
            )

    cfg, warnings = cc.load_config(config_path)
    # load_config degrades a malformed file to ({}, [warning]) — refuse rather
    # than overwrite a file we couldn't parse (would drop the user's content).
    if existed and warnings:
        raise ValueError(warnings[0])

    living = cc.load_living_specs(cfg)
    had_block = isinstance(cfg.get("livingSpecs"), dict)
    capabilities = _normalize_existing(living)
    spec_path = spec or _default_spec(name)

    existing = next((c for c in capabilities if c["name"] == name), None)
    if existing is not None:
        # Idempotent: report what's ACTUALLY on disk, not the requested inputs
        # (a custom spec/match already registered must not be misreported).
        return {
            "name": name,
            "action": "already-registered",
            "spec": existing.get("spec") or _default_spec(name),
            "match": existing.get("match", []),
            "configPath": CONFIG_REL,
        }

    new_cap = {"name": name, "match": match}
    if exclude:
        new_cap["exclude"] = exclude
    if spec_path != _default_spec(name):
        new_cap["spec"] = spec_path
    capabilities.append(new_cap)

    # Preserve an existing block's enabled flag; a fresh block (new file, or a
    # config with no livingSpecs yet) is born enabled so the registered capability
    # actually resolves — that is the whole point of the adoption wizard.
    enabled = living["enabled"] if had_block else True
    rendered = _render_living_specs(enabled, capabilities)
    if existed:
        with open(config_path, encoding="utf-8") as fh:
            original = fh.read()
        rendered = _splice_living_specs(original, rendered)
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as fh:
        fh.write(rendered)

    return {
        "name": name,
        "action": "created" if not existed else "appended",
        "spec": spec_path,
        "match": match,
        "configPath": CONFIG_REL,
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Append a Living-Specs capability to companion.yml.")
    ap.add_argument("--name", required=True, help="capability name (idempotency key)")
    ap.add_argument("--match", action="append", default=[], help="membership glob (repeatable)")
    ap.add_argument("--exclude", action="append", default=[], help="exclusion glob (repeatable)")
    ap.add_argument("--spec", default=None, help="spec path (default: capabilities/<name>/spec.md)")
    ap.add_argument("--root", default=".", help="repo root (default: cwd)")
    ap.add_argument("--json", action="store_true", help="emit the machine-readable result object")
    args = ap.parse_args(argv)

    if not args.match:
        sys.stderr.write("register-capability: --match is required (a capability with no match never resolves)\n")
        return 2

    try:
        result = register(args.root, args.name, args.match, args.exclude, args.spec)
    except ValueError as exc:
        sys.stderr.write(f"register-capability: refusing to write — {exc}\n")
        return 2

    if args.json:
        print(json.dumps(result, indent=2))
    elif result["action"] == "already-registered":
        sys.stderr.write(f"[companion] capability '{result['name']}' already registered — no change.\n")
    else:
        print(f"[companion] {result['action']} capability '{result['name']}' "
              f"({result['spec']}) in {result['configPath']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
