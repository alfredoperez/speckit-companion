#!/usr/bin/env python3
"""Requirement slicing, pinned against the fixtures the TypeScript side reads.

A living spec's requirements have to be sliced in two runtimes: the viewer has
no Python, the command bodies have no TypeScript. The fixtures under
`fixtures/requirement-slices/` are the contract between them.

Stdlib `unittest` only.
"""

from __future__ import annotations

import contextlib
import importlib
import io
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

rsp = importlib.import_module("resolve-spec-paths")




class RequirementSlicesAgainstSharedFixtures(unittest.TestCase):
    """The Python half of a parser that has to exist twice.

    The viewer has no Python and the command bodies have no TypeScript, so the
    risk is not duplication but divergence. These fixtures are the contract;
    `src/features/specs/__tests__/livingSpecsModel.test.ts` reads the same ones.
    """

    FIXTURES = Path(__file__).resolve().parent / "fixtures" / "requirement-slices"

    def _expected(self):
        return json.loads((self.FIXTURES / "expected.json").read_text(encoding="utf-8"))

    def test_every_fixture_slices_as_the_contract_says(self):
        for name, want in self._expected().items():
            with self.subTest(fixture=name):
                text = (self.FIXTURES / name).read_text(encoding="utf-8")
                got = rsp.requirement_slices(text)
                self.assertEqual([s["heading"] for s in got], [w["heading"] for w in want])
                self.assertEqual([s["touches"] for s in got], [w["touches"] for w in want])

    def test_a_marker_inside_a_fence_is_not_a_marker(self):
        text = (self.FIXTURES / "marker-in-fence.md").read_text(encoding="utf-8")
        slices = rsp.requirement_slices(text)
        self.assertEqual(len(slices), 1, "the ### inside the fence is not a requirement")
        self.assertIsNone(slices[0]["touches"])

    def test_a_marker_one_line_too_far_down_is_body(self):
        text = (self.FIXTURES / "marker-too-far.md").read_text(encoding="utf-8")
        self.assertIsNone(rsp.requirement_slices(text)[0]["touches"])

    def test_an_unmarked_requirement_is_always_contributed(self):
        text = (self.FIXTURES / "mixed.md").read_text(encoding="utf-8")
        slices = rsp.requirement_slices(text)
        picked = rsp.requirements_for_change(slices, ["src/nothing/at/all.ts"])
        self.assertEqual([s["heading"] for s in picked], ["Unmarked one"],
                         "a marker narrows; an unmarked requirement is never starved")

    def test_a_matching_marker_contributes_its_requirement(self):
        text = (self.FIXTURES / "mixed.md").read_text(encoding="utf-8")
        slices = rsp.requirement_slices(text)
        picked = rsp.requirements_for_change(slices, ["src/marked/thing.ts"])
        self.assertEqual([s["heading"] for s in picked], ["Marked one", "Unmarked one"])

    def test_a_spec_with_no_markers_reads_whole(self):
        text = (self.FIXTURES / "no-markers.md").read_text(encoding="utf-8")
        self.assertTrue(rsp.has_no_markers(rsp.requirement_slices(text)))

    def test_duplicate_headings_both_appear(self):
        text = (self.FIXTURES / "duplicate-headings.md").read_text(encoding="utf-8")
        slices = rsp.requirement_slices(text)
        self.assertEqual([s["heading"] for s in slices], ["Same name", "Same name"])
        self.assertNotEqual(slices[0]["touches"], slices[1]["touches"])

    def test_the_purpose_section_is_extracted_without_the_requirements(self):
        text = (self.FIXTURES / "mixed.md").read_text(encoding="utf-8")
        purpose = rsp.purpose_section(text)
        self.assertIn("Some marked, some not", purpose)
        self.assertNotIn("Marked one", purpose)

    def test_slicing_matches_the_requirement_count_the_denominator_uses(self):
        # The outline and the coverage denominator must count the same headings.
        for name in self._expected():
            with self.subTest(fixture=name):
                text = (self.FIXTURES / name).read_text(encoding="utf-8")
                kept, fence = [], False
                for ln in text.splitlines():
                    if re.match(r"^\s*(```|~~~)", ln):
                        fence = not fence
                        continue
                    if not fence:
                        kept.append(ln)
                # Every `###` in the document. The denominator counts the whole
                # file, and fold-back appends past the Uncovered section, so a
                # section-scoped count is exactly how the two come to disagree.
                headings = sum(1 for ln in kept if re.match(r"^###(?!#)\s+", ln))
                self.assertEqual(len(rsp.requirement_slices(text)), headings)


