#!/usr/bin/env python3
"""A build has to reach the file the assistant actually loads.

The build writes `.specify/extensions/companion/commands/<cmd>.md`. Nothing
dispatches that. What an assistant loads is the EMISSION the installer rendered
into its own directory — `.claude/skills/speckit-companion-specify/SKILL.md` and
its siblings — written once when the extension was added.

So every customisation the panel could make was real in a file nobody read. You
could attach a hook, click Build, watch it report five commands, dispatch the
step, and get the pipeline exactly as installed. The end-to-end test never caught
it because it piped the built body in on stdin rather than dispatching the
command, which proved the body was right and never that anything loaded it.

Stdlib `unittest` only.
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXT = HERE.parent
sys.path.insert(0, str(EXT / "scripts"))
sys.path.insert(0, str(HERE))

import emission_sync  # noqa: E402
from builder_harness import Project  # noqa: E402

#: A body shaped like one the build assembles — the markers are what make it one.
BODY = (
    "---\n"
    'description: "Companion specify"\n'
    "---\n"
    "\n## Outline\n\n"
    "<!-- speckit-companion:node draft-spec -->\n"
    "Write the spec.\n"
    "<!-- /speckit-companion:node draft-spec -->\n"
)


def emission(root: Path, area: str, command: str, text: str) -> Path:
    path = root / area / emission_sync.entry_for(command, area)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


class FindingWhatTheAssistantReads(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.root = self.project.root

    def test_it_finds_a_skill_directory(self):
        made = emission(self.root, ".claude/skills", "specify", BODY)
        self.assertEqual(emission_sync.emission_paths(str(self.root), "specify"),
                         [str(made)])

    def test_it_finds_a_flat_file_area(self):
        made = emission(self.root, ".github/agents", "specify", BODY)
        self.assertEqual(emission_sync.emission_paths(str(self.root), "specify"),
                         [str(made)])

    def test_an_agent_this_project_does_not_use_is_not_a_failure(self):
        self.assertEqual(emission_sync.emission_paths(str(self.root), "specify"), [])

    def test_every_known_area_is_looked_in(self):
        """A new agent dir added to the gate must be one a build refreshes too."""
        for area in emission_sync.KNOWN_AREAS:
            with self.subTest(area=area):
                project = Project()
                self.addCleanup(project.close)
                made = emission(project.root, area, "specify", BODY)
                self.assertIn(str(made),
                              emission_sync.emission_paths(str(project.root), "specify"))


class CarryingTheBodyOut(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.root = self.project.root

    def test_the_body_is_replaced(self):
        path = emission(self.root, ".claude/skills", "specify", BODY)
        new = BODY.replace("Write the spec.", "Write the spec our way.")
        emission_sync.sync_command(str(self.root), "specify", new)
        self.assertIn("Write the spec our way.", path.read_text(encoding="utf-8"))

    def test_the_agents_own_frontmatter_is_left_exactly_alone(self):
        """It is the one piece the installer wrote in that agent's own format."""
        header = "---\nname: speckit-companion-specify\nmetadata:\n  author: x\n---\n"
        path = emission(self.root, ".claude/skills", "specify",
                        header + BODY.split("---\n", 2)[2])
        emission_sync.sync_command(str(self.root), "specify",
                                   BODY.replace("Write the spec.", "New words."))
        text = path.read_text(encoding="utf-8")
        self.assertTrue(text.startswith(header))
        self.assertIn("New words.", text)

    def test_the_built_bodys_own_frontmatter_does_not_travel(self):
        path = emission(self.root, ".claude/skills", "specify", BODY)
        emission_sync.sync_command(str(self.root), "specify", BODY)
        self.assertEqual(path.read_text(encoding="utf-8").count("---"), 2)

    def test_a_banner_the_installer_wrote_survives(self):
        """`<!-- Extension: companion -->` says where the command came from."""
        banner = "---\ndescription: x\n---\n\n<!-- Extension: companion -->\n"
        path = emission(self.root, ".github/agents", "specify",
                        banner + BODY.split("---\n", 2)[2])
        emission_sync.sync_command(str(self.root), "specify",
                                   BODY.replace("Write the spec.", "New words."))
        text = path.read_text(encoding="utf-8")
        self.assertIn("<!-- Extension: companion -->", text)
        self.assertIn("New words.", text)

    def test_a_pointer_stub_is_left_alone(self):
        """`.github/prompts/*.prompt.md` has no body; splicing one in corrupts it."""
        stub = "---\nagent: speckit.companion.specify\n---\n"
        path = emission(self.root, ".github/prompts", "specify", stub)
        emission_sync.sync_command(str(self.root), "specify", BODY)
        self.assertEqual(path.read_text(encoding="utf-8"), stub)

    def test_a_file_that_did_not_change_is_not_rewritten(self):
        path = emission(self.root, ".claude/skills", "specify", BODY)
        before = path.stat().st_mtime_ns
        written = emission_sync.sync_command(str(self.root), "specify", BODY)
        self.assertEqual(written, [])
        self.assertEqual(path.stat().st_mtime_ns, before)

    def test_a_symlinked_emission_is_written_through_to_its_target(self):
        """A dev install points several agent dirs at one rendered file."""
        target = self.root / ".specify" / "rendered" / "SKILL.md"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(BODY, encoding="utf-8")
        link = self.root / ".claude/skills" / emission_sync.entry_for("specify", ".claude/skills")
        link.parent.mkdir(parents=True, exist_ok=True)
        os.symlink(target, link)

        emission_sync.sync_command(str(self.root), "specify",
                                   BODY.replace("Write the spec.", "Through the link."))
        self.assertIn("Through the link.", target.read_text(encoding="utf-8"))
        self.assertTrue(link.is_symlink(), "the link itself was replaced by a file")

    def test_every_area_is_carried_at_once(self):
        made = [emission(self.root, area, "specify", BODY)
                for area in (".claude/skills", ".agents/skills", ".github/agents")]
        emission_sync.sync_command(str(self.root), "specify",
                                   BODY.replace("Write the spec.", "All of them."))
        for path in made:
            with self.subTest(path=path.name):
                self.assertIn("All of them.", path.read_text(encoding="utf-8"))


