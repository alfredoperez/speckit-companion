"""A capability's membership and its requirements have to describe the same code.

The Conduit case: article authoring claimed `src/features/article/create-article/**` in the
registry, and every requirement's marker named `src/pages/editor/**`. Both halves are
individually valid — the markers name real files, the globs match real files — so every
other check passes, the capability resolves for a change under create-article, and it
contributes zero requirements. The run is handed an empty brief and reads as briefed.

Both directions are decided on real files, through the resolver's own matcher, so the
answer cannot disagree with what the resolver actually claims.
"""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "speckit-extension" / "scripts"

sys.path.insert(0, str(SCRIPTS))
_spec = importlib.util.spec_from_file_location("living_validate", SCRIPTS / "living_validate.py")
lv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lv)

REQ = textwrap.dedent("""\
    ### {heading}
    <!-- touches: {glob} -->

    The editor SHALL {verb}.

    #### Scenario: it happens
    - **WHEN** the author acts
    - **THEN** it takes effect
    """)


def spec_with(*reqs: str) -> str:
    return "# Article authoring\n\n## Purpose\n\nWriting articles.\n\n## Requirements\n\n" + "\n".join(reqs)


def codes(findings) -> list:
    return [f["code"] for f in findings]


class MembershipAndRequirementsMustDescribeTheSameCode(unittest.TestCase):
    SPEC_REL = "capabilities/article-authoring/article-authoring.spec.md"

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cap-coverage-")
        self.root = Path(self.tmp)
        # Real files, because membership is decided on what is actually there.
        for rel in ("src/pages/editor", "src/features/article/create-article",
                    "src/features/article/delete-article", "src/unrelated"):
            (self.root / rel).mkdir(parents=True, exist_ok=True)
            (self.root / rel / "index.ts").write_text("export {};\n", encoding="utf-8")
        (self.root / "capabilities" / "article-authoring").mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _registry(self, *globs: str, exclude: tuple = ()) -> None:
        body = ("enabled: true\nlayout: central\ncapabilities:\n"
                "  - name: article-authoring\n    match:\n"
                + "".join(f"      - {g}\n" for g in globs))
        if exclude:
            body += "    exclude:\n" + "".join(f"      - {g}\n" for g in exclude)
        body += f"    spec: {self.SPEC_REL}\n"
        (self.root / "living-specs.yml").write_text(body, encoding="utf-8")

    def _check(self, text: str):
        (self.root / self.SPEC_REL).write_text(text, encoding="utf-8")
        return lv.check_living_spec(text, self.SPEC_REL, root=str(self.root),
                                    capability="article-authoring")

    # ── the capability claims code no requirement describes ───────────────────

    def test_the_conduit_case_is_reported(self):
        self._registry("src/pages/editor/**", "src/features/article/create-article/**")
        found = self._check(spec_with(REQ.format(
            heading="An article is written", glob="src/pages/editor/**", verb="accept a draft")))
        self.assertIn("capability-claims-undescribed-code", codes(found))
        msg = next(f["message"] for f in found if f["code"] == "capability-claims-undescribed-code")
        self.assertIn("create-article", msg)

    def test_a_capability_whose_requirements_cover_every_area_is_quiet(self):
        self._registry("src/pages/editor/**", "src/features/article/delete-article/**")
        found = self._check(spec_with(
            REQ.format(heading="An article is written", glob="src/pages/editor/**",
                       verb="accept a draft"),
            REQ.format(heading="An article is deleted",
                       glob="src/features/article/delete-article/**", verb="take it down")))
        self.assertNotIn("capability-claims-undescribed-code", codes(found))

    def test_an_unmarked_requirement_makes_starvation_impossible(self):
        # The resolver always contributes an unmarked requirement, so no change can be
        # briefed with nothing. Reporting here would be crying wolf.
        self._registry("src/pages/editor/**", "src/features/article/create-article/**")
        text = spec_with(REQ.format(heading="An article is written",
                                    glob="src/pages/editor/**", verb="accept a draft"))
        text += "\n### A general rule\n\nAuthors SHALL be told when a save fails.\n\n"
        text += "#### Scenario: a save fails\n- **WHEN** the API rejects it\n- **THEN** the author is told\n"
        self.assertNotIn("capability-claims-undescribed-code", codes(self._check(text)))

    # ── the requirements describe code the capability does not claim ──────────

    def test_requirements_entirely_outside_the_capability_are_reported(self):
        self._registry("src/unrelated/**")
        found = self._check(spec_with(REQ.format(
            heading="An article is written", glob="src/pages/editor/**", verb="accept a draft")))
        self.assertIn("requirements-outside-capability", codes(found))
        # One fault, named once.
        self.assertNotIn("capability-claims-undescribed-code", codes(found))

    def test_a_broader_membership_still_covers_a_narrower_marker(self):
        # The cry-wolf case. A project that claims a parent directory is correct, and a
        # check that compared patterns as strings would nag it on every spec.
        self._registry("src/**")
        found = self._check(spec_with(REQ.format(
            heading="An article is written", glob="src/pages/editor/**", verb="accept a draft")))
        self.assertNotIn("requirements-outside-capability", codes(found))

    def test_a_broader_marker_than_the_membership_is_not_reported(self):
        # `src/**` reaches everything the capability claims, so the resolver resolves it.
        # A subset comparison would have called this orphaned.
        self._registry("src/pages/editor/**")
        found = self._check(spec_with(REQ.format(
            heading="An article is written", glob="src/**", verb="accept a draft")))
        self.assertNotIn("requirements-outside-capability", codes(found))

    def test_exclude_is_read_alongside_match(self):
        # Membership is match minus exclude. Reading only `match` gets the one shape this
        # check exists for exactly backwards.
        self._registry("src/**", exclude=("src/pages/**",))
        found = self._check(spec_with(REQ.format(
            heading="An article is written", glob="src/pages/editor/**", verb="accept a draft")))
        self.assertIn("requirements-outside-capability", codes(found))

    # ── reading the marker at all ─────────────────────────────────────────────

    def test_a_marker_under_a_blank_line_is_still_read(self):
        # A formatter puts a blank line between a heading and its comment. Reading only the
        # next line made every check here silently pass on a formatted spec — the same shape
        # as #690, where a hook unmarked a whole spec and every load fell back to reading it
        # whole. The resolver skips blanks; this must agree with it.
        self._registry("src/unrelated/**")
        text = spec_with("### An article is written\n\n"
                         "<!-- touches: src/pages/editor/** -->\n"
                         "<!-- adopted: src/pages/editor/index.ts:1 -->\n\n"
                         "The editor SHALL accept a draft.\n\n"
                         "#### Scenario: it happens\n- **WHEN** the author acts\n- **THEN** it takes effect\n")
        self.assertIn("requirements-outside-capability", codes(self._check(text)))

    def test_a_marker_under_an_aligns_line_is_still_read(self):
        # The three leading markers may sit in any order, so stopping at the first one that
        # is not `touches` would hide the marker beneath it.
        self._registry("src/unrelated/**")
        text = spec_with("### An article is written\n"
                         "<!-- aligns: session-access#Writing requires being signed in -->\n"
                         "<!-- touches: src/pages/editor/** -->\n\n"
                         "The editor SHALL accept a draft.\n\n"
                         "#### Scenario: it happens\n- **WHEN** the author acts\n- **THEN** it takes effect\n")
        self.assertIn("requirements-outside-capability", codes(self._check(text)))

    # ── staying quiet when it cannot know ─────────────────────────────────────

    def test_a_marker_that_names_nothing_real_is_left_to_the_other_check(self):
        self._registry("src/pages/editor/**")
        found = self._check(spec_with(REQ.format(
            heading="An article is written", glob="src/nowhere/**", verb="accept a draft")))
        self.assertIn("unmatched-touches-glob", codes(found))
        self.assertNotIn("requirements-outside-capability", codes(found))

    def test_a_parent_directory_in_the_membership_is_not_uncovered_code(self):
        # `src/features/**` reaches the `src/features/article` folder itself, which no marker
        # names as a folder and nobody can change. Counting it made this fire on every project
        # whose registry claims a parent directory.
        (self.root / "src/features/article/create-article").mkdir(parents=True, exist_ok=True)
        (self.root / "src/features/article/create-article/index.ts").write_text("export {};\n")
        self._registry("src/features/article/**")
        found = self._check(spec_with(REQ.format(
            heading="An article is written",
            glob="src/features/article/create-article/**", verb="accept a draft")))
        self.assertNotIn("capability-claims-undescribed-code", codes(found))

    def test_no_registry_entry_means_nothing_to_judge(self):
        (self.root / "living-specs.yml").write_text("enabled: true\ncapabilities: []\n", encoding="utf-8")
        found = self._check(spec_with(REQ.format(
            heading="An article is written", glob="src/pages/editor/**", verb="accept a draft")))
        self.assertNotIn("requirements-outside-capability", codes(found))
        self.assertNotIn("capability-claims-undescribed-code", codes(found))


if __name__ == "__main__":
    unittest.main()
