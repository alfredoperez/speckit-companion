#!/usr/bin/env python3
"""The terminal slice reader: print one requirement instead of opening the file.

Every mode is read-only and every outcome exits 0 — a reader asking a question
must never be handed a non-zero exit that a surrounding script reads as broken.

Stdlib `unittest` only.
"""

from __future__ import annotations

import contextlib
import importlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

rsp = importlib.import_module("resolve-spec-paths")

SPEC = """# Alpha

## Purpose

Alpha does the alpha things.

## Requirements

### Users can set a due date
<!-- touches: src/alpha/due-date/**, src/alpha/form.ts -->

#### Scenario: a date is chosen
- **WHEN** a date is picked
- **THEN** the todo shows it

### Users can clear a due date
<!-- touches: src/alpha/due-date/** -->

Clearing removes the date.

### Everything is audited

No marker here, so this one describes the whole capability.
"""


class LivingShowBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "src" / "alpha").mkdir(parents=True)
        (self.root / "src" / "alpha" / "alpha.spec.md").write_text(SPEC, encoding="utf-8")
        self.registry(
            "enabled: true\n"
            "capabilities:\n"
            "  - name: alpha\n"
            '    match: ["src/alpha/**"]\n'
            "    spec: src/alpha/alpha.spec.md\n"
        )

    def registry(self, text: str) -> None:
        (self.root / "living-specs.yml").write_text(text, encoding="utf-8")

    def run_cli(self, *args) -> tuple[int, str]:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = rsp.main(["--root", str(self.root), *args])
        return code, buf.getvalue()


class HeadingsMode(LivingShowBase):
    def test_prints_every_heading_in_file_order(self):
        code, out = self.run_cli("--headings", "alpha")
        self.assertEqual(code, 0)
        self.assertEqual(
            [l.strip("- ").strip() for l in out.splitlines() if l.strip().startswith("-")],
            ["Users can set a due date", "Users can clear a due date", "Everything is audited"],
        )

    def test_the_count_matches_the_slicer(self):
        _, out = self.run_cli("--headings", "alpha", "--json")
        got = json.loads(out)["requirements"]
        self.assertEqual(len(got), len(rsp.requirement_slices(SPEC)))

    def test_an_unregistered_capability_lists_the_registered_ones(self):
        code, out = self.run_cli("--headings", "beta")
        self.assertEqual(code, 0)
        self.assertIn("alpha", out)

    def test_a_registered_capability_with_no_spec_file_says_so(self):
        self.registry(
            "enabled: true\n"
            "capabilities:\n"
            "  - name: ghost\n"
            '    match: ["src/ghost/**"]\n'
            "    spec: src/ghost/ghost.spec.md\n"
        )
        code, out = self.run_cli("--headings", "ghost")
        self.assertEqual(code, 0)
        self.assertNotIn("0 requirement", out, "a missing file is not an empty spec")


class RequirementMode(LivingShowBase):
    def test_prints_the_named_requirement_with_its_scenarios(self):
        code, out = self.run_cli("--requirement", "Users can set a due date")
        self.assertEqual(code, 0)
        self.assertIn("a date is picked", out)
        self.assertNotIn("Clearing removes the date", out)

    def test_matching_is_case_and_whitespace_insensitive(self):
        _, out = self.run_cli("--requirement", "  users CAN set a due DATE ")
        self.assertIn("a date is picked", out)

    def test_a_name_matching_nothing_lists_the_headings_that_exist(self):
        code, out = self.run_cli("--requirement", "Users can teleport")
        self.assertEqual(code, 0)
        self.assertIn("Everything is audited", out)

    def test_an_ambiguous_name_lists_the_candidates_and_guesses_nothing(self):
        (self.root / "src" / "beta").mkdir(parents=True)
        (self.root / "src" / "beta" / "beta.spec.md").write_text(
            "# Beta\n\n### Everything is audited\n\nBeta's own copy.\n", encoding="utf-8"
        )
        self.registry(
            "enabled: true\n"
            "capabilities:\n"
            "  - name: alpha\n"
            '    match: ["src/alpha/**"]\n'
            "    spec: src/alpha/alpha.spec.md\n"
            "  - name: beta\n"
            '    match: ["src/beta/**"]\n'
            "    spec: src/beta/beta.spec.md\n"
        )
        code, out = self.run_cli("--requirement", "Everything is audited")
        self.assertEqual(code, 0)
        self.assertIn("alpha", out)
        self.assertIn("beta", out)


