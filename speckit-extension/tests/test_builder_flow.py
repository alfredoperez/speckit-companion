#!/usr/bin/env python3
"""Everything the builder can change, all the way through to the built command.

Each write path has its own unit test, and the panel has tests for the messages
it sends. Neither answers the question a person actually has: if I add a hook,
regroup the phases, reorder a step and rewrite a node, does all of that come out
the other side of a build?

Nothing checked that before. This drives every action the panel offers through
the same `config_write.py` the panel drives, builds, and then reads the built
command bodies back — because a customisation written to `companion.yml` and
silently dropped by the build is indistinguishable, from the panel, from one
that worked.

Four bugs found by writing it: writes landing in `companion.yml` while the build
read a workflow file; a phase rename orphaning its hooks; the write path not
seeing a project's own nodes, which made handing a step to your own document
refuse itself; and the phase check counting dropped nodes as needing a phase,
which made a step that dropped anything impossible to regroup.

Stdlib `unittest` only.
"""
from __future__ import annotations

import json
import unittest

from builder_harness import Project, Refused

#: A node of the project's own, replacing a shipped one. Deliberately distinctive.
OURS = (
    "---\nid: draft-spec\nname: Draft the spec (ours)\nkind: author\nwrites: spec.md\n---\n\n"
    "Write the spec the way THIS TEAM writes specs.\n"
)

FOUR_PHASES = json.dumps([
    {"name": "set up", "nodes": ["resolve-dir", "load-living-specs"]},
    {"name": "our review", "nodes": ["draft-spec", "quality-checklist"]},
    {"name": "size it", "nodes": ["classify-size", "persist-size"]},
    {"name": "finish", "nodes": ["branch", "finalize", "handoff"]},
])


