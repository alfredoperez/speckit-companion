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

assemble = importlib.import_module("assemble-nodes")
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
        self.assertEqual(graph["workflows"]["available"], ["", "shipped"])
        self.assertEqual(graph["workflows"]["active"], "")

    def test_nothing_is_parked_while_the_configuration_is_the_one_running(self):
        with project(HOOKED) as root:
            graph = graph_mod.build_graph(root)
        self.assertIsNone(graph["workflows"]["parked"])
        self.assertTrue(graph["configured"])


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
        self.assertEqual(graph["workflows"]["available"],
                         ["", "shipped", "bugfix", "client"])
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


class RunningAsShippedParksRatherThanDeletes(unittest.TestCase):
    """`shipped` bypasses the configuration; nothing it holds is removed, and
    what it holds stays visible so the state can be seen and undone."""

    def hooks_of(self, graph: dict, command: str) -> list:
        step = next(s for s in graph["steps"] if s["name"] == command)
        return (step["hooks"]
                + [h for p in step["phases"] for h in p["hooks"]]
                + [h for p in step["phases"] for n in p["nodes"] for h in n["hooks"]])

    def test_the_parked_hooks_are_drawn_where_they_would_attach(self):
        with project("workflow: shipped\n" + HOOKED) as root:
            graph = graph_mod.build_graph(root)

        parked = [h for h in self.hooks_of(graph, "plan") if h["parked"]]
        self.assertEqual([h["summary"] for h in parked], ["check it"])
        self.assertEqual(graph["workflows"]["parked"],
                         {"file": ".specify/companion.yml",
                          "hooks": 1, "unplaceable": 0})

    def test_a_parked_hook_is_not_counted_as_a_change(self):
        with project("workflow: shipped\n" + HOOKED) as root:
            graph = graph_mod.build_graph(root)

        plan = next(s for s in graph["steps"] if s["name"] == "plan")
        self.assertEqual(plan["changes"]["hooks"], 0)
        self.assertEqual(graph["counts"]["hooks"], 0)
        self.assertFalse(graph["customised"])

    def test_the_project_is_offered_as_the_way_back(self):
        with project("workflow: shipped\n" + HOOKED) as root:
            graph = graph_mod.build_graph(root)
        self.assertEqual(graph["workflows"]["available"], ["", "shipped"])
        self.assertEqual(graph["workflows"]["active"], "shipped")

    def test_the_reported_count_is_what_the_board_actually_draws(self):
        # Two numbers from two sources is how the header came to say a hook was
        # drawn that was nowhere on the page.
        with project("workflow: shipped\n" + HOOKED) as root:
            graph = graph_mod.build_graph(root)

        drawn = sum(
            1
            for step in graph["steps"]
            for h in (step["hooks"]
                      + [x for p in step["phases"] for x in p["hooks"]]
                      + [x for p in step["phases"] for n in p["nodes"]
                         for x in n["hooks"]])
            if h["parked"]
        )
        self.assertEqual(graph["workflows"]["parked"]["hooks"], drawn)

    def test_a_misshapen_configuration_does_not_take_the_board_down(self):
        # A file that parses as YAML but is the wrong shape raises an ordinary
        # exception, not a refusal. The project most likely to hit this is the
        # one that picked the shipped pipeline BECAUSE its config was broken.
        bad = ("workflow: shipped\n"
               "commands:\n"
               "  plan:\n"
               "    hooks:\n"
               "      - { type: command, run: \"echo hi\" }\n")
        with project(bad) as root:
            graph = graph_mod.build_graph(root)
        self.assertTrue(graph["steps"])
        self.assertIsNone(graph["workflows"]["parked"])

    def test_a_configuration_nobody_can_resolve_parks_nothing(self):
        with project("workflow: shipped\ncommands:\n  plan:\n    nodes: [nope]\n") as root:
            graph = graph_mod.build_graph(root)
        self.assertIsNone(graph["workflows"]["parked"])

    def test_switching_to_shipped_leaves_every_hook_where_it_was(self):
        parked = config_write.set_workflow(HOOKED, "shipped")
        self.assertIn("check it", parked)
        self.assertIn('workflow: "shipped"', parked)

    def test_switching_back_restores_exactly_what_was_there(self):
        for before in (HOOKED, "# ours\n\n" + HOOKED):
            parked = config_write.set_workflow(before, "shipped")
            self.assertEqual(config_write.set_workflow(parked, ""), before)

    def test_a_note_written_under_the_selection_survives_the_switch_back(self):
        parked = 'workflow: "shipped"\n# why we parked it\n\n' + HOOKED
        self.assertIn("# why we parked it", config_write.set_workflow(parked, ""))

    def test_going_back_with_no_selection_written_changes_nothing(self):
        self.assertEqual(config_write.set_workflow(HOOKED, ""), HOOKED)

    def test_the_project_is_a_name_the_writer_accepts(self):
        with project("workflow: shipped\n" + HOOKED) as root:
            config_write.check_workflow(root, "")
            path = Path(root) / ".specify" / "companion.yml"
            path.write_text(
                config_write.set_workflow(path.read_text(encoding="utf-8"), ""),
                encoding="utf-8")
            self.assertEqual(build.active_workflow(root), "")
            self.assertIn("plan", build.load_config(root)["commands"])


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