class FileMode(LivingShowBase):
    def test_prints_the_requirements_whose_marker_matches(self):
        _, out = self.run_cli("--file", "src/alpha/form.ts", "--json")
        got = json.loads(out)["capabilities"][0]["requirements"]
        headings = [r["heading"] for r in got]
        self.assertIn("Users can set a due date", headings)
        self.assertNotIn("Users can clear a due date", headings)

    def test_an_unmarked_requirement_is_always_included(self):
        _, out = self.run_cli("--file", "src/alpha/form.ts", "--json")
        got = json.loads(out)["capabilities"][0]["requirements"]
        self.assertIn("Everything is audited", [r["heading"] for r in got])

    def test_a_file_no_capability_claims_says_so(self):
        code, out = self.run_cli("--file", "src/zeta/thing.ts", "--json")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["capabilities"], [])


class DisabledOrUnconfigured(LivingShowBase):
    def test_disabled_reports_nothing_and_still_exits_zero(self):
        self.registry("enabled: false\ncapabilities: []\n")
        for args in (("--headings", "alpha"), ("--requirement", "x"), ("--file", "a.ts")):
            with self.subTest(args=args):
                code, out = self.run_cli(*args, "--json")
                self.assertEqual(code, 0)
                self.assertEqual(json.loads(out).get("capabilities", []), [])


class CountsAgreeWithTheRepoItself(unittest.TestCase):
    """The printed count is the coverage denominator and the viewer's outline count.

    Run against this repository's own registry rather than a fixture: three
    readers agreeing on a hand-written sample proves less than three readers
    agreeing on 14 real specs, and a drift here is what makes a row contradict
    the badge beside it.
    """

    REPO = Path(__file__).resolve().parent.parent.parent

    def test_every_capability_prints_the_number_of_requirements_it_has(self):
        living = rsp.load_living(str(self.REPO))
        if not living.get("enabled"):
            self.skipTest("living specs are off for this repository")
        for name in rsp.capability_names(living):
            with self.subTest(capability=name):
                shown = rsp.show_headings(name, living, str(self.REPO))
                if not shown["specExists"]:
                    continue
                entry = rsp.capability_by_name(name, living, str(self.REPO))
                self.assertEqual(
                    len(shown["requirements"]),
                    len(rsp.requirement_slices(entry["text"])),
                )


class CapabilityOrderMatchesTheEditor(unittest.TestCase):
    """The order two runtimes must agree on.

    The status bar re-implements `_specificity` in TypeScript, because the
    editor has no Python. `src/features/specs/__tests__/livingSpecsModel.test.ts`
    reads this same file; a case only one side honours fails there too.
    """

    FIXTURE = Path(__file__).resolve().parent / "fixtures" / "claim-order" / "cases.json"

    def test_every_case_orders_the_same_way(self):
        data = json.loads(self.FIXTURE.read_text(encoding="utf-8"))
        living = {"enabled": True, "exempt": [], "capabilities": [
            {"name": c["name"], "match": c["match"], "exclude": [], "spec": c["spec"]}
            for c in data["capabilities"]
        ]}
        with tempfile.TemporaryDirectory() as root:
            for case in data["cases"]:
                with self.subTest(file=case["file"]):
                    got = [m["name"] for m in rsp.match_changed([case["file"]], living, root)]
                    self.assertEqual(got, case["order"])


if __name__ == "__main__":
    unittest.main()
