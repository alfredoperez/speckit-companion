#!/usr/bin/env python3
"""Several named ways of working in one project.

A project had exactly one configuration: `companion.yml`. But a one-line fix and
a client deliverable are not the same pipeline, and the only way to run both was
to edit the file back and forth and hope the diff was clean.

A workflow is a whole named configuration in `.specify/companion/workflows/`.
Switching one switches all of it — order, hooks, templates, routing — which is
why the selected file REPLACES `companion.yml` rather than merging with it: a
merge would produce a third pipeline nobody wrote.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import config_write  # noqa: E402

build = importlib.import_module("build-pipeline")
graph_mod = importlib.import_module("pipeline-graph")


def project(companion: str = "", workflows: dict = None):
    tmp = tempfile.TemporaryDirectory()
    specify = Path(tmp.name) / ".specify"
    specify.mkdir(parents=True)
    if companion:
        (specify / "companion.yml").write_text(companion, encoding="utf-8")
    for name, text in (workflows or {}).items():
        directory = specify / "companion" / "workflows"
        directory.mkdir(parents=True, exist_ok=True)
        (directory / f"{name}.yml").write_text(text, encoding="utf-8")
    return tmp


HOOKED = ("commands:\n  plan:\n    hooks:\n      after:\n        plan-doc:\n"
          "          - { type: prompt, text: \"check it\" }\n")


class WithoutASelectionNothingChanges(unittest.TestCase):
    def test_companion_yml_is_the_configuration(self):
        with project(HOOKED) as root:
            self.assertEqual(build.active_workflow(root), "")
            config = build.load_config(root)
        self.assertIn("plan", config["commands"])

    def test_a_project_with_no_workflows_still_offers_shipped(self):
        with project(HOOKED) as root:
            self.assertEqual(build.available_workflows(root), [])
            graph = graph_mod.build_graph(root)
        self.assertEqual(graph["workflows"]["available"], ["shipped"])
        self.assertEqual(graph["workflows"]["active"], "")


class ASelectionReplacesTheConfiguration(unittest.TestCase):
    """Switching swaps the whole thing — the two are never merged."""

    def test_the_named_workflow_is_what_a_build_reads(self):
        with project(
            "workflow: bugfix\n" + HOOKED,
            {"bugfix": "commands:\n  plan:\n    nodes: [plan-doc, handoff]\n"},
        ) as root:
            config = build.load_config(root)

        self.assertEqual(config["commands"]["plan"]["nodes"], ["plan-doc", "handoff"])
        # companion.yml's own hook does not leak into the workflow.
        self.assertNotIn("hooks", config["commands"]["plan"])

    def test_shipped_selects_no_configuration_at_all(self):
        with project("workflow: shipped\n" + HOOKED) as root:
            self.assertEqual(build.load_config(root), {})
            graph = graph_mod.build_graph(root)
        self.assertFalse(graph["customised"])

    def test_a_selection_with_no_file_is_refused_by_name(self):
        with project("workflow: missing\n", {"bugfix": "commands: {}\n"}) as root:
            with self.assertRaises(build.BuildError) as caught:
                build.load_config(root)
        message = str(caught.exception)
        self.assertIn("missing", message)
        self.assertIn("bugfix", message)

    def test_every_workflow_is_listed_with_the_active_one_named(self):
        with project("workflow: client\n",
                     {"bugfix": "commands: {}\n", "client": "commands: {}\n"}) as root:
            graph = graph_mod.build_graph(root)
        self.assertEqual(graph["workflows"]["available"], ["shipped", "bugfix", "client"])
        self.assertEqual(graph["workflows"]["active"], "client")


class WritingTheSelection(unittest.TestCase):
    def test_the_key_goes_in_above_the_commands(self):
        out = config_write.set_workflow(HOOKED, "bugfix")
        self.assertTrue(out.startswith('workflow: "bugfix"'))
        self.assertIn("check it", out)

    def test_switching_again_replaces_rather_than_stacks(self):
        once = config_write.set_workflow(HOOKED, "bugfix")
        twice = config_write.set_workflow(once, "client")
        self.assertEqual(twice.count("workflow:"), 1)
        self.assertIn('workflow: "client"', twice)

    def test_a_comment_above_the_selection_survives(self):
        out = config_write.set_workflow("# ours\n\n" + HOOKED, "bugfix")
        self.assertIn("# ours", out)

    def test_the_result_reads_back_as_the_selection(self):
        import companion_config as cc

        out = config_write.set_workflow(HOOKED, "bugfix")
        self.assertEqual(cc.load_yaml(out)["workflow"], "bugfix")


class CreatingAWorkflow(unittest.TestCase):
    def test_a_new_one_starts_from_what_is_running(self):
        with project(HOOKED) as root:
            config_write.new_workflow(root, "bugfix", seed_from="")
            created = (Path(root) / ".specify" / "companion" / "workflows" / "bugfix.yml")
            text = created.read_text(encoding="utf-8")
        # Seeded from nothing named, so it is a blank slate with a header.
        self.assertIn("# bugfix", text)

    def test_seeding_from_the_project_copies_its_configuration(self):
        with project(HOOKED) as root:
            config_write.new_workflow(root, "bugfix", seed_from="this")
            text = (Path(root) / ".specify" / "companion" / "workflows"
                    / "bugfix.yml").read_text(encoding="utf-8")
        self.assertIn("check it", text)
        # The selection does not travel into the copy, or it would point at
        # itself. The header comment mentions the key, so look for the setting.
        settings = [l for l in text.splitlines() if not l.lstrip().startswith("#")]
        self.assertFalse([l for l in settings if l.startswith("workflow:")])

    def test_a_name_that_cannot_be_a_filename_is_refused(self):
        with project() as root:
            for bad in ("Bug Fix", "../escape", "", "UPPER"):
                with self.assertRaises(config_write.ConfigWriteError):
                    config_write.new_workflow(root, bad)

    def test_it_will_not_overwrite_one_that_exists(self):
        with project("", {"bugfix": "commands: {}\n"}) as root:
            with self.assertRaises(config_write.ConfigWriteError):
                config_write.new_workflow(root, "bugfix")


class NodesAreSharedAcrossWorkflows(unittest.TestCase):
    """A node written once is available to every workflow, or to none."""

    def test_a_replaced_node_applies_under_whichever_workflow_is_on(self):
        with project("workflow: bugfix\n", {"bugfix": "commands: {}\n"}) as root:
            own = Path(root) / ".specify" / "companion" / "nodes" / "specify"
            own.mkdir(parents=True)
            (own / "draft-spec.md").write_text(
                "name: ours\nkind: author\nwrites: spec.md\n---\n\nOur words.\n",
                encoding="utf-8")
            graph = graph_mod.build_graph(root)

        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        self.assertEqual(specify["changes"]["replaced"], ["draft-spec"])


class TheOtherHookSystemIsVisibleToo(unittest.TestCase):
    """`.specify/extensions.yml` is spec-kit's own registry. A run fires both."""

    REGISTRY = (
        "installed:\n"
        "- companion\n"
        "hooks:\n"
        "  before_specify:\n"
        "  - extension: git\n"
        "    command: speckit.git.feature\n"
        "    enabled: true\n"
        "    optional: false\n"
        "    description: Create feature branch before specification\n"
        "      on the current checkout\n"
        "    condition: null\n"
        "  after_specify:\n"
        "  - extension: git\n"
        "    command: speckit.git.commit\n"
        "    enabled: false\n"
        "    optional: true\n"
        "  - extension: companion\n"
        "    command: speckit.companion.after-specify\n"
        "    optional: false\n"
        "    condition: has_changes\n"
    )

    def with_registry(self, text: str):
        tmp = tempfile.TemporaryDirectory()
        specify = Path(tmp.name) / ".specify"
        specify.mkdir(parents=True)
        (specify / "extensions.yml").write_text(text, encoding="utf-8")
        return tmp

    def test_hooks_registered_against_a_step_are_reported(self):
        with self.with_registry(self.REGISTRY) as root:
            hooks = build.stock_hooks(root, "specify")

        commands = [(h["when"], h["command"]) for h in hooks]
        self.assertIn(("before", "speckit.git.feature"), commands)
        self.assertIn(("after", "speckit.companion.after-specify"), commands)

    def test_a_disabled_hook_is_left_out(self):
        with self.with_registry(self.REGISTRY) as root:
            hooks = build.stock_hooks(root, "specify")
        self.assertNotIn("speckit.git.commit", [h["command"] for h in hooks])

    def test_a_wrapped_description_arrives_whole(self):
        with self.with_registry(self.REGISTRY) as root:
            hook = build.stock_hooks(root, "specify")[0]
        self.assertEqual(
            hook["description"],
            "Create feature branch before specification on the current checkout")

    def test_a_conditional_hook_is_flagged_rather_than_promised(self):
        with self.with_registry(self.REGISTRY) as root:
            byname = {h["command"]: h for h in build.stock_hooks(root, "specify")}
        self.assertTrue(byname["speckit.companion.after-specify"]["conditional"])
        self.assertFalse(byname["speckit.git.feature"]["conditional"])

    def test_a_step_with_no_registered_hooks_reports_none(self):
        with self.with_registry(self.REGISTRY) as root:
            self.assertEqual(build.stock_hooks(root, "implement"), [])

    def test_an_absent_or_unreadable_registry_is_no_hooks_not_a_failure(self):
        with tempfile.TemporaryDirectory() as empty:
            self.assertEqual(build.stock_hooks(empty, "specify"), [])
        with self.with_registry("hooks:\n\tbad: [\n") as broken:
            self.assertEqual(build.stock_hooks(broken, "specify"), [])

    def test_the_graph_carries_them_beside_the_projects_own(self):
        with self.with_registry(self.REGISTRY) as root:
            graph = graph_mod.build_graph(root)
        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        self.assertEqual(len(specify["stockHooks"]), 2)
        self.assertEqual(graph["counts"]["stockHooks"], 2)
        # They are not the project's own hooks and must not be counted as them.
        self.assertEqual(graph["counts"]["hooks"], 0)


if __name__ == "__main__":
    unittest.main()
