#!/usr/bin/env python3
"""Does customising the pipeline break the gates the shipped one passes?

The e2e flow proves a project's edits reach the built bodies. This asks the
next question: are those bodies still good commands. It builds a customised
pipeline, overlays it on the full installed command set, and runs the same
command-quality eval and instruction-budget count the shipped set is held to.

A build that applies your configuration and quietly produces commands that
prompt for input, blow the budget, or lose a required instruction would be
worse than one that refused.

    python3 tests/e2e_customised_quality.py <repo-root>
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(sys.argv[1])
SCRIPTS = REPO / "speckit-extension" / "scripts"
EVAL = REPO / ".claude" / "skills" / "eval-speckit-extension" / "check_quality.py"
SHIPPED_COMMANDS = REPO / "speckit-extension" / "commands"

project = Path(tempfile.mkdtemp(prefix="pb-quality-"))
(project / ".specify").mkdir(parents=True)


def run(*args):
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "config_write.py"), "--project", str(project), *args],
        capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(f"REFUSED: {result.stdout}{result.stderr}")


def evaluate(commands_dir: Path) -> dict:
    result = subprocess.run(
        [sys.executable, str(EVAL), "--commands-dir", str(commands_dir), "--json"],
        capture_output=True, text=True)
    return json.loads(result.stdout)


def directives(path: Path) -> int:
    """How many instructions one command body carries, by the repo's own count."""
    import importlib

    sys.path.insert(0, str(SCRIPTS))
    counter = importlib.import_module("instruction-budget")
    return counter.directives(path.read_text(encoding="utf-8"))


print("1. the shipped command set")
before = evaluate(SHIPPED_COMMANDS)
tally = before.get("tally", before)
print(f"   {tally}")

print()
print("2. a customised pipeline")
run("--new-workflow", "demo", "--seed-from", "")
run("--command", "specify", "--hook", "skill", "--when", "after", "--anchor", "author",
    "--ref", "verify-code-review", "--text", "Block the spec on a regression.")
run("--command", "plan", "--hook", "command", "--when", "before", "--anchor", "plan-doc",
    "--run", "npm run lint-spec")
run("--command", "specify", "--renamed", "author", "our review", "--phases", json.dumps([
    {"name": "set up", "nodes": ["resolve-dir", "load-living-specs"]},
    {"name": "our review", "nodes": ["draft-spec", "quality-checklist"]},
    {"name": "size it", "nodes": ["classify-size", "persist-size"]},
    {"name": "finish", "nodes": ["branch", "finalize", "handoff"]},
]))
own = project / ".specify" / "companion" / "nodes" / "specify"
own.mkdir(parents=True)
(own / "draft-spec.md").write_text(
    "---\nid: draft-spec\nname: Draft the spec (ours)\nkind: author\nwrites: spec.md\n---\n\n"
    "Load `spec-template.md` and write the specification the way this team writes them.\n"
    "Keep every section the template declares, in its order.\n", encoding="utf-8")

# The installed set is 19 commands; a build rewrites the 5 assembled from nodes.
out = project / ".specify" / "extensions" / "companion" / "commands"
out.mkdir(parents=True)
for path in SHIPPED_COMMANDS.glob("*.md"):
    shutil.copy(path, out / path.name)
shutil.copytree(REPO / "speckit-extension" / "presets",
                project / ".specify" / "extensions" / "companion" / "presets")

result = subprocess.run(
    [sys.executable, str(SCRIPTS / "build-pipeline.py"), "--project", str(project)],
    capture_output=True, text=True)
if result.returncode:
    raise SystemExit(result.stdout + result.stderr)
print("   built:", [l for l in result.stdout.splitlines() if "built" in l][0].strip())

print()
print("3. the same gates, against the customised build")
after = evaluate(out)
tally_after = after.get("tally", after)
print(f"   {tally_after}")

failed_before = {c["id"] for c in before.get("checks", []) if c["status"] == "FAIL"}
failed_after = {c["id"] for c in after.get("checks", []) if c["status"] == "FAIL"}
introduced = failed_after - failed_before

print()
if introduced:
    print(f"   REGRESSION — customising broke: {', '.join(sorted(introduced))}")
    for check in after.get("checks", []):
        if check["id"] in introduced:
            print(f"      {check['id']}: {check.get('detail', '')}")
    raise SystemExit(1)

print("   no gate the shipped set passes is broken by customising it.")

print()
print("4. what the customisation cost in instructions")
for command in ("specify", "plan", "tasks", "implement"):
    name = f"speckit.companion.{command}.md"
    was = directives(SHIPPED_COMMANDS / name)
    now = directives(out / name)
    note = "" if now == was else "   <- what you added"
    print(f"   {command:10} {was:3} -> {now:3} directives ({now - was:+d}){note}")
print()
print(f"project kept at {project}")
