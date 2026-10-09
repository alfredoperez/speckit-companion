#!/usr/bin/env python3
"""Check the call paths and screens a plan writes.

The `call-paths` node asks the plan step for fenced ```calls <title>``` blocks in
`plan.md`: one line per function on the path, a column-0 mark (`+` new, `~`
changed, `-` removed, space unchanged), two spaces per level, and `@ path:line`
after the name, or `**new**` and `@ path` for a file that does not exist yet.
The grammar is documented in docs/call-paths.md.

A block is worth reading only while its paths are real, so this reads every cited
file. ERROR is a claim the code contradicts or a line that cannot be parsed;
WARNING is a budget or a citation it could not confirm.

The `screens` node asks for fenced ```screen <name> <title>``` blocks: a rough wireframe
of what a person sees, one part per line (`title:`, `row:`, `text:`, `chip:`, `button:`,
`field:`, `list: a | b`), two spaces to nest inside a `row:`, an optional `(new)` or
`(changed)` and a numbered dot `(1)` as a suffix, then one `1: Bold lead. Rest.` note
under the fence for each dot. The grammar is documented in docs/screens.md. Nothing is
read from the code for a screen, so it only holds the block to its grammar and budget.

A plan with no `calls` or `screen` block prints nothing. Always exits 0, so it never fails the
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
SIDE_FILES = ("call-paths.md", "screens.md")
MAX_SCREENS = 2
MAX_PARTS = 14
MAX_DOTS = 5

_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
_LOCATION = re.compile(r"^(?P<name>.*?)\s+@\s+(?P<path>\S+?)(?::(?P<line>\d+))?$")
_NEW = re.compile(r"\s*\*\*new\*\*\s*$")
_IDENT = re.compile(r"[A-Za-z_$][\w$]*")
_PART_KINDS = ("title", "row", "text", "chip", "button", "field", "list")
_TRAILER = re.compile(r"(?:^|[\s:])\((new|changed|\d{1,2})\)\s*$")
_SCREEN_NAME = re.compile(r"^[A-Za-z][\w-]{0,31}$")
_NOTE = re.compile(r"^(\d{1,2}):\s+\S")


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


def find_screens(text: str) -> list:
    """Every `screen` fence as {name, title, start, rows, closed, notes: [(lineno, n)]}."""
    lines = _lines(text)
    screens = []
    i = 0
    while i < len(lines):
        m = _FENCE.match(lines[i])
        if not m:
            i += 1
            continue
        fence, info = m.group(1), m.group(2).strip()
        words = info.split(None, 2)
        is_screen = bool(words) and words[0] == "screen"
        block = {"name": words[1] if is_screen and len(words) > 1 else "",
                 "title": words[2].strip() if is_screen and len(words) > 2 else "",
                 "start": i + 1, "rows": [], "closed": False, "notes": []}
        i += 1
        while i < len(lines):
            close = _FENCE.match(lines[i])
            if close and close.group(1)[0] == fence[0] and len(close.group(1)) >= len(fence) \
                    and not close.group(2).strip():
                block["closed"] = True
                i += 1
                break
            if is_screen and lines[i].strip():
                block["rows"].append((i + 1, lines[i].rstrip(" ")))
            i += 1
        if is_screen:
            j = i
            while j < len(lines) and not lines[j].strip():
                j += 1
            while j < len(lines) and _NOTE.match(lines[j]):
                block["notes"].append((j + 1, int(_NOTE.match(lines[j]).group(1))))
                j += 1
            screens.append(block)
    return screens


def parse_part(row: str):
    """(rule, message) for a bad part line, else (depth, kind, mark, dot)."""
    if "\t" in row:
        return "bad-indent", "a tab in the line: indent with two spaces per level"
    indent = len(row) - len(row.lstrip(" "))
    if indent % 2:
        return "bad-indent", f"indent of {indent} spaces: use two per level"
    rest, mark, dot = row.strip(), None, None
    while True:
        m = _TRAILER.search(rest)
        if not m:
            break
        if m.group(1).isdigit():
            if dot is not None:
                return "malformed", "two dots on one part"
            dot = int(m.group(1))
        else:
            if mark is not None:
                return "malformed", "two marks on one part"
            mark = m.group(1)
        rest = rest[:m.start() + (1 if m.group(0)[:1] == ":" else 0)].rstrip()
    head = re.match(r"^([a-z]+):(?:\s+(.*))?$", rest)
    if not head:
        return "malformed", "a line that is not `kind: text`"
    kind, body = head.group(1), (head.group(2) or "").strip()
    if kind not in _PART_KINDS:
        return "unknown-part", f"`{kind}:` is not a part: use {', '.join(_PART_KINDS)}"
    if kind == "row" and body:
        return "malformed", "a `row:` holds no text of its own, only the parts under it"
    if kind != "row" and not body:
        return "malformed", f"a `{kind}:` with no text"
    if kind == "list" and any(not item.strip() for item in body.split("|")):
        return "malformed", "an empty item in a `list:`"
    if dot is not None and dot < 1:
        return "malformed", "a dot is numbered from 1"
    return indent // 2, kind, mark, dot


def _symbol(name: str) -> str | None:
    found = _IDENT.findall(name.split("(", 1)[0])
    return found[-1] if found else None


def check_screens(screens: list, add, size: str | None, seen: set) -> int:
    """Hold each screen block to its grammar, budget and note pairing. Returns the parts drawn."""
    if size == "simple" and screens:
        add("WARNING", "simple-size", screens[0]["start"],
            "this spec is sized `simple`, which writes no screens")
    if len(screens) > MAX_SCREENS:
        add("WARNING", "over-budget", screens[MAX_SCREENS]["start"],
            f"{len(screens)} screens, the budget is {MAX_SCREENS}")

    total = 0
    for block in screens:
        start, name = block["start"], block["name"]
        if not block["closed"]:
            add("ERROR", "malformed", start, "the `screen` block is never closed")
        if not name:
            add("ERROR", "malformed", start, "name the screen after `screen`: one word other blocks can refer to")
        elif not _SCREEN_NAME.match(name):
            add("ERROR", "malformed", start, f"`{name}` is not a one-word name (letters, digits, `-` and `_`)")
        elif name in seen:
            add("ERROR", "duplicate-screen", start, f"a screen called `{name}` is already in this plan")
        seen.add(name)
        if name and not block["title"]:
            add("WARNING", "no-title", start, "give the screen a title after its name")
        if not block["rows"]:
            add("ERROR", "malformed", start, "the `screen` block is empty")

        depth_kinds: list = []
        dots: list = []
        count = 0
        for lineno, row in block["rows"]:
            parsed = parse_part(row)
            if isinstance(parsed[0], str):
                add("ERROR", parsed[0], lineno, parsed[1])
                continue
            depth, kind, _mark, dot = parsed
            count += 1
            if depth > len(depth_kinds):
                add("ERROR", "bad-indent", lineno, "indented more than one level past the line above")
            elif depth > 0 and depth_kinds[depth - 1] != "row":
                add("ERROR", "bad-indent", lineno, "only a `row:` has parts under it")
            del depth_kinds[depth:]
            depth_kinds.append(kind)
            if dot is not None:
                if dot in dots:
                    add("ERROR", "malformed", lineno, f"dot {dot} is on two parts")
                dots.append(dot)
        total += count

        if count > MAX_PARTS:
            add("ERROR", "over-budget", start, f"{count} parts, the budget is {MAX_PARTS} a screen")
        if len(set(dots)) > MAX_DOTS:
            add("ERROR", "over-budget", start, f"{len(set(dots))} dots, the budget is {MAX_DOTS} a screen")
        noted = [n for _, n in block["notes"]]
        for n in sorted(set(dots) - set(noted)):
            add("ERROR", "dot-without-note", start, f"dot {n} has no `{n}: …` note under the block")
        first: set = set()
        for lineno, n in block["notes"]:
            if n in first:
                add("ERROR", "malformed", lineno, f"note {n} is written twice")
            first.add(n)
            if n not in dots:
                add("ERROR", "note-without-dot", lineno, f"note {n} has no `({n})` dot in the block")
    return total


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

    screens = find_screens(text)
    parts = check_screens(screens, add, size, set())

    errors = sum(1 for f in findings if f.level == "ERROR")
    return {
        "plan": label,
        "blocks": len(blocks),
        "lines": sum(len(b["rows"]) for b in blocks),
        "screens": len(screens),
        "parts": parts,
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
           "screens": 0, "parts": 0, "errors": 0, "warnings": 0, "findings": [], "declared": []}
    for r in reports:
        for key in ("blocks", "lines", "screens", "parts", "errors", "warnings"):
            out[key] += r[key]
        out["findings"] += r["findings"]
        out["declared"] += r["declared"]
    return out


def render_human(report: dict) -> str:
    counts = []
    if report["blocks"]:
        counts.append(f"{report['blocks']} call path{'' if report['blocks'] == 1 else 's'}, "
                      f"{report['lines']} lines")
    if report["screens"]:
        counts.append(f"{report['screens']} screen{'' if report['screens'] == 1 else 's'}, "
                      f"{report['parts']} parts")
    head = f"[plan-check] {report['plan']}: {'; '.join(counts)}"
    if not report["findings"]:
        what = ("Every cited file and line checks out" if report["blocks"]
                else "Every screen holds to its grammar")
        return f"{head}. {what}."
    rows = [f"  {f['level']:<7} {f['where']}  {f['message']} ({f['rule']})"
            for f in report["findings"]]
    tail = f"  {report['errors']} error(s), {report['warnings']} warning(s)"
    return "\n".join([head, *rows, tail])


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Check a plan's call paths and screens (read-only)")
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
        files = [feature_dir / "plan.md", *(feature_dir / side for side in SIDE_FILES)]
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
    elif report["blocks"] or report["screens"]:
        print(render_human(report))
    return 1 if (args.strict and report["errors"]) else 0


if __name__ == "__main__":
    sys.exit(main())
