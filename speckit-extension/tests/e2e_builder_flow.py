#!/usr/bin/env python3
"""Drive the builder's own write paths end to end, then verify the build.

Not a unit test: a scripted run of the six things the panel can do, in the
order a person would do them, against a scratch project. Its value is the two
bugs it found that no unit test would have — every write going to
`companion.yml` while the build read a workflow file, and a phase rename
leaving its hooks pointing at a name that no longer existed.

    python3 tests/e2e_builder_flow.py <repo-root>
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(sys.argv[1])
SCRIPTS = REPO / "speckit-extension" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import config_write as cw  # noqa: E402

project = Path(tempfile.mkdtemp(prefix="pb-e2e-"))
(project / ".specify").mkdir(parents=True)


def run(*args):
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "config_write.py"), "--project", str(project), *args],
        capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(f"REFUSED: {result.stdout.strip()}{result.stderr.strip()}")
    return result.stdout.strip()


def build(*extra):
    return subprocess.run(
        [sys.executable, str(SCRIPTS / "build-pipeline.py"),
         "--project", str(project), *extra],
        capture_output=True, text=True)


def graph():
    out = subprocess.run(
        [sys.executable, str(SCRIPTS / "pipeline-graph.py"), "--project", str(project)],
        capture_output=True, text=True)
    return json.loads(out.stdout)


print("=" * 68)
print("1. a project with nothing changed")
print("=" * 68)
g = graph()
assert not g["customised"], "a fresh project should read as shipped"
shipped_counts = dict(g["counts"])
print(f"   {shipped_counts}")

# Capture the shipped bodies to diff against.
build()
shipped_dir = project / "_shipped"
shutil.copytree(project / ".specify" / "extensions" / "companion" / "commands", shipped_dir)

print()
print("=" * 68)
print("2. author a workflow, the way the panel writes it")
print("=" * 68)
print("  ", run("--new-workflow", "demo", "--seed-from", ""))

# a. a skill hook after a phase
print("  ", run("--command", "specify", "--hook", "skill", "--when", "after",
                "--anchor", "author", "--ref", "verify-code-review",
                "--text", "Block the spec if it flags a regression."))

# b. a command hook before a node
print("  ", run("--command", "plan", "--hook", "command", "--when", "before",
                "--anchor", "plan-doc", "--run", "npm run lint-spec"))

# c. rename and regroup the phases
print("  ", run("--command", "specify", "--renamed", "author", "our review",
                "--phases", json.dumps([
    {"name": "set up", "nodes": ["resolve-dir", "load-living-specs"]},
    {"name": "our review", "nodes": ["draft-spec", "quality-checklist"]},
    {"name": "size it", "nodes": ["classify-size", "persist-size"]},
    {"name": "finish", "nodes": ["branch", "finalize", "handoff"]},
])))

# d. reorder inside a phase
print("  ", run("--command", "plan", "--nodes",
                "gather-context,size-budget,plan-doc,constitution-check,side-files,handoff"))

# e. rewrite a node
own = project / ".specify" / "companion" / "nodes" / "specify"
own.mkdir(parents=True)
(own / "draft-spec.md").write_text(
    "---\nid: draft-spec\nname: Draft the spec (ours)\nkind: author\nwrites: spec.md\n---\n\n"
    "Write the spec the way THIS TEAM writes specs.\n", encoding="utf-8")
print("   wrote .specify/companion/nodes/specify/draft-spec.md")

# f. a node of our own, attached as a hook
shared = project / ".specify" / "companion" / "nodes"
(shared / "house-review.md").write_text(
    "---\nid: house-review\n---\n\nRe-read it against the house style guide.\n",
    encoding="utf-8")
print("  ", run("--command", "tasks", "--hook", "node", "--when", "after",
                "--anchor", "tasks-doc", "--ref", "house-review"))

print()
print("=" * 68)
print("3. what the build would change")
print("=" * 68)
dry = build("--dry-run")
for line in dry.stdout.splitlines():
    if line.startswith("[build]") or line.strip().startswith(("specify:", "plan:", "tasks:")):
        print("  ", line.strip())

print()
print("=" * 68)
print("4. build, and diff against shipped")
print("=" * 68)
result = build()
assert result.returncode == 0, result.stdout + result.stderr
built = project / ".specify" / "extensions" / "companion" / "commands"

import difflib
for name in sorted(os.listdir(built)):
    if not name.endswith(".md"):
        continue
    before = (shipped_dir / name).read_text(encoding="utf-8").splitlines()
    after = (built / name).read_text(encoding="utf-8").splitlines()
    added = [l for l in difflib.unified_diff(before, after, lineterm="", n=0)
             if l.startswith("+") and not l.startswith("+++")]
    removed = [l for l in difflib.unified_diff(before, after, lineterm="", n=0)
               if l.startswith("-") and not l.startswith("---")]
    if added or removed:
        print(f"   {name}: +{len(added)} −{len(removed)}")
        for line in added:
            body = line[1:].strip()
            if body and not body.startswith("<!--"):
                print(f"      + {body[:88]}")

print()
print("=" * 68)
print("5. what the panel now reports")
print("=" * 68)
g = graph()
assert g["customised"], "a project that changed six things should read as customised"
print("   counts:", g["counts"])
print("   workflow:", g["workflows"])
for s in g["steps"]:
    c = s["changes"]
    bits = [k for k in ("added", "removed", "replaced", "phases", "decisions")
            if c[k]] + (["reordered"] if c["reordered"] else [])
    if bits or c["hooks"]:
        print(f"   {s['name']}: {c['hooks']} hooks, changed: {', '.join(bits) or '—'}")
        if c["phases"]:
            print(f"      phases now: {[p['name'] for p in s['phases']]}")

print()
print(f"project kept at {project}")
