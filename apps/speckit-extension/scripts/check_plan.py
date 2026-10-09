#!/usr/bin/env python3
"""Check the call paths and code blocks a plan cites against the code they cite.

The `call-paths` node asks the plan step for fenced ```calls <title>``` blocks in
`plan.md`: one line per function on the path, a column-0 mark (`+` new, `~`
changed, `-` removed, space unchanged), two spaces per level, and `@ path:line`
after the name, or `**new**` and `@ path` for a file that does not exist yet.
The grammar is documented in docs/call-paths.md.

The `code-pins` node asks for a code fence that names a file: `<lang> sketch <file>`
for code that does not exist yet, or `<lang> <file>:<from>-<to>` for real lines,
with an optional `hl=3,6-7` and `pin N: text` lines straight after the fence. It
is read in `plan.md` and `tasks.md`, and documented in docs/code-pins.md.

A block is worth reading only while its paths are real, so this reads every cited
file. ERROR is a claim the code contradicts or a line that cannot be parsed;
WARNING is a budget or a citation it could not confirm.

A plan with neither block prints nothing. Always exits 0, so it never fails the
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
CODE_FILE = "tasks.md"
MAX_SKETCH_LINES = 12
MAX_PINS = 3
OTHER_BLOCKS = frozenset({"calls", "code", "states", "screen", "mermaid"})
MAX_DIGITS = 7

_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
_LOCATION = re.compile(r"^(?P<name>.*?)\s+@\s+(?P<path>\S+?)(?::(?P<line>\d+))?$")
_NEW = re.compile(r"\s*\*\*new\*\*\s*$")
_IDENT = re.compile(r"[A-Za-z_$][\w$]*")
_LANGUAGE = re.compile(r"^[a-z0-9][a-z0-9_+#.-]{0,31}$")
_CITE = re.compile(r"^(.+):([0-9]+)-([0-9]+)$")
_HL = re.compile(r"^([0-9]{1,7})(?:-([0-9]{1,7}))?$")
_PIN = re.compile(r"^\s*pin\s+([0-9]+):\s*(.*)$", re.IGNORECASE)
_OUTSIDE = re.compile(r"^([a-z]:|[\\/])", re.IGNORECASE)


class Finding:
    def __init__(self, level: str, rule: str, where: str, message: str) -> None:
        self.level, self.rule, self.where, self.message = level, rule, where, message

    def to_dict(self) -> dict:
        return {"level": self.level, "rule": self.rule, "where": self.where, "message": self.message}


def _lines(text: str) -> list:
    return text.replace("\r\n", "\n").replace("\r", "\n").split("\n")


def _fences(lines: list):
    """Every outermost fence as (info, start, body: [(lineno, text)], closed, index after it)."""
    i = 0
    while i < len(lines):
        m = _FENCE.match(lines[i])
        if not m:
            i += 1
            continue
        fence, info, start = m.group(1), m.group(2).strip(), i + 1
        body, closed = [], False
        i += 1
        while i < len(lines):
            close = _FENCE.match(lines[i])
            if close and close.group(1)[0] == fence[0] and len(close.group(1)) >= len(fence) \
                    and not close.group(2).strip():
                closed = True
                i += 1
                break
            body.append((i + 1, lines[i]))
            i += 1
        yield info, start, body, closed, i


def _after_blanks(lines: list, i: int) -> int:
    while i < len(lines) and not lines[i].strip():
        i += 1
    return i


def find_blocks(text: str) -> list:
    """Every `calls` fence as {title, start, rows: [(lineno, text)], closed, notes}."""
    lines = _lines(text)
    blocks = []
    for info, start, body, closed, end in _fences(lines):
        words = info.split(None, 1)
        if not words or words[0] != "calls":
            continue
        notes = 0
        j = _after_blanks(lines, end)
        while j < len(lines) and lines[j].lstrip().lower().startswith("note:"):
            notes += 1
            j += 1
        blocks.append({"title": words[1].strip() if len(words) > 1 else "", "start": start,
                       "rows": [(n, row.rstrip(" ")) for n, row in body if row.strip()],
                       "closed": closed, "notes": notes})
    return blocks


def parse_code_info(info: str):
    """{kind, path, first, last, hl} for a code block's info line, an error string, or None for any other fence."""
    words = info.split()
    if len(words) < 2 or not _LANGUAGE.match(words[0].lower()) or words[0].lower() in OTHER_BLOCKS:
        return None
    cite = _CITE.match(words[1])
    if words[1] == "sketch":
        if len(words) < 3 or words[2].startswith("hl="):
            return "`sketch` names no file"
        kind, path, first, last, extra = "sketch", words[2], 1, None, words[3:]
    elif cite:
        kind, path, extra = "cite", cite.group(1), words[2:]
        if max(len(cite.group(2)), len(cite.group(3))) > MAX_DIGITS:
            return f"`{words[1]}` is not a range of lines"
        first, last = int(cite.group(2)), int(cite.group(3))
    else:
        return None
    if len(extra) > 1 or (extra and not extra[0].startswith("hl=")):
        odd = next((w for w in extra if not w.startswith("hl=")), extra[-1])
        return f"`{odd}` is not allowed after the file: one `hl=` and nothing else"
    hl = []
    for part in extra[0][3:].split(",") if extra else []:
        m = _HL.match(part)
        low, high = (int(m.group(1)), int(m.group(2) or m.group(1))) if m else (1, 0)
        if low > high:
            return f"`{extra[0]}` is not numbers and low-to-high `a-b` ranges split by commas"
        hl.append((low, high))
    if _OUTSIDE.match(path) or ".." in re.split(r"[\\/]", path):
        return f"`{path}` is not a path inside the repo"
    if kind == "cite" and (first < 1 or first > last):
        return f"`{first}-{last}` is not a range of lines: count from 1, low to high"
    return {"kind": kind, "path": path, "first": first, "last": last, "hl": hl}