class EverythingChangedAtOnceReachesTheBuild(unittest.TestCase):
    """The six things the panel can do, done together, then built and read back.

    Together rather than one per project on purpose: each one alone is a unit
    test elsewhere, and what is not covered anywhere else is whether they
    interfere — a rename moving a hook's anchor out from under it, a reorder
    fighting a regrouping.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.project = p = Project()

        # Everything the panel writes goes into a workflow, not companion.yml,
        # once one is selected. Doing this first is what made an earlier version
        # of this catch writes landing in a file the build was not reading.
        p.write("--new-workflow", "demo", "--seed-from", "")

        # a. a skill hook after a phase
        p.write("--command", "specify", "--hook", "skill", "--when", "after",
                "--anchor", "author", "--ref", "verify-code-review",
                "--text", "Block the spec if it flags a regression.")

        # b. a shell hook before a node
        p.write("--command", "plan", "--hook", "command", "--when", "before",
                "--anchor", "plan-doc", "--run", "npm run lint-spec")

        # c. rename and regroup the phases, carrying the hook with the rename
        p.write("--command", "specify", "--renamed", "author", "our review",
                "--phases", FOUR_PHASES)

        # d. reorder within a phase
        p.write("--command", "plan", "--nodes",
                "gather-context,size-budget,plan-doc,constitution-check,side-files,handoff")

        # e. rewrite a node
        p.node("specify", "draft-spec", OURS)

        # f. a node of our own, attached as a hook
        p.shared_node("house-review",
                      "---\nid: house-review\n---\n\nRe-read it against the house style guide.\n")
        p.write("--command", "tasks", "--hook", "node", "--when", "after",
                "--anchor", "tasks-doc", "--ref", "house-review")

        cls.build_output = p.build_ok()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.project.close()

    def test_the_skill_hook_runs_where_it_was_attached(self):
        body = self.project.body("specify")
        self.assertIn("verify-code-review", body)
        self.assertIn("Block the spec if it flags a regression.", body)

    def test_a_renamed_phase_carries_its_hooks_with_it(self):
        # The bug this exists for: renaming a phase used to leave its hooks
        # anchored to a name nothing had any more, so they silently stopped
        # running while the panel still drew them.
        self.assertIn("after-our review-0", self.project.hooks_in("specify"))
        self.assertNotIn("after-author-0", self.project.hooks_in("specify"))

    def test_the_shell_hook_lands_above_the_node_it_runs_before(self):
        body = self.project.body("plan")
        self.assertIn("npm run lint-spec", body)
        self.assertLess(body.index("npm run lint-spec"),
                        body.index("<!-- speckit-companion:node plan-doc -->"))

    def test_the_phases_are_the_ones_this_project_named(self):
        self.assertEqual(self.project.phases_in("specify"),
                         ["set up", "our review", "size it", "finish"])

    def test_the_nodes_run_in_the_order_this_project_asked_for(self):
        order = self.project.nodes_in("plan")
        self.assertLess(order.index("gather-context"), order.index("size-budget"))

    def test_the_projects_own_node_replaced_the_shipped_one(self):
        body = self.project.body("specify")
        self.assertIn("Write the spec the way THIS TEAM writes specs.", body)
        self.assertNotIn("Load `spec-template.md`", body)

    def test_a_node_of_our_own_is_inlined_where_it_was_hooked(self):
        self.assertIn("Re-read it against the house style guide.",
                      self.project.body("tasks"))

    def test_the_panel_reports_the_project_as_customised(self):
        graph = self.project.graph()
        self.assertTrue(graph["customised"])
        self.assertEqual(graph["workflows"]["active"], "demo")

    def test_a_step_nobody_touched_is_reported_as_untouched(self):
        implement = next(s for s in self.project.graph()["steps"]
                         if s["name"] == "implement")
        changes = implement["changes"]
        self.assertEqual(changes["hooks"], 0)
        self.assertFalse(changes["reordered"])
        self.assertEqual(changes["replaced"], [])

    def test_the_build_says_which_steps_it_changed(self):
        self.assertIn("specify", self.build_output)
        self.assertIn("plan", self.build_output)


class PuttingADroppedNodeBack(unittest.TestCase):
    """A node the recipe dropped, returned to a phase and to the order.

    The order says when it runs and the phase says where it sits; a project with
    one and not the other is a pipeline that contradicts itself.
    """

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        # A recipe that runs three of specify's nodes and drops the rest. The
        # order goes first: a phase grouping is checked against the nodes the
        # step is running, so declaring the phases first would be refused for
        # leaving every dropped node without one.
        self.project.write("--command", "specify", "--nodes",
                           "resolve-dir,draft-spec,handoff")
        self.project.write("--command", "specify", "--phases", json.dumps([
            {"name": "author", "nodes": ["resolve-dir", "draft-spec", "handoff"]},
        ]))

    def test_the_dropped_nodes_are_offered_by_name(self):
        specify = next(s for s in self.project.graph()["steps"] if s["name"] == "specify")
        self.assertIn("quality-checklist", specify["dropped"])

    def test_a_node_put_back_runs_and_sits_where_it_was_put(self):
        # Phases first when ADDING: a node needs a home before it can run, and
        # the order check reads the grouping in force to decide whether the
        # sequence is contiguous. (Replacing a step is the mirror image — the
        # order goes first there, because it is what drops the other nodes.)
        self.project.write("--command", "specify", "--phases", json.dumps([
            {"name": "author", "nodes": ["resolve-dir", "draft-spec",
                                         "quality-checklist", "handoff"]},
        ]))
        self.project.write("--command", "specify", "--nodes",
                           "resolve-dir,draft-spec,quality-checklist,handoff")
        self.project.build_ok()

        order = self.project.nodes_in("specify")
        self.assertEqual(order, ["resolve-dir", "draft-spec", "quality-checklist", "handoff"])

    def test_a_grouping_that_leaves_a_running_node_homeless_is_refused(self):
        before = self.project.config_text()
        with self.assertRaises(Refused) as refusal:
            self.project.write("--command", "specify", "--phases", json.dumps([
                {"name": "author", "nodes": ["resolve-dir", "draft-spec"]},
            ]))
        self.assertIn("handoff", str(refusal.exception))
        self.assertEqual(self.project.config_text(), before,
                         "a refused write must leave the file untouched")


class AddingAShippedOptionalNode(unittest.TestCase):
    """A node Companion ships but does not run by default.

    `review-gaps` sat in-tree, written and tested, held out of the baseline
    order with a comment saying it was there to re-add as a layer — and there
    was no way to re-add it. Every existence check on the way through used the
    "is this the project's own copy?" flag as a stand-in for "does this file
    exist?", so a shipped node outside the default order was refused by the
    write, refused again by the build, and never offered by the panel.
    """

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def test_the_panel_offers_it(self):
        tasks = next(s for s in self.project.graph()["steps"] if s["name"] == "tasks")
        self.assertIn("review-gaps", tasks["dropped"])

    def test_the_panel_can_say_it_is_an_add_on_rather_than_one_we_took_out(self):
        """As bare ids the two read identically, which is no help at all."""
        tasks = next(s for s in self.project.graph()["steps"] if s["name"] == "tasks")
        self.assertEqual(tasks["addOns"], ["review-gaps"])

    def test_a_node_the_recipe_took_out_is_not_called_an_add_on(self):
        self.project.write(
            "--command", "tasks", "--nodes", "size-budget,handoff",
            "--phases", json.dumps([
                {"name": "gather", "nodes": ["size-budget"]},
                {"name": "wrap-up", "nodes": ["handoff"]},
            ]))
        tasks = next(s for s in self.project.graph()["steps"] if s["name"] == "tasks")
        self.assertIn("tasks-doc", tasks["dropped"])
        self.assertNotIn("tasks-doc", tasks["addOns"])

    def test_an_add_on_already_running_is_offered_by_neither(self):
        self.project.write("--command", "tasks", "--phases", json.dumps([
            {"name": "gather", "nodes": ["size-budget"]},
            {"name": "author", "nodes": ["tasks-doc", "review-gaps"]},
            {"name": "wrap-up", "nodes": ["handoff"]},
        ]))
        self.project.write("--command", "tasks", "--nodes",
                           "size-budget,tasks-doc,review-gaps,handoff")
        tasks = next(s for s in self.project.graph()["steps"] if s["name"] == "tasks")
        self.assertNotIn("review-gaps", tasks["dropped"])
        self.assertNotIn("review-gaps", tasks["addOns"])

    def test_it_can_be_added_and_reaches_the_built_command(self):
        self.project.write("--command", "tasks", "--phases", json.dumps([
            {"name": "gather", "nodes": ["size-budget"]},
            {"name": "author", "nodes": ["tasks-doc", "review-gaps"]},
            {"name": "wrap-up", "nodes": ["handoff"]},
        ]))
        self.project.write("--command", "tasks", "--nodes",
                           "size-budget,tasks-doc,review-gaps,handoff")
        self.project.build_ok()

        self.assertIn("review-gaps", self.project.nodes_in("tasks"))

    def test_a_node_that_does_not_exist_is_still_refused(self):
        with self.assertRaises(Refused) as refusal:
            self.project.write("--command", "tasks", "--nodes",
                               "size-budget,tasks-doc,invented,handoff")
        self.assertIn("invented", str(refusal.exception))


class RunningADifferentBlockInANodesPlace(unittest.TestCase):
    """A variant: same slot in the run, different instructions.

    A swap is neither an add nor a drop but both at once — the old node leaves
    the order as the new one joins it — so whichever half is written first is
    refused by the check that reads the other half as it still was. The two are
    written and validated together for that reason.
    """

    #: specify with `draft-spec` swapped for its brownfield variant.
    PHASES = json.dumps([
        {"name": "gather", "nodes": ["resolve-dir", "load-living-specs"]},
        {"name": "author", "nodes": ["draft-spec-delta", "quality-checklist"]},
        {"name": "classify", "nodes": ["classify-size", "persist-size"]},
        {"name": "wrap-up", "nodes": ["branch", "finalize", "handoff"]},
    ])
    ORDER = ("resolve-dir,load-living-specs,draft-spec-delta,quality-checklist,"
             "classify-size,persist-size,branch,finalize,handoff")

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def swap(self):
        return self.project.write("--command", "specify",
                                  "--phases", self.PHASES, "--nodes", self.ORDER)

    def test_the_panel_offers_it_as_an_alternative(self):
        specify = next(s for s in self.project.graph()["steps"] if s["name"] == "specify")
        draft = next(n for p in specify["phases"] for n in p["nodes"]
                     if n["id"] == "draft-spec")
        self.assertIn("draft-spec-delta", [v["id"] for v in draft["variants"]])

    def test_the_swap_is_one_write(self):
        said = self.swap()
        self.assertIn("phases and order", said)
        config = self.project.config_text()
        self.assertIn("draft-spec-delta", config)
        self.assertIn("phases:", config)
        self.assertIn("nodes:", config)

    def test_the_variant_runs_and_the_node_it_replaced_does_not(self):
        self.swap()
        self.project.build_ok()
        order = self.project.nodes_in("specify")
        self.assertIn("draft-spec-delta", order)
        self.assertNotIn("draft-spec", order)

    def test_a_node_that_reads_the_slot_is_satisfied_by_the_variant(self):
        # `quality-checklist` reads `draft-spec`. A variant occupies the same
        # slot, so the dependency holds — without that, every variant of a node
        # anything reads would be unusable.
        self.swap()
        self.project.build_ok()
        self.assertIn("quality-checklist", self.project.nodes_in("specify"))

    def test_a_swap_that_would_break_a_dependency_is_still_refused(self):
        with self.assertRaises(Refused) as refusal:
            self.project.write("--command", "specify", "--phases", json.dumps([
                {"name": "author", "nodes": ["resolve-dir", "quality-checklist", "handoff"]},
            ]), "--nodes", "resolve-dir,quality-checklist,handoff")
        self.assertIn("draft-spec", str(refusal.exception))


class AttachingWorkToAStepEdge(unittest.TestCase):
    """A hook on the step itself, outside every phase.

    The outermost anchor was a phase, so "before this step starts" had nowhere
    to attach: you named whichever phase happened to be first, and re-pointed
    the hook the day it was renamed or split. A step edge is the one anchor a
    regroup cannot invalidate.
    """

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def test_a_before_hook_runs_ahead_of_the_first_phase(self):
        self.project.write("--command", "specify", "--hook", "prompt",
                           "--when", "before", "--anchor", "specify",
                           "--text", "Read the steering docs first.")
        self.project.build_ok()
        body = self.project.body("specify")
        self.assertLess(body.index("Read the steering docs first."),
                        body.index("<!-- speckit-companion:phase "))

    def test_an_after_hook_runs_past_the_last_phase(self):
        self.project.write("--command", "specify", "--hook", "command",
                           "--when", "after", "--anchor", "specify",
                           "--run", "echo done >> LOG")
        self.project.build_ok()
        body = self.project.body("specify")
        self.assertGreater(body.index("echo done >> LOG"),
                           body.rindex("<!-- /speckit-companion:phase "))

    def test_it_survives_a_regroup_that_would_orphan_a_phase_anchor(self):
        self.project.write("--command", "specify", "--hook", "prompt",
                           "--when", "before", "--anchor", "specify",
                           "--text", "Still here after the regroup.")
        self.project.write("--command", "specify", "--phases", FOUR_PHASES)
        self.project.build_ok()
        self.assertIn("Still here after the regroup.", self.project.body("specify"))

    def test_a_node_anchor_still_attaches_to_its_node(self):
        self.project.write("--command", "specify", "--hook", "prompt",
                           "--when", "before", "--anchor", "draft-spec",
                           "--text", "Node-level, not step-level.")
        self.project.build_ok()
        body = self.project.body("specify")
        self.assertLess(body.index("Node-level, not step-level."),
                        body.index("<!-- speckit-companion:node draft-spec -->"))


class PointingATemplateSectionAtAFragment(unittest.TestCase):
    """Swapping the shape of a document without rewriting the node that writes it.

    The section-replacement mechanism has shipped since the template engine
    landed, with its own docstring naming "outcomes instead of user stories" as
    the case it was built for — and no fragment to point at, no writer to point
    with, and nothing in the panel offering either.
    """

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        templates = self.project.root / ".specify" / "templates"
        templates.mkdir(parents=True, exist_ok=True)
        (templates / "spec-template.md").write_text(
            "# Spec\n\n"
            "## User Scenarios & Testing *(mandatory)*\n\nShipped words here.\n\n"
            "## Requirements\n\nUntouched.\n", encoding="utf-8")

    def point_at(self, fragment: str) -> str:
        return self.project.write(
            "--command", "specify",
            "--template-section", "User Scenarios & Testing", "--fragment", fragment)

    def resolved(self) -> str:
        path = (self.project.root / ".specify" / "extensions" / "companion"
                / "templates" / "spec-template.md")
        return path.read_text(encoding="utf-8")

    def test_a_shipped_fragment_replaces_the_section(self):
        self.point_at("outcomes")
        self.project.build_ok()
        self.assertIn("### Outcomes", self.resolved())
        self.assertNotIn("Shipped words here.", self.resolved())

    # A resolved template is a file the assistant has no reason to open:
    # Companion's authoring nodes carry the document's shape in their own
    # instructions rather than loading a template, which is where the leaner spec
    # comes from. So every fragment resolved correctly into a file nothing read,
    # and a project watching the build report the swap got the shipped shape.
    def test_swapping_a_block_carries_the_hooks_on_it(self):
        """A node id is a hook anchor, so a swap renames one.

        The same detachment a phase rename used to cause: the build warns and
        skips a hook pointing at a name nothing has any more, so work someone
        attached quietly stops running while the panel still drew it.
        """
        project = Project()
        self.addCleanup(project.close)
        project.write("--command", "specify", "--when", "before", "--anchor", "draft-spec",
                      "--hook", "prompt", "--text", "Read the house rules first.")
        phases = [
            {"name": "gather", "nodes": ["resolve-dir", "load-living-specs"]},
            {"name": "author", "nodes": ["draft-spec-delta", "quality-checklist"]},
            {"name": "classify", "nodes": ["classify-size", "persist-size"]},
            {"name": "wrap-up", "nodes": ["branch", "finalize", "handoff"]},
        ]
        order = [n for p in phases for n in p["nodes"]]
        project.write("--command", "specify", "--phases", json.dumps(phases),
                      "--nodes", ",".join(order),
                      "--renamed", "draft-spec", "draft-spec-delta")
        out = project.build_ok()
        body = project.body("specify")
        self.assertIn("Read the house rules first.", body)
        self.assertNotIn("not in active recipe", out)
        self.assertLess(body.index("Read the house rules first."),
                        body.index("<!-- speckit-companion:node draft-spec-delta -->"))

    def test_the_command_tells_the_assistant_to_follow_it(self):
        self.point_at("outcomes")
        self.project.build_ok()
        body = self.project.body("specify")
        self.assertIn("reshaped what this step writes", body)
        self.assertIn("templates/spec-template.md", body)
        self.assertIn("**User Scenarios & Testing**", body)

    def test_the_note_sits_with_the_node_that_writes_the_document(self):
        self.point_at("outcomes")
        self.project.build_ok()
        body = self.project.body("specify")
        opened = body.index("<!-- speckit-companion:node draft-spec -->")
        closed = body.index("<!-- /speckit-companion:node draft-spec -->")
        self.assertTrue(opened < body.index("reshaped what this step writes") < closed)

    def test_restoring_the_section_takes_the_note_with_it(self):
        self.point_at("outcomes")
        self.project.build_ok()
        self.project.write("--command", "specify", "--template-section",
                           "User Scenarios & Testing", "--fragment", "")
        self.project.build_ok()
        self.assertNotIn("reshaped what this step writes", self.project.body("specify"))

    def test_a_project_that_reshaped_nothing_gets_no_note(self):
        """Present by default, latent: an unchanged project's body is unchanged."""
        plain = Project()
        self.addCleanup(plain.close)
        plain.build_ok()
        self.assertNotIn("reshaped what this step writes", plain.body("specify"))

    def test_the_heading_and_the_other_sections_survive(self):
        self.point_at("outcomes")
        self.project.build_ok()
        body = self.resolved()
        self.assertIn("## User Scenarios & Testing *(mandatory)*", body)
        self.assertIn("Untouched.", body)

    def test_the_fragments_own_frontmatter_does_not_reach_the_document(self):
        self.point_at("outcomes")
        self.project.build_ok()
        self.assertNotIn("summary:", self.resolved())

    def test_choosing_again_replaces_rather_than_stacks(self):
        self.point_at("outcomes")
        self.point_at("ears-requirements")
        self.project.build_ok()
        body = self.resolved()
        self.assertIn("EARS", body)
        self.assertNotIn("### Outcomes", body)

    def test_an_empty_fragment_restores_the_shipped_section(self):
        self.point_at("outcomes")
        self.point_at("")
        self.project.build_ok()
        self.assertIn("Shipped words here.", self.resolved())

    def test_a_section_the_template_does_not_have_is_refused(self):
        with self.assertRaises(Refused) as refusal:
            self.project.write("--command", "specify",
                               "--template-section", "Invented", "--fragment", "outcomes")
        self.assertIn("Invented", str(refusal.exception))

    def test_a_fragment_that_does_not_exist_is_refused_by_name(self):
        with self.assertRaises(Refused) as refusal:
            self.point_at("no-such-fragment")
        self.assertIn("no-such-fragment", str(refusal.exception))

    def test_the_panel_offers_the_sections_and_the_fragments(self):
        graph = self.project.graph()
        names = [f["name"] for f in graph["choices"]["fragments"]]
        self.assertIn("outcomes", names)
        specify = next(s for s in graph["steps"] if s["name"] == "specify")
        self.assertIn("User Scenarios & Testing",
                      specify["template"]["sectionsAvailable"])

    def test_a_project_that_changed_nothing_still_reads_as_shipped(self):
        # The template is reported for every step that has one now, so its
        # presence must not be mistaken for a customisation.
        self.assertFalse(self.project.graph()["customised"])


