#!/usr/bin/env python3
"""Measure the repo on the dimensions the cleanup claims to improve.

Run it before and after: the final report is the diff of two runs, so every
claim in it is a number somebody can re-derive rather than an impression.

  python3 .claude/scripts/repo-metrics.py > before.json
  python3 .claude/scripts/repo-metrics.py --pretty

Read-only, stdlib only. Suite timings are skipped unless --suites is passed,
because they cost three minutes.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import subprocess
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CODE = re.compile(r"\.(ts|tsx|py)$")
SKIP = re.compile(r"(\.test\.|\.spec\.|__tests__|/tests/|stories|node_modules|/worktrees/)")
MEDIA = re.compile(r"\.(png|jpg|jpeg|gif|webp|webm|mp4|mov|svg|ico|woff2?)$")


def git(*args) -> str:
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True).stdout


def tracked() -> list:
    return [f for f in git("ls-files").split("\n") if f]


def du(path: str) -> int:
    total = 0
    for dirpath, dirnames, names in os.walk(os.path.join(ROOT, path)):
        dirnames[:] = [d for d in dirnames if d != ".git"]
        for n in names:
            try:
                total += os.path.getsize(os.path.join(dirpath, n))
            except OSError:
                pass
    return total


def structure(files: list) -> dict:
    roots = sorted({f.split("/")[0] for f in files if "/" in f})
    on_disk = sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d)) and not d.startswith("."))
    return {
        "tracked_root_entries": len(roots),
        "root_dirs_on_disk": on_disk,
        "root_dirs_on_disk_count": len(on_disk),
        "disk_bytes_examples": du("examples") if os.path.isdir(os.path.join(ROOT, "examples")) else 0,
        "disk_bytes_worktrees": du(".claude/worktrees") if os.path.isdir(os.path.join(ROOT, ".claude/worktrees")) else 0,
        "committed_media_bytes": sum(
            os.path.getsize(os.path.join(ROOT, f))
            for f in files if MEDIA.search(f) and os.path.exists(os.path.join(ROOT, f))),
        "committed_media_files": sum(1 for f in files if MEDIA.search(f)),
        "gitlinks": len([l for l in git("ls-files", "-s").split("\n") if l.startswith("160000")]),
    }


def code(files: list) -> dict:
    src = [f for f in files if CODE.search(f) and not SKIP.search(f)]
    sizes, exports = [], []
    for f in src:
        p = os.path.join(ROOT, f)
        try:
            text = open(p, encoding="utf-8").read()
        except (OSError, UnicodeDecodeError):
            continue
        n = text.count("\n") + 1
        sizes.append((n, f))
        if f.endswith((".ts", ".tsx")):
            exports.append((len(re.findall(r"(?m)^export ", text)), f))
    sizes.sort(reverse=True)
    exports.sort(reverse=True)
    return {
        "source_files": len(src),
        "files_over_600_lines": [{"file": f, "lines": n} for n, f in sizes if n > 600],
        "files_over_1000_lines": sum(1 for n, _ in sizes if n > 1000),
        "largest": [{"file": f, "lines": n} for n, f in sizes[:5]],
        "widest_interfaces": [{"file": f, "exports": n} for n, f in exports[:5]],
        "total_source_lines": sum(n for n, _ in sizes),
    }


def duplication(files: list, window: int = 12) -> dict:
    seen = collections.defaultdict(list)
    for f in [f for f in files if CODE.search(f) and not SKIP.search(f)]:
        try:
            lines = [l.strip() for l in open(os.path.join(ROOT, f), encoding="utf-8").read().split("\n")]
        except (OSError, UnicodeDecodeError):
            continue
        body = [l for l in lines if l and not l.startswith(("//", "#", "*", "/*", '"""'))]
        for i in range(len(body) - window):
            key = hashlib.md5("\n".join(body[i:i + window]).encode()).hexdigest()
            seen[key].append(f)
    pairs = collections.Counter()
    for names in seen.values():
        uniq = sorted(set(names))
        if len(uniq) > 1:
            pairs[tuple(uniq[:2])] += 1
    return {
        "cross_file_duplicate_pairs": len(pairs),
        "top_pairs": [{"files": list(p), "windows": n} for p, n in pairs.most_common(5)],
    }