def find_code_blocks(text: str) -> list:
    """Every code block fence as {info, start, body: [(lineno, text)], closed, pins: [(lineno, line, text)]}."""
    lines = _lines(text)
    blocks = []
    for raw, start, body, closed, end in _fences(lines):
        info = parse_code_info(raw)
        if info is None:
            continue
        pins = []
        j = _after_blanks(lines, end) if closed else len(lines)
        while j < len(lines):
            m = _PIN.match(lines[j])
            if not m:
                break
            pins.append((j + 1, int(m.group(1)[:MAX_DIGITS + 1]), m.group(2).strip()))
            j += 1
        blocks.append({"info": info, "start": start, "body": body, "closed": closed, "pins": pins})
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


def _source(cache: dict, root: Path, path: str) -> list:
    if path not in cache:
        src = _lines((root / path).read_text(encoding="utf-8", errors="replace"))
        cache[path] = src[:-1] if src and src[-1] == "" else src
    return cache[path]


def _check_code(block: dict, root: Path, cache: dict, add) -> None:
    start, info, body = block["start"], block["info"], block["body"]
    if isinstance(info, str):
        return add("ERROR", "malformed", start, info)
    if not block["closed"]:
        return add("ERROR", "malformed", start, "the code block is never closed")
    if not any(row.strip() for _n, row in body):
        return add("ERROR", "malformed", start, "the code block is empty")

    kind, path, first, last = info["kind"], info["path"], info["first"], info["last"]
    shown = f"{first}-{first + len(body) - 1}"
    for low, high in info["hl"]:
        if low < first or high > first + len(body) - 1:
            add("ERROR", "malformed", start,
                f"`hl` names line {low if low < first else high}, the block shows {shown}")
            break
    for lineno, line, note in block["pins"]:
        if not note:
            add("ERROR", "malformed", lineno, f"`pin {line}:` has no text")
        if not first <= line < first + len(body):
            add("ERROR", "malformed", lineno, f"`pin {line}` is outside the lines shown, {shown}")
    if len(block["pins"]) > MAX_PINS:
        add("WARNING", "too-many-pins", start,
            f"{len(block['pins'])} pins, the budget is {MAX_PINS} a block")

    if kind == "sketch":
        if len(body) > MAX_SKETCH_LINES:
            add("WARNING", "sketch-too-long", start,
                f"{len(body)} lines, the budget is {MAX_SKETCH_LINES} a sketch")
        return
    want = last - first + 1
    if len(body) != want:
        add("ERROR", "range-mismatch", start,
            f"{len(body)} lines in the block, `{first}-{last}` is {want}")
    try:
        src = _source(cache, root, path) if (root / path).is_file() else None
    except (OSError, ValueError):
        return add("WARNING", "unreadable", start, f"`{path}` could not be read, so it is unverified")
    if src is None:
        return add("ERROR", "missing-file", start, f"`{path}` does not exist (code not written yet is a `sketch`)")
    if last > len(src):
        return add("ERROR", "line-out-of-range", start,
                   f"`{path}` has {len(src)} lines, there is no line {last}")
    if len(body) != want:
        return
    for offset, (lineno, row) in enumerate(body):
        if row.rstrip() != src[first - 1 + offset].rstrip():
            add("WARNING", "text-differs", lineno,
                f"line {first + offset} of `{path}` does not read like this")
            break


def check_text(text: str, label: str, root: Path, size: str | None = None, calls: bool = True) -> dict:
    findings = []
    declared = []

    def add(level, rule, lineno, message):
        findings.append(Finding(level, rule, f"{label}:{lineno}", message))

    blocks = find_blocks(text) if calls else []
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
            src = _source(cache, root, path)
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

    code = find_code_blocks(text)
    for block in code:
        _check_code(block, root, cache, add)

    errors = sum(1 for f in findings if f.level == "ERROR")
    return {
        "plan": label,
        "blocks": len(blocks),
        "lines": sum(len(b["rows"]) for b in blocks),
        "code_blocks": len(code),
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
           "code_blocks": 0, "errors": 0, "warnings": 0, "findings": [], "declared": []}
    for r in reports:
        for key in ("blocks", "lines", "code_blocks", "errors", "warnings"):
            out[key] += r[key]
        out["findings"] += r["findings"]
        out["declared"] += r["declared"]
    return out


def render_human(report: dict) -> str:
    code = report["code_blocks"]
    counts = [f"{report['blocks']} call path{'' if report['blocks'] == 1 else 's'}, {report['lines']} lines"]
    if code:
        counts = counts[:bool(report["blocks"])] + [f"{code} code block{'' if code == 1 else 's'}"]
    head = f"[plan-check] {report['plan']}: {', '.join(counts)}"
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
    if feature_dir:
        try:
            tasks = check_text((feature_dir / CODE_FILE).read_text(encoding="utf-8", errors="replace"),
                               CODE_FILE, root, calls=False)
        except OSError:
            tasks = None
        if tasks and tasks["code_blocks"]:
            reports.append(tasks)
    report = _merge(reports)

    if args.as_json:
        print(json.dumps(report, indent=2))
    elif report["blocks"] or report["code_blocks"]:
        print(render_human(report))
    return 1 if (args.strict and report["errors"]) else 0


if __name__ == "__main__":
    sys.exit(main())