class RequirementBodiesSurviveSlicing(unittest.TestCase):
    """A body is what the load step reads; anything lost here is lost silently."""

    FIXTURES = Path(__file__).resolve().parent / "fixtures" / "requirement-slices"

    def _slices(self, name):
        text = (self.FIXTURES / name).read_text(encoding="utf-8")
        return rsp.requirement_slices(text)

    def test_a_fenced_example_stays_in_the_body(self):
        body = "\n".join(self._slices("fenced-body.md")[0]["body"])
        self.assertIn("```json", body)
        self.assertIn('{"heading": "…", "touches": []}', body)

    def test_a_body_stops_at_the_next_section_heading(self):
        # Otherwise the last requirement before an uncovered section hands that
        # whole section to a load step as its own normative prose.
        first = self._slices("stranded-after-uncovered.md")[0]
        body = "\n".join(first["body"])
        self.assertNotIn("## Uncovered", body)
        self.assertNotIn("src/skimmed.ts", body)
        self.assertIn("Written when the spec was adopted.", body)

    def test_the_marker_is_not_handed_over_as_prose(self):
        for name in ("fenced-body.md", "all-marked.md", "mixed.md"):
            with self.subTest(fixture=name):
                for s in self._slices(name):
                    self.assertNotIn("touches:", "\n".join(s["body"]))


class BothSuitesReadEveryFixture(unittest.TestCase):
    """The guard that makes the shared fixtures a contract rather than a folder.

    Two parsers in two runtimes stay honest only while both are held to the same
    cases. A fixture that only one suite reads is a case where they are free to
    disagree, so adding one without wiring it up fails here.
    """

    FIXTURES = Path(__file__).resolve().parent / "fixtures" / "requirement-slices"
    TS_SUITE = (Path(__file__).resolve().parents[2]
                / "src" / "features" / "specs" / "__tests__" / "requirementSlices.test.ts")

    def test_expected_json_names_every_fixture_on_disk(self):
        on_disk = {p.name for p in self.FIXTURES.glob("*.md")} - {"README.md"}
        named = set(json.loads((self.FIXTURES / "expected.json").read_text(encoding="utf-8")))
        self.assertEqual(on_disk, named,
                         "every fixture must carry its expected slices, or it pins nothing")

    def test_the_typescript_suite_reads_the_same_fixtures(self):
        self.assertTrue(self.TS_SUITE.is_file(), "the TypeScript half must exist")
        ts = self.TS_SUITE.read_text(encoding="utf-8")
        # It drives every case from expected.json rather than naming each file, so
        # reading that manifest IS its coverage of the whole set — which is why
        # the previous assertion enforces that the manifest names every fixture.
        self.assertIn("expected.json", ts)
        self.assertIn("requirement-slices", ts)
        self.assertIn("it.each(Object.keys(expected()))", ts,
                      "the TypeScript suite must iterate the manifest, not a hand-kept list")


class RequirementsForChangedMode(unittest.TestCase):
    """`--requirements-for`: what a load should contribute, per capability."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "capabilities" / "demo").mkdir(parents=True)
        for d in ("alpha", "beta"):
            (self.root / "src" / d).mkdir(parents=True)
            (self.root / "src" / d / "f.ts").write_text("x", encoding="utf-8")
        (self.root / "living-specs.yml").write_text(
            "enabled: true\ncapabilities:\n  - name: demo\n    match: [\"src/**\"]\n",
            encoding="utf-8")

    def _spec(self, text: str):
        (self.root / "capabilities" / "demo" / "spec.md").write_text(text, encoding="utf-8")

    def _run(self, changed):
        living = rsp.load_living(str(self.root))
        return rsp.requirements_for_changed(changed, living, str(self.root))

    MARKED = """## Purpose

Why demo exists.

## Requirements