class AnEditGoesWhereTheConfigurationLives(unittest.TestCase):
    """A project on a named workflow keeps its configuration in that file.

    Every write went to `companion.yml` regardless, so on a workflow the hooks,
    phases and reorders landed in a file the build does not read — reported as
    applied, doing nothing. Only the node replacement worked, because nodes are
    shared rather than workflow-scoped.
    """

    def test_without_a_workflow_it_is_companion_yml(self):
        with project(HOOKED) as root:
            self.assertTrue(config_write.config_path(root).endswith("companion.yml"))

    def test_on_a_workflow_it_is_that_workflow_s_file(self):
        with project("workflow: bugfix\n", {"bugfix": "commands: {}\n"}) as root:
            self.assertTrue(
                config_write.config_path(root).endswith("workflows/bugfix.yml"))

    def test_on_shipped_there_is_nowhere_to_write_and_it_says_so(self):
        with project("workflow: shipped\n") as root:
            with self.assertRaises(config_write.ConfigWriteError) as caught:
                config_write.config_path(root)
        self.assertIn("cannot be edited", str(caught.exception))

    def test_a_new_workflow_can_be_added_to_straight_away(self):
        # It used to be seeded with `commands: {}` — an inline value the writers
        # then appended keys under, producing a file nothing could read.
        with project("") as root:
            config_write.new_workflow(root, "fresh", seed_from="")
            path = Path(root) / ".specify" / "companion" / "workflows" / "fresh.yml"
            text = path.read_text(encoding="utf-8")
            path.write_text(
                config_write.add_hook(text, "plan", "after", "plan-doc",
                                      {"type": "prompt", "text": "check it"}),
                encoding="utf-8")
            import companion_config as cc
            parsed = cc.load_yaml(path.read_text(encoding="utf-8"))
        self.assertEqual(
            parsed["commands"]["plan"]["hooks"]["after"]["plan-doc"][0]["text"], "check it")


class RenamingAPhaseCarriesItsHooks(unittest.TestCase):
    """A phase name is a hook anchor, so a rename that drops them is not one."""

    CONFIG = ("commands:\n  specify:\n    hooks:\n      after:\n        author:\n"
              "          - { type: prompt, text: \"read it aloud\" }\n")

    def test_the_anchor_follows_the_new_name(self):
        out = config_write.set_phases(
            self.CONFIG, "specify",
            [{"name": "our review", "nodes": assemble.default_order("specify")}],
            renamed=("author", "our review"))
        import companion_config as cc
        hooks = cc.load_yaml(out)["commands"]["specify"]["hooks"]["after"]
        self.assertIn("our review", hooks)
        self.assertNotIn("author", hooks)
        self.assertEqual(hooks["our review"][0]["text"], "read it aloud")

    def test_the_build_no_longer_warns_that_the_anchor_is_gone(self):
        out = config_write.set_phases(
            self.CONFIG, "specify",
            [{"name": "our review", "nodes": assemble.default_order("specify")}],
            renamed=("author", "our review"))
        with project(out) as root:
            _plan, warnings = build.plan_build(build.load_config(root))
        self.assertEqual(warnings, [])

    def test_without_the_rename_the_hook_is_left_behind(self):
        # The behaviour the rename exists to prevent, stated so it stays fixed.
        out = config_write.set_phases(
            self.CONFIG, "specify",
            [{"name": "our review", "nodes": assemble.default_order("specify")}])
        with project(out) as root:
            _plan, warnings = build.plan_build(build.load_config(root))
        self.assertTrue(any("author" in w for w in warnings))


