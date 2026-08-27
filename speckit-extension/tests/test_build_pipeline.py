#!/usr/bin/env python3
"""Building a project's pipeline from its configuration (R005, R006, R008, R013).

The configuration was already resolved into an order and a set of hooks by
`resolve_order` and `merge_hooks`, and nothing ever consumed either: a project
could declare a recipe or a hook and receive the shipped pipeline regardless.
These tests hold the build that closes that gap — that a recipe reaches the
built body, that a rebuild is byte-identical, that a build which cannot finish
writes nothing, and that hooks land outside the nodes they attach to.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import hook_render  # noqa: E402
import _command_parts as cp  # noqa: E402

build = importlib.import_module("build-pipeline")
assemble = importlib.import_module("assemble-nodes")


def project_with(config_text: str) -> tempfile.TemporaryDirectory:
    tmp = tempfile.TemporaryDirectory()
    specify = Path(tmp.name) / ".specify"
    specify.mkdir(parents=True)
    (specify / "companion.yml").write_text(config_text, encoding="utf-8")
    return tmp


class ARecipeReachesTheBuiltBody(unittest.TestCase):
    """R005 — the configuration is the source of truth."""

    def test_a_dropped_node_is_absent_from_the_body_and_the_manifest(self):
        order = [n for n in assemble.default_order("specify") if n != "quality-checklist"]
        config = {"commands": {"specify": {"nodes": order}}}
        plan, _ = build.plan_build(config)
        body = build.render("specify", plan["specify"])

        self.assertNotIn("speckit-companion:node quality-checklist", body)
        self.assertIn("speckit-companion:node draft-spec", body)

        manifest_mod = importlib.import_module("manifest")
        manifest = manifest_mod.build(orders={"specify": order})
        self.assertNotIn("checklists/requirements.md",
                         manifest_mod.artifacts_for(manifest, "specify"))

    def test_no_configuration_builds_the_shipped_default(self):
        plan, warnings = build.plan_build({})
        self.assertEqual(warnings, [])
        for command, entry in plan.items():
            self.assertEqual(entry["order"], assemble.default_order(command))
            self.assertEqual(build.describe(command, entry).split(": ", 1)[1], "shipped default")


class ARebuildIsIdentical(unittest.TestCase):
    """R006 — unchanged configuration, unchanged output."""

    def test_building_twice_produces_the_same_bytes(self):
        plan, _ = build.plan_build({})
        first = {c: build.render(c, e) for c, e in plan.items()}
        second_plan, _ = build.plan_build({})
        second = {c: build.render(c, e) for c, e in second_plan.items()}
        self.assertEqual(first, second)

    def test_the_cli_rewrites_the_same_bytes(self):
        with tempfile.TemporaryDirectory() as out:
            for _ in range(2):
                result = subprocess.run(
                    [sys.executable, str(SCRIPTS / "build-pipeline.py"), "--out", out],
                    capture_output=True, text=True, cwd=str(EXT.parent),
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            first = {p.name: p.read_bytes() for p in Path(out).iterdir()}

            result = subprocess.run(
                [sys.executable, str(SCRIPTS / "build-pipeline.py"), "--out", out],
                capture_output=True, text=True, cwd=str(EXT.parent),
            )
            self.assertEqual(result.returncode, 0)
            second = {p.name: p.read_bytes() for p in Path(out).iterdir()}
        self.assertEqual(first, second)


class ABuildThatCannotFinishWritesNothing(unittest.TestCase):
    """R008 — the previous working pipeline stays in place."""

    def test_a_recipe_naming_an_unknown_node_is_refused(self):
        config = {"commands": {"plan": {"nodes": ["plan-doc", "no-such-node"]}}}
        with self.assertRaises(build.BuildError) as caught:
            build.plan_build(config)
        self.assertIn("no-such-node", str(caught.exception))

    def test_a_recipe_that_breaks_an_input_is_refused(self):
        # R013: a kept node whose input is no longer produced is a build-time
        # error, not something discovered part-way through a run.
        order = [n for n in assemble.default_order("specify") if n != "draft-spec"]
        config = {"commands": {"specify": {"nodes": order}}}
        with self.assertRaises(build.BuildError) as caught:
            build.plan_build(config)
        self.assertIn("draft-spec", str(caught.exception))

    def test_a_failed_build_leaves_the_previous_output_untouched(self):
        with tempfile.TemporaryDirectory() as out:
            good = subprocess.run(
                [sys.executable, str(SCRIPTS / "build-pipeline.py"), "--out", out],
                capture_output=True, text=True, cwd=str(EXT.parent),
            )
            self.assertEqual(good.returncode, 0, good.stdout + good.stderr)
            before = {p.name: p.read_bytes() for p in Path(out).iterdir()}

            broken = project_with("commands:\n  plan:\n    nodes: [plan-doc, nope]\n")
            self.addCleanup(broken.cleanup)
            failed = subprocess.run(
                [sys.executable, str(SCRIPTS / "build-pipeline.py"),
                 "--project", broken.name, "--out", out],
                capture_output=True, text=True,
            )
            self.assertEqual(failed.returncode, 1)
            self.assertIn("nothing was written", failed.stderr)
            after = {p.name: p.read_bytes() for p in Path(out).iterdir()}
        self.assertEqual(before, after)

    def test_a_configuration_outside_the_subset_is_refused_by_name(self):
        broken = project_with("commands:\n\tplan:\n      nodes: [plan-doc]\n")
        self.addCleanup(broken.cleanup)
        with self.assertRaises(build.BuildError) as caught:
            build.load_config(broken.name)
        self.assertIn("companion.yml", str(caught.exception))


class HooksLandOutsideTheirNode(unittest.TestCase):
    def test_a_before_hook_precedes_the_nodes_opening_marker(self):
        body = "<!-- speckit-companion:node draft-spec -->\nwork\n<!-- /speckit-companion:node draft-spec -->\n"
        entries = [{"when": "before", "anchor": "draft-spec", "index": 0,
                    "hook": {"type": "prompt", "text": "look first"}}]
        out = hook_render.insert_hooks(body, entries)
        self.assertLess(out.index("look first"), out.index("speckit-companion:node draft-spec"))
        self.assertIn("work", out)

    def test_an_after_hook_follows_the_nodes_closing_marker(self):
        body = "<!-- speckit-companion:node handoff -->\nwork\n<!-- /speckit-companion:node handoff -->\n"
        entries = [{"when": "after", "anchor": "handoff", "index": 0,
                    "hook": {"type": "prompt", "text": "then review"}}]
        out = hook_render.insert_hooks(body, entries)
        self.assertGreater(out.index("then review"), out.index("/speckit-companion:node handoff"))

    def test_hooks_at_one_anchor_keep_their_declared_order(self):
        body = "<!-- speckit-companion:node complete -->\nwork\n<!-- /speckit-companion:node complete -->\n"
        entries = [
            {"when": "before", "anchor": "complete", "index": 1,
             "hook": {"type": "prompt", "text": "second"}},
            {"when": "before", "anchor": "complete", "index": 0,
             "hook": {"type": "command", "run": "first-command"}},
        ]
        out = hook_render.insert_hooks(body, entries)
        self.assertLess(out.index("first-command"), out.index("second"))

    def test_a_command_hook_renders_as_a_runnable_block(self):
        rendered = hook_render.render_hook(
            {"when": "before", "anchor": "complete", "index": 0,
             "hook": {"type": "command", "run": "python3 doctor.py"}})
        self.assertIn("```bash", rendered)
        self.assertIn("python3 doctor.py", rendered)

    def test_the_nodes_own_text_is_never_edited(self):
        plan, _ = build.plan_build({
            "commands": {"specify": {"hooks": {"before": {"draft-spec": [
                {"type": "prompt", "text": "an injected instruction"}]}}}}
        })
        body = build.render("specify", plan["specify"])
        without_hooks = hook_render.HOOK_MARKER_LINE.sub("", body)
        without_hooks = without_hooks.replace("an injected instruction\n", "")
        self.assertEqual(cp.strip_node_markers(without_hooks),
                         assemble.assemble_command("specify", markers=False))


class ThePreviewSaysWhatWouldChange(unittest.TestCase):
    """R009 — a build overwrites what the assistant reads, so the question worth
    answering first is what changes, not what it will contain."""

    def test_an_unbuilt_command_reads_as_new(self):
        with tempfile.TemporaryDirectory() as out:
            lines = build.preview({"plan": "body\n"}, out)
        self.assertIn("plan: new", lines[0])

    def test_an_identical_rebuild_reads_as_unchanged(self):
        with tempfile.TemporaryDirectory() as out:
            Path(out, "speckit.companion.plan.md").write_text("body\n", encoding="utf-8")
            lines = build.preview({"plan": "body\n"}, out)
        self.assertIn("plan: unchanged", lines[0])

    def test_a_changed_body_reports_counts_and_the_lines(self):
        with tempfile.TemporaryDirectory() as out:
            Path(out, "speckit.companion.plan.md").write_text("keep\ngone\n", encoding="utf-8")
            lines = build.preview({"plan": "keep\nadded\n"}, out)
        summary = lines[0]
        self.assertIn("+1", summary)
        self.assertIn("−1", summary)
        self.assertTrue(any(line.strip() == "+added" for line in lines))
        self.assertTrue(any(line.strip() == "-gone" for line in lines))

    def test_a_dry_run_writes_nothing(self):
        with tempfile.TemporaryDirectory() as out:
            result = subprocess.run(
                [sys.executable, str(SCRIPTS / "build-pipeline.py"), "--dry-run", "--out", out],
                capture_output=True, text=True, cwd=str(EXT.parent),
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("what would change", result.stdout)
            self.assertEqual(list(Path(out).iterdir()), [])


class ItReadsThisRepositorysOwnConfiguration(unittest.TestCase):
    """The build has a real configuration to prove itself against: this one."""

    def test_the_repos_hooks_reach_the_built_bodies(self):
        config = build.load_config(str(EXT.parent))
        self.assertTrue(config, "this repo's companion.yml did not load")
        plan, _ = build.plan_build(config)
        self.assertTrue(plan["implement"]["hooks"], "the repo declares implement hooks")

        body = build.render("implement", plan["implement"])
        self.assertIn("speckit-companion:hook", body)
        self.assertIn("doctor.py", body, "the configured command hook did not reach the body")


if __name__ == "__main__":
    unittest.main()