class HandingAStepToOneDocumentOfYourOwn(unittest.TestCase):
    """Replacing a whole step, rather than rewriting each of its nodes."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.project.node("plan", "plan-ours",
                          "---\nid: plan-ours\nname: plan — ours\nkind: author\n---\n\n"
                          "Plan it the way we plan things, in one page.\n")
        # Order first, as the panel does it: the recipe is what drops the
        # shipped nodes, and a grouping that omits nodes still in the order is
        # refused for leaving them without a phase.
        self.project.write("--command", "plan", "--nodes", "plan-ours")
        self.project.write("--command", "plan", "--phases",
                           json.dumps([{"name": "our plan", "nodes": ["plan-ours"]}]))
        self.project.build_ok()

    def test_the_step_is_that_document_and_nothing_else(self):
        self.assertEqual(self.project.nodes_in("plan"), ["plan-ours"])

    def test_the_shipped_nodes_are_gone_from_the_body(self):
        body = self.project.body("plan")
        self.assertIn("Plan it the way we plan things", body)
        self.assertNotIn("<!-- speckit-companion:node constitution-check -->", body)

    def test_the_other_steps_are_untouched(self):
        self.assertIn("<!-- speckit-companion:node draft-spec -->",
                      self.project.body("specify"))


class RemovingAHook(unittest.TestCase):
    """Taking a hook out, and leaving its neighbours where they were."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        for text in ("first", "second", "third"):
            self.project.write("--command", "specify", "--hook", "prompt",
                               "--when", "after", "--anchor", "draft-spec",
                               "--text", f"Check the {text} thing.")

    def test_the_hook_at_that_index_is_the_one_that_goes(self):
        self.project.write("--command", "specify", "--when", "after",
                           "--anchor", "draft-spec", "--remove-index", "1")
        self.project.build_ok()

        body = self.project.body("specify")
        self.assertIn("Check the first thing.", body)
        self.assertNotIn("Check the second thing.", body)
        self.assertIn("Check the third thing.", body)

    def test_the_survivors_close_up_rather_than_leaving_a_gap(self):
        self.project.write("--command", "specify", "--when", "after",
                           "--anchor", "draft-spec", "--remove-index", "1")
        self.project.build_ok()
        self.assertEqual(self.project.hooks_in("specify"),
                         ["after-draft-spec-0", "after-draft-spec-1"])

    def test_removing_the_last_one_leaves_no_trace_in_the_body(self):
        for _ in range(3):
            self.project.write("--command", "specify", "--when", "after",
                               "--anchor", "draft-spec", "--remove-index", "0")
        self.project.build_ok()
        self.assertEqual(self.project.hooks_in("specify"), [])