def docs(files: list) -> dict:
    def words(paths):
        total = 0
        for f in paths:
            try:
                total += len(open(os.path.join(ROOT, f), encoding="utf-8").read().split())
            except (OSError, UnicodeDecodeError):
                pass
        return total

    md = [f for f in files if f.endswith(".md")]
    live = [f for f in md if not f.startswith("specs/")]
    return {
        "markdown_files_outside_specs": len(live),
        "words_outside_specs": words(live),
        "words_docs_dir": words([f for f in md if f.startswith("docs/")]),
        "docs_top_level_md": len([f for f in md if f.startswith("docs/") and f.count("/") == 1]),
        "words_root_changelog": words(["CHANGELOG.md"]),
        "words_ext_changelog": words(["apps/speckit-extension/CHANGELOG.md"]),
        "words_living_specs": words([f for f in md if f.endswith(".spec.md") and not f.startswith("specs/")]),
        "install_instruction_locations": sorted(
            f for f in files
            if re.search(r"\.(md|mdx|astro)$", f) and not f.startswith("specs/")
            and "specify extension add" in _read(f)),
    }


def _read(f: str) -> str:
    try:
        return open(os.path.join(ROOT, f), encoding="utf-8").read()
    except (OSError, UnicodeDecodeError):
        return ""


def tests(files: list) -> dict:
    jest = [f for f in files if re.search(r"\.(test|spec)\.(ts|tsx)$", f)]
    homes = collections.Counter()
    for f in jest:
        if "__tests__" in f:
            homes["__tests__"] += 1
        elif f.startswith("apps/vscode/tests/"):
            homes["apps/vscode/tests/"] += 1
        else:
            homes["colocated"] += 1
    ci = _read(".github/workflows/ci.yml")
    return {
        "jest_files": len(jest),
        "jest_homes": dict(homes),
        "python_test_files": len([f for f in files if re.search(r"/tests/test_.*\.py$", f)]),
        "golden_command_files": len([f for f in files if "tests/golden/commands" in f]),
        "ci_run_steps": len(re.findall(r"(?m)^\s+run: ", ci)),
        "release_runs_tests": bool(re.search(r"run: npm (test|run test)", _read(".github/workflows/release.yml"))),
        "webview_typechecked_in_ci": "tsconfig.webview.json" in ci,
        "fixture_roots": sorted({f.split("/fixtures/")[0] + "/fixtures" for f in files if "/fixtures/" in f}),
    }


def suites() -> dict:
    out = {}
    for name, cmd in (("jest_seconds", ["npm", "test", "--silent"]),
                      ("python_seconds", ["python3", "-m", "pytest", "-q", "apps/speckit-extension/tests"])):
        start = time.time()
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        out[name] = round(time.time() - start, 1)
        out[name.replace("_seconds", "_passed")] = r.returncode == 0
    return out


def living() -> dict:
    r = subprocess.run(["python3", "apps/speckit-extension/scripts/living_validate.py", "--json"],
                       cwd=ROOT, capture_output=True, text=True)
    try:
        report = json.loads(r.stdout)
    except ValueError:
        return {"available": False}
    counts = collections.Counter(f["code"] for f in report.get("findings", []))
    return {"available": True, "specs_checked": report.get("checked", 0),
            "findings": dict(counts), "findings_total": sum(counts.values())}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--suites", action="store_true", help="also time both test suites (~4 min)")
    ap.add_argument("--pretty", action="store_true")
    args = ap.parse_args()

    files = tracked()
    report = {
        "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "head": git("rev-parse", "--short", "HEAD").strip(),
        "tracked_files": len(files),
        "structure": structure(files),
        "code": code(files),
        "duplication": duplication(files),
        "docs": docs(files),
        "tests": tests(files),
        "living_specs": living(),
    }
    if args.suites:
        report["suites"] = suites()
    print(json.dumps(report, indent=2 if args.pretty else None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
