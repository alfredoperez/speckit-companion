#!/usr/bin/env python3
"""Reordering a step's nodes, and saving that order back to `companion.yml`.

Two defects sit behind these tests.

The first: `phases_for` grouped nodes by the shipped phase membership and kept
the *shipped* order inside each phase, so a recipe that swapped two nodes in one
phase produced a byte-identical body while the build printed "reordered". A
change reported as applied and silently discarded is the exact failure this
pipeline keeps closing.

The second is the shape of the fix: phases are contiguous runs of the body, so
an order that interleaves them cannot be built. That is now refused by name
rather than quietly rewritten to the nearest expressible thing.

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

# plan/gather holds two nodes that read nothing from each other, so it is the
# one phase in the shipped pipeline a reorder can legally touch.
PLAN_DEFAULT = ["size-budget", "gather-context", "plan-doc",
                "constitution-check", "side-files", "handoff"]
PLAN_SWAPPED = ["gather-context", "size-budget", "plan-doc",
                "constitution-check", "side-files", "handoff"]


class AReorderInsideAPhaseIsHonoured(unittest.TestCase):
    def test_the_shipped_order_is_what_we_think_it_is(self):
        self.assertEqual(assemble.default_order("plan"), PLAN_DEFAULT)

    def test_the_phase_lists_the_nodes_in_the_order_that_was_asked_for(self):
        gather = next(p for p in assemble.phases_for("plan", PLAN_SWAPPED)
                      if p["name"] == "gather")
        self.assertEqual(gather["nodes"], ["gather-context", "size-budget"])

    def test_the_body_actually_changes(self):
        before = assemble.assemble_command("plan", order=PLAN_DEFAULT)
        after = assemble.assemble_command("plan", order=PLAN_SWAPPED)
        self.assertNotEqual(before, after)
        # The same nodes, in the other order — nothing added or dropped.
        self.assertEqual(sorted(before.splitlines()), sorted(after.splitlines()))

    def test_an_order_within_phases_is_expressible(self):
        self.assertIsNone(assemble.unexpressible_order("plan", PLAN_SWAPPED))


class ALockMeansHeldByADependency(unittest.TestCase):
    """A lock is about `reads:`, not about the shape of the drawing.

    Movability used to be asked one phase at a time, which called every node
    alone in a phase immovable — nine of this pipeline's twenty-four. A node
    can be dragged into another phase, so the question is whether any position
    in the whole step is valid.
    """

    def test_a_node_alone_in_its_phase_can_still_move(self):
        order = assemble.default_order("plan")
        # `constitution-check` is the only node in `check` and reads nothing.
        self.assertEqual(assemble.movability("plan", order)["constitution-check"], "")

    def test_a_node_nothing_depends_on_can_move(self):
        order = assemble.default_order("specify")
        self.assertEqual(assemble.movability("specify", order)["handoff"], "")

    def test_a_node_boxed_in_on_both_sides_cannot(self):
        order = assemble.default_order("plan")
        why = assemble.movability("plan", order)["plan-doc"]
        self.assertIn("after gather-context", why)
        self.assertIn("before", why)

    def test_a_node_two_others_read_has_to_stay_first(self):
        order = assemble.default_order("specify")
        why = assemble.movability("specify", order)["resolve-dir"]
        self.assertIn("has to run after it", why)

    def test_most_of_the_shipped_pipeline_is_free_to_move(self):
        import _command_parts as cp

        locked = [
            n for cmd in cp.decomposed_commands()
            for n, why in assemble.movability(cmd, assemble.default_order(cmd)).items()
            if why
        ]
        # Two, both genuinely boxed in by `reads:`.
        self.assertEqual(sorted(locked), ["plan-doc", "resolve-dir"])


class AnOrderAcrossPhasesIsRefused(unittest.TestCase):
    def test_the_node_that_crosses_is_named(self):
        crossing = ["size-budget", "constitution-check", "gather-context",
                    "plan-doc", "side-files", "handoff"]
        self.assertEqual(assemble.unexpressible_order("plan", crossing), "constitution-check")

    def test_a_build_refuses_it_and_says_which_node(self):
        with tempfile.TemporaryDirectory() as project:
            specify = Path(project) / ".specify"
            specify.mkdir()
            (specify / "companion.yml").write_text(
                "commands:\n  plan:\n    nodes:\n"
                "      - size-budget\n      - constitution-check\n      - gather-context\n"
                "      - plan-doc\n      - side-files\n      - handoff\n",
                encoding="utf-8",
            )
            config = build.load_config(project)
            with self.assertRaises(build.BuildError) as caught:
                build.plan_build(config)
        self.assertIn("constitution-check", str(caught.exception))
        self.assertIn("phase boundary", str(caught.exception))


class TheOrderIsCheckedBeforeItIsWritten(unittest.TestCase):
    """A configuration written and then refused at every build is worse than none."""

    def test_a_legal_reorder_passes(self):
        config_write.check_order("plan", PLAN_SWAPPED)

    def test_running_a_node_before_something_it_reads_is_refused(self):
        with self.assertRaises(config_write.ConfigWriteError) as caught:
            config_write.check_order(
                "specify",
                ["resolve-dir", "load-living-specs", "quality-checklist", "draft-spec",
                 "classify-size", "persist-size", "branch", "finalize", "handoff"],
            )
        self.assertIn("quality-checklist", str(caught.exception))
        self.assertIn("draft-spec", str(caught.exception))

    def test_an_unknown_node_is_refused(self):
        with self.assertRaises(config_write.ConfigWriteError):
            config_write.check_order("plan", PLAN_DEFAULT + ["invented"])

    def test_an_empty_order_is_refused(self):
        with self.assertRaises(config_write.ConfigWriteError):
            config_write.set_nodes("", "plan", [])


class WritingBackLeavesTheRestOfTheFileAlone(unittest.TestCase):
    """The configuration is a file people read and review, not a serialization."""

    EXISTING = (
        "# our pipeline\n"
        "debug: false\n"
        "\n"
        "commands:\n"
        "  specify:\n"
        "    hooks:\n"
        "      after:\n"
        "        author:\n"
        "          - { type: prompt, text: \"re-read it\" }\n"
    )

    def test_an_absent_file_gets_a_whole_block(self):
        out = config_write.set_nodes("", "plan", ["a", "b"])
        self.assertEqual(out, "commands:\n  plan:\n    nodes:\n      - a\n      - b\n")

    def test_another_commands_entry_is_untouched(self):
        out = config_write.set_nodes(self.EXISTING, "plan", ["a", "b"])
        self.assertIn("# our pipeline", out)
        self.assertIn("- { type: prompt, text: \"re-read it\" }", out)
        self.assertIn("  plan:\n    nodes:\n      - a\n      - b\n", out)

    def test_an_existing_order_is_replaced_not_appended(self):
        once = config_write.set_nodes(self.EXISTING, "plan", ["a", "b"])
        twice = config_write.set_nodes(once, "plan", ["b", "a"])
        self.assertEqual(twice.count("nodes:"), 1)
        self.assertIn("      - b\n      - a\n", twice)

    def test_hooks_on_the_same_command_survive_a_reorder(self):
        out = config_write.set_nodes(self.EXISTING, "specify", ["a", "b"])
        self.assertIn("hooks:", out)
        self.assertIn("- { type: prompt, text: \"re-read it\" }", out)
        self.assertIn("nodes:", out)

    def test_the_result_still_reads_as_the_order_that_was_written(self):
        import companion_config as cc

        out = config_write.set_nodes(self.EXISTING, "plan", ["a", "b", "c"])
        parsed = cc.load_yaml(out)
        self.assertEqual(parsed["commands"]["plan"]["nodes"], ["a", "b", "c"])
        self.assertEqual(parsed["debug"], False)


class AHookPointsAtASkillTheProjectAlreadyHas(unittest.TestCase):
    """A project that wrote a skill has written the instructions; do not copy them."""

    def render(self, when: str, anchor: str, **hook) -> str:
        import hook_render

        entry = {"when": when, "anchor": anchor, "index": 0,
                 "hook": {"type": "skill", **hook}}
        return hook_render.render_hook(entry)

    def test_it_names_the_skill_to_invoke(self):
        out = self.render("after", "check", ref="verify-code-review")
        self.assertIn("`verify-code-review`", out)
        self.assertIn("check", out)

    def test_a_note_rides_along_when_there_is_one(self):
        out = self.render("before", "plan-doc", ref="read-adrs", text="Skip drafts.")
        self.assertIn("`read-adrs`", out)
        self.assertIn("Skip drafts.", out)

    def test_the_skill_body_is_never_inlined(self):
        # The whole point: the pipeline points at the skill rather than holding
        # a copy that forks from it the first time the skill is edited.
        out = self.render("after", "check", ref="verify-code-review")
        self.assertLess(len(out.splitlines()), 5)

    def test_a_skill_hook_with_no_ref_is_refused(self):
        import companion_config as cc

        config = {"commands": {"plan": {"hooks": {"after": {"plan-doc": [{"type": "skill"}]}}}}}
        with self.assertRaises(cc.ConfigError) as caught:
            cc.merge_hooks(config, "plan", ["plan-doc"])
        self.assertIn("name the skill", str(caught.exception))

    def test_it_reaches_the_built_body(self):
        with tempfile.TemporaryDirectory() as project:
            specify = Path(project) / ".specify"
            specify.mkdir()
            (specify / "companion.yml").write_text(
                "commands:\n  plan:\n    hooks:\n      after:\n        check:\n"
                "          - { type: skill, ref: verify-code-review }\n",
                encoding="utf-8",
            )
            config = build.load_config(project)
            plan, _warnings = build.plan_build(config)
            body = build.render("plan", plan["plan"])
        self.assertIn("`verify-code-review`", body)


class ANodeHookCanNameAFileTheProjectWrote(unittest.TestCase):
    """`.specify/companion/nodes/<id>.md` — documented since the format shipped.

    It had never worked: refs resolved only against the extension's own parts, so
    the documented way to add your own work as a node refused to build.
    """

    def project_with_node(self, node_id: str, body: str):
        tmp = tempfile.TemporaryDirectory()
        nodes = Path(tmp.name) / ".specify" / "companion" / "nodes"
        nodes.mkdir(parents=True)
        (nodes / f"{node_id}.md").write_text(f"---\nid: {node_id}\n---\n\n{body}\n", encoding="utf-8")
        (Path(tmp.name) / ".specify" / "companion.yml").write_text(
            "commands:\n  plan:\n    hooks:\n      after:\n        plan-doc:\n"
            f"          - {{ type: node, ref: {node_id} }}\n",
            encoding="utf-8",
        )
        return tmp

    def tearDown(self):
        build.use_project_hook_nodes(None)

    def test_the_projects_node_reaches_the_built_body(self):
        with self.project_with_node("review", "Review it our way.") as project:
            build.use_project_hook_nodes(project)
            config = build.load_config(project)
            plan, _warnings = build.plan_build(config)
            body = build.render("plan", plan["plan"])
        self.assertIn("Review it our way.", body)

    def test_the_extensions_own_parts_still_resolve(self):
        # `debug-timing` lives in presets/_parts and this repo's own config uses it.
        self.assertIsNotNone(
            __import__("companion_config").find_node_file(
                "debug-timing", build.hook_node_dirs()))

    def test_a_ref_in_neither_place_says_where_it_looked(self):
        import companion_config as cc

        config = {"commands": {"plan": {"hooks": {"after": {"plan-doc": [
            {"type": "node", "ref": "nowhere"}]}}}}}
        with self.assertRaises(cc.ConfigError) as caught:
            cc.merge_hooks(config, "plan", ["plan-doc"], nodes_dir=build.hook_node_dirs())
        self.assertIn("nowhere", str(caught.exception))
        self.assertIn("_parts", str(caught.exception))


class AddingAHookLeavesTheRestOfTheFileAlone(unittest.TestCase):
    def test_an_empty_file_gets_the_whole_nesting(self):
        out = config_write.add_hook(
            "", "plan", "after", "check", {"type": "skill", "ref": "verify"})
        self.assertEqual(
            out,
            "commands:\n  plan:\n    hooks:\n      after:\n        check:\n"
            '          - { type: skill, ref: "verify" }\n',
        )

    def test_a_second_hook_at_one_anchor_is_appended_not_replaced(self):
        once = config_write.add_hook(
            "", "plan", "after", "check", {"type": "skill", "ref": "verify"})
        twice = config_write.add_hook(
            once, "plan", "after", "check", {"type": "prompt", "text": "Then say why."})
        self.assertEqual(twice.count("- {"), 2)
        self.assertIn('ref: "verify"', twice)
        self.assertIn('text: "Then say why."', twice)

    def test_a_new_anchor_joins_the_existing_when_block(self):
        once = config_write.add_hook(
            "", "plan", "after", "check", {"type": "skill", "ref": "verify"})
        twice = config_write.add_hook(
            once, "plan", "after", "gather", {"type": "prompt", "text": "Read the ADRs."})
        self.assertEqual(twice.count("after:"), 1)
        self.assertIn("        gather:", twice)
        self.assertIn("        check:", twice)

    def test_an_existing_node_order_on_the_same_command_survives(self):
        with_nodes = config_write.set_nodes("", "plan", ["a", "b"])
        out = config_write.add_hook(
            with_nodes, "plan", "before", "a", {"type": "command", "run": "npm test"})
        self.assertIn("      - a\n      - b\n", out)
        self.assertIn('run: "npm test"', out)

    def test_what_was_written_reads_back_as_what_was_asked_for(self):
        import companion_config as cc

        out = config_write.add_hook(
            "", "plan", "after", "check",
            {"type": "skill", "ref": "verify", "text": 'say "why", then stop'})
        hooks = cc.load_yaml(out)["commands"]["plan"]["hooks"]["after"]["check"]
        self.assertEqual(hooks[0]["type"], "skill")
        self.assertEqual(hooks[0]["ref"], "verify")
        self.assertEqual(hooks[0]["text"], 'say "why", then stop')

    def test_text_holding_both_quote_characters_is_refused_not_mangled(self):
        # The reader strips quotes without unescaping, so there is no escape
        # that survives a round trip — refusing beats writing something that
        # reads back different from what was typed.
        with self.assertRaises(config_write.ConfigWriteError):
            config_write.add_hook(
                "", "plan", "after", "check",
                {"type": "prompt", "text": "say \"why\" and don't stop"})

    def test_a_hook_missing_what_it_needs_is_refused(self):
        for hook in ({"type": "skill"}, {"type": "prompt"}, {"type": "command"},
                     {"type": "invented", "text": "x"}):
            with self.assertRaises(config_write.ConfigWriteError):
                config_write.add_hook("", "plan", "after", "check", hook)


if __name__ == "__main__":
    unittest.main()