class SwitchingWorkflows(unittest.TestCase):
    """The build has to read the configuration the panel is writing into."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def test_a_build_reads_the_workflow_in_force_not_companion_yml(self):
        # The bug: with a workflow selected, the panel's writes went into the
        # workflow file while the build still read companion.yml, so every edit
        # appeared to save and none of them ran.
        self.project.write("--new-workflow", "ours", "--seed-from", "")
        self.project.write("--command", "specify", "--hook", "prompt",
                           "--when", "after", "--anchor", "draft-spec",
                           "--text", "Only in the ours workflow.")
        self.project.build_ok()
        self.assertIn("Only in the ours workflow.", self.project.body("specify"))

    def test_switching_back_to_shipped_drops_what_the_workflow_added(self):
        self.project.write("--new-workflow", "ours", "--seed-from", "")
        self.project.write("--command", "specify", "--hook", "prompt",
                           "--when", "after", "--anchor", "draft-spec",
                           "--text", "Only in the ours workflow.")
        self.project.write("--workflow", "shipped")
        self.project.build_ok()

        self.assertNotIn("Only in the ours workflow.", self.project.body("specify"))
        self.assertFalse(self.project.graph()["customised"])

    def test_switching_back_keeps_the_workflow_for_later(self):
        self.project.write("--new-workflow", "ours", "--seed-from", "")
        self.project.write("--workflow", "shipped")
        self.assertIn("ours", self.project.graph()["workflows"]["available"])


class RecoveringAConfigurationThatCannotBeRead(unittest.TestCase):
    """The way out of a broken pipeline, from the panel rather than the YAML."""

    #: A phase whose last node was dragged out, alongside work worth keeping.
    #: Written by hand because the write path refuses to produce this — a real
    #: project reaches it from an older build, or from editing the file.
    BROKEN = """\