class PhasesAreTheProjectsToNameAndGroup(unittest.TestCase):
    """The middle block was the one thing a project could see and not touch."""

    GROUPED = (
        "commands:\n"
        "  specify:\n"
        "    phases:\n"
        "      - name: set up\n"
        "        nodes: [resolve-dir, load-living-specs]\n"
        "      - name: our review\n"
        "        nodes: [draft-spec, quality-checklist]\n"
        "      - name: size it\n"
        "        nodes: [classify-size, persist-size]\n"
        "      - name: finish\n"
        "        nodes: [branch, finalize, handoff]\n"
    )

    def tearDown(self):
        assemble.use_project_phases({})

    def test_the_projects_names_reach_the_built_body(self):
        with project(self.GROUPED) as root:
            config = build.load_config(root)
            plan, _warnings = build.plan_build(config)
            body = build.render("specify", plan["specify"])

        for name in ("set up", "our review", "size it", "finish"):
            self.assertIn(f"speckit-companion:phase {name}", body)
        self.assertNotIn("speckit-companion:phase gather", body)

    def test_a_build_reports_which_phases_the_project_named(self):
        with project(self.GROUPED) as root:
            plan, _warnings = build.plan_build(build.load_config(root))
        self.assertEqual(
            plan["specify"]["phasesChanged"],
            ["set up", "our review", "size it", "finish"])

    def test_the_shipped_grouping_reports_no_change(self):
        with project("") as root:
            plan, _warnings = build.plan_build(build.load_config(root))
        self.assertEqual(plan["specify"]["phasesChanged"], [])

    def test_a_hook_can_anchor_on_a_phase_the_project_named(self):
        config = self.GROUPED + (
            "    hooks:\n"
            "      after:\n"
            "        our review:\n"
            "          - { type: prompt, text: \"read it aloud\" }\n"
        )
        with project(config) as root:
            plan, warnings = build.plan_build(build.load_config(root))
            body = build.render("specify", plan["specify"])
        self.assertEqual(warnings, [])
        self.assertIn("read it aloud", body)

    def test_two_phases_with_one_name_are_refused(self):
        bad = ("commands:\n  specify:\n    phases:\n"
               "      - name: same\n        nodes: [resolve-dir]\n"
               "      - name: same\n        nodes: [draft-spec]\n")
        with project(bad) as root:
            with self.assertRaises(build.BuildError) as caught:
                build.plan_build(build.load_config(root))
        self.assertIn("both called", str(caught.exception))

    def test_a_node_in_two_phases_is_refused(self):
        bad = ("commands:\n  specify:\n    phases:\n"
               "      - name: one\n        nodes: [resolve-dir]\n"
               "      - name: two\n        nodes: [resolve-dir]\n")
        with project(bad) as root:
            with self.assertRaises(build.BuildError) as caught:
                build.plan_build(build.load_config(root))
        self.assertIn("more than one phase", str(caught.exception))

    def test_an_empty_phase_is_refused_at_every_layer(self):
        # The panel wrote one by moving a phase's only node elsewhere, and the
        # project could not be read back at all until the file was hand-edited.
        bad = ("commands:\n  specify:\n    phases:\n"
               "      - name: gather\n        nodes: []\n"
               "      - name: rest\n        nodes: [resolve-dir]\n")
        with project(bad) as root:
            with self.assertRaises(build.BuildError) as caught:
                build.plan_build(build.load_config(root))
        self.assertIn("gather", str(caught.exception))
        self.assertIn("no nodes", str(caught.exception))

        with self.assertRaises(config_write.ConfigWriteError):
            config_write.check_phases("specify", [
                {"name": "gather", "nodes": []},
                {"name": "rest", "nodes": assemble.default_order("specify")},
            ])

    def test_a_phase_naming_a_node_that_does_not_exist_is_refused(self):
        bad = ("commands:\n  specify:\n    phases:\n"
               "      - name: one\n        nodes: [invented]\n")
        with project(bad) as root:
            with self.assertRaises(build.BuildError) as caught:
                build.plan_build(build.load_config(root))
        self.assertIn("invented", str(caught.exception))


class WritingTheGrouping(unittest.TestCase):
    def test_it_writes_a_readable_block(self):
        out = config_write.set_phases("", "specify", [
            {"name": "set up", "nodes": ["resolve-dir"]},
        ])
        self.assertIn('- name: "set up"', out)
        self.assertIn("          - resolve-dir", out)

    def test_regrouping_replaces_rather_than_stacks(self):
        once = config_write.set_phases("", "specify", [{"name": "a", "nodes": ["x"]}])
        twice = config_write.set_phases(once, "specify", [{"name": "b", "nodes": ["y"]}])
        self.assertEqual(twice.count("phases:"), 1)
        self.assertNotIn("name: \"a\"", twice)

    def test_a_hook_on_the_same_command_survives_a_regroup(self):
        out = config_write.set_phases(HOOKED, "plan", [{"name": "a", "nodes": ["plan-doc"]}])
        self.assertIn("check it", out)
        self.assertIn("phases:", out)

    def test_it_reads_back_as_what_was_written(self):
        import companion_config as cc

        out = config_write.set_phases("", "specify", [
            {"name": "our review", "nodes": ["draft-spec", "quality-checklist"]},
        ])
        phases = cc.load_yaml(out)["commands"]["specify"]["phases"]
        self.assertEqual(phases, [
            {"name": "our review", "nodes": ["draft-spec", "quality-checklist"]}])

    def test_a_grouping_that_leaves_a_node_homeless_is_refused(self):
        with self.assertRaises(config_write.ConfigWriteError) as caught:
            config_write.check_phases("specify", [{"name": "one", "nodes": ["resolve-dir"]}])
        self.assertIn("every node needs a phase", str(caught.exception))

    def test_a_grouping_that_breaks_reads_is_refused(self):
        with self.assertRaises(config_write.ConfigWriteError):
            config_write.check_phases("specify", [
                {"name": "backwards",
                 "nodes": ["quality-checklist", "draft-spec", "resolve-dir",
                           "load-living-specs", "classify-size", "persist-size",
                           "branch", "finalize", "handoff"]},
            ])


if __name__ == "__main__":
    unittest.main()
