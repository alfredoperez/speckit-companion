#!/usr/bin/env python3
"""Subagents the last /speckit-companion-auto run dispatched, per step, beside what each step's rule expects.

Usage: python3 .claude/scripts/subagent-tally.py specs/<NNN>-<slug> [--session <id>]
Reads the Claude Code transcript for this session (CLAUDE_CODE_SESSION_ID). Logs, never enforces.
"""
import argparse
import json
import os
import re
from pathlib import Path

STEPS = ("specify", "plan", "tasks", "implement")


def transcript(session):
    slug = re.sub(r"[^A-Za-z0-9]", "-", os.getcwd())
    return Path.home() / ".claude" / "projects" / slug / f"{session}.jsonl"


def blocks(path):
    for line in path.open():
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        content = (entry.get("message") or {}).get("content")
        if isinstance(content, str):
            yield {"type": "text", "text": content}
        elif isinstance(content, list):
            yield from (b for b in content if isinstance(b, dict))


def step_of(block):
    if block.get("type") == "tool_use" and block.get("name") == "Skill":
        m = re.search(r"speckit[.-]companion[.-](\w+)", str((block.get("input") or {}).get("skill", "")))
        return m and m.group(1)
    if block.get("type") == "text":
        m = re.search(r"<command-name>/?speckit[.-]companion[.-](\w+)", block.get("text") or "")
        return m and m.group(1)


def dispatched(path):
    """Agent calls since the last auto start, keyed by the companion step that was running."""
    runs = []
    for block in blocks(path):
        step = step_of(block)
        if step == "auto":
            runs.append({s: [] for s in STEPS})
            current = None
        elif step in STEPS and runs:
            current = step
        if runs and current and block.get("type") == "tool_use" and block.get("name") in ("Agent", "Task"):
            i = block.get("input") or {}
            text = f"{i.get('description', '')} {i.get('prompt', '')}".lower()
            kind = "review" if re.search(r"code-review|codex", text) or "review" in (i.get("description") or "").lower() else "worker"
            runs[-1][current].append((kind, i.get("description") or "?"))
    return runs[-1] if runs else None


def expected(spec_dir):
    ctx_file = spec_dir / ".spec-context.json"
    ctx = json.loads(ctx_file.read_text()) if ctx_file.exists() else {}
    areas = [c for c in ctx.get("context") or [] if isinstance(c, str) and c.startswith("area:")]
    plan = f"{len(areas)} readers (one per area)" if len(areas) >= 2 else f"0 readers ({len(areas)} area recorded)"
    docs = [d for d in ("data-model.md", "contracts") if (spec_dir / d).exists()]
    plan += f", {len(docs)} design-doc writers" if len(docs) >= 2 else f", 0 design-doc writers ({len(docs)} doc kept)"

    tasks = spec_dir / "tasks.md"
    big = []
    if tasks.exists():
        phase = None
        for line in tasks.read_text().splitlines():
            if line.startswith("## Phase"):
                phase = line[3:].strip()
            elif phase and re.match(r"Files( owned by this phase)?:", line) and not re.search(r"Setup|Foundational|Polish", phase):
                if len(re.findall(r"`[^`]+`", line)) >= 5:
                    big.append(phase.split(" - ")[0])
    implement = f"{len(big)} ({', '.join(big)} own 5+ files)" if big else "0 (no story phase owns 5+ files)"
    return {
        "specify": "judgement (one per code area when the request names 2+)",
        "plan": plan,
        "tasks": "0 (the gap-review panel is an optional node, off by default)",
        "implement": implement + "; plus 2 reviewers per round where the project has a review hook",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec_dir", type=Path)
    ap.add_argument("--session", default=os.environ.get("CLAUDE_CODE_SESSION_ID"))
    args = ap.parse_args()
    path = transcript(args.session)
    if not args.session or not path.exists():
        print(f"[subagents] No transcript found for session {args.session!r}; tally skipped.")
        return
    got = dispatched(path)
    if got is None:
        print("[subagents] No /speckit-companion-auto run in this session; tally skipped.")
        return
    exp = expected(args.spec_dir)
    for step in STEPS:
        workers = [d for k, d in got[step] if k == "worker"]
        reviews = [d for k, d in got[step] if k == "review"]
        line = f"[subagents] {step}: {len(workers)} worker(s)"
        if reviews:
            line += f", {len(reviews)} reviewer(s)"
        if got[step]:
            line += " — " + "; ".join(d for _, d in got[step])
        print(f"{line}\n             expected: {exp[step]}")


if __name__ == "__main__":
    main()
