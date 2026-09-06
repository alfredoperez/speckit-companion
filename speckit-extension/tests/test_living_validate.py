"""The living-spec shape check (#672 Wave 2).

Every case is driven from `tests/fixtures/spec-shape/expected.json`, which the
TypeScript twin reads too. A fixture only one runtime exercises is a case where
the two are free to disagree, so the drift guard here fails the build for it.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "speckit-extension" / "scripts"
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "spec-shape"

sys.path.insert(0, str(SCRIPTS))
_spec = importlib.util.spec_from_file_location(
    "living_validate", SCRIPTS / "living_validate.py")
lv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lv)


def manifest() -> dict:
    return json.loads((FIXTURES / "expected.json").read_text(encoding="utf-8"))


def marks(findings) -> list:
    """Each finding as the manifest states it — severity, code, line."""
    return [
        {"severity": f["severity"], "code": f["code"], "line": f["line"]}
        for f in findings
    ]


class EveryFixtureProducesExactlyItsExpectedFindings(unittest.TestCase):
    def test_each_fixture(self):
        for name, expected in manifest().items():
            with self.subTest(fixture=name):
                text = (FIXTURES / name).read_text(encoding="utf-8")
                if expected["kind"] == "living":
                    found = lv.check_living_spec(text, name, root=str(REPO))
                else:
                    target = (FIXTURES / expected["target"]).read_text(encoding="utf-8")
                    found = lv.check_feature_deltas(
                        text, name,
                        known_capabilities=["spec-shape-target"],
                        target_texts={"spec-shape-target": target},
                        default_capability=expected.get("default"),
                    )
                self.assertEqual(marks(found), expected["findings"])

    def test_every_finding_carries_a_path_a_message_and_a_fix(self):
        for name, expected in manifest().items():
            if not expected["findings"]:
                continue
            with self.subTest(fixture=name):
                text = (FIXTURES / name).read_text(encoding="utf-8")
                found = (
                    lv.check_living_spec(text, name, root=str(REPO))
                    if expected["kind"] == "living"
                    else lv.check_feature_deltas(
                        text, name, known_capabilities=["spec-shape-target"],
                        target_texts={"spec-shape-target": (
                            FIXTURES / expected["target"]).read_text(encoding="utf-8")},
                        default_capability=expected.get("default"),
                    )
                )
                for f in found:
                    self.assertEqual(f["path"], name)
                    self.assertTrue(f["message"].strip())
                    self.assertTrue(f["fix"].strip())


class BothSuitesReadEveryFixture(unittest.TestCase):
    """The guard that makes the fixtures a contract rather than a folder."""

    def test_the_manifest_names_every_fixture_on_disk(self):
        on_disk = {p.name for p in FIXTURES.glob("*.md")} - {"README.md"}
        self.assertEqual(set(manifest()), on_disk)

    def test_the_typescript_suite_iterates_the_manifest_rather_than_a_list(self):
        # Asserting the twin merely mentions the directory would pass even if it
        # had stopped reading the manifest entirely. What makes the fixtures a
        # contract is that the twin loops over the manifest's own keys.
        twin = (REPO / "src" / "features" / "specs" / "__tests__"
                / "specShapeCheck.test.ts").read_text(encoding="utf-8")
        self.assertIn("Object.entries(manifest)", twin)
        self.assertIn("read('expected.json')", twin)
        for name in manifest():
            self.assertNotIn(f"'{name}'", twin,
                             "the twin names a fixture instead of iterating the manifest")


class TheReportNeverGates(unittest.TestCase):
    def test_a_clean_project_exits_zero(self):
        self.assertEqual(lv.main(["--root", str(REPO), "--json"]), 0)

    def test_a_project_with_living_specs_off_exits_zero_and_says_so(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(lv.main(["--root", tmp, "--json"]), 0)
            report = lv.build_report(tmp)
            self.assertFalse(report["enabled"])
            self.assertEqual(report["checked"], 0)
            self.assertEqual(report["findings"], [])

    def test_an_unreadable_spec_is_a_skip_not_a_crash(self):
        report = lv.build_report(str(REPO))
        self.assertIn("skipped", report)
        for entry in report["skipped"]:
            self.assertTrue(entry["reason"].strip())

    def test_this_repository_is_checked_and_exits_zero(self):
        report = lv.build_report(str(REPO))
        self.assertTrue(report["enabled"])
        self.assertGreaterEqual(report["checked"], 14)
        self.assertEqual(lv.main(["--root", str(REPO)]), 0)


class TheGlobIndexSeesNewFilesToo(unittest.TestCase):
    """A marker on code a feature branch just added must not read as absent."""

    def test_an_uncommitted_file_counts_as_on_disk(self):
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["git", "init", "-q", tmp], check=True)
            new = Path(tmp) / "src" / "brand_new.ts"
            new.parent.mkdir(parents=True)
            new.write_text("export const x = 1;\n", encoding="utf-8")
            lv._PATHS_CACHE.clear()
            self.assertIn("src/brand_new.ts", lv.repo_paths(tmp))
            self.assertIn("src", lv.repo_paths(tmp))

    def test_an_ignored_file_does_not_count(self):
        import subprocess
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["git", "init", "-q", tmp], check=True)
            (Path(tmp) / ".gitignore").write_text("build/\n", encoding="utf-8")
            built = Path(tmp) / "build" / "out.js"
            built.parent.mkdir(parents=True)
            built.write_text("x\n", encoding="utf-8")
            lv._PATHS_CACHE.clear()
            self.assertNotIn("build/out.js", lv.repo_paths(tmp))


class NothingCheckedIsNeverReportedAsNothingWrong(unittest.TestCase):
    """A run that could not read the registry is not a run that found nothing."""

    def test_running_from_a_subdirectory_says_where_the_registry_is(self):
        report = lv.build_report(str(REPO / "src"))
        self.assertFalse(report["enabled"])
        self.assertTrue(report["skipped"])
        rendered = lv.render_human(report)
        self.assertIn("living-specs.yml", rendered)
        self.assertIn("--root", rendered)
        self.assertNotIn("nothing to check", rendered)

    def test_a_project_with_no_registry_anywhere_says_it_is_off(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            report = lv.build_report(tmp)
            self.assertEqual(lv.render_human(report),
                             "Living specs are off in this repo; nothing to check.")


class ScenarioBulletsAreMarkdown(unittest.TestCase):
    """One unrecognised bullet refused a whole capability, so the shapes a
    person actually writes all have to be recognised."""

    def _halves(self, bullets):
        text = ("## Requirements\n\n### A rule\n\nProse.\n\n"
                "#### Scenario: s\n" + "\n".join(bullets) + "\n")
        return [f["code"] for f in lv.check_living_spec(text, "x.md", root=None)]

    def test_every_ordinary_bullet_shape_is_recognised(self):
        for pair in (["- **WHEN** a", "- **THEN** b"],
                     ["+ **WHEN** a", "+ **THEN** b"],
                     ["* **WHEN** a", "* **THEN** b"],
                     ["1. **WHEN** a", "2. **THEN** b"],
                     ["1) **WHEN** a", "2) **THEN** b"],
                     ["  - **WHEN** a", "  - **THEN** b"],
                     ["- *WHEN* a", "- *THEN* b"],
                     ["- WHEN a", "- THEN b"],
                     ["- GIVEN a", "- THEN b"],
                     ["1. WHEN a", "2. THEN b"],
                     ["- when a", "- then b"]):
            with self.subTest(bullets=pair):
                self.assertEqual(self._halves(pair), [])

    def test_a_missing_half_is_still_caught(self):
        self.assertEqual(self._halves(["+ **WHEN** a"]), ["scenario-missing-half"])
        self.assertEqual(self._halves(["+ WHEN a"]), ["scenario-missing-half"])
        self.assertEqual(self._halves(["- THEN b"]), ["scenario-missing-half"])

    def test_a_word_that_merely_starts_with_a_keyword_is_not_one(self):
        self.assertEqual(self._halves(["- Whenever a", "- Thence b"]),
                         ["scenario-missing-half"])


class TheMarkerCheckIsSkippedWhereItIsNotWanted(unittest.TestCase):
    """The fold takes this path before every write, and the marker check indexed
    the tree for a finding it discards."""

    def test_no_root_means_no_tree_is_indexed(self):
        text = ("## Requirements\n\n### A rule\n"
                "<!-- touches: src/nowhere/at/all/** -->\n\nProse.\n\n"
                "#### Scenario: s\n- **WHEN** a\n- **THEN** b\n")
        codes = [f["code"] for f in lv.check_living_spec(text, "x.md", root=None)]
        self.assertEqual(codes, [])

    def test_a_delta_check_asks_git_for_nothing(self):
        import subprocess

        calls = []
        real = subprocess.run

        def spy(*a, **k):
            calls.append(a[0] if a else None)
            return real(*a, **k)

        subprocess.run = spy
        try:
            lv._PATHS_CACHE.clear()
            lv.check_feature_deltas(
                "## ADDED Requirements\n\n### A rule\n"
                "<!-- touches: src/nowhere/** -->\n\n"
                "#### Scenario: s\n- **WHEN** a\n- **THEN** b\n",
                "spec.md", known_capabilities=[], target_texts={})
        finally:
            subprocess.run = real
        self.assertEqual(calls, [])


class FindingsAreOrdered(unittest.TestCase):
    def test_by_path_then_line_then_code(self):
        report = lv.build_report(str(REPO))
        keys = [(f["path"], f["line"], f["code"]) for f in report["findings"]]
        self.assertEqual(keys, sorted(keys))


if __name__ == "__main__":
    unittest.main()
