#!/usr/bin/env python3
"""Per-step timing for an e2e run: wall-clock marks you take, next to what the run record captured.

  timing.py mark   <results-dir> <surface> <step> start|end [note]
  timing.py report <results-dir> <surface> <spec-dir>   -> prints a markdown table, appends it to <results-dir>/timing.md
  timing.py wait   <spec-dir|specs-root> <step> [timeout-min]  -> blocks until the run record closes <step>; a specs root waits on the newest spec
"""
import csv
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

STEPS = ["specify", "plan", "tasks", "implement", "mark-complete"]


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00")) if ts else None


def fmt(seconds):
    if seconds is None:
        return "-"
    m, s = divmod(int(round(seconds)), 60)
    return f"{m}m{s:02d}s" if m else f"{s}s"


def mark(results, surface, step, edge, note=""):
    path = Path(results) / "timing.csv"
    fresh = not path.exists()
    with path.open("a", newline="") as fh:
        w = csv.writer(fh)
        if fresh:
            w.writerow(["surface", "step", "edge", "at", "note"])
        w.writerow([surface, step, edge, now(), note])
    print(f"[timing] {surface} {step} {edge}")


def wall_marks(results, surface):
    path = Path(results) / "timing.csv"
    marks = {}
    if path.exists():
        for row in csv.DictReader(path.open()):
            if row["surface"] == surface:
                marks.setdefault(row["step"], {})[row["edge"]] = parse(row["at"])
    return marks


def recorded(spec_dir):
    ctx = Path(spec_dir) / ".spec-context.json"
    spans = {}
    if not ctx.exists():
        return spans
    for e in json.load(ctx.open()).get("history", []):
        if e.get("substep"):
            continue
        slot = spans.setdefault(e["step"], {})
        at = parse(e.get("at"))
        if e.get("kind") == "start":
            slot.setdefault("start", at)
        elif e.get("kind") == "complete":
            slot["end"] = at
    return spans


def dur(slot):
    if slot and slot.get("start") and slot.get("end"):
        return (slot["end"] - slot["start"]).total_seconds()
    return None


def report(results, surface, spec_dir):
    wall, rec = wall_marks(results, surface), recorded(spec_dir)
    lines = [f"### {surface} — {Path(spec_dir).name}", "", "| Step | Wall clock | Recorded | Gap | Note |", "|---|---|---|---|---|"]
    tw = tr = 0.0
    for step in STEPS:
        w, r = dur(wall.get(step)), dur(rec.get(step))
        if w is None and r is None:
            continue
        tw += w or 0
        tr += r or 0
        gap = fmt(abs(w - r)) if w is not None and r is not None else "-"
        note = "no recorded span" if r is None else ("no wall marks" if w is None else "")
        lines.append(f"| {step} | {fmt(w)} | {fmt(r)} | {gap} | {note} |")
    lines.append(f"| **total** | {fmt(tw)} | {fmt(tr)} | | |")
    table = "\n".join(lines) + "\n"
    print(table)
    with (Path(results) / "timing.md").open("a") as fh:
        fh.write(table + "\n")


def newest_spec(root):
    dirs = [d for d in Path(root).iterdir() if d.is_dir() and not d.name.startswith("_")]
    return max(dirs, key=lambda d: d.stat().st_mtime) if dirs else None


def wait(target, step, timeout_min="30"):
    deadline = time.time() + float(timeout_min) * 60
    while time.time() < deadline:
        spec = Path(target) if (Path(target) / ".spec-context.json").exists() else newest_spec(target)
        if spec and recorded(spec).get(step, {}).get("end"):
            print(f"[timing] {step} closed in {spec}")
            return
        time.sleep(10)
    sys.exit(f"[timing] {step} never closed within {timeout_min}m -> check the terminal for a stuck prompt")


if __name__ == "__main__":
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ("", [])
    if cmd == "mark" and len(args) >= 4:
        mark(*args[:4], " ".join(args[4:]))
    elif cmd == "report" and len(args) == 3:
        report(*args)
    elif cmd == "wait" and len(args) in (2, 3):
        wait(*args)
    else:
        sys.exit(__doc__)