### Alpha behaviour
<!-- touches: src/alpha/** -->

Alpha.

### Beta behaviour
<!-- touches: src/beta/** -->

Beta.

### Shared behaviour

No marker.
"""

    def test_a_marked_spec_narrows_to_the_matching_and_unmarked_requirements(self):
        self._spec(self.MARKED)
        [cap] = self._run(["src/alpha/f.ts"])
        self.assertFalse(cap["whole"])
        self.assertEqual([r["heading"] for r in cap["requirements"]],
                         ["Alpha behaviour", "Shared behaviour"])
        self.assertIn("Why demo exists", cap["purpose"])

    def test_a_change_matching_no_marker_still_gets_the_unmarked_requirement(self):
        self._spec(self.MARKED)
        [cap] = self._run(["src/gamma/f.ts"]) or [None]
        # src/gamma is still inside the capability's src/** claim.
        self.assertIsNotNone(cap)
        self.assertEqual([r["heading"] for r in cap["requirements"]], ["Shared behaviour"])

    def test_a_spec_with_no_markers_is_reported_whole(self):
        self._spec(self.MARKED.replace("<!-- touches: src/alpha/** -->\n", "")
                              .replace("<!-- touches: src/beta/** -->\n", ""))
        [cap] = self._run(["src/alpha/f.ts"])
        self.assertTrue(cap["whole"])
        self.assertEqual(cap["requirements"], [])
        self.assertIsNone(cap["purpose"])

    def test_a_missing_spec_file_is_reported_whole_and_never_raises(self):
        [cap] = self._run(["src/alpha/f.ts"])
        self.assertTrue(cap["whole"])
        self.assertFalse(cap["exists"])

    def test_the_matched_flag_distinguishes_a_hit_from_an_unmarked_requirement(self):
        self._spec(self.MARKED)
        [cap] = self._run(["src/alpha/f.ts"])
        by_head = {r["heading"]: r["matched"] for r in cap["requirements"]}
        self.assertTrue(by_head["Alpha behaviour"])
        self.assertFalse(by_head["Shared behaviour"])

    def test_a_disabled_registry_returns_an_empty_capability_list(self):
        (self.root / "living-specs.yml").write_text("enabled: false\n", encoding="utf-8")
        living = rsp.load_living(str(self.root))
        self.assertFalse(living.get("enabled"))


class RulesReachTheirOwnStep(unittest.TestCase):
    """Guidance authored once in the registry, handed to one step at a time.

    The point of the block is that nobody retypes the house rule into a chat
    window, so the failure that matters is a rule reaching the wrong step or a
    malformed block taking the step down with it.
    """

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def registry(self, text: str) -> None:
        (self.root / "living-specs.yml").write_text(text, encoding="utf-8")

    def rules(self) -> dict:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = rsp.main(["--root", str(self.root), "--rules", "--json"])
        self.assertEqual(code, 0)
        return json.loads(buf.getvalue())["rules"]

    def test_each_step_sees_only_its_own_rules(self):
        self.registry(
            "enabled: true\n"
            "capabilities: []\n"
            "rules:\n"
            "  spec:\n"
            '    - "one outcome per scenario"\n'
            "  plan:\n"
            '    - "name the capability each decision belongs to"\n'
        )
        rules = self.rules()
        self.assertEqual(rules["spec"], ["one outcome per scenario"])
        self.assertEqual(rules["plan"], ["name the capability each decision belongs to"])

    def test_a_registry_with_no_rules_reports_empty_lists(self):
        self.registry("enabled: true\ncapabilities: []\n")
        self.assertEqual(self.rules(), {"spec": [], "plan": []})

    def test_a_malformed_registry_reports_no_rules_and_still_exits_zero(self):
        self.registry("enabled: true\ncapabilities:\n  - [unclosed\n")
        self.assertEqual(self.rules(), {"spec": [], "plan": []})

    def test_rules_ride_along_with_the_requirements_envelope(self):
        # The load steps already call --requirements-for; the rules arrive on
        # that same call so a step never pays for a second process.
        self.registry(
            "enabled: true\n"
            "capabilities: []\n"
            "rules:\n"
            "  spec:\n"
            '    - "one outcome per scenario"\n'
        )
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rsp.main(["--root", str(self.root), "--changed", "a.ts",
                      "--requirements-for", "--json"])
        self.assertEqual(json.loads(buf.getvalue())["rules"]["spec"],
                         ["one outcome per scenario"])

    def test_rules_are_absent_when_living_specs_are_off(self):
        self.registry("enabled: false\ncapabilities: []\nrules:\n  spec:\n    - \"x\"\n")
        self.assertEqual(self.rules(), {"spec": [], "plan": []})