commands:
  specify:
    hooks:
      after:
        draft-spec:
          - { type: prompt, text: "Worth keeping through a repair." }
  tasks:
    phases:
      - name: "gather"
        nodes:
      - name: "author"
        nodes:
          - size-budget
          - tasks-doc
      - name: "wrap-up"
        nodes:
          - handoff
"""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.project.set_config(self.BROKEN)

    def test_the_panel_is_told_what_is_wrong_and_what_it_can_do(self):
        graph = self.project.graph()
        self.assertIn("error", graph)
        self.assertTrue(graph.get("repairs"), "a broken graph must carry its ways out")

    def test_the_narrow_repair_is_offered_before_the_broad_one(self):
        ids = [r["id"] for r in self.project.graph()["repairs"]]
        self.assertLess(ids.index("drop-empty-phases:tasks"), ids.index("reset-all"))

    def test_applying_it_makes_the_pipeline_readable_again(self):
        self.project.repair("drop-empty-phases:tasks")
        self.assertNotIn("error", self.project.graph())

    def test_a_repair_keeps_the_work_it_did_not_have_to_undo(self):
        self.project.repair("drop-empty-phases:tasks")
        self.project.build_ok()
        self.assertIn("Worth keeping through a repair.", self.project.body("specify"))

    def test_a_repaired_pipeline_builds(self):
        broken = self.project.build()
        self.assertNotEqual(broken.returncode, 0, "a broken configuration must not build")
        self.project.repair("drop-empty-phases:tasks")
        self.project.build_ok()


GIT_REGISTRY = """extensions:
  - name: git
    version: 1.0.0