class WhatTheBuildSays(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.root = self.project.root

    def test_a_command_with_nowhere_to_go_is_named(self):
        """No agent directory at all — nothing to model an emission on."""
        _w, _c, unreached, _s = emission_sync.sync(str(self.root), {"review": BODY})
        self.assertEqual(unreached, ["review"])
        said = " ".join(emission_sync.describe([], [], unreached, str(self.root)))
        self.assertIn("review", said)
        self.assertIn("nothing can dispatch", said)

    def test_what_was_refreshed_is_counted_by_area(self):
        emission(self.root, ".claude/skills", "specify", BODY)
        written, created, unreached, stale = emission_sync.sync(
            str(self.root), {"specify": BODY.replace("Write the spec.", "New.")})
        self.assertEqual((created, unreached, stale), ([], [], []))
        said = " ".join(emission_sync.describe(written, created, unreached, str(self.root)))
        self.assertIn(".claude/skills", said)
        self.assertIn("1 agent command file", said)

    def test_a_format_the_build_cannot_rewrite_is_named_not_passed_over(self):
        """A Gemini `.toml` keeps its old pipeline, so the build has to say so.

        Rewriting it would produce invalid TOML, so leaving it alone is right —
        but a build that only counts what it wrote reads as "every agent has
        the new pipeline" when one of them does not.
        """
        emission(self.root, ".claude/skills", "specify", BODY)
        emission(self.root, ".gemini/commands", "specify", BODY)
        written, created, unreached, stale = emission_sync.sync(
            str(self.root), {"specify": BODY.replace("Write the spec.", "New.")})
        self.assertTrue(any(p.endswith(".toml") for p in stale), stale)
        self.assertFalse(any(p.endswith(".toml") for p in written), written)
        said = " ".join(
            emission_sync.describe(written, created, unreached, str(self.root), stale))
        self.assertIn(".gemini/commands", said)
        self.assertIn("still carries the pipeline it had", said)


class GivingAProjectsOwnStepACommand(unittest.TestCase):
    """A step a project added will never be in `extension.yml`.

    That file is the extension's own and is what the installer reads, so
    reinstalling could never register a project's step — the built command sat
    in a file nothing could dispatch, and the build told you to run an installer
    that cannot help. So the build writes the emission itself, modelled on a
    sibling the installer really produced rather than on a guess at seven agent
    formats, one of which is TOML.
    """

    SIBLING = (
        "---\n"
        "name: speckit-companion-auto\n"
        "description: Companion auto — run the whole pipeline hands-off (specify\n"
        "  → implement → mark-complete), no pauses\n"
        "compatibility: Requires spec-kit project structure\n"
        "metadata:\n"
        "  author: github-spec-kit\n"
        "  source: companion:commands/speckit.companion.auto.md\n"
        "---\n"
    )

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.root = self.project.root
        emission(self.root, ".claude/skills", "auto",
                 self.SIBLING + BODY.split("---\n", 2)[2])

    def made(self) -> Path:
        return (self.root / ".claude/skills"
                / emission_sync.entry_for("review", ".claude/skills"))

    def test_it_is_created(self):
        created = emission_sync.create_command(str(self.root), "review", BODY, "Review it")
        self.assertEqual(created, [str(self.made())])
        self.assertTrue(self.made().is_file())

    def test_it_carries_the_built_body(self):
        emission_sync.create_command(str(self.root), "review", BODY, "Review it")
        self.assertIn("Write the spec.", self.made().read_text(encoding="utf-8"))

    def test_it_is_named_for_itself(self):
        emission_sync.create_command(str(self.root), "review", BODY, "Review it")
        text = self.made().read_text(encoding="utf-8")
        self.assertIn("name: speckit-companion-review", text)
        self.assertNotIn("speckit-companion-auto", text)

    def test_it_says_what_it_is(self):
        emission_sync.create_command(str(self.root), "review", BODY, "Review the change")
        self.assertIn("description: Review the change",
                      self.made().read_text(encoding="utf-8"))

    # A wrapped description used to leave its tail dangling under the new one:
    # "description: Review the change" followed by "→ implement…, no pauses".
    def test_a_description_that_wrapped_does_not_leave_its_tail_behind(self):
        emission_sync.create_command(str(self.root), "review", BODY, "Review the change")
        text = self.made().read_text(encoding="utf-8")
        self.assertNotIn("no pauses", text)
        self.assertNotIn("mark-complete", text.split("---", 2)[1])

    def test_the_rest_of_the_siblings_shape_is_kept(self):
        """It is the format that agent reads; only the identity differs."""
        emission_sync.create_command(str(self.root), "review", BODY, "Review it")
        text = self.made().read_text(encoding="utf-8")
        self.assertIn("compatibility: Requires spec-kit project structure", text)
        self.assertIn("author: github-spec-kit", text)

    def test_the_source_points_at_its_own_command(self):
        emission_sync.create_command(str(self.root), "review", BODY, "Review it")
        self.assertIn("source: companion:commands/speckit.companion.review.md",
                      self.made().read_text(encoding="utf-8"))

    def test_an_existing_emission_is_never_overwritten_by_creation(self):
        self.made().parent.mkdir(parents=True, exist_ok=True)
        self.made().write_text("mine", encoding="utf-8")
        self.assertEqual(
            emission_sync.create_command(str(self.root), "review", BODY, "x"), [])
        self.assertEqual(self.made().read_text(encoding="utf-8"), "mine")

    def test_an_area_with_no_sibling_is_skipped(self):
        (self.root / ".github/agents").mkdir(parents=True, exist_ok=True)
        emission_sync.create_command(str(self.root), "review", BODY, "x")
        self.assertFalse(
            (self.root / ".github/agents"
             / emission_sync.entry_for("review", ".github/agents")).exists())

    def test_a_later_build_refreshes_what_it_created(self):
        emission_sync.create_command(str(self.root), "review", BODY, "Review it")
        emission_sync.sync(str(self.root),
                           {"review": BODY.replace("Write the spec.", "Second pass.")})
        self.assertIn("Second pass.", self.made().read_text(encoding="utf-8"))


class ABuildReachesTheAssistant(unittest.TestCase):
    """The whole point, through the real build."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.project.build_ok()
        # Stand the emissions up from what that build produced, the way the
        # installer does.
        for command in ("specify", "plan"):
            emission(self.project.root, ".claude/skills", command,
                     "---\nname: x\n---\n" + self.project.body(command).split("---\n", 2)[2])

    def loaded(self, command: str) -> str:
        return (self.project.root / ".claude/skills"
                / emission_sync.entry_for(command, ".claude/skills")).read_text(encoding="utf-8")

    def test_a_hook_reaches_what_the_assistant_loads(self):
        self.project.write("--command", "specify", "--when", "before",
                           "--anchor", "draft-spec", "--hook", "prompt",
                           "--text", "Read the house rules first.")
        report = self.project.build_ok()
        self.assertIn("Read the house rules first.", self.project.body("specify"))
        self.assertIn("Read the house rules first.", self.loaded("specify"))
        self.assertIn("refreshed", report)

    def test_a_step_nobody_touched_is_left_alone(self):
        before = self.loaded("plan")
        self.project.write("--command", "specify", "--when", "before",
                           "--anchor", "draft-spec", "--hook", "prompt", "--text", "x")
        self.project.build_ok()
        self.assertEqual(self.loaded("plan"), before)

    def test_a_preview_writes_nothing_to_the_assistant(self):
        before = self.loaded("specify")
        self.project.write("--command", "specify", "--when", "before",
                           "--anchor", "draft-spec", "--hook", "prompt", "--text", "y")
        out = self.project.build_ok("--dry-run")
        self.assertEqual(self.loaded("specify"), before)
        self.assertIn("refresh", out)


if __name__ == "__main__":
    unittest.main()
