#!/usr/bin/env python3
"""Check the call paths a plan cites against the code they cite.

The `call-paths` node asks the plan step for fenced ```calls <title>``` blocks in
`plan.md`: one line per function on the path, a column-0 mark (`+` new, `~`
changed, `-` removed, space unchanged), two spaces per level, and `@ path:line`
after the name, or `**new**` and `@ path` for a file that does not exist yet.
The grammar is documented in docs/call-paths.md.

A block is worth reading only while its paths are real, so this reads every cited
file. ERROR is a claim the code contradicts or a line that cannot be parsed;
WARNING is a budget or a citation it could not confirm.

A plan with no `calls` block prints nothing. Always exits 0, so it never fails the
step it runs in; `--strict` exits 1 on any error, for a caller that wants a gate.
Read-only. Stdlib only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from spec_context import _repo_root, _repo_root_for, resolve_feature_dir  # noqa: E402

MAX_BLOCKS = 3
MAX_LINES = 12
MAX_NOTE_LINES = 1
NEAR = 8
SIDE_FILE = "call-paths.md"

_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
_LOCATION = re.compile(r"^(?P<name>.*?)\s+@\s+(?P<path>\S+?)(?::(?P<line>\d+))?$")
_NEW = re.compile(r"\s*\*\*new\*\*\s*$")
_IDENT = re.compile(r"[A-Za-z_$][\w$]*")


class Finding:
    def __init__(self, level: str, rule: str, where: str, message: str) -> None:
        self.level, self.rule, self.where, self.message = level, rule, where, message

    def to_dict(self) -> dict:
        return {"level": self.level, "rule": self.rule, "where": self.where, "message": self.message}


def _lines(text: str) -> list:
    return text.replace("\r\n", "\n").replace("\r", "\n").split("\n")


def find_blocks(text: str) -> list:
    """Every `calls` fence as {title, start, rows: [(lineno, text)], closed, notes}."""
    lines = _lines(text)
    blocks = []
    i = 0
    while i < len(lines):
        m = _FENCE.match(lines[i])
        if not m:
            i += 1
            continue
        fence, info = m.group(1), m.group(2).strip()
        words = info.split(None, 1)
        is_calls = bool(words) and words[0] == "calls"
        block = {"title": words[1].strip() if is_calls and len(words) > 1 else "",
                 "start": i + 1, "rows": [], "closed": False, "notes": 0}
        i += 1
        while i < len(lines):
            close = _FENCE.match(lines[i])
            if close and close.group(1)[0] == fence[0] and len(close.group(1)) >= len(fence) \
                    and not close.group(2).strip():
                block["closed"] = True
                i += 1
                break
            if is_calls and lines[i].strip():
                block["rows"].append((i + 1, lines[i].rstrip(" ")))
            i += 1
        if is_calls:
            j = i
            while j < len(lines) and not lines[j].strip():
                j += 1
            while j < len(lines) and lines[j].lstrip().lower().startswith("note:"):
                block["notes"] += 1
                j += 1
            blocks.append(block)
    return blocks


def parse_row(row: str):
    """(mark, depth, name, path, line, new) for one block line, or an error string."""
    if "\t" in row:
        return "a tab in the line: indent with two spaces per level"
    if len(row) < 2 or row[0] not in "+~- " or row[1] != " ":
        return "column 0 must be `+`, `~`, `-` or a space, followed by a space"
    mark, rest = row[0], row[2:]
    indent = len(rest) - len(rest.lstrip(" "))
    if indent % 2:
        return f"indent of {indent} spaces: use two per level"
    m = _LOCATION.match(rest.strip())
    if not m:
        return "no `@ path` after the name"
    name, path, line = m.group("name").strip(), m.group("path"), m.group("line")
    new = bool(_NEW.search(name))
    name = _NEW.sub("", name).strip()
    if not name:
        return "no name before `@`"
    if new and mark != "+":
        return "`**new**` marks a new file, so the line must start with `+`"
    if new and line:
        return "a `**new**` file has no line yet: write `@ path` alone"
    if os.path.isabs(path) or ".." in Path(path).parts:
        return f"`{path}` is not a path inside the repo"
    return mark, indent // 2, name, path, int(line) if line else None, new


def _symbol(name: str) -> str | None:
    found = _IDENT.findall(name.split("(", 1)[0])
    return found[-1] if found else None


def check_text(text: str, label: str, root: Path, size: str | None = None) -> dict:
    findings = []
    declared = []

    def add(level, rule, lineno, message):
        findings.append(Finding(level, rule, f"{label}:{lineno}", message))

    blocks = find_blocks(text)
    if size == "simple" and blocks:
        add("WARNING", "simple-size", blocks[0]["start"],
            "this spec is sized `simple`, which writes no call paths")
    if len(blocks) > MAX_BLOCKS:
        add("WARNING", "too-many-blocks", blocks[MAX_BLOCKS]["start"],
            f"{len(blocks)} call-path blocks, the budget is {MAX_BLOCKS}")

    cache: dict = {}
    for block in blocks:
        start = block["start"]
        if not block["closed"]:
            add("ERROR", "malformed", start, "the `calls` block is never closed")
        if not block["title"]:
            add("WARNING", "no-title", start, "name the behaviour after `calls`")
        if not block["rows"]:
            add("ERROR", "malformed", start, "the `calls` block is empty")
        if len(block["rows"]) > MAX_LINES:
            add("WARNING", "too-long", start,
                f"{len(block['rows'])} lines, the budget is {MAX_LINES} a block")
        if block["notes"] > MAX_NOTE_LINES:
            add("WARNING", "long-note", start,
                f"{block['notes']} `note:` lines under the block, the budget is {MAX_NOTE_LINES}")

        depth = -1
        for lineno, row in block["rows"]:
            parsed = parse_row(row)
            if isinstance(parsed, str):
                add("ERROR", "malformed", lineno, parsed)
                continue
            mark, level, name, path, line, new = parsed
            if depth == -1 and level != 0:
                add("ERROR", "malformed", lineno, "the first line is the entry point, at no indent")
            elif depth != -1 and level == 0:
                add("ERROR", "malformed", lineno, "a second entry point: one per block")
            elif level > depth + 1:
                add("ERROR", "malformed", lineno, "indented more than one level past the line above")
            depth = level
            declared.append({"mark": mark.strip() or " ", "name": name, "path": path,
                             "line": line, "new": new})

            target = root / path
            if new:
                if target.exists():
                    add("ERROR", "new-exists", lineno,
                        f"`{path}` already exists: drop `**new**` and cite the line")
                continue
            if not target.is_file():
                add("ERROR", "missing-file", lineno,
                    f"`{path}` does not exist (a file the change creates takes `**new**` and no line)")
                continue
            if line is None:
                add("WARNING", "no-line", lineno, f"`{path}` has no `:line`, so it is unverified")
                continue
            if path not in cache:
                cache[path] = _lines(target.read_text(encoding="utf-8", errors="replace"))
            src = cache[path]
            if src and src[-1] == "":
                src = src[:-1]
            if line < 1 or line > len(src):
                add("ERROR", "line-out-of-range", lineno,
                    f"`{path}` has {len(src)} lines, there is no line {line}")
                continue
            symbol = _symbol(name)
            if mark != "+" and symbol:
                window = "\n".join(src[max(0, line - 1 - NEAR):line + NEAR])
                if not re.search(rf"(?<![\w$]){re.escape(symbol)}(?![\w$])", window):
                    add("WARNING", "symbol-not-near", lineno,
                        f"`{symbol}` is not within {NEAR} lines of `{path}:{line}`")

    errors = sum(1 for f in findings if f.level == "ERROR")
    return {
        "plan": label,
        "blocks": len(blocks),
        "lines": sum(len(b["rows"]) for b in blocks),
        "errors": errors,
        "warnings": len(findings) - errors,
        "findings": [f.to_dict() for f in findings],
        "declared": declared,
    }


def _size(feature_dir: Path) -> str | None:
    try:
        ctx = json.loads((feature_dir / ".spec-context.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return ctx.get("size") if isinstance(ctx, dict) else None


def _merge(reports: list) -> dict:
    out = {"plan": ", ".join(r["plan"] for r in reports), "blocks": 0, "lines": 0,
           "errors": 0, "warnings": 0, "findings": [], "declared": []}
    for r in reports:
        for key in ("blocks", "lines", "errors", "warnings"):
            out[key] += r[key]
        out["findings"] += r["findings"]
        out["declared"] += r["declared"]
    return out


def render_human(report: dict) -> str:
    head = (f"[plan-check] {report['plan']}: {report['blocks']} call path"
            f"{'' if report['blocks'] == 1 else 's'}, {report['lines']} lines")
    if not report["findings"]:
        return f"{head}. Every cited file and line checks out."
    rows = [f"  {f['level']:<7} {f['where']}  {f['message']} ({f['rule']})"
            for f in report["findings"]]
    tail = f"  {report['errors']} error(s), {report['warnings']} warning(s)"
    return "\n".join([head, *rows, tail])


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Check a plan's call paths against the code (read-only)")
    ap.add_argument("--feature-dir", default=None, help="the spec whose plan.md to check")
    ap.add_argument("--plan", default=None, help="check this file instead of the spec's plan")
    ap.add_argument("--root", default=None,
                    help="where cited paths resolve from (default: the spec's repository)")
    ap.add_argument("--json", dest="as_json", action="store_true")
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 when any error is found; without it the check always exits 0")
    args = ap.parse_args(argv)

    feature_dir = None
    if args.plan:
        files = [Path(args.plan)]
        root = Path(args.root) if args.root else _repo_root()
    else:
        feature_dir = resolve_feature_dir(_repo_root(), args.feature_dir)
        if feature_dir is None or not feature_dir.is_dir():
            print("[plan-check] Could not resolve the spec to check. Nothing checked.", file=sys.stderr)
            return 0
        files = [feature_dir / "plan.md", feature_dir / SIDE_FILE]
        root = Path(args.root) if args.root else _repo_root_for(feature_dir)

    size = _size(feature_dir) if feature_dir else None
    reports = []
    for path in files:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        reports.append(check_text(text, path.name, root, size))
    report = _merge(reports)

    if args.as_json:
        print(json.dumps(report, indent=2))
    elif report["blocks"]:
        print(render_human(report))
    return 1 if (args.strict and report["errors"]) else 0


if __name__ == "__main__":
    sys.exit(main())