hooks:
  before_specify:
  - extension: git
    command: speckit.git.feature
    enabled: true
    optional: false
    description: Create feature branch before specification
  before_plan:
  - extension: git
    command: speckit.git.commit
    enabled: true
    optional: true
    description: Auto-commit before implementation planning
  after_plan:
  - extension: git
    command: speckit.git.commit
    enabled: true
    optional: true
    description: Auto-commit after implementation planning
"""


class TheCatalogIsWhatThisProjectHas(unittest.TestCase):
    """A hard-coded list would lie about what is installed, and the lie is only
    found when the pipeline runs."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)

    def _commands(self):
        return self.project.graph()["choices"]["commands"]

    def _ids(self):
        return [c["id"] for c in self._commands()]

    def test_companions_own_hooks_are_always_offered(self):
        ids = self._ids()
        for name in ("speckit.companion.after-specify", "speckit.companion.after-plan",
                     "speckit.companion.after-tasks", "speckit.companion.after-implement"):
            self.assertIn(name, ids)

    def test_an_installed_extensions_hooks_are_offered_with_its_own_words(self):
        (self.project.root / ".specify" / "extensions.yml").write_text(
            GIT_REGISTRY, encoding="utf-8")
        by_id = {c["id"]: c for c in self._commands()}
        self.assertIn("speckit.git.feature", by_id)
        self.assertEqual(by_id["speckit.git.feature"]["note"],
                         "Create feature branch before specification")
        self.assertEqual(by_id["speckit.git.feature"]["from"], "git")

    def test_an_absent_extension_offers_nothing(self):
        self.assertNotIn("speckit.git.commit", self._ids())

    def test_a_command_registered_at_several_steps_is_offered_once(self):
        (self.project.root / ".specify" / "extensions.yml").write_text(
            GIT_REGISTRY, encoding="utf-8")
        ids = self._ids()
        self.assertEqual(ids.count("speckit.git.commit"), 1)

    def test_a_command_registered_in_several_places_names_none_of_them(self):
        # The automatic commit sits at nine lifecycle steps in a stock install,
        # so naming the first one read would present one truth out of nine.
        (self.project.root / ".specify" / "extensions.yml").write_text(
            GIT_REGISTRY, encoding="utf-8")
        by_id = {c["id"]: c for c in self._commands()}
        self.assertNotIn("usually", by_id["speckit.git.commit"])

    def test_a_lifecycle_key_becomes_a_readable_placement(self):
        (self.project.root / ".specify" / "extensions.yml").write_text(
            GIT_REGISTRY, encoding="utf-8")
        by_id = {c["id"]: c for c in self._commands()}
        self.assertEqual(by_id["speckit.git.feature"]["usually"], "before specify")

    def test_an_entry_with_no_command_name_is_skipped(self):
        (self.project.root / ".specify" / "extensions.yml").write_text(
            "hooks:\n  before_specify:\n  - extension: git\n    description: nameless\n",
            encoding="utf-8")
        self.assertNotIn("", self._ids())

    def test_an_unreadable_registry_contributes_nothing_and_never_raises(self):
        (self.project.root / ".specify" / "extensions.yml").write_text(
            "hooks: [this is not a map]\n", encoding="utf-8")
        ids = self._ids()
        self.assertIn("speckit.companion.after-specify", ids)
        self.assertNotIn("speckit.git.commit", ids)

    def test_one_malformed_key_costs_only_itself(self):
        # Guarding the whole loop made the result depend on where in the file
        # the bad key sat, and made the picker disagree with the board.
        for placement in ("first", "middle", "last"):
            with self.subTest(bad=placement):
                good_a = ("  before_specify:\n  - extension: a\n"
                          "    command: GOOD.first\n")
                good_b = ("  after_plan:\n  - extension: b\n"
                          "    command: GOOD.second\n")
                bad = "  before_tasks: 5\n"
                order = {"first": bad + good_a + good_b,
                         "middle": good_a + bad + good_b,
                         "last": good_a + good_b + bad}[placement]
                (self.project.root / ".specify" / "extensions.yml").write_text(
                    "hooks:\n" + order, encoding="utf-8")
                ids = self._ids()
                self.assertIn("GOOD.first", ids)
                self.assertIn("GOOD.second", ids)

    def test_every_entry_carries_an_id_and_a_label(self):
        (self.project.root / ".specify" / "extensions.yml").write_text(
            GIT_REGISTRY, encoding="utf-8")
        for entry in self._commands():
            self.assertTrue(entry["id"])
            self.assertTrue(entry["label"])


if __name__ == "__main__":
    unittest.main()
